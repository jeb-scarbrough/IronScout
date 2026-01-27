import { defineConfig, devices } from '@playwright/test'

const E2E_ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'e2e-admin@ironscout.local'

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
  globalSetup: './e2e/global-setup.ts',

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
        storageState: 'e2e/.storage/admin.json',
      },
    },
    {
      name: 'merchant',
      testMatch: 'merchant/**/*.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.E2E_MERCHANT_URL || 'http://localhost:3003',
        storageState: 'e2e/.storage/merchant.json',
      },
    },
  ],

  // Run local dev servers before tests
  webServer: [
    {
      command: 'pnpm -C apps/web dev',
      url: 'http://localhost:3000',
      reuseExistingServer: false,
      timeout: 120 * 1000,
      env: {
        PORT: '3000',
        NODE_ENV: 'development',
        NEXT_PUBLIC_API_URL: 'http://localhost:8000',
        GOOGLE_CLIENT_ID: 'e2e-google-client-id',
        GOOGLE_CLIENT_SECRET: 'e2e-google-client-secret',
        JWT_SECRET: 'e2e-jwt-secret',
        NEXTAUTH_URL: 'http://localhost:3000',
        NEXT_PUBLIC_E2E_TEST_MODE: 'true',
      },
    },
    {
      command: 'pnpm -C apps/admin dev',
      url: 'http://localhost:3002',
      reuseExistingServer: false,
      timeout: 120 * 1000,
      env: {
        NODE_ENV: 'development',
        E2E_TEST_MODE: 'true',
        NEXTAUTH_SECRET: 'e2e-jwt-secret',
        ADMIN_EMAILS: E2E_ADMIN_EMAIL,
      },
    },
    {
      command: 'pnpm -C apps/merchant dev',
      url: 'http://localhost:3003',
      reuseExistingServer: false,
      timeout: 120 * 1000,
      env: {
        NODE_ENV: 'development',
        E2E_TEST_MODE: 'true',
      },
    },
  ],
})
