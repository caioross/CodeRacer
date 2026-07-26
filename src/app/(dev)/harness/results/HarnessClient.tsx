"use client";

import Link from "next/link";
import { Results } from "@/components/Results";
import { ToastProvider } from "@/components/ui/Toast";
import {
  DEFAULT_SCENARIO,
  HARNESS_FIXTURE_MARKER,
  HARNESS_ME_ID,
  SCENARIOS,
  SCENARIO_LIST,
  isScenarioId
} from "@/components/dev/results.fixtures";

const noop = () => {};

// `<Results>` é montado com as MESMAS props que `RoomView` passa em produção, e
// embrulhado no `<ToastProvider>` que a rota /room/[id] usa — sem o provider o
// `useToast` cai no fallback silencioso e o harness daria falso-verde.
export function HarnessClient({
  scenario,
  isLeader
}: {
  scenario?: string;
  isLeader: boolean;
}) {
  const active = isScenarioId(scenario) ? scenario : DEFAULT_SCENARIO;
  const room = SCENARIOS[active];

  return (
    <ToastProvider>
      <main className="mx-auto max-w-6xl px-4 py-6 space-y-5">
        <header className="card p-4 space-y-3">
          <div>
            <span className="label">// harness de dev — telas pós-corrida</span>
            <p className="text-xs text-text-muted font-mono mt-1">
              Dados sintéticos, sem Supabase/Realtime. Não existe em produção.
            </p>
          </div>

          <nav className="flex flex-wrap gap-2" aria-label="Cenários">
            {SCENARIO_LIST.map(s => (
              <Link
                key={s.id}
                href={`/harness/results?n=${s.id}${isLeader ? "" : "&leader=0"}`}
                aria-current={s.id === active ? "page" : undefined}
                className={
                  "rounded-md border px-3 py-1.5 text-xs font-mono transition-colors " +
                  (s.id === active
                    ? "border-neon-green/50 text-neon-green"
                    : "border-bg-line text-text-muted hover:text-text")
                }
              >
                {s.label}
              </Link>
            ))}
          </nav>

          <Link
            href={`/harness/results?n=${active}${isLeader ? "&leader=0" : ""}`}
            className="inline-block text-xs font-mono text-text-muted hover:text-neon-amber transition-colors"
          >
            líder: <span className="text-text">{isLeader ? "sim" : "não"}</span> // alternar
          </Link>
        </header>

        <Results
          room={room}
          meId={HARNESS_ME_ID}
          isLeader={isLeader}
          onPlayAgain={noop}
          onChat={noop}
        />

        <p className="text-[10px] font-mono text-text-dim">{HARNESS_FIXTURE_MARKER}</p>
      </main>
    </ToastProvider>
  );
}
