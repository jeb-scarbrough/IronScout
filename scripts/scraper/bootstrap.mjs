#!/usr/bin/env node
"use strict"

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { parseArgs } from '../lib/utils.mjs'
import { loadEnv } from '../lib/load-env.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '../..')
const nodeBin = process.execPath
const scraperConfigDir = resolve(projectRoot, '.ironscout', 'scraper')

function fail(message) {
  console.error(`Error: ${message}`)
  process.exit(1)
}

function formatDefaultValue(value, maxLength = 120) {
  if (!value) return ''
  const raw = String(value).replace(/\s+/g, ' ').trim()
  if (raw.length <= maxLength) return raw
  return `${raw.slice(0, maxLength - 3)}...`
}

function buildPrompt(question, defaultValue) {
  if (!defaultValue) return `${question} `
  const display = formatDefaultValue(defaultValue)
  return `${question} [${display}] `
}

function buildYesNoQuestion(question, defaultNo) {
  const suffix = defaultNo ? '(y/N)' : '(Y/n)'
  return `${question} ${suffix} `
}

function loadScraperConfig(adapterId) {
  const path = resolve(scraperConfigDir, `${adapterId}.json`)
  if (!existsSync(path)) {
    return { path, data: null }
  }

  try {
    const raw = readFileSync(path, 'utf8')
    const data = JSON.parse(raw)
    return { path, data }
  } catch (error) {
    console.warn(`Warning: failed to read scraper config at ${path}: ${error?.message || error}`)
    return { path, data: null }
  }
}

function saveScraperConfig(path, data) {
  mkdirSync(scraperConfigDir, { recursive: true })
  const payload = {
    ...data,
    lastUpdatedAt: new Date().toISOString(),
  }
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
}

function defaultNoFrom(value) {
  if (typeof value === 'boolean') {
    return value === false
  }
  return false
}

async function promptText(question, defaultValue = '') {
  if (!process.stdin.isTTY) return defaultValue
  const rl = createInterface({ input, output })
  try {
    const raw = (await rl.question(question)).trim()
    return raw || defaultValue
  } finally {
    rl.close()
  }
}

async function promptYesNo(question, defaultNo = false) {
  if (!process.stdin.isTTY) return false
  const rl = createInterface({ input, output })
  try {
    const raw = (await rl.question(question)).trim().toLowerCase()
    if (!raw) return !defaultNo
    return raw === 'y' || raw === 'yes'
  } finally {
    rl.close()
  }
}

async function runNodeScript(scriptPath, args) {
  const fullPath = resolve(projectRoot, scriptPath)
  return await new Promise((resolvePromise) => {
    const child = spawn(nodeBin, [fullPath, ...args], {
      cwd: projectRoot,
      stdio: 'inherit',
      shell: false,
    })

    child.on('close', (code) => {
      resolvePromise(code ?? 0)
    })
  })
}

function splitList(value) {
  if (!value) return []
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
}

function nowTag() {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

function parsePositiveInt(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback
  const parsed = Number.parseInt(String(value), 10)
  if (!Number.isFinite(parsed) || parsed < 1) return fallback
  return parsed
}

function parseDiscoveryUrls(discoveryFilePath) {
  if (!discoveryFilePath || !existsSync(discoveryFilePath)) {
    return []
  }
  const text = readFileSync(discoveryFilePath, 'utf8')
  const urls = []
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    if (/^https?:\/\//i.test(line)) {
      urls.push(line)
    }
  }
  return Array.from(new Set(urls))
}

function buildBootstrapArtifacts({ adapterId, discoveredUrls, scrapeConfig }) {
  const runDir = resolve(projectRoot, 'tmp', 'scraper-bootstrap', `${adapterId}-${nowTag()}`)
  mkdirSync(runDir, { recursive: true })

  const urlListPath = resolve(runDir, 'urls.txt')
  writeFileSync(urlListPath, `${discoveredUrls.join('\n')}\n`, 'utf8')

  const csvLines = ['url,adapterId', ...discoveredUrls.map(url => `${url},${adapterId}`)]
  const csvPath = resolve(runDir, 'targets-import.csv')
  writeFileSync(csvPath, `${csvLines.join('\n')}\n`, 'utf8')

  const scrapeConfigPath = resolve(runDir, 'scrape-config.suggested.json')
  writeFileSync(scrapeConfigPath, `${JSON.stringify(scrapeConfig, null, 2)}\n`, 'utf8')

  return {
    runDir,
    urlListPath,
    csvPath,
    scrapeConfigPath,
  }
}

