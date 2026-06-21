import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["dotenv/config"],
    include: ["lib/**/*.test.ts", "tests/**/*.test.ts"],
    exclude: ["node_modules/**", "e2e/**", ".next/**"],
    // Integration suites share one local Postgres and reset it in beforeEach/afterAll,
    // so test files must run one at a time — parallel files would wipe each other mid-run.
    fileParallelism: false,
  },
});
