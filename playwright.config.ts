import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 120_000,
  fullyParallel: false,
  use: {
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  webServer: [
    {
      command: "npm run test:serve:api",
      url: "http://127.0.0.1:4100/health",
      reuseExistingServer: false,
      timeout: 300_000
    },
    {
      command: "npm run test:serve:admin",
      url: "http://127.0.0.1:3101",
      reuseExistingServer: false,
      timeout: 180_000
    },
    {
      command: "npm run test:serve:public",
      url: "http://127.0.0.1:3100",
      reuseExistingServer: false,
      timeout: 180_000
    }
  ]
})
