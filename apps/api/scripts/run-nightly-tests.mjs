import { spawnSync } from 'node:child_process'

const nightlySearchTests = [
  'src/services/ai-search/__tests__/search-service.test.ts',
  'src/services/ai-search/__tests__/queryraw-safety.test.ts',
  'src/services/ai-search/__tests__/consumer-output-safety.test.ts',
  'src/services/ai-search/__tests__/functional/search-functional-matrix.test.ts',
  'src/services/ai-search/__tests__/functional/search-relevance-ranking.test.ts',
  'src/services/ai-search/__tests__/functional/search-functional-exhaustive-nightly.test.ts',
  'src/services/ai-search/__tests__/functional/search-options-exhaustive-nightly.test.ts',
]

const command = `vitest run ${nightlySearchTests.join(' ')}`

const result = spawnSync(command, {
  shell: true,
  stdio: 'inherit',
  env: {
    ...process.env,
    RUN_EXHAUSTIVE_SEARCH_MATRIX: '1',
  },
})

if (result.error) {
  throw result.error
}

process.exit(result.status ?? 1)
