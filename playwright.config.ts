import { defineConfig, devices } from "@playwright/test";

// One-time setup: `npx playwright install chromium`. Requires the local Postgres
// (docker on :5435) and the dev .env. Run with `npm run test:e2e`.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: "http://localhost:3010",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "PORT=3010 npm run start",
    url: "http://localhost:3010/login",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
