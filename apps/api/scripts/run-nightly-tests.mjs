import { spawnSync } from 'node:child_process'

const result = spawnSync('vitest run', {
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
