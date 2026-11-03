// Qual transporte de tempo real a sala usa. Seguro no servidor e no cliente.
//
// `NEXT_PUBLIC_REALTIME` é embutida no BUILD (prefixo NEXT_PUBLIC_): o bundle do
// navegador e o das rotas saem do mesmo `next build` e, portanto, sempre
// concordam. Trocar de transporte = rebuild.
//   - `supabase` (padrão): Supabase Realtime (presence + broadcast + postgres_changes).
//   - `local`: hub SSE dentro do próprio processo Next (`src/lib/realtime/hub.ts`) —
//     só serve para servidor ÚNICO e de longa duração (deploy da casa), nunca serverless.

export type RealtimeMode = "supabase" | "local";

export function realtimeMode(): RealtimeMode {
  // A expressão tem de ser literal (`process.env.NEXT_PUBLIC_REALTIME`) para o Next embuti-la.
  const raw = process.env.NEXT_PUBLIC_REALTIME;
  return typeof raw === "string" && raw.trim().toLowerCase() === "local" ? "local" : "supabase";
}
