#!/usr/bin/env node
/**
 * Discovery seeding for scrape_targets (ADR-022).
 *
 * Usage:
 *   node scripts/seeding/discover-scrape-targets.mjs \
 *     --source-id <id> \
 *     --sitemap <url> [--sitemap <url> ...] \
 *     --listing <url> [--listing <url> ...] \
 *     --product-path-prefix /product/ \
 *     [--product-url-regex "<regex>"] \
 *     [--max-urls 1000] \
 *     [--dry-run] \
 *     [--count-only] \
 *     [--notes "optional note"]
 */

import { promises as dns } from 'dns'

const DEFAULT_USER_AGENT = null
const DEFAULT_DELAY_MS = 1000
const MIN_DELAY_MS = 1000
const MAX_DELAY_MS = 60000
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024

async function main() {
  const args = process.argv.slice(2)
  const opts = parseArgs(args)

  if (opts.help) {
    printHelp()
    return
  }

  if (!opts.sourceId && !opts.domain && !opts.sourceUrl) {
    fail('Provide --source-id or --domain/--source-url')
  }

  if (opts.sitemaps.length === 0 && opts.listings.length === 0 && !opts.autoSitemap) {
    fail('Provide at least one --sitemap or --listing URL, or use --auto-sitemap')
  }

  if (!opts.productPathPrefix && !opts.productUrlRegex) {
    fail('Provide --product-path-prefix or --product-url-regex to filter product URLs')
  }

  const startedAt = Date.now()
  const runId = new Date().toISOString()

  let prisma = null
  let source = null

  try {

  if (opts.dryRun && opts.accept) {
    fail('--accept cannot be used with --dry-run')
  }
  if (opts.countOnly && opts.accept) {
    fail('--accept cannot be used with --count-only')
  }

  if (!opts.dryRun && opts.sourceId) {
    const db = await import('../../packages/db/index.js')
    prisma = db.prisma

    source = await prisma.sources.findUnique({
      where: { id: opts.sourceId },
      select: {
        id: true,
        url: true,
        adapterId: true,
        scrapeEnabled: true,
        robotsCompliant: true,
        tosReviewedAt: true,
        tosApprovedBy: true,
        scrapeConfig: true,
      },
    })

    if (!source) {
      fail(`Source not found: ${opts.sourceId}`)
    }

    if (!source.adapterId) {
      fail(`Source missing adapterId: ${opts.sourceId}`)
    }

    if (opts.adapterId && opts.adapterId !== source.adapterId) {
      fail(`adapterId mismatch: source=${source.adapterId} input=${opts.adapterId}`)
    }

    if (!source.scrapeEnabled || !source.robotsCompliant || !source.tosReviewedAt || !source.tosApprovedBy) {
      fail('Source gates not satisfied (scrapeEnabled, robotsCompliant, tosReviewedAt, tosApprovedBy)')
    }
  } else if (opts.accept) {
    fail('Cannot write without --source-id')
  }

  const baseUrl = source?.url ?? opts.sourceUrl ?? (opts.domain ? `https://${opts.domain}` : null)
  const sourceDomain = baseUrl ? getRegistrableDomain(baseUrl) : null
  if (!sourceDomain) {
    fail('Unable to determine source domain')
  }

  if (opts.autoSitemap) {
    const autoSitemaps = await discoverSitemaps(sourceDomain)
    if (autoSitemaps.length === 0) {
      fail(`No sitemap discovered for ${sourceDomain}`)
    }
    for (const sitemapUrl of autoSitemaps) {
      if (!opts.sitemaps.includes(sitemapUrl)) {
        opts.sitemaps.push(sitemapUrl)
      }
    }
  }

  const discoveryConfig =
    source?.scrapeConfig && typeof source.scrapeConfig === 'object'
      ? source.scrapeConfig.discovery
      : null

  const allowlist = Array.isArray(discoveryConfig?.allowlist)
    ? discoveryConfig.allowlist.map(entry => canonicalizeUrl(String(entry)))
    : null

  const configMaxUrls = Number.isFinite(discoveryConfig?.maxUrls)
    ? Number.parseInt(discoveryConfig.maxUrls, 10)
    : null

  const requestedMaxUrls = opts.maxUrlsProvided ? opts.maxUrls : null
  const effectiveMaxUrls =
    configMaxUrls && requestedMaxUrls
      ? Math.min(configMaxUrls, requestedMaxUrls)
      : configMaxUrls ?? requestedMaxUrls ?? 500
  const capInfo = {
    configMaxUrls,
    requestedMaxUrls,
    effectiveMaxUrls,
  }

  if (!Number.isFinite(effectiveMaxUrls) || effectiveMaxUrls < 1) {
    fail('Invalid maxUrls cap')
  }

  let productRegex = null
  if (opts.productUrlRegex) {
    try {
      productRegex = new RegExp(opts.productUrlRegex)
    } catch {
      fail('Invalid --product-url-regex')
    }
  }
  const productPrefix = opts.productPathPrefix ? normalizePrefix(opts.productPathPrefix) : null

  const robots = new RobotsPolicy({ userAgent: 'IronScout' })
  const rateLimiter = new DomainRateLimiter()

  const canonicalToUrl = new Map()
  let totalScanned = 0
  let eligibleCount = 0
  let skippedRobots = 0
  let skippedInvalid = 0
  let skippedPattern = 0
  let skippedDuplicate = 0
  let okCount = 0
  let lastProgressLogged = 0
  const PROGRESS_INTERVAL = 100
  const MAX_SITEMAP_DEPTH = 2

  const seedUrls = [...opts.sitemaps, ...opts.listings]
  for (const seedUrl of seedUrls) {
    await ensurePublicUrl(seedUrl)
    await ensureSameDomain(seedUrl, sourceDomain)
    if (allowlist && allowlist.length > 0) {
      const canonicalSeed = canonicalizeUrl(seedUrl)
      if (!allowlist.includes(canonicalSeed)) {
        fail(`Seed URL not in allowlist: ${seedUrl}`)
      }
    }
    const robotsCheck = await robots.check(seedUrl)
    if (!robotsCheck.fetchSucceeded) {
      fail(`robots.txt fetch failed for ${getRegistrableDomain(seedUrl)}`)
    }
    if (!robotsCheck.allowed) {
      fail(`robots.txt disallows seed URL: ${seedUrl}`)
    }
  }

  for (const sitemapUrl of opts.sitemaps) {
    await collectFromSitemap(sitemapUrl, 0)
  }

  for (const listingUrl of opts.listings) {
    const html = await fetchWithRobots(listingUrl, robots, rateLimiter)
    const links = extractLinks(html, listingUrl)
    for (const link of links) {
      await handleCandidate(link)
    }
  }

  const records = []
  const method = resolveMethod(opts)
  const notes = buildNotes(runId, method, opts.notes)
  const createdBy = process.env.USER || process.env.USERNAME || 'discovery-script'

  for (const [canonicalUrl, originalUrl] of canonicalToUrl.entries()) {
    records.push({
      url: originalUrl,
      canonicalUrl,
      sourceId: source?.id ?? 'no-db',
      adapterId: source?.adapterId ?? opts.adapterId ?? 'unknown',
      createdBy,
      notes,
    })
  }

  const durationMs = Date.now() - startedAt
  const failureCount = skippedInvalid + skippedPattern + skippedRobots + skippedDuplicate
  const summaryLines = [
    '',
    '::discovery-summary::',
    `  durationMs=${durationMs}`,
    `  scanned=${totalScanned} eligible=${eligibleCount} discovered=${records.length}`,
    `  ok=${okCount} failures=${failureCount}`,
    `  skippedInvalid=${skippedInvalid} skippedPattern=${skippedPattern} skippedRobots=${skippedRobots} skippedDuplicate=${skippedDuplicate}`,
    '',
  ]

  if (opts.countOnly) {
    const wouldExceedCap = records.length > effectiveMaxUrls
    console.log('COUNT ONLY')
    console.log(
      `discovered=${records.length} eligible=${eligibleCount} scanned=${totalScanned} skippedRobots=${skippedRobots}`
    )
    console.log(`cap=${effectiveMaxUrls} wouldExceedCap=${wouldExceedCap}`)
    for (const line of summaryLines) {
      console.log(line)
    }
  } else {
    console.log(opts.dryRun ? 'DRY RUN' : 'SUMMARY')
    console.log(
      `discovered=${records.length} eligible=${eligibleCount} scanned=${totalScanned} skippedRobots=${skippedRobots}`
    )
    console.log(`cap=${effectiveMaxUrls}`)
    for (const line of summaryLines) {
      console.log(line)
    }
  }
  if (source) {
    console.log(`sourceId=${source.id} adapterId=${source.adapterId}`)
  } else {
    console.log(`sourceDomain=${sourceDomain}`)
  }
  console.log(`notes="${notes}"`)
  if (records.length > 0) {
    console.log('sample:')
    for (const record of records.slice(0, 5)) {
      console.log(`  ${record.url}`)
    }
  }

  if (records.length === 0) {
    console.log('No eligible URLs discovered.')
    return
  }

  if (opts.dryRun || opts.countOnly) {
    return
  }

  if (!opts.accept) {
    console.log('Not accepted. No writes performed. Re-run with --accept to write.')
    return
  }

  if (!prisma) {
    fail('Internal error: prisma missing for write')
  }

  const result = await prisma.scrape_targets.createMany({
    data: records,
    skipDuplicates: true,
  })

  console.log(`inserted=${result.count} discovered=${records.length} skippedRobots=${skippedRobots}`)

  async function handleCandidate(candidateUrl) {
    totalScanned += 1
    if (totalScanned - lastProgressLogged >= PROGRESS_INTERVAL) {
      lastProgressLogged = totalScanned
      console.log(
        `::discovery-progress:: scanned=${totalScanned} eligible=${eligibleCount} discovered=${canonicalToUrl.size}`
      )
    }
    const cleaned = cleanCandidateUrl(candidateUrl)
    if (!cleaned) {
      skippedInvalid += 1
      if (opts.logUrls) {
        console.log(`url: skip reason=invalid raw=${String(candidateUrl).trim()}`)
      }
      return
    }
    await ensurePublicUrl(cleaned)
    await ensureSameDomain(cleaned, sourceDomain)

    if (!matchesProductPattern(cleaned, productPrefix, productRegex)) {
      skippedPattern += 1
      if (opts.logUrls) {
        console.log(`url: skip reason=pattern url=${cleaned}`)
      }
      return
    }

    const robotsCheck = await robots.check(cleaned)
    if (!robotsCheck.fetchSucceeded) {
      fail(`robots.txt fetch failed for ${getRegistrableDomain(cleaned)}`)
    }
    if (!robotsCheck.allowed) {
      skippedRobots += 1
      if (opts.logUrls) {
        console.log(`url: skip reason=robots url=${cleaned}`)
      }
      return
    }

    eligibleCount += 1

    const canonicalUrl = canonicalizeUrl(cleaned)
    if (!canonicalToUrl.has(canonicalUrl)) {
      if (!opts.countOnly && canonicalToUrl.size >= effectiveMaxUrls) {
        const details = formatCapDetails(capInfo, canonicalToUrl.size + 1)
        const hint = capOverrideHint(capInfo)
        fail(`Discovery cap exceeded. ${details}${hint}`)
      }
      canonicalToUrl.set(canonicalUrl, cleaned)
      okCount += 1
      if (opts.logUrls) {
        console.log(`url: ok url=${cleaned}`)
      }
    } else if (opts.logUrls) {
      skippedDuplicate += 1
      console.log(`url: skip reason=duplicate url=${cleaned}`)
    }
  }

  async function collectFromSitemap(sitemapUrl, depth) {
    if (depth > MAX_SITEMAP_DEPTH) return
    const xml = await fetchWithRobots(sitemapUrl, robots, rateLimiter)
    const locs = extractSitemapLocs(xml)
    if (xml.includes('<sitemapindex')) {
      for (const loc of locs) {
        await collectFromSitemap(loc, depth + 1)
      }
      return
    }

    for (const loc of locs) {
      await handleCandidate(loc)
    }
  }
  } finally {
    if (prisma) {
      await prisma.$disconnect()
    }
  }
}

