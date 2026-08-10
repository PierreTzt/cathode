import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// node:sqlite emits an ExperimentalWarning on first import. This is expected
// (see task brief) but clutters test output, so we silence Node warnings for
// the test run. Setting it here (rather than in the npm script) keeps the
// fix cross-platform (Windows/macOS/Linux) since it avoids shell-specific
// env var syntax.
process.env.NODE_NO_WARNINGS = "1";

export default defineConfig({
  // tsconfig laisse le JSX à Next ("preserve") ; esbuild doit donc être dit
  // explicitement d'utiliser le runtime automatique, sinon il génère des
  // React.createElement et les tests échouent sur « React is not defined ».
  esbuild: { jsx: "automatic" },
  resolve: {
    // Même alias que tsconfig, pour que les composants résolvent "@/lib/…".
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    globals: true,
    // Les tests de composants déclarent `// @vitest-environment happy-dom` en
    // tête de fichier ; le reste de la suite tourne en Node, plus rapide.
    environment: "node",
    setupFiles: ["tests/setup.ts"],
  },
});
