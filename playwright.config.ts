import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "tests/browser",
  timeout: 45000,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5198",
    trace: "retain-on-failure",
    launchOptions: {
      args: [
        "--use-gl=angle",
        "--use-angle=d3d11",
        "--enable-webgl",
        "--ignore-gpu-blocklist",
      ],
    },
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "phone",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
    {
      name: "tablet",
      use: { ...devices["iPad Mini"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: {
    command: "npm run build && node scripts/test-server.mjs",
    url: "http://127.0.0.1:5198",
    reuseExistingServer: false,
    timeout: 120000,
  },
});