function parseArgs(argv) {
  const out = {
    help: false,
    sourceId: null,
    adapterId: null,
    domain: null,
    sourceUrl: null,
    sitemaps: [],
    listings: [],
    productPathPrefix: null,
    productUrlRegex: null,
    maxUrls: null,
    maxUrlsProvided: false,
    dryRun: false,
    countOnly: false,
    accept: false,
    autoSitemap: false,
    notes: null,
    logUrls: false,
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') {
      out.help = true
    } else if (arg === '--source-id') {
      out.sourceId = argv[++i]
    } else if (arg === '--adapter-id') {
      out.adapterId = argv[++i]
    } else if (arg === '--domain') {
      out.domain = argv[++i]
    } else if (arg === '--source-url') {
      out.sourceUrl = argv[++i]
    } else if (arg === '--sitemap') {
      out.sitemaps.push(argv[++i])
    } else if (arg === '--listing') {
      out.listings.push(argv[++i])
    } else if (arg === '--product-path-prefix') {
      out.productPathPrefix = argv[++i]
    } else if (arg === '--product-url-regex') {
      out.productUrlRegex = argv[++i]
    } else if (arg === '--max-urls') {
      out.maxUrls = Number.parseInt(argv[++i], 10)
      out.maxUrlsProvided = true
    } else if (arg === '--dry-run') {
      out.dryRun = true
    } else if (arg === '--count-only') {
      out.countOnly = true
    } else if (arg === '--accept') {
      out.accept = true
    } else if (arg === '--auto-sitemap') {
      out.autoSitemap = true
    } else if (arg === '--notes') {
      out.notes = argv[++i]
    } else if (arg === '--log-urls') {
      out.logUrls = true
    } else {
      fail(`Unknown arg: ${arg}`)
    }
  }

  return out
}

