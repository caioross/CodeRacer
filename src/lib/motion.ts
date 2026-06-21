// Motion system — single source of truth for animation timing across the app.
// See docs/UI-AAA-OVERHAUL.md §I.3. Durations are in SECONDS (framer-motion convention).
import type { Transition } from "framer-motion";

type Bezier = [number, number, number, number];

/** Named easing curves (cubic-bezier) for framer-motion `ease`. */
export const ease = {
  outQuad: [0.25, 0.46, 0.45, 0.94] as Bezier,
  outExpo: [0.16, 1, 0.3, 1] as Bezier,
  inOutQuart: [0.76, 0, 0.24, 1] as Bezier,
  backOut: [0.34, 1.56, 0.64, 1] as Bezier,
  inQuad: [0.55, 0.085, 0.68, 0.53] as Bezier
};

/** Same curves as CSS strings (for transitions outside framer-motion). */
export const easeCss = {
  outQuad: "cubic-bezier(0.25,0.46,0.45,0.94)",
  outExpo: "cubic-bezier(0.16,1,0.3,1)",
  inOutQuart: "cubic-bezier(0.76,0,0.24,1)",
  backOut: "cubic-bezier(0.34,1.56,0.64,1)",
  inQuad: "cubic-bezier(0.55,0.085,0.68,0.53)"
};

/** Duration tokens (seconds). */
export const dur = {
  instant: 0.08,
  fast: 0.15,
  base: 0.25,
  slow: 0.4,
  slower: 0.6,
  cinematic: 0.9
};

/** Spring presets (framer-motion). */
export const spring: Record<"snappy" | "smooth" | "bouncy" | "gentle" | "caret", Transition> = {
  snappy: { type: "spring", stiffness: 400, damping: 30 },
  smooth: { type: "spring", stiffness: 200, damping: 26 },
  bouncy: { type: "spring", stiffness: 300, damping: 18 },
  gentle: { type: "spring", stiffness: 120, damping: 22 },
  caret: { type: "spring", stiffness: 700, damping: 40 }
};

/** Ready-to-spread props for a fade + rise entrance. */
export function fadeUp(delay = 0, y = 12) {
  return {
    initial: { opacity: 0, y },
    animate: { opacity: 1, y: 0 },
    transition: { duration: dur.slow, ease: ease.outExpo, delay }
  };
}

/** Container that staggers its children (use with `staggerItem` on each child). */
export function staggerContainer(staggerChildren = 0.06, delayChildren = 0) {
  return {
    initial: "hidden" as const,
    animate: "show" as const,
    variants: {
      hidden: {},
      show: { transition: { staggerChildren, delayChildren } }
    }
  };
}

/** Variant pair for a child inside a `staggerContainer`. */
export const staggerItem = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: dur.base, ease: ease.outExpo } }
};
