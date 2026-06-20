# Smoke Tests de Crash-Safety — AulaLogger

## Por que AulaLogger precisa de smoke tests

A proposta central do AulaLogger é "gravação crash-safe de aulas longas (4h+)". O app usa foreground service + `fsync` periódico + WavWriter para garantir que o áudio não se perde em caso de kill do processo. Sem um teste automatizado dessa promessa, qualquer refatoração no `recording/` pode silenciosamente quebrar o `fsync` e ninguém vai saber até um professor perder 4 horas de aula.

Os smoke tests não testam a UI — testam a invariante crítica: **o arquivo WAV gerado é válido mesmo após interrupção abrupta do processo**.

## Estrutura de diretórios

```
app/src/test/java/com/aulalogger/
├── recording/
│   ├── WavWriterTest.kt          ← testa que header WAV é escrito corretamente
│   ├── RecoveryTest.kt           ← testa recuperação de arquivo parcial
│   └── CrashSafetyTest.kt        ← testa invariante central: arquivo válido após kill
└── transcription/
    └── WhisperBridgeTest.kt      ← testa que JNI bridge retorna texto para áudio conhecido
```

## Padrão: WavWriterTest

```kotlin
class WavWriterTest {
    private lateinit var tempFile: File

    @Before
    fun setup() {
        tempFile = File.createTempFile("test_audio", ".wav")
    }

    @After
    fun teardown() {
        tempFile.delete()
    }

    @Test
    fun `WavWriter gera header RIFF válido`() {
        val writer = WavWriter(tempFile, sampleRate = 16000, channels = 1)
        writer.writeSamples(ShortArray(1600) { 0 })  // 0.1s de silêncio
        writer.close()

        // Verifica magic bytes do formato WAV
        val bytes = tempFile.readBytes()
        assertEquals("RIFF", String(bytes.sliceArray(0..3)))
        assertEquals("WAVE", String(bytes.sliceArray(8..11)))
        assertEquals("fmt ", String(bytes.sliceArray(12..15)))
    }

    @Test
    fun `WavWriter com fsync periódico gera arquivo recuperável`() {
        val writer = WavWriter(tempFile, sampleRate = 16000, channels = 1)
        // Simula 3 chunks de áudio com fsync entre eles
        repeat(3) {
            writer.writeSamples(ShortArray(16000) { it.toShort() })
            writer.flush()  // simula o fsync periódico
        }
        // Simula kill sem close() — não chama writer.close()

        // Arquivo deve ser recuperável (header atualizado no flush)
        assertTrue("Arquivo deve ter tamanho > 0 mesmo sem close()", tempFile.length() > 44)
        val bytes = tempFile.readBytes()
        assertEquals("RIFF", String(bytes.sliceArray(0..3)))
    }
}
```

## Padrão: RecoveryTest

```kotlin
class RecoveryTest {
    @Test
    fun `RecordingRecovery encontra arquivo parcial e corrige header`() {
        // Cria arquivo WAV truncado (simula crash no meio da gravação)
        val truncated = File.createTempFile("crash_audio", ".wav")
        writeWavHeader(truncated, sampleRate = 16000, dataSize = 0)  // header com tamanho errado
        truncated.appendBytes(ShortArray(8000) { it.toShort() }.toByteArray())

        // Executa recovery
        val recovered = RecordingRecovery.fixHeader(truncated)

        assertTrue("Recovery deve retornar arquivo válido", recovered.isValid)
        assertEquals(16000, recovered.sampleRate)
        assertTrue("DataSize deve refletir bytes reais", recovered.dataSize > 0)

        truncated.delete()
    }
}
```

## Padrão: WhisperBridgeTest (JNI)

O JNI é a parte mais frágil — muda de ABI, compilation flags ou NDK version pode silenciosamente retornar string vazia.

```kotlin
class WhisperBridgeTest {
    @Test
    fun `WhisperBridge retorna transcrição não-vazia para áudio de referência`() {
        // Usa arquivo de áudio fixo (incluído em src/test/resources/)
        val audioFile = javaClass.getResourceAsStream("/test_audio_pt_br.wav")!!
            .readBytes()
        val bridge = WhisperBridge(modelPath = "src/test/resources/ggml-tiny.bin")

        val result = bridge.transcribe(audioFile, language = "pt")

        assertNotNull("Transcrição não deve ser null", result)
        assertTrue("Transcrição não deve ser vazia", result.isNotEmpty())
        // Verifica que o texto contém palavras esperadas do áudio de referência
        assertTrue("Deve conter 'teste'", result.lowercase().contains("teste"))
    }
}
```

Inclua `ggml-tiny.bin` (39MB) em `src/test/resources/` e adicione ao `.gitignore` se muito grande, ou hospede como GitHub Release asset e baixe no CI.

## Gradle — habilitar testes com recursos nativos

```kotlin
// app/build.gradle.kts
android {
    testOptions {
        unitTests {
            isIncludeAndroidResources = true
            isReturnDefaultValues = true  // mock Android APIs (como Context)
        }
    }
}
```

## CI snippet

```yaml
- name: Smoke tests AulaLogger
  run: ./gradlew test --tests "com.aulalogger.recording.*" --no-daemon
  working-directory: ./app

- name: Falha se crash-safety quebrou
  run: |
    if grep -q "FAILED" build/reports/tests/test/index.html; then
      echo "CRÍTICO: smoke test de crash-safety falhou"
      exit 1
    fi
```

## Invariante do critério de aceite

O teste `WavWriter_com_fsync_gera_arquivo_recuperável` deve rodar verde após qualquer mudança no `recording/`. Se falhar, o build inteiro falha — não há exceção para "só um refactor de estilo".