function printHelp() {
  console.log('discover-scrape-targets.mjs')
  console.log('  --source-id <id> (required)')
  console.log('  --domain <domain> (dry-run without DB)')
  console.log('  --source-url <url> (dry-run without DB)')
  console.log('  --sitemap <url> (repeatable)')
  console.log('  --listing <url> (repeatable)')
  console.log('  --product-path-prefix /product/ OR --product-url-regex "<regex>"')
  console.log('  --max-urls 500 (default; capped by scrapeConfig.discovery.maxUrls)')
  console.log('  --dry-run')
  console.log('  --count-only (scan and report totals; no writes)')
  console.log('  --accept (required to write to scrape_targets)')
  console.log('  --auto-sitemap (discover sitemap via robots.txt or /sitemap.xml)')
  console.log('  --notes "optional note"')
  console.log('  --log-urls (print per-URL status as discovery runs)')
}

function fail(message) {
  console.error(`Error: ${message}`)
  process.exit(1)
}

function formatCapDetails({ configMaxUrls, requestedMaxUrls, effectiveMaxUrls }, attemptedCount) {
  const configPart = Number.isFinite(configMaxUrls) ? String(configMaxUrls) : 'none'
  const requestedPart = Number.isFinite(requestedMaxUrls) ? String(requestedMaxUrls) : 'none'
  const attemptedPart = Number.isFinite(attemptedCount) ? ` attempted=${attemptedCount}` : ''
  return `cap=${effectiveMaxUrls} configMaxUrls=${configPart} requestedMaxUrls=${requestedPart}.${attemptedPart}`
}

