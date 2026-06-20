# Arquitetura Realtime do CodeRacer

## Por que três canais em um?

O Supabase Realtime oferece três mecanismos em um único channel. O CodeRacer
usa todos os três com propósitos distintos — confundi-los é a causa mais comum de bugs de estado.

### 1. Presence — roster ao vivo

**O que é:** estado efêmero por sessão. Cada cliente anuncia presença com um payload.
O Supabase garante que todos vejam o mesmo estado sincronizado.

**Usado para:** saber quem está na sala agora (nome, cor, avatar, joinedAt).

```ts
// Anunciar presença (useRoom.ts)
channel.track({ id, name, color, avatar, joinedAt: Date.now() } as PresenceMeta);

// Receber state atual (sync) e joins/leaves
channel.on("presence", { event: "sync" }, () => { ... });
channel.on("presence", { event: "join" }, ({ newPresences }) => { ... });
channel.on("presence", { event: "leave" }, ({ leftPresences }) => { ... });
```

**Limitação:** desaparece quando a conexão cai. Não sobrevive a refresh de página
(o cliente precisa reconectar e re-track). Por isso `sessionStorage` guarda `playerId`
e `name` para re-entrar na mesma identidade.

### 2. Broadcast — progresso por tecla e chat

**O que é:** mensagens efêmeras ponto-a-ponto. Não persistidas. Baixíssima latência.

**Usado para:**
- `event "progress"`: WPM, precisão, erros, progresso, finishedAt — uma mensagem por keystroke
  (throttlado em 120 ms para keystroke não-final, imediato ao finalizar)
- `event "chat"`: mensagens de jogadores na sala

```ts
// Emitir
ch.send({ type: "broadcast", event: "progress", payload: msg });

// Receber
channel.on("broadcast", { event: "progress" }, ({ payload }) => { ... });
```

**Por que Broadcast e não postgres_changes para progresso?**
Toque no banco a cada keystroke seria ~5–10 writes/s por jogador. Em uma sala de 12 jogadores,
seria ~60–120 writes/s, o que excede o limite do plano free do Supabase e cria
latência de ~200 ms vs. ~50 ms do Broadcast. Decisão correta.

### 3. postgres_changes — estado durável da sala

**O que é:** listener em tempo real de mudanças no Postgres.

**Usado para:** receber atualizações da row `rooms` — mudança de status,
snippet selecionado, `start_at`, `results`, `leader_id`.

```ts
channel.on(
  "postgres_changes",
  { event: "*", schema: "public", table: "rooms", filter: `code=eq.${code}` },
  payload => { setRoom(payload.new as RoomRow); }
);
```

**Por que só `rooms` e não `matches`/`scores`?**
O leaderboard é consultado por Server Component (`leaderboard/page.tsx`) com
`force-dynamic` — não precisa de Realtime. Só a sala precisa de estado ao vivo.

## Countdown sem timer server-side

```ts
// API route (start action):
const startAt = new Date(Date.now() + COUNTDOWN_MS).toISOString(); // COUNTDOWN_MS = 4000

// Cliente (useRoom.ts):
const startMs = room?.start_at ? Date.parse(room.start_at) : 0;
const countdownN = Math.max(1, Math.ceil((startMs - now) / 1000)); // derivado de now
```

Todos os clientes derivam o countdown de `start_at` do banco — não há timer no servidor.
Isso elimina drift entre clientes mesmo com latência de rede diferente.

## Reconexão e identidade persistente

```ts
const SESSION_KEY = (code) => `coderacer:room:${code}`;
const NAME_KEY = "coderacer:name";
```

- `sessionStorage[SESSION_KEY(code)]`: guarda `{ playerId, name }` por aba/sessão
- `localStorage[NAME_KEY]`: guarda o último nick usado (persiste entre sessões)
- Em refresh: o mesmo `playerId` é re-anunciado via `channel.track()` → seamless

## Scalabilidade

| Tier | Conexões WebSocket | Custo/mês |
|---|---|---|
| Free | ~200 conexões simultâneas | $0 |
| Pro | ~500 (configurável) | $25 |
| Team+ | Custom | $599+ |

Para o MVP/Beta com até ~50 usuários simultâneos, o plano free é suficiente.
Se o projeto crescer para uso público real, avaliar Pro antes de lançar.
