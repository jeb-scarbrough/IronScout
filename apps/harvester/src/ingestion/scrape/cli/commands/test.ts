import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { resolveRepoRoot } from '../paths.js'

interface TestCommandArgs {
  siteId: string
}

const SITE_ID_PATTERN = /^[a-z0-9_]+$/
const PNPM_CMD = 'pnpm'
const PNPM_SHELL = process.platform === 'win32'

export async function runTestCommand(args: TestCommandArgs): Promise<number> {
  if (!args.siteId) {
    console.error('Missing --site-id <siteId>')
    return 2
  }
  if (!SITE_ID_PATTERN.test(args.siteId)) {
    console.error('siteId must match /^[a-z0-9_]+$/')
    return 2
  }

  const repoRoot = resolveRepoRoot()
  const contractVitestConfig = resolve(
    repoRoot,
    'apps/harvester/src/ingestion/scrape/cli/vitest.contract.config.ts'
  )
  const testFile = resolve(
    repoRoot,
    'apps/harvester/src/ingestion/scrape/sites',
    args.siteId,
    'tests/contract.test.ts'
  )

  if (!existsSync(testFile)) {
    console.error(`Contract test file not found: ${testFile}`)
    return 6
  }

  try {
    const result = spawnSync(
      PNPM_CMD,
      [
        '--filter',
        '@ironscout/harvester',
        'exec',
        'vitest',
        'run',
        '--config',
        contractVitestConfig,
        testFile,
      ],
      {
        cwd: repoRoot,
        stdio: 'inherit',
        shell: PNPM_SHELL,
      }
    )
    return result.status === 0 ? 0 : 6
  } catch {
    return 6
  }
}
