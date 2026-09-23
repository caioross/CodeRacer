package com.astralforge.domain

import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.Parameterized

/**
 * Testes do BattleEngine determinístico — padrão Astral Forge.
 *
 * Este é o molde real dos 19 testes existentes. Copie e adapte para
 * outros engines do portfólio (Fatima Games, Guerra dos Formigueiros, Senet).
 *
 * Princípio: engine puro (zero imports android.*) → roda na JVM → sem emulador.
 * Rode com: ./gradlew test --tests 'com.astralforge.domain.BattleEngineTest'
 */
class BattleEngineTest {

    private lateinit var engine: BattleEngine

    // Decks de referência com stats conhecidas — sem aleatoriedade
    private val playerDeck = listOf(
        Card(id = "LUMEN_KNIGHT", attack = 3, defense = 3, faction = Faction.LUMEN, keywords = setOf(Keyword.TAUNT)),
        Card(id = "UMBRA_DRAIN",  attack = 2, defense = 1, faction = Faction.UMBRA,  keywords = setOf(Keyword.LIFESTEAL)),
        Card(id = "SILVA_ROOT",   attack = 1, defense = 4, faction = Faction.SILVA,  keywords = emptySet()),
    )
    private val opponentDeck = listOf(
        Card(id = "MECHANUM_TURRET", attack = 4, defense = 2, faction = Faction.MECHANUM, keywords = emptySet()),
        Card(id = "OBLIVIORA_VOID", attack = 0, defense = 3, faction = Faction.OBLIVIORA, keywords = setOf(Keyword.SILENCE)),
    )

    @Before
    fun setup() {
        // Seed fixa garante que qualquer aleatoriedade interna é determinística
        engine = BattleEngine(
            playerDeck = playerDeck,
            opponentDeck = opponentDeck,
            seed = 42L
        )
    }

    // ── Regra: Provocar ──────────────────────────────────────────────────────

    @Test
    fun `unidade sem voo ataca obrigatoriamente a carta com Provocar`() {
        engine.playCard(playerCardIndex = 0)  // coloca LUMEN_KNIGHT (TAUNT)
        val result = engine.resolveAttack(
            attackerIndex = 1,  // MECHANUM_TURRET (sem voo)
            isPlayerAttacking = false
        )
        assertEquals("Atacante sem voo deve ser forçado ao TAUNT", "LUMEN_KNIGHT", result.targetId)
    }

    @Test
    fun `carta com Voo ignora Provocar e pode escolher alvo livremente`() {
        val flyingCard = Card("LUMEN_PHOENIX", attack = 2, defense = 2,
            faction = Faction.LUMEN, keywords = setOf(Keyword.FLYING))
        engine.addToField(flyingCard, isPlayer = false)
        engine.playCard(playerCardIndex = 0)  // LUMEN_KNIGHT (TAUNT) no campo

        val result = engine.resolveAttack(
            attackerIndex = 0,  // flyingCard
            isPlayerAttacking = false,
            targetOverride = "PLAYER_HERO"
        )
        assertEquals("Carta com Voo pode atacar herói mesmo com TAUNT no campo",
            "PLAYER_HERO", result.targetId)
    }

    // ── Regra: Sede de Sangue (Lifesteal) ────────────────────────────────────

    @Test
    fun `Sede cura o jogador pelo dano causado`() {
        val initialHp = engine.playerHp
        engine.playCard(playerCardIndex = 1)  // UMBRA_DRAIN (LIFESTEAL, atk=2)
        engine.addToField(
            Card("DUMMY", attack = 0, defense = 5, faction = Faction.LUMEN, keywords = emptySet()),
            isPlayer = false
        )
        engine.resolveAttack(attackerIndex = 0, isPlayerAttacking = true)

        assertEquals("LIFESTEAL deve curar 2 HP (dano causado)", initialHp + 2, engine.playerHp)
    }

    // ── Regra: Exaustão ───────────────────────────────────────────────────────

    @Test
    fun `carta recém-jogada não pode atacar no mesmo turno`() {
        engine.playCard(playerCardIndex = 0)
        val result = engine.resolveAttack(attackerIndex = 0, isPlayerAttacking = true)
        assertEquals("Carta com exaustão deve retornar EXHAUSTED", AttackResult.EXHAUSTED, result.outcome)
    }

    @Test
    fun `carta pode atacar no turno seguinte após exaustão`() {
        engine.playCard(playerCardIndex = 0)
        engine.endTurn()  // passa o turno e volta
        engine.endTurn()

        val result = engine.resolveAttack(attackerIndex = 0, isPlayerAttacking = true)
        assertNotEquals("Carta não exausta deve poder atacar", AttackResult.EXHAUSTED, result.outcome)
    }

    // ── Balanceamento via simulação ───────────────────────────────────────────

    @Test
    fun `win rate do player em 1000 partidas fica entre 40% e 60%`() {
        var playerWins = 0
        val totalGames = 1000

        for (i in 0 until totalGames) {
            val sim = BattleEngine(
                playerDeck = playerDeck,
                opponentDeck = opponentDeck,
                seed = i.toLong()  // seed diferente por partida para variação
            )
            val winner = sim.simulateFullGame()
            if (winner == Winner.PLAYER) playerWins++
        }

        val winRate = playerWins.toDouble() / totalGames
        assertTrue("Win rate deve ser entre 40-60% (era $winRate)", winRate in 0.40..0.60)
    }

    // ── Catálogo ──────────────────────────────────────────────────────────────

    @Test
    fun `todos os 135 cards têm arte associada`() {
        val catalog = CardCatalog.loadAll()
        assertEquals("Catálogo deve ter 135 cartas", 135, catalog.size)

        val missing = catalog.filter { card ->
            !card.artResourceId.isValidDrawable()
        }
        assertTrue("Cards sem arte: ${missing.map { it.id }}", missing.isEmpty())
    }
}

// ── Dados Paramétricos ────────────────────────────────────────────────────────

@RunWith(Parameterized::class)
class BattleEngineDataDrivenTest(
    private val description: String,
    private val attackerKeyword: Keyword?,
    private val defenderKeyword: Keyword?,
    private val expectedOutcome: AttackResult
) {
    companion object {
        @JvmStatic
        @Parameterized.Parameters(name = "{0}")
        fun scenarios() = listOf(
            arrayOf("normal vs normal → RESOLVED", null, null, AttackResult.RESOLVED),
            arrayOf("flying vs taunt → RESOLVED (ignora taunt)", Keyword.FLYING, Keyword.TAUNT, AttackResult.RESOLVED),
            arrayOf("silence remove keywords do alvo", null, Keyword.SILENCE, AttackResult.RESOLVED),
        )
    }

    @Test
    fun `cenário de combate`() {
        val attacker = Card("ATK", attack = 3, defense = 3, faction = Faction.LUMEN,
            keywords = if (attackerKeyword != null) setOf(attackerKeyword) else emptySet())
        val defender = Card("DEF", attack = 2, defense = 2, faction = Faction.UMBRA,
            keywords = if (defenderKeyword != null) setOf(defenderKeyword) else emptySet())

        val engine = BattleEngine(
            playerDeck = listOf(attacker),
            opponentDeck = listOf(defender),
            seed = 0L
        )
        engine.playCard(0)
        engine.endTurn(); engine.endTurn()  // remove exaustão
        engine.addToField(defender, isPlayer = false)

        val result = engine.resolveAttack(attackerIndex = 0, isPlayerAttacking = true)
        assertEquals(description, expectedOutcome, result.outcome)
    }
}
