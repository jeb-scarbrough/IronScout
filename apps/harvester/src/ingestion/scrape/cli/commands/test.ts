import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

interface TestCommandArgs {
  siteId: string
}

const SITE_ID_PATTERN = /^[a-z0-9_]+$/
const PNPM_CMD = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'

export async function runTestCommand(args: TestCommandArgs): Promise<number> {
  if (!args.siteId) {
    console.error('Missing --site-id <siteId>')
    return 2
  }
  if (!SITE_ID_PATTERN.test(args.siteId)) {
    console.error('siteId must match /^[a-z0-9_]+$/')
    return 2
  }

  const repoRoot = process.cwd()
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
      ['--filter', '@ironscout/harvester', 'exec', 'vitest', 'run', testFile],
      {
        cwd: repoRoot,
        stdio: 'inherit',
      }
    )
    return result.status === 0 ? 0 : 6
  } catch {
    return 6
  }
}
