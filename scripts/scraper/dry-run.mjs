#!/usr/bin/env node
"use strict"

import { existsSync, readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { parseArgs } from '../lib/utils.mjs'
import { loadEnv } from '../lib/load-env.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '../..')
const scraperRegistryPath = resolve(projectRoot, 'apps/harvester/dist/scraper/registry.js')
const scraperHttpFetcherPath = resolve(projectRoot, 'apps/harvester/dist/scraper/fetch/http-fetcher.js')
const scraperRobotsPath = resolve(projectRoot, 'apps/harvester/dist/scraper/fetch/robots.js')
const scraperUrlUtilsPath = resolve(projectRoot, 'apps/harvester/dist/scraper/utils/url.js')
const adaptersIndexPath = resolve(projectRoot, 'apps/harvester/dist/scraper/adapters/index.js')

function fail(message) {
  console.error(`Error: ${message}`)
  process.exit(1)
}

function printHelp() {
  console.log('dry-run.mjs (DB-free)')
  console.log('  --adapter-id <id> (required)')
  console.log('  --source-id <id> (optional, default: dry_run_source)')
  console.log('  --retailer-id <id> (optional, default: dry_run_retailer)')
  console.log('  --url <url> (optional, repeat via positional args)')
  console.log('  --url-file <path> (optional, newline-delimited URLs or logs containing url=...)')
  console.log('  --limit <n> (default: all)')
  console.log('  --delay-ms <n> (default: 500)')
  console.log('  --json (print JSON output)')
  console.log('  --verbose')
  console.log('')
  console.log('Examples:')
  console.log('  node scripts/scraper/dry-run.mjs --adapter-id brownells --url https://www.brownells.com/ammunition/...')
  console.log('  node scripts/scraper/dry-run.mjs --adapter-id brownells --url-file brownells-discovery.log --limit 20')
}

function createLogger(verbose) {
  const log = (level, message, meta) => {
    if (!verbose && level === 'debug') return
    const metaText = meta ? ` ${JSON.stringify(meta)}` : ''
    console.log(`[${level}] ${message}${metaText}`)
  }

  return {
    info: (message, meta) => log('info', message, meta),
    warn: (message, meta) => log('warn', message, meta),
    error: (message, meta) => log('error', message, meta),
    debug: (message, meta) => log('debug', message, meta),
  }
}

function formatCurrency(cents) {
  if (typeof cents !== 'number') return 'n/a'
  return `$${(cents / 100).toFixed(2)}`
}

function normalizeUrlToken(token) {
  if (!token) return null
  const cleaned = token.trim().replace(/^["']|["']$/g, '').replace(/[),.;]+$/g, '')
  if (!/^https?:\/\//i.test(cleaned)) return null
  return cleaned
}

function extractUrlsFromText(text) {
  const urls = []
  const lines = text.split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    if (/^https?:\/\//i.test(trimmed)) {
      const firstToken = trimmed.split(/\s+/)[0]
      const parsed = normalizeUrlToken(firstToken)
      if (parsed) urls.push(parsed)
      continue
    }

    const keyMatch = trimmed.match(/url=(https?:\/\/[^\s"'<>]+)/i)
    if (keyMatch?.[1]) {
      const parsed = normalizeUrlToken(keyMatch[1])
      if (parsed) urls.push(parsed)
      continue
    }

    const generalMatch = trimmed.match(/https?:\/\/[^\s"'<>]+/i)
    if (generalMatch?.[0]) {
      const parsed = normalizeUrlToken(generalMatch[0])
      if (parsed) urls.push(parsed)
    }
  }
  return urls
}

function collectInputUrls(args, flags) {
  const collected = []

  if (typeof flags.url === 'string') {
    const split = flags.url
      .split(',')
      .map(part => normalizeUrlToken(part))
      .filter(Boolean)
    collected.push(...split)
  }

  if (typeof flags['url-file'] === 'string') {
    const urlFile = resolve(process.cwd(), flags['url-file'])
    if (!existsSync(urlFile)) {
      fail(`--url-file not found: ${urlFile}`)
    }
    const fileText = readFileSync(urlFile, 'utf8')
    collected.push(...extractUrlsFromText(fileText))
  }

  if (args.length > 0) {
    for (const token of args) {
      const parsed = normalizeUrlToken(token)
      if (parsed) {
        collected.push(parsed)
      }
    }
  }

  return Array.from(new Set(collected))
}

function shouldPreferJson(url) {
  try {
    const parsed = new URL(url)
    if (parsed.pathname.includes('/api/')) return true
    if (parsed.pathname.endsWith('.json')) return true
    if (parsed.searchParams.has('fieldset')) return true
    if (parsed.searchParams.has('include')) return true
    return false
  } catch {
    return false
  }
}

async function main() {
  loadEnv()
  const parsedArgs = parseArgs()
  const flags = parsedArgs.flags

  if (flags.help || flags.h) {
    printHelp()
    return
  }

  const adapterId = flags['adapter-id'] || flags.adapterId
  if (!adapterId || typeof adapterId !== 'string') {
    fail('Missing --adapter-id <id>')
  }

  const sourceId = typeof flags['source-id'] === 'string' ? flags['source-id'] : 'dry_run_source'
  const retailerId = typeof flags['retailer-id'] === 'string' ? flags['retailer-id'] : 'dry_run_retailer'
  const outputJson = flags.json === true
  const verbose = flags.verbose === true || flags.v === true

  const limitRaw = flags.limit
  const limit = typeof limitRaw === 'string' ? Math.max(1, Number.parseInt(limitRaw, 10) || 1) : Number.POSITIVE_INFINITY

  const delayRaw = flags['delay-ms']
  const minDelayMs = typeof delayRaw === 'string' ? Math.max(0, Number.parseInt(delayRaw, 10) || 500) : 500

  const inputUrls = collectInputUrls(parsedArgs._, flags)
  if (inputUrls.length === 0) {
    fail('No input URLs provided. Use --url, --url-file, or positional URLs.')
  }

  if (
    !existsSync(scraperRegistryPath) ||
    !existsSync(scraperHttpFetcherPath) ||
    !existsSync(scraperRobotsPath) ||
    !existsSync(scraperUrlUtilsPath) ||
    !existsSync(adaptersIndexPath)
  ) {
    fail('Harvester dist not found. Run: pnpm --filter @ironscout/harvester build')
  }

  const registryModule = await import(pathToFileURL(scraperRegistryPath).href)
  const httpFetcherModule = await import(pathToFileURL(scraperHttpFetcherPath).href)
  const robotsModule = await import(pathToFileURL(scraperRobotsPath).href)
  const urlUtilsModule = await import(pathToFileURL(scraperUrlUtilsPath).href)
  const adapters = await import(pathToFileURL(adaptersIndexPath).href)
  adapters.registerAllAdapters()

  const adapter = registryModule.getAdapterRegistry().get(adapterId)
  if (!adapter) {
    fail(`Adapter not registered: ${adapterId}`)
  }

  const selectedUrls = inputUrls.slice(0, limit)
  const logger = createLogger(verbose)
  const runId = `dry-run-${Date.now()}`

  const robotsPolicy = new robotsModule.RobotsPolicyImpl()
  const fetcher = new httpFetcherModule.HttpFetcher({ robotsPolicy })

  const counters = {
    attempted: selectedUrls.length,
    fetchedOk: 0,
    fetchFailed: 0,
    extractOk: 0,
    extractFailed: 0,
    normalizedOk: 0,
    dropped: 0,
    quarantined: 0,
    fetchReasons: {},
    extractReasons: {},
    normalizeReasons: {},
  }

  const results = []
  const lastFetchAtByDomain = new Map()

  for (const url of selectedUrls) {
    const domain = urlUtilsModule.getRegistrableDomain(url)
    const crawlDelay = await robotsPolicy.getCrawlDelay(domain)
    const effectiveDelayMs = Math.max(minDelayMs, crawlDelay ? crawlDelay * 1000 : 0)
    const lastAt = lastFetchAtByDomain.get(domain) || 0
    const elapsed = Date.now() - lastAt
    if (elapsed < effectiveDelayMs) {
      await new Promise(resolve => setTimeout(resolve, effectiveDelayMs - elapsed))
    }
    lastFetchAtByDomain.set(domain, Date.now())

    const headers = {}
    if (shouldPreferJson(url)) {
      headers.Accept = 'application/json,text/plain,*/*'
    }

    const fetchResult = await fetcher.fetch(url, { headers })
    if (fetchResult.status !== 'ok') {
      counters.fetchFailed += 1
      counters.fetchReasons[fetchResult.status] = (counters.fetchReasons[fetchResult.status] || 0) + 1
      results.push({
        url,
        status: 'fetch_failed',
        fetchStatus: fetchResult.status,
        error: fetchResult.error,
      })
      continue
    }

    counters.fetchedOk += 1

    let extractResult
    try {
      extractResult = adapter.extract(fetchResult.html ?? '', url, {
        sourceId,
        retailerId,
        runId,
        targetId: `dry-target-${domain}`,
        now: new Date(),
        logger,
      })
    } catch (error) {
      counters.extractFailed += 1
      counters.extractReasons.EXCEPTION = (counters.extractReasons.EXCEPTION || 0) + 1
      results.push({
        url,
        status: 'extract_failed',
        reason: 'EXCEPTION',
        error: error?.message || String(error),
      })
      continue
    }

    if (!extractResult.ok) {
      counters.extractFailed += 1
      counters.extractReasons[extractResult.reason] =
        (counters.extractReasons[extractResult.reason] || 0) + 1
      results.push({
        url,
        status: 'extract_failed',
        reason: extractResult.reason,
        details: extractResult.details,
      })
      continue
    }

    counters.extractOk += 1

    let normalizeResult
    try {
      normalizeResult = adapter.normalize(extractResult.offer, {
        sourceId,
        retailerId,
        runId,
        targetId: `dry-target-${domain}`,
        now: new Date(),
        logger,
      })
    } catch (error) {
      counters.quarantined += 1
      counters.normalizeReasons.EXCEPTION = (counters.normalizeReasons.EXCEPTION || 0) + 1
      results.push({
        url,
        status: 'quarantined',
        reason: 'EXCEPTION',
        error: error?.message || String(error),
      })
      continue
    }

    if (normalizeResult.status === 'ok') {
      counters.normalizedOk += 1
      results.push({
        url,
        status: 'ok',
        title: normalizeResult.offer.title,
        priceCents: normalizeResult.offer.priceCents,
        availability: normalizeResult.offer.availability,
      })
    } else if (normalizeResult.status === 'drop') {
      counters.dropped += 1
      counters.normalizeReasons[normalizeResult.reason] =
        (counters.normalizeReasons[normalizeResult.reason] || 0) + 1
      results.push({
        url,
        status: 'dropped',
        reason: normalizeResult.reason,
      })
    } else {
      counters.quarantined += 1
      counters.normalizeReasons[normalizeResult.reason] =
        (counters.normalizeReasons[normalizeResult.reason] || 0) + 1
      results.push({
        url,
        status: 'quarantined',
        reason: normalizeResult.reason,
      })
    }
  }

  if (outputJson) {
    console.log(
      JSON.stringify(
        {
          adapterId,
          sourceId,
          retailerId,
          counts: counters,
          results,
        },
        null,
        2
      )
    )
    return
  }

  console.log(`Dry run complete for adapter ${adapterId}`)
  console.log(`URLs tested: ${selectedUrls.length}`)
  console.log('')
  for (const result of results) {
    if (result.status === 'ok') {
      console.log(`OK      ${formatCurrency(result.priceCents)} ${result.availability} ${result.url}`)
    } else if (result.status === 'fetch_failed') {
      console.log(`FETCH   ${result.fetchStatus} ${result.url}`)
    } else if (result.status === 'extract_failed') {
      console.log(`EXTRACT ${result.reason} ${result.url}`)
    } else if (result.status === 'dropped') {
      console.log(`DROP    ${result.reason} ${result.url}`)
    } else {
      console.log(`QUAR    ${result.reason} ${result.url}`)
    }
  }

  console.log('')
  console.log('Summary:')
  console.log(`  fetchedOk=${counters.fetchedOk} fetchFailed=${counters.fetchFailed}`)
  console.log(`  extractOk=${counters.extractOk} extractFailed=${counters.extractFailed}`)
  console.log(`  normalizedOk=${counters.normalizedOk} dropped=${counters.dropped} quarantined=${counters.quarantined}`)

  if (Object.keys(counters.fetchReasons).length > 0) {
    console.log(`  fetchReasons=${JSON.stringify(counters.fetchReasons)}`)
  }
  if (Object.keys(counters.extractReasons).length > 0) {
    console.log(`  extractReasons=${JSON.stringify(counters.extractReasons)}`)
  }
  if (Object.keys(counters.normalizeReasons).length > 0) {
    console.log(`  normalizeReasons=${JSON.stringify(counters.normalizeReasons)}`)
  }
}

main().catch(error => {
  console.error(error?.message || error)
  process.exit(1)
})
