import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

interface TestCommandArgs {
  siteId: string
}

export async function runTestCommand(args: TestCommandArgs): Promise<number> {
  if (!args.siteId) {
    console.error('Missing --site-id <siteId>')
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
    execSync(
      `pnpm --filter @ironscout/harvester exec vitest run "${testFile}"`,
      {
        cwd: repoRoot,
        stdio: 'inherit',
      }
    )
    return 0
  } catch {
    return 6
  }
}
