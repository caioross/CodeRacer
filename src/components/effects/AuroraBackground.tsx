"use client";

import { motion, useReducedMotion } from "framer-motion";

// Layered animated background for the home/title screen (docs §I.4 / §III.1).
// Aurora neon blobs drifting slowly + faded grid + vignette. Soft radial
// gradients (no blur filter) keep it GPU-cheap. Honors reduced-motion.
type Blob = {
  color: string; // "r,g,b"
  size: number;
  top: string;
  left: string;
  dx: number;
  dy: number;
  dur: number;
};

const BLOBS: Blob[] = [
  { color: "0,255,136", size: 640, top: "-14%", left: "6%", dx: 60, dy: 40, dur: 26 },
  { color: "0,229,255", size: 560, top: "26%", left: "60%", dx: -70, dy: 54, dur: 31 },
  { color: "168,85,247", size: 480, top: "60%", left: "18%", dx: 54, dy: -64, dur: 35 }
];

export function AuroraBackground() {
  const reduced = useReducedMotion();
  return (
    <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden bg-bg">
      {BLOBS.map((b, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full mix-blend-screen will-change-transform"
          style={{
            top: b.top,
            left: b.left,
            width: b.size,
            height: b.size,
            background: `radial-gradient(circle at center, rgba(${b.color},0.55), rgba(${b.color},0.16) 36%, transparent 70%)`,
            filter: "blur(36px)"
          }}
          animate={reduced ? undefined : { x: [0, b.dx, 0], y: [0, b.dy, 0], scale: [1, 1.12, 1] }}
          transition={
            reduced
              ? undefined
              : { duration: b.dur, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }
          }
        />
      ))}

      {/* faded perspective-less grid */}
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.045) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 25%, transparent 75%)",
          maskImage: "radial-gradient(ellipse at center, black 25%, transparent 75%)"
        }}
      />

      {/* vignette keeps the center readable */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 30%, rgba(5,6,10,0.5) 78%, rgba(5,6,10,0.92) 100%)"
        }}
      />
    </div>
  );
}
