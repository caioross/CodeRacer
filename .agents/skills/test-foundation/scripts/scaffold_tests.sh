#!/usr/bin/env bash
# scaffold_tests.sh — cria esqueleto de teste + config pelo tipo
# Uso: bash scaffold_tests.sh --type jvm|jest|rls|smoke [--package com.exemplo.app] [--dir .]
set -euo pipefail

TYPE=""
PACKAGE="com.example.app"
DIR="."

while [[ $# -gt 0 ]]; do
    case "$1" in
        --type) TYPE="$2"; shift 2 ;;
        --package) PACKAGE="$2"; shift 2 ;;
        --dir) DIR="$2"; shift 2 ;;
        *) echo "Argumento desconhecido: $1"; exit 1 ;;
    esac
done

if [[ -z "$TYPE" ]]; then
    echo "Uso: bash scaffold_tests.sh --type jvm|jest|rls|smoke [--package com.exemplo.app] [--dir .]"
    exit 1
fi

PACKAGE_PATH="${PACKAGE//.//}"

case "$TYPE" in

# ─── JVM (Kotlin engine tests) ───────────────────────────────────────────────
jvm)
    TEST_DIR="$DIR/app/src/test/java/$PACKAGE_PATH"
    mkdir -p "$TEST_DIR"
    OUTFILE="$TEST_DIR/EngineTest.kt"
    if [[ -f "$OUTFILE" ]]; then
        echo "Já existe: $OUTFILE — não sobrescrevo."
    else
        cat > "$OUTFILE" << KOTLIN
package $PACKAGE

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * Testes JVM para o engine puro (sem deps Android).
 * Rode com: ./gradlew test
 *
 * Padrão: estado controlado + seed fixa = determinístico.
 */
class EngineTest {

    // TODO: substitua pelo engine real do projeto
    // private lateinit var engine: BattleEngine

    @Before
    fun setup() {
        // engine = BattleEngine(seed = 42L)
    }

