// Vitest scope: unit tests under lib/ only. Playwright specs in e2e/ run
// via `npm run test:e2e`, never collected by vitest (housekeeping fix).
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: ["e2e/**", "**/node_modules/**", "**/test-results/**"],
  },
});
