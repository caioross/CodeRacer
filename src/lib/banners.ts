// Estandartes de linguagem: assets, matemática do carousel infinito e a
// simulação de tecido pesado. Puro e sem DOM — o componente só integra e
// escreve transforms. Ver `banners.test.ts` e a issue #97.

import type { LangId } from "./languages";

/** Razão altura/largura dos assets em `public/banners/` (128×640). */
export const BANNER_RATIO = 5;

/** Caminho do estandarte de uma linguagem. */
export function bannerSrc(id: LangId | string): string {
  return `/banners/${id}.webp`;
}

// ─── Carousel infinito ────────────────────────────────────────────────────

/**
 * Traz `x` para a faixa `[-total/2, total/2)`. É o que torna o carousel
 * infinito: um item que sai pela direita reaparece pela esquerda sem que a
 * lista precise ser duplicada nem o offset precise ser reiniciado.
 */
export function wrapDelta(x: number, total: number): number {
  if (total <= 0) return 0;
  const m = ((x + total / 2) % total + total) % total;
  return m - total / 2;
}

/** Índice do item mais próximo do centro para um dado offset. */
export function nearestIndex(offset: number, pitch: number, count: number): number {
  if (count <= 0 || pitch <= 0) return 0;
  const raw = Math.round(offset / pitch);
  return ((raw % count) + count) % count;
}

/** Offset (px) que centraliza `index`, pelo caminho mais curto desde `from`. */
export function offsetForIndex(
  index: number,
  from: number,
  pitch: number,
  count: number
): number {
  const total = pitch * count;
  return from + wrapDelta(index * pitch - from, total);
}

/**
 * Passos de índice entre dois itens pelo caminho mais curto no anel — usado
 * pelo teclado e pelo clique para saber para que lado girar.
 */
export function stepsBetween(from: number, to: number, count: number): number {
  if (count <= 0) return 0;
  const d = (((to - from) % count) + count) % count;
  return d > count / 2 ? d - count : d;
}

/** Atrito exponencial do arremesso — independente do frame rate. */
export function decayVelocity(v: number, dt: number, friction = 3.2): number {
  return v * Math.exp(-friction * dt);
}

// ─── Tecido pesado ────────────────────────────────────────────────────────

/** Estado de balanço de um estandarte: ângulo e velocidade angular. */
export interface ClothState {
  theta: number; // rad — inclinação do pano em relação à haste
  omega: number; // rad/s
}

export const CLOTH_REST: ClothState = { theta: 0, omega: 0 };

/**
 * Parâmetros do tecido. O default é veludo/estandarte: oscilação lenta
 * (`omega0` baixo) e amortecimento alto (`zeta`), de modo que o pano acompanha
 * com atraso, dá UMA oscilação curta e volta ao repouso — nada de seda tremendo.
 */
export interface ClothParams {
  omega0: number; // rad/s — frequência natural
  zeta: number; // 0..1 — razão de amortecimento (>0.7 quase sem overshoot)
  accelGain: number; // quanto a aceleração do carousel inclina o pano
  dragGain: number; // arrasto residual: dá um leve rastro em movimento contínuo
  maxTheta: number; // rad — teto de inclinação (evita pano "quebrado")
}

export const HEAVY_CLOTH: ClothParams = {
  omega0: 7.2,
  zeta: 0.42,
  accelGain: 0.00055,
  dragGain: 0.00028,
  maxTheta: 0.42
};

/**
 * Um passo da simulação (Euler semi-implícito). Modelo: pêndulo amortecido
 * forçado pelo referencial não-inercial do carousel — só ACELERAÇÃO inclina o
 * pano, velocidade constante quase não (por isso o estandarte fica reto quando
 * o carousel corre liso e "chicoteia" ao frear). `dragGain` acrescenta o rastro
 * de arrasto, pequeno de propósito: tecido pesado quase não sente o ar.
 *
 * `dt` é limitado a 32ms para que um frame perdido (aba em background, GC) não
 * exploda a integração — sem isso o pano dispara ao voltar o foco.
 */
export function stepCloth(
  s: ClothState,
  drive: { accel: number; velocity: number },
  dt: number,
  p: ClothParams = HEAVY_CLOTH
): ClothState {
  const h = Math.min(Math.max(dt, 0), 0.032);
  if (h <= 0) return s;
  const force = -(drive.accel * p.accelGain + drive.velocity * p.dragGain);
  const omega =
    s.omega + h * (force - p.omega0 * p.omega0 * s.theta - 2 * p.zeta * p.omega0 * s.omega);
  const theta = clamp(s.theta + h * omega, -p.maxTheta, p.maxTheta);
  // No teto, zera a velocidade angular para o pano não "colar" empurrando.
  return { theta, omega: Math.abs(theta) >= p.maxTheta ? omega * 0.5 : omega };
}

/**
 * O estandarte pode parar de ser simulado? Em repouso o rAF é desligado
 * inteiro — é o que cumpre "praticamente imóveis quando o carousel está
 * parado" e o objetivo de performance da issue (nada roda à toa).
 */
export function isClothAtRest(s: ClothState, drive: { accel: number; velocity: number }): boolean {
  return (
    Math.abs(s.theta) < 1e-4 &&
    Math.abs(s.omega) < 1e-3 &&
    Math.abs(drive.accel) < 1 &&
    Math.abs(drive.velocity) < 1
  );
}

/**
 * Peso do balanço por faixa horizontal do pano, do topo (0) à ponta (1).
 * Perfil quadrático: a haste no topo não se move, e a curvatura cresce para
 * baixo — é o que dá a leitura de pano preso por cima em vez de imagem
 * inteira deslizando.
 */
export function bendProfile(segments: number): number[] {
  if (segments <= 1) return [0];
  return Array.from({ length: segments }, (_, i) => {
    const t = i / (segments - 1);
    return t * t;
  });
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