    @Test
    fun \`estado inicial é válido\`() {
        // Substitua pela verificação do estado inicial do seu engine
        assertTrue("Placeholder — substitua por asserção real", true)
    }

    @Test
    fun \`ação básica produz resultado determinístico\`() {
        // val result = engine.performAction(Action.DEFAULT)
        // assertEquals("resultado esperado", expectedValue, result.value)
        assertTrue("Placeholder — substitua por asserção real", true)
    }
}
KOTLIN
        echo "Criado: $OUTFILE"
    fi

    # Verifica se as deps de teste já estão no build.gradle.kts
    GRADLE_FILE="$DIR/app/build.gradle.kts"
    if [[ -f "$GRADLE_FILE" ]]; then
        if ! grep -q "junit:junit" "$GRADLE_FILE"; then
            echo ""
            echo "AVISO: Adicione ao dependencies {} em $GRADLE_FILE:"
            echo '  testImplementation("junit:junit:4.13.2")'
            echo '  testImplementation("io.mockk:mockk:1.13.12")'
            echo '  testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.9.0")'
        else
            echo "Deps de teste já presentes em $GRADLE_FILE — OK"
        fi
    fi
    echo ""
    echo "Próximos passos:"
    echo "  1. Edite $OUTFILE com asserções reais"
    echo "  2. ./gradlew test --tests '${PACKAGE}.EngineTest'"
    ;;

# ─── Jest (Next.js) ──────────────────────────────────────────────────────────
jest)
    TEST_DIR="$DIR/__tests__"
    mkdir -p "$TEST_DIR"
    OUTFILE="$TEST_DIR/utils.test.ts"
    if [[ -f "$OUTFILE" ]]; then
        echo "Já existe: $OUTFILE — não sobrescrevo."
    else
        cat > "$OUTFILE" << 'TS'
/**
 * Testes Jest para utilitários Next.js.
 * Rode com: pnpm test
 *
 * Padrão: mock de Supabase/Stripe, nunca conexão real em testes unitários.
 */

describe('utils — placeholder', () => {
  it('substitua por teste real', () => {
    // exemplo:
    // expect(formatCurrency(1000)).toBe('R$ 10,00')
    expect(true).toBe(true)
  })
})
TS
        echo "Criado: $OUTFILE"
    fi

    JEST_CONFIG="$DIR/jest.config.ts"
    if [[ ! -f "$JEST_CONFIG" ]]; then
        cat > "$JEST_CONFIG" << 'JESTCFG'
import type { Config } from 'jest'

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
}

export default config
JESTCFG
        echo "Criado: $JEST_CONFIG"
    else
        echo "jest.config.ts já existe — não sobrescrevo."
    fi

    echo ""
    echo "Próximos passos:"
    echo "  1. pnpm add -D jest @types/jest ts-jest (se ainda não instalado)"
    echo "  2. Edite $OUTFILE com testes reais"
    echo "  3. pnpm test"
    ;;

# ─── RLS (Supabase) ──────────────────────────────────────────────────────────
rls)
    mkdir -p "$DIR/supabase/tests"
    OUTFILE="$DIR/supabase/tests/test_rls.sql"
    if [[ -f "$OUTFILE" ]]; then
        echo "Já existe: $OUTFILE — não sobrescrevo."
    else
        # Copia o template de assets se disponível
        SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
        ASSET="$SCRIPT_DIR/../assets/test_rls.sql"
        if [[ -f "$ASSET" ]]; then
            cp "$ASSET" "$OUTFILE"
            echo "Copiado assets/test_rls.sql → $OUTFILE"
        else
            cat > "$OUTFILE" << 'SQL'
-- test_rls.sql — substitua schema/tabelas pelos reais do projeto
-- Execute: psql $SUPABASE_DB_URL -f supabase/tests/test_rls.sql -v ON_ERROR_STOP=1
\set ON_ERROR_STOP on

DO $$
BEGIN
  RAISE NOTICE 'Iniciando testes RLS...';
END $$;

-- TODO: adicione testes de isolamento cross-tenant aqui
-- Veja references/rls-tests.md para padrões completos

DO $$
BEGIN
  RAISE NOTICE 'Todos os testes RLS passaram.';
END $$;
SQL
            echo "Criado: $OUTFILE"
        fi
    fi

    echo ""
    echo "Próximos passos:"
    echo "  1. Edite $OUTFILE com testes reais por papel"
    echo "  2. psql \$SUPABASE_DB_URL -f $OUTFILE -v ON_ERROR_STOP=1"
    echo "  Veja references/rls-tests.md para o padrão completo"
    ;;

# ─── Smoke (AulaLogger crash-safety) ─────────────────────────────────────────
smoke)
    TEST_DIR="$DIR/app/src/test/java/$PACKAGE_PATH/recording"
    mkdir -p "$TEST_DIR"
    OUTFILE="$TEST_DIR/WavWriterTest.kt"
    if [[ -f "$OUTFILE" ]]; then
        echo "Já existe: $OUTFILE — não sobrescrevo."
    else
        cat > "$OUTFILE" << KOTLIN
package $PACKAGE.recording

import org.junit.After
import org.junit.Before
import org.junit.Test
import org.junit.Assert.*
import java.io.File

/**
 * Smoke test de crash-safety para WavWriter.
 * A promessa do AulaLogger é: arquivo válido mesmo após kill do processo.
 *
 * Rode com: ./gradlew test --tests '$PACKAGE.recording.WavWriterTest'
 */
class WavWriterTest {

    private lateinit var tempFile: File

    @Before
    fun setup() {
        tempFile = File.createTempFile("smoke_test_audio", ".wav")
    }

    @After
    fun teardown() {
        tempFile.delete()
    }

    @Test
    fun \`WavWriter gera header RIFF válido\`() {
        // TODO: substitua WavWriter pelo import real do projeto
        // val writer = WavWriter(tempFile, sampleRate = 16000, channels = 1)
        // writer.writeSamples(ShortArray(1600) { 0 })
        // writer.close()
        //
        // val bytes = tempFile.readBytes()
        // assertEquals("RIFF", String(bytes.sliceArray(0..3)))
        // assertEquals("WAVE", String(bytes.sliceArray(8..11)))
        assertTrue("Placeholder — substitua por teste real de WavWriter", true)
    }

    @Test
    fun \`arquivo é recuperável sem close explícito\`() {
        // Simula crash: escreve dados mas não chama close()
        // TODO: substitua pela implementação real
        // val writer = WavWriter(tempFile, sampleRate = 16000, channels = 1)
        // writer.writeSamples(ShortArray(16000) { it.toShort() })
        // writer.flush()  // fsync periódico
        // — não chama writer.close() —
        //
        // assertTrue("Arquivo deve ter dados mesmo sem close()", tempFile.length() > 44)
        assertTrue("Placeholder — substitua por teste real de recovery", true)
    }
}
KOTLIN
        echo "Criado: $OUTFILE"
    fi

    echo ""
    echo "Próximos passos:"
    echo "  1. Substitua os TODOs em $OUTFILE pelos imports reais do AulaLogger"
    echo "  2. ./gradlew test --tests '${PACKAGE}.recording.WavWriterTest'"
    echo "  Veja references/smoke-tests.md para o padrão completo"
    ;;

*)
    echo "Tipo desconhecido: $TYPE. Use: jvm | jest | rls | smoke"
    exit 1
    ;;
esac
