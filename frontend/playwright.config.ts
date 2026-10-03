import { defineConfig, devices } from '@playwright/test';

/**
 * E2E 冒煙測試：以 production build（`next start`）驗證頁面可載入、
 * 且沒有 runtime／CSP 錯誤。刻意用 production build，才能重現 CSP 生效下的行為
 * （例如先前 p5 的 eval 被 CSP 擋下的 regression）。
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI
    ? [['github'], ['list'], ['html', { open: 'never' }]]
    : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // 需先以空 API URL 建置（前端走同源相對路徑，E2E 用 route mock 攔截，無 CORS）：
    // CI 由前面的 `npm run build` 完成；本機請先 `NEXT_PUBLIC_API_URL= npm run build`。
    command: 'npm run start',
    url: 'http://localhost:3000/login',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
