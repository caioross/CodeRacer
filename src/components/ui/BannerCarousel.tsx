"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { LANGUAGES, type LangId } from "@/lib/languages";
import {
  BANNER_RATIO,
  CLOTH_REST,
  HEAVY_CLOTH,
  bannerSrc,
  bendProfile,
  decayVelocity,
  isClothAtRest,
  nearestIndex,
  offsetForIndex,
  stepCloth,
  wrapDelta,
  type ClothParams,
  type ClothState
} from "@/lib/banners";

/** Faixas horizontais por estandarte — a malha do pano. */
const SEGMENTS = 9;
/** Espaçamento entre estandartes, em múltiplos da largura. */
const PITCH_FACTOR = 1.22;
/** Balanço máximo da ponta, em múltiplos da largura do estandarte. */
const SWAY_FACTOR = 0.55;
/** Altura reservada para a haste no topo da gôndola (px). */
const GONDOLA_INSET = 18;
/** Abaixo disto o arremesso acabou e o carousel encaixa (px/s). */
const FLING_FLOOR = 60;

interface Props {
  /** Linguagem escolhida, ou `null` quando ainda não há escolha (votação). */
  value: LangId | null;
  onChange: (id: LangId) => void;
  /**
   * `true` (padrão): o estandarte que para no centro vira a escolha — natural
   * para um seletor. `false`: centralizar só navega, e a escolha exige clique
   * ou Enter — é o que a votação do lobby precisa, senão passar o dedo pela
   * gôndola votaria em cada linguagem que cruzasse o centro.
   */
  commitOnSettle?: boolean;
  /** Contagem por linguagem, exibida como selo sobre o estandarte. */
  badges?: Record<string, number>;
  /** Linguagens em primeiro lugar — selo dourado. */
  leadingIds?: string[];
  /** id de um <label> externo, para o radiogroup ser anunciado com nome. */
  labelledBy?: string;
}

/** Cada estandarte tem massa/rigidez ligeiramente diferente (índice = semente). */
function paramsFor(i: number): ClothParams {
  const j = ((i * 2654435761) % 1000) / 1000; // hash determinístico em [0,1)
  return {
    ...HEAVY_CLOTH,
    omega0: HEAVY_CLOTH.omega0 * (0.9 + 0.2 * j),
    accelGain: HEAVY_CLOTH.accelGain * (0.88 + 0.24 * (1 - j)),
    zeta: HEAVY_CLOTH.zeta * (0.94 + 0.12 * j)
  };
}

/**
 * Gôndola infinita de estandartes (#97) — substitui a grade de cards na escolha
 * de linguagem.
 *
 * Arquitetura: TODA a animação roda num único rAF que escreve `transform`
 * direto nos nós (refs). O React só re-renderiza quando muda a seleção ou o
 * foco — arrastar não causa nenhum re-render. O loop se desliga sozinho quando
 * o carousel para e os panos assentam (`isClothAtRest`), então a gôndola parada
 * custa exatamente zero por frame.
 *
 * O pano é um pêndulo amortecido por estandarte (`stepCloth`), com a malha
 * cisalhada em `SEGMENTS` faixas por um perfil quadrático: a haste no topo não
 * se move e a ponta responde por todo o balanço.
 */