function capOverrideHint({ configMaxUrls }) {
  if (Number.isFinite(configMaxUrls)) {
    return ' Cap is enforced by source.scrapeConfig.discovery.maxUrls.'
  }
  return ' Use --max-urls to override the default cap for this run.'
}

function buildNotes(runId, method, note) {
  const base = `discovery:${runId} method:${method}`
  if (!note) return base
  return `${base} ${note}`
}

function normalizePrefix(prefix) {
  if (!prefix.startsWith('/')) return `/${prefix}`
  return prefix
}

function matchesProductPattern(url, prefix, regex) {
  if (regex) return regex.test(url)
  if (!prefix) return false
  try {
    const parsed = new URL(url)
    return parsed.pathname.startsWith(prefix)
  } catch {
    return false
  }
}

function cleanCandidateUrl(url) {
  if (!url) return null
  const trimmed = url.trim()
  if (!trimmed) return null
  const lowered = trimmed.toLowerCase()
  if (
    lowered.startsWith('javascript:') ||
    lowered.startsWith('mailto:') ||
    lowered.startsWith('tel:') ||
    lowered.startsWith('#')
  ) {
    return null
  }
  return decodeHtmlEntities(trimmed)
}

function resolveMethod(opts) {
  if (opts.sitemaps.length > 0 && opts.listings.length > 0) return 'MIXED'
  if (opts.sitemaps.length > 0) return 'SITEMAP'
  return 'LISTING'
}

