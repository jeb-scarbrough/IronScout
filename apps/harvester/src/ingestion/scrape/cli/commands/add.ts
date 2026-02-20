import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

interface AddCommandArgs {
  siteId: string
  name: string
  mode: 'html' | 'json'
  owner: string
  force: boolean
}

const SITE_ID_PATTERN = /^[a-z0-9_]+$/

function fail(message: string, code = 2): never {
  const error = new Error(message) as Error & { exitCode?: number }
  error.exitCode = code
  throw error
}

function asTsString(value: string): string {
  return JSON.stringify(value)
}

function templateManifest(args: AddCommandArgs, baseUrl: string): string {
  return `import type { ScrapePluginManifest } from '../../types.js'

export const manifest: ScrapePluginManifest = {
  id: ${asTsString(args.siteId)},
  name: ${asTsString(args.name)},
  owner: ${asTsString(args.owner)},
  version: '0.1.0',
  mode: ${asTsString(args.mode)},
  baseUrls: [${asTsString(baseUrl)}],
  rateLimit: {
    requestsPerSecond: 0.5,
    minDelayMs: 500,
    maxConcurrent: 1,
  },
}
`
}

function templateFetch(): string {
  return `import { fetchWithPolicy } from '../../kit/http.js'
import { manifest } from './manifest.js'

export async function fetchRaw(url: string) {
  // Note: bridge mode uses legacy fetcher during migration.
  // This fetch is used by plugin-native runtime and scraper smoke.
  return fetchWithPolicy({
    url,
    mode: manifest.mode,
    baseUrls: manifest.baseUrls,
    rateLimit: manifest.rateLimit,
  })
}
`
}

function templateExtract(args: AddCommandArgs): string {
  const fixtureExt = args.mode === 'json' ? 'json' : 'html'
  return `import type { ScrapePluginExtractResult } from '../../types.js'

export function extractRaw(payload: string, _url: string): ScrapePluginExtractResult {
  if (!payload || payload.trim().length === 0) {
    return { ok: false, reason: 'EMPTY_PAGE' }
  }

  return {
    ok: false,
    reason: 'PAGE_STRUCTURE_CHANGED',
    details: 'Template extractor not implemented. Add fixture-backed extraction logic for .${fixtureExt} payloads.',
  }
}
`
}

function templateNormalize(): string {
  return `import type { NormalizeInput, NormalizeResult } from '../../types.js'
import { normalizeOffer } from '../../kit/normalize.js'
import { validateNormalizedOffer } from '../../kit/validate.js'

export function normalizeRaw(input: NormalizeInput): NormalizeResult {
  const normalized = normalizeOffer(input)
  const validation = validateNormalizedOffer(normalized)
  if (!validation.ok) {
    return {
      status: validation.status,
      reason: validation.reason,
    }
  }
  return { status: 'ok', offer: normalized }
}
`
}

function templateIndex(): string {
  return `import type { ScrapeSitePlugin } from '../../types.js'
import { manifest } from './manifest.js'
import { fetchRaw } from './fetch.js'
import { extractRaw } from './extract.js'
import { normalizeRaw } from './normalize.js'

export const plugin: ScrapeSitePlugin = {
  manifest,
  fetchRaw: async (input) => fetchRaw(input.url),
  extractRaw,
  normalizeRaw,
}
`
}

function templateTest(args: AddCommandArgs): string {
  const fixtureExt = args.mode === 'json' ? 'json' : 'html'
  return `import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { plugin } from '../index.js'
import { deterministicHash } from '../../../kit/fixtures.js'

describe('${args.siteId} contract', () => {
  it('fixture contract placeholder', () => {
    const fixturePath = join(__dirname, '../fixtures/in-stock.${fixtureExt}')
    const payload = readFileSync(fixturePath, 'utf8')
    const extracted = plugin.extractRaw(payload, 'https://example.com')

    // Template contract intentionally starts failing until extraction is implemented.
    expect(extracted.ok).toBe(false)
    if (extracted.ok) {
      expect(deterministicHash(extracted.rawOffers)).toBeTypeOf('string')
    }
  })
})
`
}

function templateFixturesReadme(): string {
  return `# Fixtures

Required:
- in-stock fixture
- out-of-stock fixture
- one malformed/edge fixture
- meta.json with capturedAt/capturedFrom/capturedBy/notes

Rules:
- no live network in contract tests
- fixture outputs must be deterministic
- update expected hash only when normalization behavior intentionally changes
`
}

