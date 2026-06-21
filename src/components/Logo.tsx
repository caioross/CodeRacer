"use client";

import { motion } from "framer-motion";
import { DecryptedText } from "./effects/DecryptedText";

export function Logo({
  size = "lg",
  decrypt = false
}: {
  size?: "sm" | "md" | "lg" | "xl";
  decrypt?: boolean;
}) {
  const sizes = {
    sm: { text: "text-xl", icon: "text-lg" },
    md: { text: "text-3xl", icon: "text-2xl" },
    lg: { text: "text-5xl md:text-6xl", icon: "text-4xl md:text-5xl" },
    xl: { text: "text-6xl md:text-8xl", icon: "text-5xl md:text-7xl" }
  };
  const s = sizes[size];
  return (
    <div className="inline-flex items-center gap-2 select-none">
      <motion.span
        className={`font-mono font-bold ${s.icon} text-neon-green glow-text-green`}
        animate={{ opacity: [1, 0.3, 1] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
      >
        &gt;_
      </motion.span>
      <span className={`font-mono font-extrabold tracking-tight ${s.text}`}>
        {decrypt ? (
          <>
            <DecryptedText text="Code" className="gradient-text" durationMs={700} />
            <DecryptedText text="Racer" className="text-text" durationMs={900} />
          </>
        ) : (
          <>
            <span className="gradient-text">Code</span>
            <span className="text-text">Racer</span>
          </>
        )}
      </span>
    </div>
  );
}