async function fetchWithRobots(url, robotsPolicy, limiter) {
  const robotsCheck = await robotsPolicy.check(url)
  if (!robotsCheck.fetchSucceeded) {
    fail(`robots.txt fetch failed for ${getRegistrableDomain(url)}`)
  }
  if (!robotsCheck.allowed) {
    fail(`robots.txt disallows URL: ${url}`)
  }

  const delayMs = clampDelayMs(robotsCheck.crawlDelayMs ?? DEFAULT_DELAY_MS)
  await limiter.wait(url, delayMs)
  return await fetchText(url)
}

async function fetchText(url) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000)

  const headers = buildHeaders({
    Accept: 'text/html,application/xhtml+xml,application/xml',
  })

  const response = await fetch(url, {
    method: 'GET',
    headers,
    redirect: 'follow',
    signal: controller.signal,
  })

  clearTimeout(timeoutId)

  if (!response.ok) {
    fail(`HTTP ${response.status} for ${url}`)
  }

  const contentLength = response.headers.get('content-length')
  if (contentLength && Number.parseInt(contentLength, 10) > MAX_RESPONSE_BYTES) {
    fail(`Response too large for ${url}`)
  }

  const text = await response.text()
  if (text.length > MAX_RESPONSE_BYTES) {
    fail(`Response too large for ${url}`)
  }

  return text
}

function extractSitemapLocs(xml) {
  const urls = []
  const regex = /<loc>([\s\S]*?)<\/loc>/gi
  let match = null
  while ((match = regex.exec(xml)) !== null) {
    const loc = decodeHtmlEntities(match[1].trim())
    if (loc) urls.push(loc)
  }
  return urls
}

function extractLinks(html, baseUrl) {
  const urls = []
  const regex = /href\s*=\s*("([^"]+)"|'([^']+)')/gi
  let match = null
  while ((match = regex.exec(html)) !== null) {
    const href = match[2] || match[3]
    if (!href) continue
    try {
      const abs = new URL(href, baseUrl).toString()
      urls.push(abs)
    } catch {
      continue
    }
  }
  return urls
}

function decodeHtmlEntities(value) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
}

function buildHeaders(extra = {}) {
  const headers = { ...extra }
  if (DEFAULT_USER_AGENT) {
    headers['User-Agent'] = DEFAULT_USER_AGENT
  }
  return headers
}

function canonicalizeUrl(url) {
  const parsed = new URL(url)
  parsed.protocol = 'https:'
  parsed.hostname = parsed.hostname.toLowerCase()

  const trackingParams = new Set([
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_term',
    'utm_content',
    'fbclid',
    'gclid',
    'ref',
    'source',
    'campaign',
  ])

  for (const param of trackingParams) {
    parsed.searchParams.delete(param)
  }

  const keysToDelete = []
  for (const key of parsed.searchParams.keys()) {
    if (key.startsWith('utm_')) {
      keysToDelete.push(key)
    }
  }
  for (const key of keysToDelete) {
    parsed.searchParams.delete(key)
  }

  const emptyKeys = []
  for (const [key, value] of parsed.searchParams.entries()) {
    if (value === '') emptyKeys.push(key)
  }
  for (const key of emptyKeys) {
    parsed.searchParams.delete(key)
  }

  parsed.searchParams.sort()
  parsed.hash = ''
  if (parsed.pathname !== '/' && parsed.pathname.endsWith('/')) {
    parsed.pathname = parsed.pathname.slice(0, -1)
  }

  return parsed.toString()
}

function getRegistrableDomain(url) {
  try {
    const parsed = new URL(url)
    return normalizeDomain(parsed.hostname)
  } catch {
    return ''
  }
}

async function ensureSameDomain(url, expectedDomain) {
  const domain = getRegistrableDomain(url)
  const expected = normalizeDomain(expectedDomain)
  if (!domain || !expected) {
    fail(`Unable to determine domain for ${url}`)
  }
  if (
    domain !== expected &&
    !domain.endsWith(`.${expected}`) &&
    !expected.endsWith(`.${domain}`)
  ) {
    fail(`Domain mismatch for ${url}: ${domain} (expected ${expected})`)
  }
}

function normalizeDomain(host) {
  const lower = host.toLowerCase()
  if (lower.startsWith('www.')) {
    return lower.slice(4)
  }
  return lower
}

