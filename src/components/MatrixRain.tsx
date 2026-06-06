"use client";

import { useEffect, useRef } from "react";

/**
 * Subtle matrix rain background, low opacity so it doesn't compete with content.
 */
export function MatrixRain({ opacity = 0.07 }: { opacity?: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const chars = "アァカサタナハマヤラワ0123456789{}[]()=>;:.,/<>+-*&|!?$";
    const fontSize = 14;
    let columns = 0;
    let drops: number[] = [];
    let rafId = 0;
    let lastTick = 0;

    const resize = () => {
      const { innerWidth: w, innerHeight: h } = window;
      canvas.width = w;
      canvas.height = h;
      columns = Math.floor(w / fontSize);
      drops = new Array(columns).fill(0).map(() => Math.random() * -50);
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = (t: number) => {
      if (t - lastTick < 60) {
        rafId = requestAnimationFrame(draw);
        return;
      }
      lastTick = t;
      ctx.fillStyle = "rgba(5, 6, 10, 0.18)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = `rgba(0, 255, 136, ${opacity * 3})`;
      ctx.font = `${fontSize}px JetBrains Mono, monospace`;
      for (let i = 0; i < drops.length; i++) {
        const ch = chars[Math.floor(Math.random() * chars.length)];
        const x = i * fontSize;
        const y = drops[i] * fontSize;
        ctx.fillText(ch, x, y);
        if (y > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }
      rafId = requestAnimationFrame(draw);
    };
    rafId = requestAnimationFrame(draw);
    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(rafId);
    };
  }, [opacity]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="fixed inset-0 -z-10 pointer-events-none"
      style={{ opacity }}
    />
  );
}
