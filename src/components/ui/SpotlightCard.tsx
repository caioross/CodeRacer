"use client";

import { useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

// Card com um brilho radial que segue o cursor (docs/UI-AAA-OVERHAUL.md §III.1).
// Em reduced-motion, vira um brilho estático sutil no topo.
export function SpotlightCard({
  children,
  className,
  color = "0, 255, 136",
  size = 480
}: {
  children: React.ReactNode;
  className?: string;
  /** "r, g, b" — cor do brilho. Default = neon-green. */
  color?: string;
  size?: number;
}) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [active, setActive] = useState(false);

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    if (reduced) return;
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      className={cn("relative overflow-hidden", className)}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{
          opacity: reduced ? 0.4 : active ? 1 : 0,
          background: reduced
            ? `radial-gradient(${size}px circle at 50% 0%, rgba(${color}, 0.10), transparent 60%)`
            : `radial-gradient(${size}px circle at ${pos.x}px ${pos.y}px, rgba(${color}, 0.12), transparent 55%)`
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
