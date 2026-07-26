"use client";

import Link from "next/link";
import { Race } from "@/components/Race";
import { ToastProvider } from "@/components/ui/Toast";
import {
  DEFAULT_RACE_SCENARIO,
  RACE_HARNESS_MARKER,
  RACE_HARNESS_ME_ID,
  RACE_SCENARIOS,
  RACE_SCENARIO_LIST,
  isRaceScenarioId
} from "@/components/dev/race.fixtures";

const noop = () => {};

// `<Race>` recebe as MESMAS props que `RoomView` passa em produção, dentro do
// mesmo `<ToastProvider>` — sem o provider o `useToast` cai no fallback e o
// harness daria falso-verde (lição do harness pós-corrida, #37).
//
// O cabeçalho é `md:` apenas: em viewport mobile ele some, para não roubar a
// altura que é justamente o que se quer medir.
export function HarnessClient({ scenario }: { scenario?: string }) {
  const active = isRaceScenarioId(scenario) ? scenario : DEFAULT_RACE_SCENARIO;
  const room = RACE_SCENARIOS[active];

  return (
    <ToastProvider>
      <main className="mx-auto max-w-7xl px-4 py-4 md:px-6 md:py-6">
        <header className="card mb-4 hidden p-4 md:block">
          <span className="label">// harness de dev — corrida</span>
          <p className="mt-1 font-mono text-xs text-text-muted">
            Dados sintéticos, sem Supabase/Realtime. Não existe em produção.
          </p>
          <nav className="mt-3 flex flex-wrap gap-2" aria-label="Cenários">
            {RACE_SCENARIO_LIST.map(s => (
              <Link
                key={s.id}
                href={`/harness/race?n=${s.id}`}
                aria-current={s.id === active ? "page" : undefined}
                className={
                  "rounded-md border px-3 py-1.5 font-mono text-xs transition-colors " +
                  (s.id === active
                    ? "border-neon-green/50 text-neon-green"
                    : "border-bg-line text-text-muted hover:text-text")
                }
              >
                {s.label}
              </Link>
            ))}
          </nav>
        </header>

        <Race
          room={room}
          meId={RACE_HARNESS_ME_ID}
          isLeader={false}
          onProgress={noop}
          onAbandon={noop}
          onChat={noop}
        />

        <p className="mt-3 hidden font-mono text-[10px] text-text-dim md:block">
          {RACE_HARNESS_MARKER}
        </p>
      </main>
    </ToastProvider>
  );
}
