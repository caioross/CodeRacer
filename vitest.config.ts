import { defineConfig } from "vitest/config";

// Runner de testes dev-only (não entra no bundle de runtime). As funções-alvo
// (sanitizeResults/clampInt) são puras e não tocam o DOM, então `node` basta.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"]
  }
});
