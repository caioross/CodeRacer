// Tiny Web Audio synth for keystroke sounds — zero assets, tunable, fast.
// A satisfying "thock": a low triangle body + a short bandpassed noise click,
// with slight per-press pitch variation. Mute is persisted in localStorage.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let muted = false;
let loaded = false;

const KEY = "coderacer:sound"; // value "off" => muted

function loadPref() {
  if (loaded) return;
  loaded = true;
  try {
    muted = localStorage.getItem(KEY) === "off";
  } catch {}
}

function ensure(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      const AC: typeof AudioContext =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      const len = Math.floor(ctx.sampleRate * 0.05);
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

export function isMuted(): boolean {
  loadPref();
  return muted;
}

export function setMuted(m: boolean) {
  loadPref();
  muted = m;
  try {
    localStorage.setItem(KEY, m ? "off" : "on");
  } catch {}
  if (!m) ensure(); // unlock the context when (re)enabling
}

/** A keyboard click. `strength` 0.6..1.2 lets errors sound heavier if desired. */
export function playKey(strength = 1) {
  loadPref();
  if (muted) return;
  const c = ensure();
  if (!c || !master || !noiseBuf) return;
  const now = c.currentTime;

  // body "thock"
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = "triangle";
  const base = (160 + Math.random() * 70) / strength;
  osc.frequency.setValueAtTime(base, now);
  osc.frequency.exponentialRampToValueAtTime(base * 0.6, now + 0.05);
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.16 * strength, now + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
  osc.connect(g).connect(master);
  osc.start(now);
  osc.stop(now + 0.07);

  // click transient
  const noise = c.createBufferSource();
  noise.buffer = noiseBuf;
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 2300 + Math.random() * 500;
  bp.Q.value = 0.9;
  const ng = c.createGain();
  ng.gain.setValueAtTime(0.22, now);
  ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.02);
  noise.connect(bp).connect(ng).connect(master);
  noise.start(now);
  noise.stop(now + 0.03);
}

/** Heavier, lower thunk for mistakes. */
export function playError() {
  loadPref();
  if (muted) return;
  const c = ensure();
  if (!c || !master) return;
  const now = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(110, now);
  osc.frequency.exponentialRampToValueAtTime(70, now + 0.08);
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.14, now + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
  osc.connect(g).connect(master);
  osc.start(now);
  osc.stop(now + 0.12);
}

// ── Sons de evento (programa 253, nov/2026) ────────────────────────────────────────
// Mesma filosofia: síntese na hora, zero arquivo, respeita o mudo. Nenhum destes roda
// por tecla — só em transições (contagem, largada, chegada, pódio, marco de sequência).

/** Uma nota curta com envelope ataque/queda. `type` e `gain` moldam o timbre. */
function note(
  c: AudioContext,
  freq: number,
  at: number,
  len: number,
  { type = "square", gain = 0.08 }: { type?: OscillatorType; gain?: number } = {}
) {
  if (!master) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, at + len);
  osc.connect(g).connect(master);
  osc.start(at);
  osc.stop(at + len + 0.02);
}

function withCtx(fn: (c: AudioContext, now: number) => void) {
  loadPref();
  if (muted) return;
  const c = ensure();
  if (!c || !master) return;
  fn(c, c.currentTime);
}

/** Bipe da contagem regressiva (3, 2, 1). */
export function playTick() {
  withCtx((c, now) => note(c, 660, now, 0.12, { type: "square", gain: 0.06 }));
}

/** Largada: bipe agudo e mais longo, com uma quinta por baixo. */
export function playGo() {
  withCtx((c, now) => {
    note(c, 1320, now, 0.32, { type: "square", gain: 0.07 });
    note(c, 880, now, 0.32, { type: "triangle", gain: 0.06 });
  });
}

/** Chegada (eu terminei): arpejo maior ascendente. */
export function playFinish() {
  withCtx((c, now) => {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      note(c, f, now + i * 0.075, 0.22, { type: "triangle", gain: 0.08 })
    );
  });
}

/** Pódio: fanfarra curta (só para quem ficou entre os 3 primeiros). */
export function playFanfare(place: 1 | 2 | 3 = 1) {
  withCtx((c, now) => {
    const base = place === 1 ? 1 : place === 2 ? 0.94 : 0.89;
    const seq: [number, number, number][] = [
      [523.25, 0, 0.14],
      [523.25, 0.15, 0.14],
      [523.25, 0.3, 0.14],
      [698.46, 0.45, 0.5]
    ];
    for (const [f, t, len] of seq) {
      note(c, f * base, now + t, len, { type: "square", gain: 0.05 });
      note(c, (f * base) / 2, now + t, len, { type: "triangle", gain: 0.05 });
    }
  });
}

/** Marco de sequência de acertos (25, 50, 100…): "plim" que sobe com o nível. */
export function playStreak(level: number) {
  withCtx((c, now) => {
    const f = 880 * Math.pow(2, Math.min(level, 6) / 12);
    note(c, f, now, 0.09, { type: "sine", gain: 0.06 });
    note(c, f * 1.5, now + 0.06, 0.14, { type: "sine", gain: 0.05 });
  });
}
