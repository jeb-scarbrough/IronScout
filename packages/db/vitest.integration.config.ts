import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['__tests__/**/*.integration.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    testTimeout: 120000,
    sequence: {
      concurrent: false,
    },
  },
})