function printUiHandoffChecklist({ adapterId, artifacts, discoveredCount }) {
  console.log('')
  console.log('UI handoff checklist (complete in Admin):')
  console.log('1. Create or verify Retailer record for the site domain.')
  console.log(`2. Create or verify Source for adapter "${adapterId}".`)
  console.log('3. Set source trust config values as required by policy.')
  console.log('4. Update source scrapeConfig (if needed) using suggested JSON:')
  console.log(`   ${artifacts.scrapeConfigPath}`)
  console.log('5. Import scrape targets in Admin /scrapers using CSV:')
  console.log(`   ${artifacts.csvPath}`)
  console.log(`   (discovered URLs: ${discoveredCount})`)
  console.log('6. Keep source disabled until approval gates are complete, then enable for controlled run.')
  console.log('')
  console.log('Generated artifacts:')
  console.log(`- runDir: ${artifacts.runDir}`)
  console.log(`- urlList: ${artifacts.urlListPath}`)
  console.log(`- uploadCsv: ${artifacts.csvPath}`)
  console.log(`- scrapeConfig: ${artifacts.scrapeConfigPath}`)
}

function printHelp() {
  console.log('bootstrap.mjs')
  console.log('  --id <adapterId> (required)')
  console.log('  --domain <domain> (required)')
  console.log('  --version <semver> (default: 0.1.0)')
  console.log('  --source-url <url> (for discovery, optional)')
  console.log('  --listing <url> (repeatable, for discovery)')
  console.log('  --sitemap <url> (repeatable, for discovery)')
  console.log('  --product-path-prefix /product/ (for discovery)')
  console.log('  --product-url-regex "<regex>" (for discovery)')
  console.log('  --target-url-template "<url with {slug}>" (for discovery)')
  console.log('  --paginate (discovery)')
  console.log('  --max-pages 10 (discovery)')
  console.log('  --max-urls 500 (discovery)')
  console.log('  --skip-dry-run (run discovery without --dry-run)')
  console.log('  --skip-validate (skip scraper:validate step)')
  console.log('  --skip-smoke (skip scraper:smoke step)')
  console.log('  --smoke-limit 20 (smoke URL cap)')
  console.log('  --scrape-config-json \'{"fetcherType":"http"}\' (suggested UI config output)')
}

