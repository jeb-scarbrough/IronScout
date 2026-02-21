#!/usr/bin/env node
"use strict"

import { spawnSync } from 'node:child_process'

const args = process.argv.slice(2)
const result = spawnSync(
  'pnpm',
  [
    '--filter',
    '@ironscout/harvester',
    'exec',
    'tsx',
    'src/ingestion/scrape/cli/index.ts',
    'test',
    ...args,
  ],
  {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  }
)

process.exit(result.status ?? 1)
