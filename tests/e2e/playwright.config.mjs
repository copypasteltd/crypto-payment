import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const dashboardPort = 43173;
const mobilePort = 43174;
const adminPort = 43175;
const resolvedChannel = process.env.PLAYWRIGHT_CHANNEL?.trim() || undefined;

export default defineConfig({
  testDir: path.resolve("tests/e2e/specs"),
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { outputFolder: path.resolve("playwright-report"), open: "never" }]],
  outputDir: path.resolve("tests/evidence/playwright/output"),
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: [
    {
      command: "node ./serve-static.mjs --root ../../app/dashboard/dist --port 43173",
      url: `http://127.0.0.1:${dashboardPort}`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: "node ./serve-static.mjs --root ../../app/mobile/dist --port 43174",
      url: `http://127.0.0.1:${mobilePort}`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: "node ./serve-static.mjs --root ../../app/admin/dist --port 43175",
      url: `http://127.0.0.1:${adminPort}`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
  projects: [
    {
      name: "dashboard",
      testMatch: /dashboard\.spec\.mjs$/,
      use: {
        ...devices["Desktop Chrome"],
        ...(resolvedChannel ? { channel: resolvedChannel } : {}),
        baseURL: `http://127.0.0.1:${dashboardPort}`,
      },
    },
    {
      name: "admin",
      testMatch: /admin\.spec\.mjs$/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        ...(resolvedChannel ? { channel: resolvedChannel } : {}),
        baseURL: `http://127.0.0.1:${adminPort}`,
      },
    },
    {
      name: "mobile-h5",
      testMatch: /mobile\.spec\.mjs$/,
      use: {
        ...devices["Pixel 7"],
        ...(resolvedChannel ? { channel: resolvedChannel } : {}),
        baseURL: `http://127.0.0.1:${mobilePort}`,
      },
    },
  ],
});