const publicHostCache = new Map()

async function ensurePublicUrl(url) {
  let parsed = null
  try {
    parsed = new URL(url)
  } catch {
    fail(`Invalid URL: ${url}`)
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    fail(`Unsupported URL protocol: ${url}`)
  }

  const host = parsed.hostname.toLowerCase()
  const cached = publicHostCache.get(host)
  if (cached === true) {
    return
  }
  if (cached === false) {
    fail(`Host not allowed: ${url}`)
  }

  if (!host || host === 'localhost') {
    fail(`Invalid host: ${url}`)
  }

  if (isIpLiteral(host)) {
    if (!isPublicIp(host)) {
      fail(`Private or reserved IP not allowed: ${url}`)
    }
    publicHostCache.set(host, true)
    return
  }

  const addresses = await dns.lookup(host, { all: true })
  if (!addresses || addresses.length === 0) {
    fail(`DNS lookup failed for ${host}`)
  }

  for (const addr of addresses) {
    if (!isPublicIp(addr.address)) {
      fail(`Private or reserved IP not allowed for ${host}: ${addr.address}`)
    }
  }

  publicHostCache.set(host, true)
}

function isIpLiteral(host) {
  return /^[0-9.]+$/.test(host) || host.includes(':')
}

function isPublicIp(address) {
  if (address.includes(':')) {
    const lower = address.toLowerCase()
    if (lower === '::1') return false
    if (lower.startsWith('fe80:')) return false
    if (lower.startsWith('fc') || lower.startsWith('fd')) return false
    return true
  }

  const parts = address.split('.').map(part => Number.parseInt(part, 10))
  if (parts.length !== 4 || parts.some(part => Number.isNaN(part))) {
    return false
  }

  const [a, b] = parts
  if (a === 10) return false
  if (a === 127) return false
  if (a === 0) return false
  if (a === 100 && b >= 64 && b <= 127) return false
  if (a === 169 && b === 254) return false
  if (a === 172 && b >= 16 && b <= 31) return false
  if (a === 192 && b === 168) return false
  if (a >= 224) return false

  return true
}

function clampDelayMs(value) {
  return Math.max(MIN_DELAY_MS, Math.min(MAX_DELAY_MS, value))
}

class DomainRateLimiter {
  constructor() {
    this.lastFetchAt = new Map()
  }

  async wait(url, delayMs) {
    const domain = getRegistrableDomain(url)
    const now = Date.now()
    const last = this.lastFetchAt.get(domain) || 0
    const waitMs = Math.max(0, delayMs - (now - last))
    if (waitMs > 0) {
      await sleep(waitMs)
    }
    this.lastFetchAt.set(domain, Date.now())
  }
}

class RobotsPolicy {
  constructor({ userAgent }) {
    this.userAgent = userAgent.toLowerCase()
    this.cache = new Map()
  }

  async check(url) {
    const domain = getRegistrableDomain(url)
    const rules = await this.getRules(domain)

    if (!rules.fetchSucceeded) {
      return { allowed: false, fetchSucceeded: false, crawlDelayMs: null }
    }

    const parsed = new URL(url)
    const path = parsed.pathname + parsed.search

    if (matchesAnyRule(path, rules.agentDisallowed)) {
      return { allowed: false, fetchSucceeded: true, crawlDelayMs: rules.crawlDelayMs }
    }

    if (matchesAnyRule(path, rules.globalDisallowed)) {
      return { allowed: false, fetchSucceeded: true, crawlDelayMs: rules.crawlDelayMs }
    }

    return { allowed: true, fetchSucceeded: true, crawlDelayMs: rules.crawlDelayMs }
  }

  async getRules(domain) {
    const cached = this.cache.get(domain)
    const now = Date.now()
    if (cached && now - cached.cachedAt < 24 * 60 * 60 * 1000) {
      return cached
    }

    const robotsUrl = `https://${domain}/robots.txt`
    let text = null
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000)
        const headers = buildHeaders()
        const response = await fetch(robotsUrl, {
          method: 'GET',
          headers,
          signal: controller.signal,
        })
        clearTimeout(timeoutId)

