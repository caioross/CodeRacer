"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n } from "@/i18n/client";
import { playTick } from "@/lib/sound";

export function Countdown({ n }: { n: number }) {
  const { t } = useI18n();
  // Bipe a cada número (o "GO" toca quando a pista aparece, no Race).
  useEffect(() => {
    if (n > 0) playTick();
  }, [n]);
  const label = n > 0 ? String(n) : "GO!";
  const color =
    n === 0 ? "text-neon-green glow-text-green" : "text-neon-cyan glow-text-cyan";
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={n}
        initial={{ scale: 0.4, opacity: 0, rotate: -8 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        exit={{ scale: 1.6, opacity: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="text-center"
      >
        <div className={`font-mono font-extrabold text-[160px] md:text-[220px] leading-none ${color}`}>
          {label}
        </div>
        <p className="mt-4 text-text-muted text-sm tracking-widest uppercase">
          {n > 0 ? t("countdown.getSet") : t("countdown.go")}
        </p>
      </motion.div>
    </AnimatePresence>
  );
}
