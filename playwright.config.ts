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
    // APP_BASE_URL must match the test origin: redirects are built from it
    // (so they resolve correctly behind a proxy), not from the request URL.
    command: "APP_BASE_URL=http://localhost:3010 PORT=3010 npm run start",
    url: "http://localhost:3010/login",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
