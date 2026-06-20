# Testes JVM para Engines Kotlin Puro

## Por que funciona sem emulador

Engines de jogo bem arquitetados não importam nada do pacote `android.*`. Quando `BattleEngine.kt`, `JigsawEngine.kt`, `FroggerEngine.kt`, `World.kt` etc. dependem apenas de `kotlin.*` e `java.*`, o Gradle pode compilá-los e testá-los na JVM local — zero emulador, zero AVD, CI roda em segundos.

Astral Forge confirma: 19 testes no `BattleEngine` rodando em `./gradlew test` em poucos segundos. Fatima Games tem as deps configuradas mas faltam os arquivos de teste.

## Estrutura de diretórios

```
app/
└── src/
    ├── main/java/com/<pacote>/domain/
    │   └── BattleEngine.kt          ← código de produção
    └── test/java/com/<pacote>/domain/
        ├── BattleEngineTest.kt      ← testes JUnit
        ├── WaveManagerTest.kt       ← (Guerra dos Formigueiros)
        ├── JigsawEngineTest.kt      ← (Fatima Games)
        └── fixtures/
            └── TestFixtures.kt      ← builders de estado de teste
```

Se `app/src/test/` não existe, crie com o scaffold:
```bash
bash scripts/scaffold_tests.sh --type jvm
```

## Dependências no build.gradle.kts

Estas já estão em Fatima Games. Para outros projetos, adicione em `dependencies {}`:

```kotlin
// Testes JVM (ficam em testImplementation — não entram no APK)
testImplementation("junit:junit:4.13.2")
testImplementation("io.mockk:mockk:1.13.12")
testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.9.0")
testImplementation("app.cash.turbine:turbine:1.2.0")  // para Flow
```

Nenhuma dependência `androidTest` é necessária para engines puros.

## Padrão de teste: estado controlado + seed fixa

```kotlin
@Test
fun `provocar impede ataque de unidade sem voo`() {
    // ARRANGE — estado totalmente controlado, sem random
    val engine = BattleEngine(
        playerDeck = testDeck(cards = listOf(Card.GOBLIN, Card.ARCHER)),
        opponentDeck = testDeck(cards = listOf(Card.TANK_WITH_TAUNT)),
        seed = 42L  // seed fixa = resultado determinístico
    )
    engine.playCard(GOBLIN, target = AUTO)

    // ACT
    val result = engine.resolveAttack(attacker = GOBLIN, target = ARCHER)

    // ASSERT
    assertEquals(AttackResult.BLOCKED, result.outcome)
    assertEquals("TANK_WITH_TAUNT deve ser alvo forçado", TANK_WITH_TAUNT, result.forcedTarget)
}
```

**Regras:**
- Seed sempre fixa em testes de motor com aleatoriedade.
- State inicial explícito — nunca dependa do estado padrão do engine.
- Uma asserção central por teste (mais fácil de ler o failure).
- Nomes descritivos: `` `o que acontece quando condição` ``.

## Padrão com data-driven (tabela de cenários)

Quando há muitas combinações (Astral Forge usa isso nos 11 testes de regra):

```kotlin
@ParameterizedTest
@MethodSource("combatScenarios")
fun `combate resolve corretamente`(scenario: CombatScenario) {
    val result = engine.resolve(scenario.attacker, scenario.defender)
    assertEquals(scenario.expectedWinner, result.winner)
    assertEquals(scenario.expectedDamage, result.damage)
}

companion object {
    @JvmStatic
    fun combatScenarios() = listOf(
        CombatScenario(attacker = GOBLIN_2_2, defender = SOLDIER_3_1, expectedWinner = DEFENDER, expectedDamage = 1),
        CombatScenario(attacker = DRAGON_5_5, defender = SOLDIER_3_1, expectedWinner = ATTACKER, expectedDamage = 4),
    )
}
```

## Testes por projeto

### Astral Forge
- `BattleEngineTest` — mecânicas: Veloz, Provocar, Sede, exaustão, turno extra
- `CatalogTest` — confirma que todos os 135 cards têm arte associada
- `BalanceSimTest` — simulação de N partidas, valida win rate dentro do intervalo esperado
- `FusionTest` — duplicatas → raridade superior

### Fatima Games
Namespace: `com.fatimagames.app.games`
- `JigsawEngineTest` — peças encaixam, estado de vitória detectado
- `MahjongEngineTest` — pares válidos, invalid moves rejeitados
- `ColorSortEngineTest` — estados de stage verificados contra `ColorSortStages`
- `MinesweeperEngineTest` — first click nunca é mina, cascata correta

### Guerra dos Formigueiros
Namespace: `com.haradsopere.anthill`
- `WaveManagerTest` — budget de onda n: `130 × 1.14^n` ≈ valor esperado
- `SpatialHashTest` — entidades a 200px não colidem, entidades a 50px colidem
- `CounterSystemTest` — tropa A vs tropa B: +70% de dano no counter, -40% no reverse

### Senet
Namespace: `com.senet.game.model`
- `GameStateTest` — movimentos válidos e inválidos, bear-off com lançamento exato
- `SticksTest` — distribuição de 4 bastões: P(1 claro) ≈ 4/16

## CI snippet (adicione ao workflow existente)

```yaml
- name: Rodar testes JVM
  run: ./gradlew test --no-daemon
  working-directory: ./app  # ou Jogo/ para Astral Forge

- name: Publicar resultados
  uses: mikepenz/action-junit-report@v4
  if: always()
  with:
    report_paths: '**/build/test-results/test/TEST-*.xml'
```
