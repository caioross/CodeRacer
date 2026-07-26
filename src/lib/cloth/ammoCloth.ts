// Motor de tecido pesado: soft-body do ammo (Bullet) desenhado com three.js.
// Decisão do dono na PR #98 (núcleo §7.1): a dependência pesada foi autorizada.
//
// Este módulo é SEMPRE carregado por `import()` dinâmico e nunca é importado
// no topo de um componente — é o que mantém three + ammo fora do first-load da
// home. Se o import falhar, se não houver WebGL ou se o usuário pedir
// reduced-motion, o carousel continua no motor analítico (`stepCloth`), que não
// tem dependência nenhuma.
//
// Física em unidades de mundo com o estandarte medindo 1.0 de altura; a
// colocação em pixels é do carousel. Assim o tecido nunca "viaja" pela gôndola
// e o wrap infinito do carousel não chega a chacoalhar o pano.

import type { ClothDrive, ClothEngine, SlotView } from "./types";

/** Nós por estandarte. 5×12 = 60 nós dá curvatura suficiente em ~50px de largura. */
const SEG_X = 4;
const SEG_Y = 11;
/** Altura do estandarte em unidades de mundo. */
const UNIT_H = 1;
/** Meia largura em unidades de mundo (razão 1:5 dos assets). */
const HALF_W = UNIT_H / 10;
/**
 * Quanto da aceleração da gôndola vira pseudo-força no pano. A gôndola acelera
 * na ordem de 4800 px/s²; com o estandarte medindo ~245px isso daria ~19.6 de
 * aceleração em unidades de mundo, contra 9.8 de gravidade — o pano ficaria na
 * horizontal. Este ganho traz o pico para ~4.3, isto é, ~24° de inclinação —
 * medido em ~12px de atraso na ponta, a mesma leitura do motor leve.
 */
const ACCEL_GAIN = 0.22;
/** Rastro de arrasto em movimento contínuo — pequeno: veludo quase não sente o ar. */
const DRAG_GAIN = 0.02;
/** Velocidade (unidades de mundo/s) abaixo da qual o pano conta como parado. */
const REST_SPEED = 0.01;
/** Quadros calmos seguidos exigidos antes de desligar o rAF. */
const REST_FRAMES = 15;

type AmmoNS = any;

interface Cloth {
  body: any;
  mesh: any;
  active: boolean;
  nodes: any;
}

/**
 * Cria o motor. Lança se o ambiente não suportar — quem chama trata e continua
 * no motor leve.
 */
