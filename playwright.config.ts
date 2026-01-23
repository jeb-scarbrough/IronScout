import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E Test Configuration
 *
 * Runs E2E tests against the web app.
 *
 * Usage:
 *   pnpm test:e2e         # Run all E2E tests
 *   pnpm test:e2e --ui    # Open Playwright UI
 */

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'web',
      testMatch: 'web/**/*.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.E2E_WEB_URL || 'http://localhost:3000',
      },
    },
    {
      name: 'admin',
      testMatch: 'admin/**/*.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.E2E_ADMIN_URL || 'http://localhost:3002',
      },
    },
    {
      name: 'merchant',
      testMatch: 'merchant/**/*.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.E2E_MERCHANT_URL || 'http://localhost:3003',
      },
    },
  ],

  // Run local dev servers before tests
  webServer: [
    {
      command: 'pnpm --filter @ironscout/web dev -- --port 3000',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
      env: {
        NEXT_PUBLIC_E2E_TEST_MODE: 'true',
      },
    },
    {
      command: 'pnpm --filter @ironscout/admin dev',
      url: 'http://localhost:3002',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
      env: {
        E2E_TEST_MODE: 'true',
        E2E_AUTH_BYPASS: 'true',
      },
    },
    {
      command: 'pnpm --filter @ironscout/merchant dev',
      url: 'http://localhost:3003',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
      env: {
        E2E_TEST_MODE: 'true',
        E2E_AUTH_BYPASS: 'true',
      },
    },
  ],
})
