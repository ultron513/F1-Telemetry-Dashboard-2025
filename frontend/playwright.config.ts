import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run the real stack: the FastAPI backend in offline mode
 * against the FastF1 cache committed in ../cache (Japanese GP 2025), and a
 * production build of this app.
 *
 *   npm run test:e2e      functional tests
 *   npm run test:visual   visual regression (screenshots in e2e/__screenshots__)
 */
const API_PORT = 8010;
const WEB_PORT = 3010;
const visual = !!process.env.VISUAL;

export default defineConfig({
  testDir: "./e2e",
  snapshotPathTemplate: "{testDir}/__screenshots__/{testFilePath}/{arg}{ext}",
  timeout: 90_000,
  expect: { timeout: 30_000, toHaveScreenshot: { maxDiffPixelRatio: 0.015, animations: "disabled" } },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    trace: "retain-on-failure",
    colorScheme: "dark",
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
  },
  projects: [
    { name: "functional", testIgnore: /visual\.spec\.ts/, use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } } },
    ...(visual ? [{ name: "visual", testMatch: /visual\.spec\.ts/, use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } } }] : []),
  ],
  webServer: [
    {
      command: `python -m uvicorn app.main:app --port ${API_PORT}`,
      cwd: "../backend",
      url: `http://127.0.0.1:${API_PORT}/api/v1/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        F1_OFFLINE: "1",
        F1_DEFAULT_SEASON: "2025",
        CORS_ORIGINS: `http://127.0.0.1:${WEB_PORT},http://localhost:${WEB_PORT}`,
        F1_WAREHOUSE_DIR: process.env.E2E_WAREHOUSE_DIR ?? "/tmp/pitwall-e2e-warehouse",
        F1_HISTORY_CACHE_DIR: "/tmp/pitwall-e2e-history",
      },
    },
    {
      command: `npm run build && npm run start -- -p ${WEB_PORT}`,
      url: `http://127.0.0.1:${WEB_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
      env: { NEXT_PUBLIC_API_URL: `http://127.0.0.1:${API_PORT}` },
    },
  ],
});
