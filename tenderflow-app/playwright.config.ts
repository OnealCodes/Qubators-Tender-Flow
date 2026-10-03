import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 120000,
  retries: 0,
  workers: 1,
  use: {
    baseURL: "http://localhost:3000",
    channel: "chromium-headless-shell",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --port 3000",
    port: 3000,
    reuseExistingServer: true,
    timeout: 180000,
    env: { ...process.env } as Record<string, string>,
  },
});
