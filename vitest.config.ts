import { defineConfig } from "vitest/config";

// node:sqlite emits an ExperimentalWarning on first import. This is expected
// (see task brief) but clutters test output, so we silence Node warnings for
// the test run. Setting it here (rather than in the npm script) keeps the
// fix cross-platform (Windows/macOS/Linux) since it avoids shell-specific
// env var syntax.
process.env.NODE_NO_WARNINGS = "1";

export default defineConfig({});
