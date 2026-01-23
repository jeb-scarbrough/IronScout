import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    // Integration tests require test containers - run separately with test:integration
    exclude: ['**/node_modules/**', '**/dist/**', 'src/__tests__/integration/**/*.integration.test.ts'],

    // Longer timeout for integration tests hitting real DB
    testTimeout: 30000,

    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/node_modules/**',
        '**/dist/**',
        'src/test-setup.ts',
      ],
    },
  },
})
