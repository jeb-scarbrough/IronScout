import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { assertRegistryParity } from '../../registry.js'

interface ValidateCommandArgs {
  siteId: string
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

function hasKnownAdapterEntry(registryFileContent: string, siteId: string): boolean {
  return registryFileContent.includes(`id: '${siteId}'`)
}

function extractKnownAdapterIds(registryFileContent: string): string[] {
  const ids: string[] = []
  const regex = /id:\s*'([a-z0-9_]+)'/g
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

  const repoRoot = process.cwd()
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

  return 0
}