export async function createAmmoCloth(
  canvas: HTMLCanvasElement,
  bannerUrls: string[]
): Promise<ClothEngine> {
  const [THREE, AmmoFactory] = await Promise.all([
    import("three"),
    import("ammojs-typed").then(m => (m.default ?? m) as any)
  ]);
  const Ammo: AmmoNS = await AmmoFactory();

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: "low-power"
  });
  renderer.setClearAlpha(0);
  renderer.setPixelRatio(Math.min(typeof devicePixelRatio === "number" ? devicePixelRatio : 1, 2));

  const scene = new THREE.Scene();
  // Câmera ortográfica em PIXELS da gôndola: o carousel continua raciocinando
  // em px e nada precisa converter coordenada.
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -100, 100);
  camera.position.z = 10;

  // ─── Mundo de física ────────────────────────────────────────────────────
  const cfg = new Ammo.btSoftBodyRigidBodyCollisionConfiguration();
  const dispatcher = new Ammo.btCollisionDispatcher(cfg);
  const broadphase = new Ammo.btDbvtBroadphase();
  const solver = new Ammo.btSequentialImpulseConstraintSolver();
  const softSolver = new Ammo.btDefaultSoftBodySolver();
  const world = new Ammo.btSoftRigidDynamicsWorld(dispatcher, broadphase, solver, cfg, softSolver);
  world.setGravity(new Ammo.btVector3(0, -9.8, 0));
  world.getWorldInfo().set_m_gravity(new Ammo.btVector3(0, -9.8, 0));

  const helpers = new Ammo.btSoftBodyHelpers();
  const loader = new THREE.TextureLoader();
  const clothes: Cloth[] = [];
  const nodeCount = (SEG_X + 1) * (SEG_Y + 1);

  for (const url of bannerUrls) {
    const c00 = new Ammo.btVector3(-HALF_W, UNIT_H, 0);
    const c10 = new Ammo.btVector3(HALF_W, UNIT_H, 0);
    const c01 = new Ammo.btVector3(-HALF_W, 0, 0);
    const c11 = new Ammo.btVector3(HALF_W, 0, 0);
    const body = helpers.CreatePatch(
      world.getWorldInfo(),
      c00,
      c10,
      c01,
      c11,
      SEG_X + 1,
      SEG_Y + 1,
      0,
      true
    );
    const sb = body.get_m_cfg();
    // Veludo: muitas iterações (pouca elasticidade), amortecimento alto, sem
    // vento. É o que separa "estandarte" de "seda ao vento".
    sb.set_viterations(12);
    sb.set_piterations(12);
    // CUIDADO: `kDP` é aplicado como `v *= (1 - kDP)` a CADA substep, não por
    // segundo. A 120Hz, 0.12 vira ~4e-7 por segundo e o pano fica inerte — foi
    // exatamente o que aconteceu na primeira tentativa (ponta andava 0.4px sob
    // estímulo forte). 0.01 dá veludo amortecido que ainda se move.
    sb.set_kDP(0.02);
    sb.set_kDF(0.2);
    const mat = body.get_m_materials().at(0);
    mat.set_m_kLST(0.95); // rigidez linear: quase inextensível
    mat.set_m_kAST(0.95);
    body.setTotalMass(1, false);
    Ammo.castObject(body, Ammo.btCollisionObject)
      .getCollisionShape()
      .setMargin(0.01);
    body.setActivationState(4); // DISABLE_DEACTIVATION
    // Prende a linha de cima na haste.
    for (let i = 0; i <= SEG_X; i++) body.setMass(i, 0);

    const geo = new THREE.PlaneGeometry(2 * HALF_W, UNIT_H, SEG_X, SEG_Y);
    const tex = loader.load(url);
    tex.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(geo, material);
    mesh.visible = false;
    scene.add(mesh);
    clothes.push({ body, mesh, active: false, nodes: body.get_m_nodes() });
  }

  const force = new Ammo.btVector3(0, 0, 0);
  let width = 1;
  let height = 1;
  /** Altura em px do estandarte central — converte px/s² para unidades de mundo. */
  let refHeight = 245;
  /** Contador de histerese do repouso (ver `atRest`). */
  let calmFrames = 0;

  /** Copia as posições dos nós do soft-body para os vértices da malha. */
  function syncGeometry(c: Cloth) {
    const pos = c.mesh.geometry.attributes.position;
    const arr = pos.array as Float32Array;
    for (let i = 0; i < nodeCount; i++) {
      const p = c.nodes.at(i).get_m_x();
      arr[3 * i] = p.x();
      arr[3 * i + 1] = p.y() - UNIT_H; // topo do patch vira a origem do mesh
      arr[3 * i + 2] = p.z();
    }
    pos.needsUpdate = true;
  }

  const engine: ClothEngine = {
    resize(w, h) {
      width = Math.max(1, w);
      height = Math.max(1, h);
      renderer.setSize(width, height, false);
      camera.left = -width / 2;
      camera.right = width / 2;
      camera.top = height / 2;
      camera.bottom = -height / 2;
      camera.updateProjectionMatrix();
    },

    setSlots(slots) {
      const seen = new Set<number>();
      for (const s of slots) {
        const c = clothes[s.index];
        if (!c) continue;
        seen.add(s.index);
        if (!c.active) {
          world.addSoftBody(c.body, 1, -1);
          c.active = true;
          c.mesh.visible = true;
        }
        // A malha vive em unidades de mundo com o topo na origem e a ponta em
        // y = -1; a escala converte isso para os pixels que o carousel pediu, e
        // a posição é a própria haste (topo do estandarte).
        c.mesh.position.set(s.x, height / 2 - s.topY, 0);
        c.mesh.scale.set(s.w / (2 * HALF_W), s.h, s.h);
        if (s.centered) refHeight = s.h;
        const m = c.mesh.material as any;
        // Reproduz em WebGL o realce que no motor leve era filtro CSS. O
        // escolhido ganha luz esverdeada em vez de anel: um contorno
        // retangular devolveria a moldura que a #99 mandou tirar, e a malha
        // deformada nem é mais um retângulo.
        if (s.checked) m.color.setRGB(1.14, 1.4, 1.24);
        else if (s.centered) m.color.setRGB(1.14, 1.14, 1.14);
        else m.color.setRGB(0.5, 0.5, 0.5);
        m.opacity = s.opacity;
      }
      for (let i = 0; i < clothes.length; i++) {
        const c = clothes[i];
        if (c.active && !seen.has(i)) {
          world.removeSoftBody(c.body);
          c.active = false;
          c.mesh.visible = false;
        }
      }
    },

    step(dt, drive) {
      // Pseudo-força do referencial não-inercial da gôndola: só ACELERAÇÃO
      // inclina o pano; velocidade constante quase não (só o arrasto).
      const a = -(drive.accel * ACCEL_GAIN + drive.velocity * DRAG_GAIN) / Math.max(refHeight, 1);
      const perNode = a / nodeCount;
      for (const c of clothes) {
        if (!c.active) continue;
        force.setValue(perNode, 0, 0);
        c.body.addForce(force);
      }
      world.stepSimulation(Math.min(dt, 1 / 30), 2, 1 / 120);
      for (const c of clothes) if (c.active) syncGeometry(c);
    },

    render() {
      renderer.render(scene, camera);
    },

    atRest(drive) {
      if (Math.abs(drive.accel) > 1 || Math.abs(drive.velocity) > 1) {
        calmFrames = 0;
        return false;
      }
      // Percorre TODOS os nós, não um só: a velocidade de qualquer nó passa por
      // zero a cada extremo do balanço, e amostrar um único nó fazia o rAF
      // dormir no meio da oscilação, congelando o pano torto.
      let maxV = 0;
      for (const c of clothes) {
        if (!c.active) continue;
        for (let i = SEG_X + 1; i < nodeCount; i++) {
          const v = c.nodes.at(i).get_m_v();
          const sp = Math.abs(v.x()) + Math.abs(v.y());
          if (sp > maxV) maxV = sp;
        }
      }
      // Histerese: só dorme depois de alguns quadros seguidos calmo, senão o
      // instante de inversão do balanço seria confundido com repouso.
      calmFrames = maxV < REST_SPEED ? calmFrames + 1 : 0;
      return calmFrames >= REST_FRAMES;
    },

    dispose() {
      for (const c of clothes) {
        if (c.active) world.removeSoftBody(c.body);
        c.mesh.geometry.dispose();
        (c.mesh.material as any).map?.dispose();
        (c.mesh.material as any).dispose();
      }
      renderer.dispose();
    }
  };

  return engine;
}
