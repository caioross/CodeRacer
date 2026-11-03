"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

type Toast = { id: number; text: string; kind: "info" | "error" | "success" };

const ToastContext = createContext<{
  push: (t: Omit<Toast, "id">) => void;
} | null>(null);

// #129: os avisos eram mudos para leitor de tela e distinguidos só por cor. Agora há duas
// regiões vivas sempre montadas (uma educada para info/sucesso, uma assertiva para erro —
// região viva criada junto com a mensagem não é anunciada em vários leitores) e cada
// aviso leva um ícone além da cor.
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setToasts(curr => [...curr, { ...t, id }]);
    setTimeout(() => setToasts(curr => curr.filter(x => x.id !== id)), t.kind === "error" ? 5000 : 3500);
  }, []);

  // Identidade estável: quem depende de `toast` (callbacks do RoomView) não muda a cada aviso.
  const value = useMemo(() => ({ push }), [push]);
  const errors = toasts.filter(t => t.kind === "error");
  const others = toasts.filter(t => t.kind !== "error");

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 end-4 z-[60] flex flex-col items-end gap-2 pointer-events-none">
        <div role="status" aria-live="polite" className="flex flex-col items-end gap-2">
          <ToastList toasts={others} />
        </div>
        <div role="alert" aria-live="assertive" className="flex flex-col items-end gap-2">
          <ToastList toasts={errors} />
        </div>
      </div>
    </ToastContext.Provider>
  );
}

function ToastList({ toasts }: { toasts: Toast[] }) {
  return (
    <AnimatePresence>
      {toasts.map(t => (
        <motion.div
          key={t.id}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 40 }}
          className={
            "card px-4 py-2 text-sm font-mono pointer-events-auto flex items-center gap-2 " +
            (t.kind === "error"
              ? "border-neon-red/40 text-neon-red"
              : t.kind === "success"
              ? "border-neon-green/40 text-neon-green"
              : "border-bg-line text-text")
          }
        >
          {t.kind === "error" ? (
            <AlertTriangle className="size-4 shrink-0" aria-hidden />
          ) : t.kind === "success" ? (
            <CheckCircle2 className="size-4 shrink-0" aria-hidden />
          ) : (
            <Info className="size-4 shrink-0" aria-hidden />
          )}
          <span>{t.text}</span>
        </motion.div>
      ))}
    </AnimatePresence>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fallback (no provider): silent
    return { push: (_: Omit<Toast, "id">) => {} };
  }
  return ctx;
}
