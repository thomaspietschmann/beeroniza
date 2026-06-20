import { defineConfig, devices } from "@playwright/test";

// e2e configuration. Designed to run in a CI pipeline: it boots the dev server
// (reused locally), authenticates once, and records a video for every test as a
// downloadable artifact. CI must provide a Postgres DATABASE_URL and run
// `prisma migrate deploy` + `npm run db:seed` (admin@example.org / 123456)
// before invoking `npx playwright test`.
const PORT = Number(process.env.E2E_PORT ?? 3939);
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  // Create the isolated test user (+ seeds) before, remove it after, so tests
  // never touch real/production data.
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  // Shared database state across tests → run serially for determinism.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // Always record a video per test; kept as a CI artifact (test-results/).
    video: "on",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/admin.json" },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: `PORT=${PORT} npm run dev`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