function upsertKnownAdaptersEntry(
  registryPath: string,
  args: AddCommandArgs,
  domain: string,
  baseUrl: string
): void {
  const existing = readFileSync(registryPath, 'utf8')
  if (existing.includes(`id: '${args.siteId}'`)) {
    return
  }

  const marker = '// __KNOWN_ADAPTERS_INSERT__'
  if (!existing.includes(marker)) {
    fail(`Missing marker '${marker}' in ${registryPath}`, 3)
  }

  const entry = `  {
    id: ${asTsString(args.siteId)},
    name: ${asTsString(args.name)},
    domain: ${asTsString(domain)},
    productPathPattern: '/product/',
    owner: ${asTsString(args.owner)},
    mode: ${asTsString(args.mode)},
    version: '0.1.0',
    baseUrls: [${asTsString(baseUrl)}],
  },
  ${marker}`

  writeFileSync(registryPath, existing.replace(marker, entry), 'utf8')
}

function upsertSiteRegistration(sitesIndexPath: string, args: AddCommandArgs): void {
  const existing = readFileSync(sitesIndexPath, 'utf8')
  const importLine = `import { plugin as ${args.siteId}Plugin } from './${args.siteId}/index.js'`
  if (existing.includes(importLine)) {
    return
  }

  const marker = '// __SITE_PLUGIN_REGISTRATIONS_INSERT__'
  if (!existing.includes(marker)) {
    fail(`Missing marker '${marker}' in ${sitesIndexPath}`, 3)
  }

  const withImport = `${importLine}\n${existing}`
  const registrationLine = `  { manifest: ${args.siteId}Plugin.manifest, load: async () => ${args.siteId}Plugin },
  ${marker}`
  writeFileSync(
    sitesIndexPath,
    withImport.replace(marker, registrationLine),
    'utf8'
  )
}

function writeFile(path: string, content: string, force: boolean): void {
  if (existsSync(path) && !force) {
    fail(`File already exists: ${path}`, 3)
  }
  writeFileSync(path, content, 'utf8')
}

export async function runAddCommand(args: AddCommandArgs): Promise<number> {
  if (!SITE_ID_PATTERN.test(args.siteId)) {
    fail('siteId must match /^[a-z0-9_]+$/', 2)
  }
  if (!args.name.trim()) {
    fail('name is required', 2)
  }
  if (args.mode !== 'html' && args.mode !== 'json') {
    fail('mode must be html or json', 2)
  }

  const repoRoot = process.cwd()
  const domain = `${args.siteId.replace(/_/g, '-')}.com`
  const baseUrl = `https://www.${domain}`
  const siteRoot = resolve(repoRoot, 'apps/harvester/src/ingestion/scrape/sites', args.siteId)
  const fixturesRoot = join(siteRoot, 'fixtures')
  const testsRoot = join(siteRoot, 'tests')

  if (existsSync(siteRoot) && !args.force) {
    fail(`Site already exists: ${siteRoot}`, 3)
  }

  mkdirSync(fixturesRoot, { recursive: true })
  mkdirSync(testsRoot, { recursive: true })

  writeFile(join(siteRoot, 'manifest.ts'), templateManifest(args, baseUrl), args.force)
  writeFile(join(siteRoot, 'fetch.ts'), templateFetch(), args.force)
  writeFile(join(siteRoot, 'extract.ts'), templateExtract(args), args.force)
  writeFile(join(siteRoot, 'normalize.ts'), templateNormalize(), args.force)
  writeFile(join(siteRoot, 'index.ts'), templateIndex(), args.force)

  const fixtureExt = args.mode === 'json' ? 'json' : 'html'
  writeFile(join(fixturesRoot, `in-stock.${fixtureExt}`), '', args.force)
  writeFile(join(fixturesRoot, `out-of-stock.${fixtureExt}`), '', args.force)
  writeFile(join(fixturesRoot, 'README.md'), templateFixturesReadme(), args.force)
  writeFile(
    join(fixturesRoot, 'meta.json'),
    JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        capturedFrom: 'TEMPLATE_PLACEHOLDER',
        capturedBy: 'scraper:add',
        notes: 'Replace with captured fixtures before enabling site.',
      },
      null,
      2
    ) + '\n',
    args.force
  )
  writeFile(join(testsRoot, 'contract.test.ts'), templateTest(args), args.force)

  upsertKnownAdaptersEntry(
    resolve(repoRoot, 'packages/scraper-registry/src/index.ts'),
    args,
    domain,
    baseUrl
  )
  upsertSiteRegistration(
    resolve(repoRoot, 'apps/harvester/src/ingestion/scrape/sites/index.ts'),
    args
  )

  return 0
}