        if (response.status === 404) {
          const rules = {
            globalDisallowed: [],
            agentDisallowed: [],
            crawlDelayMs: DEFAULT_DELAY_MS,
            cachedAt: Date.now(),
            fetchSucceeded: true,
          }
          this.cache.set(domain, rules)
          return rules
        }

        if (response.ok) {
          text = await response.text()
          break
        }
      } catch {
        // retry
      }

      if (attempt < 3) {
        await sleep(1000 * attempt)
      }
    }

    if (text === null) {
      const rules = {
        globalDisallowed: ['*'],
        agentDisallowed: [],
        crawlDelayMs: null,
        cachedAt: Date.now(),
        fetchSucceeded: false,
      }
      this.cache.set(domain, rules)
      return rules
    }

    const parsed = parseRobotsTxt(text, this.userAgent)
    this.cache.set(domain, parsed)
    return parsed
  }
}

function parseRobotsTxt(text, userAgent) {
  const rules = {
    globalDisallowed: [],
    agentDisallowed: [],
    crawlDelayMs: DEFAULT_DELAY_MS,
    cachedAt: Date.now(),
    fetchSucceeded: true,
  }

  const lines = text.split('\n')
  let currentAgents = []

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const colonIndex = line.indexOf(':')
    if (colonIndex === -1) continue

    const directive = line.slice(0, colonIndex).trim().toLowerCase()
    const value = line.slice(colonIndex + 1).trim()

    if (directive === 'user-agent') {
      currentAgents = [value.toLowerCase()]
    } else if (directive === 'disallow') {
      if (!value) continue
      const isGlobal = currentAgents.includes('*')
      const isOurAgent = currentAgents.includes(userAgent)
      if (isOurAgent) {
        rules.agentDisallowed.push(value)
      } else if (isGlobal) {
        rules.globalDisallowed.push(value)
      }
    } else if (directive === 'crawl-delay') {
      const isGlobal = currentAgents.includes('*')
      const isOurAgent = currentAgents.includes(userAgent)
      if (isGlobal || isOurAgent) {
        const delay = Number.parseFloat(value)
        if (!Number.isNaN(delay) && delay > 0) {
          rules.crawlDelayMs = clampDelayMs(delay * 1000)
        }
      }
    }
  }

  return rules
}

function matchesAnyRule(path, rules) {
  for (const rule of rules) {
    if (rule === '*' || rule === '/') return true
    if (rule.endsWith('*')) {
      const prefix = rule.slice(0, -1)
      if (path.startsWith(prefix)) return true
    } else if (path.startsWith(rule)) {
      return true
    }
  }
  return false
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function discoverSitemaps(domain) {
  const robots = await fetchRobotsTxt(domain)
  if (!robots.fetchSucceeded) {
    fail(`robots.txt fetch failed for ${domain}`)
  }

  const discovered = new Set(robots.sitemaps)
  if (discovered.size === 0) {
    discovered.add(`https://${domain}/sitemap.xml`)
    discovered.add(`https://${domain}/sitemap_index.xml`)
  }

  const result = []
  for (const sitemapUrl of discovered) {
    await ensurePublicUrl(sitemapUrl)
    await ensureSameDomain(sitemapUrl, domain)
    result.push(sitemapUrl)
  }
  return result
}

async function fetchRobotsTxt(domain) {
  const robotsUrl = `https://${domain}/robots.txt`
  await ensurePublicUrl(robotsUrl)

  let text = null
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)
      const headers = buildHeaders()
      const response = await fetch(robotsUrl, {
        method: 'GET',
        headers,
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      if (response.status === 404) {
        return { fetchSucceeded: true, sitemaps: [] }
      }

      if (response.ok) {
        text = await response.text()
        break
      }
    } catch {
      // retry
    }

    if (attempt < 3) {
      await sleep(1000 * attempt)
    }
  }

  if (text === null) {
    return { fetchSucceeded: false, sitemaps: [] }
  }

  return { fetchSucceeded: true, sitemaps: extractSitemapLines(text) }
}

function extractSitemapLines(text) {
  const sitemaps = []
  const lines = text.split('\n')
  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue
    const lower = line.toLowerCase()
    if (!lower.startsWith('sitemap:')) continue
    const value = line.slice(8).trim()
    if (value) {
      sitemaps.push(value)
    }
  }
  return sitemaps
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch(error => {
    console.error(`Error: ${error?.message || error}`)
    process.exit(1)
  })
