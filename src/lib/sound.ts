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
