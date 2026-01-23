import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['__tests__/**/*.{test,spec}.ts'],
    // Integration tests require test containers - run separately with test:integration
    exclude: ['**/node_modules/**', '**/dist/**', '**/*.integration.test.ts'],

    // DB tests need longer timeout for connection/queries
    testTimeout: 30000,

    // Run tests sequentially since they may share DB connection
    sequence: {
      concurrent: false,
    },
  },
})
