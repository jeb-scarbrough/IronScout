#!/usr/bin/env node
"use strict"

import { existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { parseArgs } from '../lib/utils.mjs'
import { loadEnv } from '../lib/load-env.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '../..')
const scraperIndexPath = resolve(projectRoot, 'apps/harvester/dist/scraper/index.js')
const adaptersIndexPath = resolve(projectRoot, 'apps/harvester/dist/scraper/adapters/index.js')

function fail(message) {
  console.error(`Error: ${message}`)
  process.exit(1)
}

function printHelp() {
  console.log('dry-run.mjs')
  console.log('  --source-id <id> (required)')
  console.log('  --limit <n> (default: 10)')
  console.log('  --latest (disable random sampling)')
  console.log('  --allow-unapproved (bypass ToS/robots/scrapeEnabled gates)')
  console.log('  --json (print JSON output)')
  console.log('')
  console.log('Example:')
  console.log('  node scripts/scraper/dry-run.mjs --source-id <sourceId> --limit 10')
}

function sampleIndices(max, count) {
  const picks = new Set()
  if (count >= max) {
    return Array.from({ length: max }, (_, i) => i)
  }
  while (picks.size < count) {
    picks.add(Math.floor(Math.random() * max))
  }
  return Array.from(picks).sort((a, b) => a - b)
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

async function main() {
  loadEnv()

  const args = parseArgs()
  const flags = args.flags

  if (flags.help || flags.h) {
    printHelp()
    return
  }

  const sourceId = flags['source-id'] || flags.sourceId || args._[0]
  if (!sourceId) {
    fail('Missing --source-id <id>')
  }

  const limitRaw = flags.limit || '10'
  const limit = Math.max(1, Number.parseInt(limitRaw, 10) || 10)
  const useRandom = !(flags.latest === true)
  const allowUnapproved = flags['allow-unapproved'] === true
  const outputJson = flags.json === true
  const verbose = flags.verbose === true || flags.v === true

  if (!existsSync(scraperIndexPath) || !existsSync(adaptersIndexPath)) {
    fail('Harvester dist not found. Run: pnpm --filter @ironscout/harvester build')
  }

  const scraper = await import(pathToFileURL(scraperIndexPath).href)
  const adapters = await import(pathToFileURL(adaptersIndexPath).href)
  const { prisma } = await import('../../packages/db/index.js')

  try {
    adapters.registerAllAdapters()

    const source = await prisma.sources.findUnique({
      where: { id: sourceId },
      select: {
        id: true,
        name: true,
        url: true,
        adapterId: true,
        retailerId: true,
        enabled: true,
        scrapeEnabled: true,
        robotsCompliant: true,
        tosReviewedAt: true,
        tosApprovedBy: true,
        scrapeConfig: true,
        scrape_adapter_status: {
          select: {
            enabled: true,
            ingestionPaused: true,
          },
        },
      },
    })

    if (!source) {
      fail(`Source not found: ${sourceId}`)
    }

    if (!source.adapterId) {
      fail(`Source missing adapterId: ${sourceId}`)
    }

    const adapter = scraper.getAdapterRegistry().get(source.adapterId)
    if (!adapter) {
      fail(`Adapter not registered: ${source.adapterId}`)
    }

    if (adapter.requiresJsRendering) {
      fail(`Adapter ${adapter.id} requires JS rendering; dry-run uses HTTP fetcher only`)
    }

    if (!allowUnapproved) {
      if (!source.enabled) {
        fail('Source is disabled (sources.enabled=false)')
      }
      if (!source.scrapeEnabled) {
        fail('Source scrapeEnabled=false (scraping not approved)')
      }
      if (!source.robotsCompliant) {
        fail('Source robotsCompliant=false (robots blocked)')
      }
      if (!source.tosReviewedAt || !source.tosApprovedBy) {
        fail('Source ToS gates not satisfied (tosReviewedAt/tosApprovedBy)')
      }
      if (!source.scrape_adapter_status?.enabled) {
        fail('Adapter disabled (scrape_adapter_status.enabled=false)')
      }
      if (source.scrape_adapter_status?.ingestionPaused) {
        fail('Adapter ingestion paused (scrape_adapter_status.ingestionPaused=true)')
      }
    }

    const scrapeConfig = scraper.parseScrapeConfig(source.scrapeConfig)
    const rateLimit = {
      requestsPerSecond:
        scrapeConfig?.rateLimit?.requestsPerSecond ?? scraper.DEFAULT_RATE_LIMIT.requestsPerSecond,
      minDelayMs: scrapeConfig?.rateLimit?.minDelayMs ?? scraper.DEFAULT_RATE_LIMIT.minDelayMs,
    }
    const derivedDelayMs = Math.max(rateLimit.minDelayMs, Math.ceil(1000 / rateLimit.requestsPerSecond))

    const robotsPolicy = new scraper.RobotsPolicyImpl()
    const fetcher = new scraper.HttpFetcher({ robotsPolicy })

    const where = {
      sourceId: source.id,
      adapterId: source.adapterId,
      enabled: true,
      status: 'ACTIVE',
      robotsPathBlocked: false,
    }

    const totalTargets = await prisma.scrape_targets.count({ where })
    if (totalTargets === 0) {
      fail('No active scrape targets found for this source')
    }

    const takeCount = Math.min(limit, totalTargets)
    let targets = []

    if (useRandom) {
      const indices = sampleIndices(totalTargets, takeCount)
      for (const index of indices) {
        const rows = await prisma.scrape_targets.findMany({
          where,
          select: { id: true, url: true, canonicalUrl: true },
          orderBy: { id: 'asc' },
          skip: index,
          take: 1,
        })
        if (rows.length > 0) {
          targets.push(rows[0])
        }
      }
    } else {
      targets = await prisma.scrape_targets.findMany({
        where,
        select: { id: true, url: true, canonicalUrl: true },
        orderBy: { updatedAt: 'desc' },
        take: takeCount,
      })
    }

    if (targets.length === 0) {
      fail('No targets selected for dry run')
    }

    const logger = createLogger(verbose)
    const runId = `dry-run-${Date.now()}`
    const results = []
    const counters = {
      attempted: targets.length,
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

    const lastFetchAt = new Map()

    for (const target of targets) {
      const domain = scraper.getRegistrableDomain(target.url)
      const crawlDelay = await robotsPolicy.getCrawlDelay(domain)
      const delayMs = Math.max(derivedDelayMs, crawlDelay ? crawlDelay * 1000 : 0)

      const last = lastFetchAt.get(domain) || 0
      const elapsed = Date.now() - last
      if (elapsed < delayMs) {
        await new Promise(resolve => setTimeout(resolve, delayMs - elapsed))
      }

      lastFetchAt.set(domain, Date.now())

      const headers = { ...(scrapeConfig?.customHeaders ?? {}) }
      if (!headers.Accept && shouldPreferJson(target.url)) {
        headers.Accept = 'application/json,text/plain,*/*'
      }

      const fetchResult = await fetcher.fetch(target.url, { headers })
      if (fetchResult.status !== 'ok') {
        counters.fetchFailed += 1
        counters.fetchReasons[fetchResult.status] = (counters.fetchReasons[fetchResult.status] || 0) + 1
        results.push({
          id: target.id,
          url: target.url,
          status: 'fetch_failed',
          fetchStatus: fetchResult.status,
          error: fetchResult.error,
        })
        continue
      }

      counters.fetchedOk += 1

      let extractResult = null
      try {
        extractResult = adapter.extract(fetchResult.html ?? '', target.url, {
          sourceId: source.id,
          retailerId: source.retailerId,
          runId,
          targetId: target.id,
          now: new Date(),
          logger,
        })
      } catch (error) {
        counters.extractFailed += 1
        counters.extractReasons.EXCEPTION = (counters.extractReasons.EXCEPTION || 0) + 1
        results.push({
          id: target.id,
          url: target.url,
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
          id: target.id,
          url: target.url,
          status: 'extract_failed',
          reason: extractResult.reason,
          details: extractResult.details,
        })
        continue
      }

      counters.extractOk += 1

      let normalizeResult = null
      try {
        normalizeResult = adapter.normalize(extractResult.offer, {
          sourceId: source.id,
          retailerId: source.retailerId,
          runId,
          targetId: target.id,
          now: new Date(),
          logger,
        })
      } catch (error) {
        counters.quarantined += 1
        counters.normalizeReasons.EXCEPTION = (counters.normalizeReasons.EXCEPTION || 0) + 1
        results.push({
          id: target.id,
          url: target.url,
          status: 'quarantined',
          reason: 'EXCEPTION',
          error: error?.message || String(error),
        })
        continue
      }

      if (normalizeResult.status === 'ok') {
        counters.normalizedOk += 1
        results.push({
          id: target.id,
          url: target.url,
          status: 'ok',
          priceCents: normalizeResult.offer.priceCents,
          availability: normalizeResult.offer.availability,
          title: normalizeResult.offer.title,
        })
      } else if (normalizeResult.status === 'drop') {
        counters.dropped += 1
        counters.normalizeReasons[normalizeResult.reason] =
          (counters.normalizeReasons[normalizeResult.reason] || 0) + 1
        results.push({
          id: target.id,
          url: target.url,
          status: 'dropped',
          reason: normalizeResult.reason,
        })
      } else {
        counters.quarantined += 1
        counters.normalizeReasons[normalizeResult.reason] =
          (counters.normalizeReasons[normalizeResult.reason] || 0) + 1
        results.push({
          id: target.id,
          url: target.url,
          status: 'quarantined',
          reason: normalizeResult.reason,
        })
      }
    }

    if (outputJson) {
      console.log(
        JSON.stringify(
          {
            source: {
              id: source.id,
              name: source.name,
              adapterId: source.adapterId,
            },
            counts: counters,
            results,
          },
          null,
          2
        )
      )
      return
    }

    console.log(`Dry run complete for source ${source.name} (${source.id})`) 
    console.log(`Adapter: ${source.adapterId} | Targets: ${targets.length}/${totalTargets}`)
    console.log('')

    for (const result of results) {
      if (result.status === 'ok') {
        console.log(`OK     ${formatCurrency(result.priceCents)} ${result.availability} ${result.url}`)
      } else if (result.status === 'fetch_failed') {
        console.log(`FETCH  ${result.fetchStatus} ${result.url}`)
      } else if (result.status === 'extract_failed') {
        console.log(`EXTRACT ${result.reason} ${result.url}`)
      } else if (result.status === 'dropped') {
        console.log(`DROP   ${result.reason} ${result.url}`)
      } else if (result.status === 'quarantined') {
        console.log(`QUAR   ${result.reason} ${result.url}`)
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
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(error => {
  console.error(error?.message || error)
  process.exit(1)
})
