import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { assertRegistryParity } from '../../registry.js'
import { safeJsonParse } from '../../kit/json.js'
import { evaluateFixtureFreshness, validateFixtureMeta } from '../../kit/fixtures.js'
import { runTestCommand } from './test.js'
import { resolveRepoRoot } from '../paths.js'

interface ValidateCommandArgs {
  siteId: string
  strict?: boolean
}

const REQUIRED_SITE_FILES = [
  'manifest.ts',
  'fetch.ts',
  'extract.ts',
  'normalize.ts',
  'index.ts',
  'fixtures/meta.json',
  'tests/contract.test.ts',
]

const PNPM_CMD = 'pnpm'
const PNPM_SHELL = process.platform === 'win32'

function runHarvesterTypecheck(repoRoot: string): boolean {
  const result = spawnSync(
    PNPM_CMD,
    ['--filter', '@ironscout/harvester', 'exec', 'tsc', '--noEmit'],
    {
      cwd: repoRoot,
      stdio: 'inherit',
      shell: PNPM_SHELL,
    }
  )
  return result.status === 0
}

function runHarvesterLint(repoRoot: string): { ok: boolean; skipped: boolean } {
  const result = spawnSync(
    PNPM_CMD,
    ['--filter', '@ironscout/harvester', 'run', 'lint'],
    {
      cwd: repoRoot,
      encoding: 'utf8',
      shell: PNPM_SHELL,
    }
  )

  if (result.status === 0) {
    return { ok: true, skipped: false }
  }

  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`
  if (output.includes('ERR_PNPM_RECURSIVE_RUN_NO_SCRIPT')) {
    console.warn('Lint step skipped: @ironscout/harvester has no lint script configured')
    return { ok: true, skipped: true }
  }

  if (result.stdout) {
    process.stdout.write(result.stdout)
  }
  if (result.stderr) {
    process.stderr.write(result.stderr)
  }
  return { ok: false, skipped: false }
}

export function hasKnownAdapterEntry(registryFileContent: string, siteId: string): boolean {
  return (
    registryFileContent.includes(`id: '${siteId}'`) ||
    registryFileContent.includes(`id: "${siteId}"`)
  )
}

export function extractKnownAdapterIds(registryFileContent: string): string[] {
  const ids: string[] = []
  const regex = /id:\s*['"]([a-z0-9_]+)['"]/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(registryFileContent)) !== null) {
    const id = match[1]
    if (!ids.includes(id)) {
      ids.push(id)
    }
  }
  return ids
}

function hasSiteRegistration(siteIndexContent: string, siteId: string): boolean {
  return siteIndexContent.includes(`./${siteId}/index.js`)
}

export async function runValidateCommand(args: ValidateCommandArgs): Promise<number> {
  if (!args.siteId) {
    console.error('Missing --site-id <siteId>')
    return 2
  }

  const repoRoot = resolveRepoRoot()
  const siteRoot = resolve(repoRoot, 'apps/harvester/src/ingestion/scrape/sites', args.siteId)
  if (!existsSync(siteRoot)) {
    console.error(`Site does not exist: ${siteRoot}`)
    return 4
  }

  for (const file of REQUIRED_SITE_FILES) {
    const abs = resolve(siteRoot, file)
    if (!existsSync(abs)) {
      console.error(`Missing required file: ${abs}`)
      return 4
    }
  }

  const fixtureMetaPath = resolve(siteRoot, 'fixtures/meta.json')
  const fixtureMetaRaw = readFileSync(fixtureMetaPath, 'utf8')
  const parsedMeta = safeJsonParse(fixtureMetaRaw)
  if (!parsedMeta.ok) {
    console.error(`Invalid fixture metadata JSON: ${parsedMeta.error}`)
    return 4
  }

  const metaValidation = validateFixtureMeta(parsedMeta.value)
  if (!metaValidation.ok) {
    console.error(metaValidation.error)
    return 4
  }

  const freshness = evaluateFixtureFreshness(metaValidation.value, {
    strict: args.strict === true,
  })
  if (!freshness.ok) {
    console.error(freshness.error)
    return 4
  }
  if (freshness.status === 'warn' && freshness.warning) {
    console.warn(freshness.warning)
  } else {
    console.log(`Fixture metadata freshness: ok (${freshness.ageDays} days old)`)
  }

  const registryPath = resolve(repoRoot, 'packages/scraper-registry/src/index.ts')
  const registryContent = readFileSync(registryPath, 'utf8')
  if (!hasKnownAdapterEntry(registryContent, args.siteId)) {
    console.error(`packages/scraper-registry missing site '${args.siteId}'`)
    return 4
  }

  const sitesIndexPath = resolve(repoRoot, 'apps/harvester/src/ingestion/scrape/sites/index.ts')
  const sitesIndexContent = readFileSync(sitesIndexPath, 'utf8')
  if (!hasSiteRegistration(sitesIndexContent, args.siteId)) {
    console.error(`ingestion scrape site registry missing site '${args.siteId}'`)
    return 4
  }

  const expectedIds = extractKnownAdapterIds(registryContent)
  const parity = assertRegistryParity(expectedIds)
  if (parity.unknownPluginIds.length > 0 || parity.missingInPluginRegistry.includes(args.siteId)) {
    console.error('Registry parity check failed')
    console.error(`Missing in plugin registry: ${parity.missingInPluginRegistry.join(', ') || '(none)'}`)
    console.error(`Unknown plugin IDs: ${parity.unknownPluginIds.join(', ') || '(none)'}`)
    return 4
  }
  if (parity.missingInPluginRegistry.length > 0) {
    console.warn(
      `Registry parity warning (not yet migrated): ${parity.missingInPluginRegistry.join(', ')}`
    )
  }
  if (!runHarvesterTypecheck(repoRoot)) {
    console.error('Typecheck failed during scraper validate')
    return 5
  }

  const lint = runHarvesterLint(repoRoot)
  if (!lint.ok) {
    console.error('Lint failed during scraper validate')
    return 5
  }

  const testExit = await runTestCommand({ siteId: args.siteId })
  if (testExit !== 0) {
    console.error('Fixture contract tests failed during scraper validate')
    return 5
  }

  return 0
}