async function main() {
  loadEnv()

  const args = parseArgs()
  const flags = args.flags

  if (flags.help || flags.h) {
    printHelp()
    return
  }

  const adapterId = flags.id || flags.adapter || (await promptText('Adapter id (e.g., midwayusa): '))
  if (!adapterId) fail('Missing adapter id')

  const { path: configPath, data: storedConfig } = loadScraperConfig(adapterId)
  const storedDiscovery = storedConfig?.discovery || {}

  const adapterDomain =
    flags.domain ||
    storedConfig?.adapterDomain ||
    (await promptText(
      buildPrompt('Adapter domain (e.g., midwayusa.com):', storedConfig?.adapterDomain || ''),
      storedConfig?.adapterDomain || ''
    ))
  if (!adapterDomain) fail('Missing domain')

  const adapterVersion = flags.version || storedConfig?.adapterVersion || '0.1.0'

  const newAdapterArgs = ['--id', adapterId, '--domain', adapterDomain, '--version', adapterVersion]
  const newExit = await runNodeScript('scripts/scraper/new-adapter.mjs', newAdapterArgs)
  if (newExit !== 0) {
    process.exit(newExit)
  }

  const runDiscovery = await promptYesNo(
    buildYesNoQuestion('Run discovery now?', defaultNoFrom(storedDiscovery.runDiscovery)),
    defaultNoFrom(storedDiscovery.runDiscovery)
  )
  saveScraperConfig(configPath, {
    ...(storedConfig || {}),
    adapterId,
    adapterDomain,
    adapterVersion,
    discovery: {
      ...storedDiscovery,
      runDiscovery,
    },
  })
  if (!runDiscovery) {
    return
  }

  let discoveryDomain = flags.domain || adapterDomain
  const sourceUrl =
    flags['source-url'] ||
    storedDiscovery.sourceUrl ||
    (await promptText(
      buildPrompt('Source URL for discovery (optional):', storedDiscovery.sourceUrl || ''),
      storedDiscovery.sourceUrl || ''
    ))
  if (!sourceUrl && !discoveryDomain) {
    discoveryDomain = await promptText(
      buildPrompt('Source domain for discovery (optional):', storedDiscovery.domain || ''),
      storedDiscovery.domain || ''
    )
  }

  const listingInput = flags.listing
    ? null
    : await promptText(
        buildPrompt(
          'Listing URL(s) (comma separated, optional):',
          (storedDiscovery.listings || []).join(', ')
        ),
        (storedDiscovery.listings || []).join(', ')
      )
  const listings = flags.listing ? splitList(flags.listing) : splitList(listingInput)

  const sitemapInput = flags.sitemap
    ? null
    : await promptText(
        buildPrompt(
          'Sitemap URL(s) (comma separated, optional):',
          (storedDiscovery.sitemaps || []).join(', ')
        ),
        (storedDiscovery.sitemaps || []).join(', ')
      )
  const sitemaps = flags.sitemap ? splitList(flags.sitemap) : splitList(sitemapInput)

  if (listings.length === 0 && sitemaps.length === 0) {
    console.warn('Skipping discovery: no listing or sitemap URLs provided.')
    return
  }

  const productPathPrefix = flags['product-path-prefix']
    ? flags['product-path-prefix']
    : await promptText(
        buildPrompt('Product path prefix (e.g., /product/):', storedDiscovery.productPathPrefix || ''),
        storedDiscovery.productPathPrefix || ''
      )
  const productUrlRegex = flags['product-url-regex']
    ? flags['product-url-regex']
    : await promptText(
        buildPrompt('Product URL regex (optional):', storedDiscovery.productUrlRegex || ''),
        storedDiscovery.productUrlRegex || ''
      )

  const targetUrlTemplate = flags['target-url-template']
    ? flags['target-url-template']
    : await promptText(
        buildPrompt('Target URL template (optional):', storedDiscovery.targetUrlTemplate || ''),
        storedDiscovery.targetUrlTemplate || ''
      )

  const paginate =
    flags.paginate === true ||
    (await promptYesNo(
      buildYesNoQuestion('Paginate listing pages?', defaultNoFrom(storedDiscovery.paginate)),
      defaultNoFrom(storedDiscovery.paginate)
    ))
  const maxPages =
    flags['max-pages'] ||
    (paginate
      ? await promptText(
          buildPrompt('Max pages (default 25):', String(storedDiscovery.maxPages || 25)),
          String(storedDiscovery.maxPages || 25)
        )
      : '')
  const maxUrls =
    flags['max-urls'] ||
    (await promptText(
      buildPrompt('Max URLs (default 500):', String(storedDiscovery.maxUrls || 500)),
      String(storedDiscovery.maxUrls || 500)
    ))
  const logUrls = flags['log-urls'] === true || flags.logUrls === true || storedDiscovery.logUrls === true

  saveScraperConfig(configPath, {
    ...(storedConfig || {}),
    adapterId,
    adapterDomain,
    adapterVersion,
    discovery: {
      ...storedDiscovery,
      runDiscovery,
      sourceUrl,
      domain: discoveryDomain,
      listings,
      sitemaps,
      productPathPrefix,
      productUrlRegex,
      targetUrlTemplate,
      paginate,
      maxPages: maxPages ? Number.parseInt(maxPages, 10) : undefined,
      maxUrls: maxUrls ? Number.parseInt(maxUrls, 10) : undefined,
      logUrls,
    },
  })

  const baseArgs = []
  if (sourceUrl) {
    baseArgs.push('--source-url', sourceUrl)
  } else if (discoveryDomain) {
    baseArgs.push('--domain', discoveryDomain)
  } else {
    console.warn('Skipping discovery: source-url or domain required.')
    return
  }
  for (const url of listings) baseArgs.push('--listing', url)
  for (const url of sitemaps) baseArgs.push('--sitemap', url)
  if (!productPathPrefix && !productUrlRegex) {
    console.warn('Skipping discovery: product-path-prefix or product-url-regex required.')
    return
  }
  if (productPathPrefix) baseArgs.push('--product-path-prefix', productPathPrefix)
  if (productUrlRegex) baseArgs.push('--product-url-regex', productUrlRegex)
  if (targetUrlTemplate) baseArgs.push('--target-url-template', targetUrlTemplate)
  if (paginate) baseArgs.push('--paginate')
  if (paginate && maxPages) baseArgs.push('--max-pages', String(maxPages))
  if (maxUrls) baseArgs.push('--max-urls', String(maxUrls))
  if (logUrls) baseArgs.push('--log-urls')

  const discoveryArgs = [...baseArgs]
  const runAsDryRun = flags['skip-dry-run'] !== true
  const runValidate = flags['skip-validate'] !== true
  const runSmoke = flags['skip-smoke'] !== true
  const smokeLimit = parsePositiveInt(flags['smoke-limit'] ?? storedDiscovery.smokeLimit, 20)
  const suggestedScrapeConfigRaw = typeof flags['scrape-config-json'] === 'string'
    ? flags['scrape-config-json']
    : null
  let suggestedScrapeConfig = { fetcherType: 'http' }
  if (suggestedScrapeConfigRaw) {
    try {
      const parsed = JSON.parse(suggestedScrapeConfigRaw)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        fail('--scrape-config-json must be a JSON object')
      }
      suggestedScrapeConfig = parsed
    } catch {
      fail('Invalid --scrape-config-json (must be valid JSON)')
    }
  }

  const discoveryOutPath = resolve(
    projectRoot,
    'tmp',
    'scraper-bootstrap',
    `${adapterId}-discovery-${nowTag()}.txt`
  )
  mkdirSync(resolve(discoveryOutPath, '..'), { recursive: true })
  discoveryArgs.push('--output', discoveryOutPath)
  if (runAsDryRun) {
    discoveryArgs.push('--dry-run')
  }
  const discoveryExit = await runNodeScript('scripts/seeding/discover-scrape-targets.mjs', discoveryArgs)
  if (discoveryExit !== 0) {
    console.error('Discovery run failed. Fix the error above and retry.')
    process.exit(discoveryExit)
  }
  console.log(
    runAsDryRun
      ? 'Discovery completed in dry-run mode (CLI/text-file output only; no DB writes).'
      : 'Discovery completed (CLI/text-file output only; no DB writes).'
  )

  const discoveredUrls = parseDiscoveryUrls(discoveryOutPath)
  if (discoveredUrls.length === 0) {
    console.warn('No URLs discovered. Validate can still run; smoke will be skipped. Emitting UI handoff with empty target list.')
  }

  if (runValidate) {
    const validateExit = await runNodeScript('scripts/scraper/validate.mjs', ['--site-id', adapterId])
    if (validateExit !== 0) {
      console.error('Validation failed. Fix adapter issues before UI onboarding.')
      process.exit(validateExit)
    }
  } else {
    console.log('Validation skipped (--skip-validate).')
  }

  if (runSmoke && discoveredUrls.length > 0) {
    const preArtifacts = buildBootstrapArtifacts({
      adapterId,
      discoveredUrls,
      scrapeConfig: suggestedScrapeConfig,
    })

    const smokeArgs = ['--site-id', adapterId, '--url-file', preArtifacts.urlListPath]
    if (smokeLimit > 0) {
      smokeArgs.push('--limit', String(smokeLimit))
    }
    const smokeExit = await runNodeScript('scripts/scraper/smoke.mjs', smokeArgs)
    if (smokeExit !== 0) {
      console.error('Smoke test failed. Resolve issues before UI onboarding.')
      process.exit(smokeExit)
    }

    printUiHandoffChecklist({
      adapterId,
      artifacts: preArtifacts,
      discoveredCount: discoveredUrls.length,
    })
    return
  }

  if (!runSmoke) {
    console.log('Smoke skipped (--skip-smoke).')
  } else {
    console.log('Smoke skipped (no discovered URLs).')
  }

  const artifacts = buildBootstrapArtifacts({
    adapterId,
    discoveredUrls,
    scrapeConfig: suggestedScrapeConfig,
  })
  printUiHandoffChecklist({
    adapterId,
    artifacts,
    discoveredCount: discoveredUrls.length,
  })
}

main().catch(error => {
  console.error(error?.message || error)
  process.exit(1)
})