export function BannerCarousel({
  value,
  onChange,
  commitOnSettle = true,
  badges,
  leadingIds,
  labelledBy
}: Props) {
  const reduced = useReducedMotion();
  const count = LANGUAGES.length;
  const checkedIndex = useMemo(
    () => (value ? LANGUAGES.findIndex(l => l.id === value) : -1),
    [value]
  );
  const homeIndex = checkedIndex < 0 ? 0 : checkedIndex;

  const viewportRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const stripRefs = useRef<(HTMLSpanElement | null)[][]>([]);

  // Estado da simulação vive em refs: muda a 60fps e não deve tocar o React.
  const offsetRef = useRef(0);
  const targetRef = useRef<number | null>(null);
  const velRef = useRef(0);
  const lastVelRef = useRef(0);
  const clothRef = useRef<ClothState[]>(LANGUAGES.map(() => ({ ...CLOTH_REST })));
  const draggingRef = useRef(false);
  const movedRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef(0);
  const geomRef = useRef({ w: 52, pitch: 64, half: 200 });

  const [focusIndex, setFocusIndexState] = useState(homeIndex);
  // Espelho em ref: o teclado calcula o próximo índice a partir do atual, e
  // repetição rápida de seta dispara vários keydown antes de um único
  // re-render — lendo só o state, todos partiriam do mesmo valor e a gôndola
  // andaria uma casa só.
  const focusRef = useRef(homeIndex);
  const setFocusIndex = useCallback((i: number) => {
    focusRef.current = i;
    setFocusIndexState(i);
  }, []);
  const profile = useMemo(() => bendProfile(SEGMENTS), []);

  // O rAF é criado uma vez; tudo que ele lê do render atual passa por ref,
  // senão o loop congela o `value`/`onChange` da primeira renderização.
  const settleRef = useRef<() => void>(() => {});

  const measure = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    // A haste ocupa o topo; o pano é o que sobra da altura da viewport.
    const h = Math.max(el.clientHeight - GONDOLA_INSET, 1);
    const w = h / BANNER_RATIO;
    geomRef.current = { w, pitch: w * PITCH_FACTOR, half: el.clientWidth / 2 };
    // Largura do estandarte vira variável CSS: o layout acompanha o resize sem
    // que o React precise re-renderizar.
    el.style.setProperty("--banner-w", `${w}px`);
  }, []);

  /** Escreve a pose de todos os estandartes. Chamado pelo rAF e no layout. */
  const paint = useCallback(() => {
    // Remede a cada quadro: uma leitura de clientHeight não invalida layout
    // (só escrevemos `transform` depois) e mantém a gôndola correta mesmo se o
    // ResizeObserver não entregar — rotação de tela, modal reabrindo, zoom.
    measure();
    const { w, pitch, half } = geomRef.current;
    const total = pitch * count;
    const offset = offsetRef.current;
    for (let i = 0; i < count; i++) {
      const el = itemRefs.current[i];
      if (!el) continue;
      const x = wrapDelta(i * pitch - offset, total);
      const dist = Math.abs(x) / pitch;
      // Perto do centro cresce e ganha luz; longe, recua para a penumbra.
      // O centro fica em 1.0 (não mais): com `origin-top`, qualquer escala >1
      // cresceria para baixo e a ponta do estandarte seria cortada pelo
      // `overflow-hidden` da gôndola.
      const scale = 1 - Math.min(dist, 3) * 0.1;
      el.style.transform = `translate3d(${x}px,0,0) scale(${scale})`;
      el.style.opacity = String(Math.max(0.34, 1 - dist * 0.2));
      el.style.zIndex = String(100 - Math.round(dist * 10));
      el.dataset.centered = dist < 0.5 ? "true" : "false";
      // Largura em px: a razão do estandarte não pode depender de `--banner-w`
      // ter chegado, senão um quadro com a variável velha exibe pano esticado.
      el.style.width = `${w}px`;
      el.style.marginLeft = `${-w / 2}px`;

      // Fora da viewport o pano não é repintado.
      const strips = stripRefs.current[i];
      if (!strips || Math.abs(x) > half + pitch) continue;
      const sway = clothRef.current[i].theta * w * SWAY_FACTOR;
      for (let s = 0; s < strips.length; s++) {
        const node = strips[s];
        if (node) node.style.transform = `translate3d(${sway * profile[s]}px,0,0)`;
      }
    }
  }, [count, measure, profile]);

  /** Liga o loop; ele se desliga sozinho quando tudo assenta. */
  const wake = useCallback(() => {
    if (rafRef.current != null) return;
    lastTsRef.current = 0;
    const tick = (ts: number) => {
      const dt = lastTsRef.current ? Math.min((ts - lastTsRef.current) / 1000, 0.05) : 1 / 60;
      lastTsRef.current = ts;

      if (!draggingRef.current) {
        const target = targetRef.current;
        if (target != null) {
          // Aproximação exponencial do alvo: sem overshoot, independe de fps.
          const k = 1 - Math.exp(-11 * dt);
          const next = offsetRef.current + (target - offsetRef.current) * k;
          velRef.current = dt > 0 ? (next - offsetRef.current) / dt : 0;
          offsetRef.current = next;
          if (Math.abs(target - offsetRef.current) < 0.3) {
            offsetRef.current = target;
            targetRef.current = null;
            velRef.current = 0;
            settleRef.current();
          }
        } else if (Math.abs(velRef.current) > 1) {
          offsetRef.current += velRef.current * dt;
          velRef.current = decayVelocity(velRef.current, dt);
          if (Math.abs(velRef.current) <= FLING_FLOOR) {
            // Arremesso terminou → encaixa no estandarte mais próximo.
            velRef.current = 0;
            const { pitch } = geomRef.current;
            const i = nearestIndex(offsetRef.current, pitch, count);
            targetRef.current = offsetForIndex(i, offsetRef.current, pitch, count);
          }
        }
      }

      const accel = dt > 0 ? (velRef.current - lastVelRef.current) / dt : 0;
      lastVelRef.current = velRef.current;

      const drive = { accel, velocity: velRef.current };
      let resting = !draggingRef.current && targetRef.current == null;
      if (reduced) {
        // Sem movimento de pano: os estandartes ficam retos.
        if (Math.abs(velRef.current) > 1) resting = false;
      } else {
        for (let i = 0; i < count; i++) {
          clothRef.current[i] = stepCloth(clothRef.current[i], drive, dt, paramsFor(i));
          if (!isClothAtRest(clothRef.current[i], drive)) resting = false;
        }
      }
      paint();

      if (resting) {
        rafRef.current = null; // dorme: zero custo com a gôndola parada
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [count, paint, reduced]);

  /** Centraliza um índice pelo caminho mais curto do anel. */
  const centerTo = useCallback(
    (i: number, immediate = false) => {
      const { pitch } = geomRef.current;
      const target = offsetForIndex(i, offsetRef.current, pitch, count);
      velRef.current = 0;
      if (immediate || reduced) {
        offsetRef.current = target;
        targetRef.current = null;
        paint();
        return;
      }
      targetRef.current = target;
      wake();
    },
    [count, paint, reduced, wake]
  );

  /** Escolhe de fato (clique/Enter): centraliza e publica. */
  const select = useCallback(
    (i: number) => {
      const lang = LANGUAGES[i];
      if (!lang) return;
      setFocusIndex(i);
      centerTo(i);
      if (lang.id !== value) onChange(lang.id);
    },
    [centerTo, onChange, setFocusIndex, value]
  );

  // O que acontece quando a rolagem assenta. Guardado em ref para o rAF sempre
  // enxergar o `value`/`onChange` do render atual.
  settleRef.current = () => {
    const { pitch } = geomRef.current;
    const i = nearestIndex(offsetRef.current, pitch, count);
    setFocusIndex(i);
    if (!commitOnSettle) return;
    const lang = LANGUAGES[i];
    if (lang && lang.id !== value) onChange(lang.id);
  };

  // Geometria: mede no layout e a cada resize.
  useEffect(() => {
    measure();
    offsetRef.current = homeIndex * geomRef.current.pitch;
    paint();
    const el = viewportRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      const i = nearestIndex(offsetRef.current, geomRef.current.pitch, count);
      measure();
      offsetRef.current = i * geomRef.current.pitch;
      paint();
    });
    ro.observe(el);
    return () => ro.disconnect();
    // Só na montagem: reposicionar a gôndola a cada mudança de prop brigaria
    // com o arrasto do usuário.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Escolha vinda de fora (o líder trocou a linguagem via Realtime, p. ex.).
  useEffect(() => {
    if (draggingRef.current || checkedIndex < 0) return;
    const { pitch } = geomRef.current;
    if (nearestIndex(offsetRef.current, pitch, count) === checkedIndex) return;
    centerTo(checkedIndex);
    setFocusIndex(checkedIndex);
  }, [checkedIndex, count, centerTo]);

  useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    },
    []
  );

  // ─── Arrasto (mouse e touch pelo mesmo caminho) ─────────────────────────
  const dragRef = useRef({ x: 0, t: 0 });

  const onPointerDown = (e: React.PointerEvent) => {
    draggingRef.current = true;
    movedRef.current = 0;
    dragRef.current = { x: e.clientX, t: e.timeStamp };
    targetRef.current = null;
    velRef.current = 0;
    e.currentTarget.setPointerCapture(e.pointerId);
    wake();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    const dx = e.clientX - dragRef.current.x;
    const dt = Math.max((e.timeStamp - dragRef.current.t) / 1000, 1 / 240);
    dragRef.current = { x: e.clientX, t: e.timeStamp };
    movedRef.current += Math.abs(dx);
    offsetRef.current -= dx;
    velRef.current = -dx / dt;
    wake();
  };

  const endDrag = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (reduced || Math.abs(velRef.current) <= FLING_FLOOR) {
      const { pitch } = geomRef.current;
      const i = nearestIndex(offsetRef.current, pitch, count);
      centerTo(i, !!reduced);
      if (reduced) settleRef.current();
    }
    wake();
  };

  const onWheel = (e: React.WheelEvent) => {
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (!d) return;
    targetRef.current = null;
    offsetRef.current += d;
    velRef.current = d * 8;
    wake();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    let next = -1;
    if (step) next = (((focusRef.current + step) % count) + count) % count;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = count - 1;
    if (next < 0) return;
    e.preventDefault();
    setFocusIndex(next);
    itemRefs.current[next]?.focus();
    // Navegar pelo teclado escolhe quando o centro é a escolha; na votação,
    // navegar só move o foco e o voto sai no Enter/Espaço (clique do botão).
    if (commitOnSettle) select(next);
    else centerTo(next);
  };

  const selected = checkedIndex >= 0 ? LANGUAGES[checkedIndex] : null;

  return (
    <div className="select-none">
      <div
        ref={viewportRef}
        role="radiogroup"
        aria-labelledby={labelledBy}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onWheel={onWheel}
        className={
          "banner-gondola relative h-[210px] sm:h-[268px] overflow-hidden rounded-lg " +
          "border border-bg-line bg-bg " +
          "cursor-grab active:cursor-grabbing"
        }
        style={{ touchAction: "pan-y" }}
      >
        {/* A haste da gôndola: os estandartes pendem dela. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-[6px] z-[200] h-[3px] bg-gradient-to-r from-transparent via-amber-700/70 to-transparent"
        />
        <div className="absolute left-1/2 top-0 h-full w-0">
          {LANGUAGES.map((l, i) => {
            const votes = badges?.[l.id] ?? 0;
            const leading = !!leadingIds?.includes(l.id);
            return (
              <button
                key={l.id}
                ref={el => {
                  itemRefs.current[i] = el;
                }}
                type="button"
                role="radio"
                aria-checked={i === checkedIndex}
                aria-label={votes ? `${l.label} — ${votes} voto${votes > 1 ? "s" : ""}` : l.label}
                tabIndex={i === focusIndex ? 0 : -1}
                onFocus={() => setFocusIndex(i)}
                onClick={() => {
                  // Um arrasto que terminou sobre o item não é um clique.
                  if (movedRef.current > 6) return;
                  select(i);
                }}
                className="banner-item absolute origin-top focus-visible:outline-none"
                style={{
                  top: `${GONDOLA_INSET}px`,
                  left: 0,
                  width: "var(--banner-w, 52px)",
                  height: `calc(100% - ${GONDOLA_INSET}px)`,
                  marginLeft: "calc(var(--banner-w, 52px) / -2)"
                }}
              >
                {/* Fundo preto sob as faixas: o pano cisalha ao balançar e um
                    fio de subpixel entre faixas some contra o preto da arte. */}
                <span className="banner-cloth relative block h-full w-full overflow-hidden rounded-[2px] bg-black">
                  {profile.map((_, s) => (
                    <span
                      key={s}
                      ref={el => {
                        if (!stripRefs.current[i]) stripRefs.current[i] = [];
                        stripRefs.current[i][s] = el;
                      }}
                      aria-hidden
                      className="absolute left-0 block w-full"
                      style={{
                        top: `${(s * 100) / SEGMENTS}%`,
                        height: `${100 / SEGMENTS}%`,
                        backgroundImage: `url(${bannerSrc(l.id)})`,
                        backgroundSize: `100% ${SEGMENTS * 100}%`,
                        backgroundPosition: `0 ${(s * 100) / (SEGMENTS - 1)}%`
                      }}
                    />
                  ))}
                </span>
                {votes > 0 && (
                  <span
                    aria-hidden
                    className={
                      "absolute -top-1 -right-1 grid h-4 min-w-[16px] place-items-center rounded-full px-1 text-[9px] font-bold tabular-nums " +
                      (leading ? "bg-neon-amber text-bg" : "bg-bg-line text-text")
                    }
                  >
                    {votes}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-center gap-2 font-mono text-xs">
        <span className="text-neon-green">{selected ? selected.label : "—"}</span>
        {selected && (
          <span className="text-text-dim tabular-nums">
            {checkedIndex + 1}/{count}
          </span>
        )}
      </div>
    </div>
  );
}
