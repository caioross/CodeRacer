---
name: test-foundation
description: Instala testes mínimos e de alto valor onde o risco é real. Use SEMPRE que a tarefa mencionar engine de jogo (BattleEngine, Engine.kt, JigsawEngine, FroggerEngine), RLS, políticas de acesso, gravação de áudio, transcrição, Whisper, fluxo de pagamento, ou quando o usuário perguntar "como testar", "quero adicionar testes", "cobertura de testes", "CI falhando nos testes". O portfólio tem quase zero testes — Astral Forge (19 JVM) e skilldepot (Jest) são as únicas exceções. Esta skill planta o mesmo padrão nos demais projetos.
---

# test-foundation — Testes mínimos onde o risco é real

## Por que isso importa

O portfólio tem um padrão perigoso: engines de jogo determinísticos escritos do zero sem um único teste (Fatima Games, Guerra dos Formigueiros), RLS crítico sem validação por papel (MedPet/linkapet, MecanicaSmart), e AulaLogger cuja promessa central é "gravação crash-safe" — sem testes de regressão do recording pipeline. Astral Forge prova que funciona: 19 testes JVM cobrem o `BattleEngine` sem emulador, e eles já pegaram regressões reais. O objetivo desta skill não é cobertura total — é colocar um teste em cada ponto onde uma regressão silenciosa causaria dano real.

## Roteamento por tipo de projeto

| Projeto / Contexto | Referência | Script |
|---|---|---|
| Engine Kotlin puro (Astral Forge, Fatima, Guerra, Senet) | `references/jvm-engine-tests.md` | `--type jvm` |
| Next.js utils/API (skilldepot, MecanicaSmart web, MedPet web) | `references/jest-nextjs.md` | `--type jest` |
| Supabase RLS por papel (MedPet/linkapet, MecanicaSmart, skilldepot) | `references/rls-tests.md` | `--type rls` |
| Gravação/transcrição crash-safe (AulaLogger) | `references/smoke-tests.md` | `--type smoke` |

Rode o scaffold para gerar o arquivo inicial e a config:

```bash
bash scripts/scaffold_tests.sh --type jvm   # ou jest | rls | smoke
```

## Workflow geral

### 1. Identifique onde o risco é real
Não teste tudo de uma vez. Pergunte: "se este código regredir silenciosamente, o que quebra para o usuário?" Engine de batalha que resolve cartas errado → partida inválida. RLS que deixa viewer ler dados de outro tutor → vazamento. Recording que corrompe arquivo em crash → perda de aula de 4h.

### 2. Leia a referência do tipo correto
Cada referência tem o padrão exato (estrutura de diretório, imports, asserções), baseado no que já funciona no portfólio.

### 3. Use o scaffold para o esqueleto
O script cria o arquivo de teste e o `build.gradle.kts` / `jest.config.ts` / `pytest.ini` corretos no lugar certo. Não invente a configuração do zero.

### 4. Escreva o primeiro teste no padrão "estado → ação → asserção"
```kotlin
// Estado: engine configurado com cartas conhecidas
val engine = BattleEngine(deck = testDeck(), seed = 42L)
// Ação: jogar turno
val result = engine.playTurn(action = Action.INVOKE, cardIndex = 0)
// Asserção: resultado determinístico
assertEquals(expectedHp, result.opponentHp)
```
Seed fixa + estado controlado = teste determinístico. Sem seed = teste que falha aleatoriamente.

### 5. Rode localmente antes de commitar
- JVM: `./gradlew test` na raiz do módulo Android
- Jest: `pnpm test` ou `npm test`
- RLS: `psql $DATABASE_URL -f assets/test_rls.sql`
- Smoke: `pytest tests/smoke/ -v`

### 6. Adicione ao CI
O teste não existe até estar no CI. Cada referência inclui um snippet de workflow GitHub Actions para adicionar ao `.github/workflows/`.

## Exemplos reais por projeto

**Astral Forge** — padrão de referência. Veja `assets/BattleEngineTest.kt` para o molde exato dos 19 testes existentes. Adicionar novos testes: copie o padrão, mude o cenário.

**Fatima Games** — `JigsawEngine.kt`, `MahjongEngine.kt` etc. são pure Kotlin, sem deps Android. As dependências de teste (`junit`, `mockk`, `turbine`) já estão em `build.gradle.kts` — falta apenas criar `app/src/test/java/com/fatimagames/app/games/`. Use `--type jvm`.

**Guerra dos Formigueiros** — `World.kt` e `WaveManager.kt` têm lógica de ondas (`130 × 1.14ⁿ`) sem dependência Android. Namespace: `com.haradsopere.anthill`. Use `--type jvm`.

**Senet** — `model/GameState.kt` já é pure Kotlin (sem imports Android). A mesma lógica foi portada para TypeScript no site — dois alvos de teste com uma lógica. Namespace: `com.senet.game`.

**MedPet/linkapet** — schema `linkapet` com RLS `deny-by-default` na migration `20260503000600_rls_policies.sql`. Use `--type rls`. Papéis: owner, co-tutor, caretaker, viewer.

**AulaLogger** — foreground service + WavWriter. Use `--type smoke`. O risco central: o arquivo WAV não corrompeu após kill forçado do processo?

**skilldepot** — `__tests__/` já existe com 10 arquivos Jest. Use `--type jest` para adicionar cobertura nas API routes críticas (OAuth, checkout, MCP). A `CRIT-001` (SQL injection em `mcp-tools.ts:47`) deve ter um teste de regressão.

## Critério de aceite

- Todo teste adicionado roda verde em `./gradlew test` / `pnpm test` / `psql` / `pytest` localmente.
- O step de CI existe e passa no último commit do branch `main`.
- Nenhum teste depende de seed não-fixa, estado de rede, ou ordem de execução.
- Para RLS: um teste prova explicitamente que um `viewer` não lê dado de outro tutor (cross-tenant isolation).

## Arquivos desta skill

- `references/jvm-engine-tests.md` — padrão JUnit para engines Kotlin puro
- `references/jest-nextjs.md` — padrão Jest para Next.js utils e API routes
- `references/rls-tests.md` — validação de RLS por papel no Supabase
- `references/smoke-tests.md` — smoke tests de crash-safety para AulaLogger
- `assets/BattleEngineTest.kt` — exemplo real de teste de engine (padrão Astral Forge)
- `assets/SkillFormTest.test.ts` — exemplo real de teste Jest (padrão skilldepot)
- `assets/test_rls.sql` — template de teste RLS executável
- `scripts/scaffold_tests.sh` — cria esqueleto de teste + config pelo tipo
