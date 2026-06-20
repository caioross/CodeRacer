---
name: cr-typing-engine
description: Motor de corrida de digitação do CodeRacer (Next.js + TypeScript) — calcula WPM/precisão/erros char-a-char, detecta trapaça (paste, tempo implausível), valida a lógica de métricas com casos de teste. Use SEMPRE que a tarefa tocar Race.tsx, CodeDisplay.tsx, cálculo de WPM, precisão, anti-cheat, broadcastProgress, handleInput, ou qualquer modificação na engine de digitação, mesmo que o usuário não cite "typing engine".
---

# cr-typing-engine — Motor de Digitação do CodeRacer

## Quando usar
Toda vez que a tarefa envolver:
- Alterar ou corrigir cálculo de WPM, precisão ou contagem de erros
- Modificar `src/components/Race.tsx` ou `src/components/CodeDisplay.tsx`
- Ajustar `broadcastProgress` / `sendProgress` em `src/lib/useRoom.ts`
- Implementar ou fortalecer anti-cheat (paste, tempo impossível, WPM absurdo)
- Adicionar modo solo, replay de fantasmas, ou histórico de keystrokes
- Depurar métricas que chegam erradas no leaderboard

## Arquitetura da engine (fonte: código real)

### Onde cada métrica nasce
Toda a lógica de digitação vive em **`src/components/Race.tsx`**. Não há módulo separado — o cálculo é inline no componente. Isso é uma dívida técnica a ser refatorada se a engine crescer.

```
Race.tsx
├── handleInput()        ← processa cada keystroke, conta erros
├── correctChars (useMemo) ← conta chars corretos em typed vs code
├── wpm (derivado)       ← (correctChars / 5) / elapsedMin
├── accuracy (derivado)  ← (1 - errors / totalKeystrokes) * 100
├── progress (derivado)  ← typed.length / code.length
└── onProgress()         ← dispara para useRoom → broadcastProgress
```

`src/lib/useRoom.ts` recebe as métricas via `sendProgress(progress, wpm, accuracy, errors)`
e as transmite por **Broadcast efêmero** (não toca o banco) a cada keystroke,
throttlado em `PROGRESS_THROTTLE_MS = 120 ms` para não sobrecarregar o Supabase Realtime.

### Fórmulas exatas (Race.tsx, linhas 49–60)

```ts
// elapsed desde start_at (ms passados desde início da corrida)
const elapsedMs  = Math.max(0, now - startedAt);
const elapsedMin = elapsedMs / 60000;

// correctChars: quantos índices em `typed` batem com `code`
const correctChars = typed.split('').filter((ch, i) => ch === code[i]).length;

// WPM padrão de indústria: palavras = chars / 5
const wpm = elapsedMin > 0.001 ? Math.round((correctChars / 5) / elapsedMin) : 0;

// precisão: não penaliza backspace, conta apenas teclas "para frente"
// errors acumula erros; totalKeystrokes acumula teclas para frente
const accuracy = totalKeystrokes === 0
  ? 100
  : Math.max(0, Math.round((1 - errors / totalKeystrokes) * 100));

// progresso: posição no snippet (0..1), não depende de acerto
const progress = code.length === 0 ? 0 : Math.min(1, typed.length / code.length);
```

**Por que `elapsedMin > 0.001`?** Evita divisão por zero nos primeiros milissegundos.
**Por que backspace não conta como keystroke?** Convenção de mercado (Monkeytype/TypeRacer) —
penalizar backspace desmotiva correção de erros.

## Workflow — alterar ou depurar a engine

1. **Entenda o fluxo completo** antes de mexer: `Race.tsx` → `onProgress` →
   `useRoom.ts:broadcastProgress` → Supabase Broadcast → outros clientes.
   Alterar a fórmula sem revalidar o script de testes vai quebrar o leaderboard silenciosamente.

2. **Rode os testes de métricas** antes e depois de qualquer mudança:
   ```bash
   node scripts/validate-metrics.mjs
   ```
   Todos os casos devem passar. Se um caso falhar, a fórmula está errada ou o caso
   de teste precisa ser atualizado com justificativa documentada.

3. **Ao refatorar `handleInput`**, preserve estes invariantes:
   - `typed.length` nunca ultrapassa `code.length` (ver `if (next.length > code.length) next = next.slice(0, code.length)`)
   - `errors` só cresce (nunca decresce) — é cumulativo, não o estado atual
   - `totalKeystrokes` só conta teclas para frente (não backspace)
   - `progress` é posição no texto, não acurácia

4. **Anti-cheat atual** (não remova sem substituir):
   - `onPaste` bloqueado no `<textarea>` com `e.preventDefault()`
   - `disabled={iFinished}` impede input pós-término
   - Veja `references/anti-cheat.md` para validação de tempo implausível (P1 — não implementado ainda)

5. **Ao expor métricas novas** no broadcast, atualize `ProgressMsg` em
   `src/lib/room.ts` e reaplique o tipo em `useRoom.ts` e `Race.tsx` de forma consistente.

## Anti-cheat — o que existe e o que falta

| Vetor | Status | Onde |
|---|---|---|
| Paste (Ctrl+V) | Bloqueado | `Race.tsx:noPaste` |
| Input após término | Bloqueado | `disabled={iFinished}` |
| WPM fisicamente impossível | **Não validado** | — |
| Tempo de corrida implausível | **Não validado** | — |
| Manipulação do broadcast | **Não validado** | — |

Para implementar validação de WPM e tempo, leia `references/anti-cheat.md`.
Para auditoria de segurança web mais ampla, use `../web-security-audit`.

## Critério de aceite

A tarefa está pronta quando:
- [ ] `node scripts/validate-metrics.mjs` passa **todos** os casos sem erro
- [ ] O WPM exibido em `Race.tsx` coincide com o WPM persistido em `scores` no Supabase
- [ ] Paste continua bloqueado (testar manualmente no browser)
- [ ] Nenhum `console.error` ou warning TypeScript novo introduzido
- [ ] `pnpm typecheck` passa limpo

Para dívidas de segurança, consulte também `../web-security-audit`.

## Referências
- `references/anti-cheat.md` — plano de validação de tempo e WPM implausível
- `scripts/validate-metrics.mjs` — suite de testes das fórmulas de WPM/precisão
