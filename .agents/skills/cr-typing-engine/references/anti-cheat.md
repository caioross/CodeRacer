# Anti-cheat — Plano de Validação para o CodeRacer

## O que já existe (não remova)

| Mecanismo | Arquivo | Como funciona |
|---|---|---|
| Paste bloqueado | `src/components/Race.tsx:noPaste` | `e.preventDefault()` no `onPaste` do `<textarea>` |
| Input desabilitado pós-término | `Race.tsx` | `disabled={iFinished}` no `<textarea>` |
| Throttle de broadcast | `src/lib/useRoom.ts` | `PROGRESS_THROTTLE_MS = 120` — não envia broadcast a cada tecla |

## O que ainda falta (P1 — implementar antes de tornar o leaderboard competitivo)

### 1. Validação de WPM no servidor

Quando `action=finish` chega em `src/app/api/rooms/[code]/route.ts`,
o servidor confia cegamente nos resultados enviados pelo cliente. Adicione:

```ts
// Em persistMatch(), antes de inserir em `scores`:
const MAX_HUMAN_WPM = 300; // record mundial ~212 WPM — 300 é margem generosa
for (const r of results) {
  if (r.wpm > MAX_HUMAN_WPM) {
    console.warn(`[anti-cheat] WPM suspeito: ${r.name} → ${r.wpm}`);
    r.wpm = MAX_HUMAN_WPM; // clamp, não rejeita (evita falsos positivos)
  }
  if (r.accuracy > 100) r.accuracy = 100;
  if (r.accuracy < 0)   r.accuracy = 0;
}
```

### 2. Validação de tempo mínimo de corrida

Calcula o tempo mínimo plausível com base no tamanho do snippet:
- WPM máximo humano realístico: ~220 WPM ≈ 18,3 chars/s
- Snippet "fácil" mínimo: ~50 chars → tempo mínimo ≈ 2,7 s
- Se `finishedAt - start_at < MIN_RACE_MS`, rejeite o resultado

```ts
// Em src/app/api/rooms/[code]/route.ts, case "finish":
const startAt = room.start_at ? Date.parse(room.start_at) : 0;
const snippetLen = room.snippet?.code?.length ?? 0;
const MIN_CHARS_PER_SEC = 18; // ~220 WPM
const minRaceMs = (snippetLen / MIN_CHARS_PER_SEC) * 1000;

for (const r of results) {
  if (r.finishedAt && startAt && (r.finishedAt - startAt) < minRaceMs) {
    console.warn(`[anti-cheat] corrida muito rápida: ${r.name}`);
    // opções: rejeitar o "finished" ou desclassificar do leaderboard
    r.finished = false;
    r.place = null;
  }
}
```

### 3. Validação de progresso sequencial (broadcast)

O progresso em `ProgressMsg.progress` deve ser monotonicamente crescente.
Se um cliente enviar `progress: 0.9` depois de `progress: 0.3` e depois `progress: 0.1`,
é sinal de manipulação. Valide no receptor em `useRoom.ts`:

```ts
channel.on("broadcast", { event: "progress" }, ({ payload }) => {
  const m = payload as ProgressMsg;
  if (!m?.id || m.id === id) return;
  setProgress(prev => {
    const old = prev[m.id];
    // Aceite regressão pequena (< 5%) para cobrir race conditions normais
    if (old && m.progress < old.progress - 0.05) return prev;
    return { ...prev, [m.id]: m };
  });
});
```

## Notas de segurança

- O leaderboard é público e sem autenticação de nick — qualquer um pode escolher o nome
  de outra pessoa. Para competições sérias, considere vincular ao login Google (já disponível
  via Supabase Auth/PKCE em `src/lib/useAuth.ts`).
- O `SUPABASE_SERVICE_ROLE_KEY` nunca deve vazar para o cliente. Ele só existe em
  `src/lib/supabase.ts` (server-side). Ver `.env.example` para confirmação.
- Para auditoria de segurança completa da superfície web, use `../web-security-audit`.
