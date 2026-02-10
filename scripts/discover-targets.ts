#!/usr/bin/env tsx
/**
 * Scraper Target Discovery CLI
 *
 * Crawls a retailer's sitemap to discover product URLs and outputs CSV
 * suitable for bulk import via the admin UI.
 *
 * Usage:
 *   npx tsx scripts/discover-targets.ts \
 *     --adapter sgammo \
 *     --sitemap https://www.sgammo.com/sitemap.xml \
 *     --output targets.csv \
 *     [--pattern "/product/"] \
 *     [--exclude "/category/,/tag/"] \
 *     [--max 500] \
 *     [--respect-robots] \
 *     [--verbose]
 */

import { XMLParser } from 'fast-xml-parser'
import { writeFileSync } from 'node:fs'
import { KNOWN_ADAPTERS } from '../packages/scraper-registry/src/index.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CliOptions {
  adapter: string
  sitemap: string
  output: string | null
  pattern: string | null
  exclude: string[]
  max: number
  respectRobots: boolean
  verbose: boolean
}

interface SitemapEntry {
  loc: string
}

// ---------------------------------------------------------------------------
// URL Canonicalization (mirrors apps/harvester/src/scraper/utils/url.ts)
// ---------------------------------------------------------------------------

const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid', 'ref', 'source', 'campaign',
])

function canonicalizeUrl(url: string): string {
  const parsed = new URL(url)
  parsed.protocol = 'https:'
  parsed.hostname = parsed.hostname.toLowerCase()

  for (const param of TRACKING_PARAMS) {
    parsed.searchParams.delete(param)
  }

  const keysToDelete: string[] = []
  for (const key of parsed.searchParams.keys()) {
    if (key.startsWith('utm_')) keysToDelete.push(key)
  }
  for (const key of keysToDelete) {
    parsed.searchParams.delete(key)
  }

  const emptyKeys: string[] = []
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

// ---------------------------------------------------------------------------
// Robots.txt (lightweight inline implementation for CLI)
// ---------------------------------------------------------------------------

interface RobotsRules {
  disallowed: string[]
  fetchSucceeded: boolean
}

async function fetchRobotsTxt(domain: string): Promise<RobotsRules> {
  const robotsUrl = `https://${domain}/robots.txt`
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)
    const response = await fetch(robotsUrl, {
      method: 'GET',
      headers: { 'User-Agent': 'IronScout/1.0 (+https://ironscout.ai/bot)' },
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (response.status === 404) {
      return { disallowed: [], fetchSucceeded: true }
    }

    if (!response.ok) {
      return { disallowed: ['*'], fetchSucceeded: false }
    }

    const text = await response.text()
    const disallowed: string[] = []
    let inGlobalSection = false

    for (const rawLine of text.split('\n')) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#')) continue

      const colonIndex = line.indexOf(':')
      if (colonIndex === -1) continue

      const directive = line.slice(0, colonIndex).trim().toLowerCase()
      const value = line.slice(colonIndex + 1).trim()

      if (directive === 'user-agent') {
        inGlobalSection = value === '*' || value.toLowerCase() === 'ironscout'
      } else if (directive === 'disallow' && inGlobalSection && value) {
        disallowed.push(value)
      }
    }

    return { disallowed, fetchSucceeded: true }
  } catch {
    return { disallowed: ['*'], fetchSucceeded: false }
  }
}

function isBlockedByRobots(path: string, rules: RobotsRules): boolean {
  if (!rules.fetchSucceeded) return true

  for (const rule of rules.disallowed) {
    if (rule === '*' || rule === '/') return true
    if (rule.endsWith('*')) {
      if (path.startsWith(rule.slice(0, -1))) return true
    } else {
      if (path.startsWith(rule)) return true
    }
  }

  return false
}

// ---------------------------------------------------------------------------
// Sitemap Fetching & Parsing
// ---------------------------------------------------------------------------

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  isArray: (name) => name === 'sitemap' || name === 'url',
})

async function fetchSitemap(url: string, verbose: boolean): Promise<string> {
  if (verbose) console.error(`Fetching: ${url}`)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000)

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'User-Agent': 'IronScout/1.0 (+https://ironscout.ai/bot)',
      'Accept': 'application/xml,text/xml,*/*',
    },
    signal: controller.signal,
  })

  clearTimeout(timeoutId)

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${url}`)
  }

  return response.text()
}

async function collectUrls(
  sitemapUrl: string,
  verbose: boolean,
  depth = 0,
): Promise<string[]> {
  if (depth > 3) {
    if (verbose) console.error(`Max sitemap depth reached at ${sitemapUrl}`)
    return []
  }

  const xml = await fetchSitemap(sitemapUrl, verbose)
  const parsed = xmlParser.parse(xml)

  // Check if this is a sitemap index
  if (parsed.sitemapindex?.sitemap) {
    const childSitemaps: Array<{ loc: string }> = parsed.sitemapindex.sitemap
    const urls: string[] = []

    if (verbose) {
      console.error(`Sitemap index with ${childSitemaps.length} child sitemaps`)
    }

    for (const child of childSitemaps) {
      const childLoc = child.loc?.trim()
      if (childLoc) {
        const childUrls = await collectUrls(childLoc, verbose, depth + 1)
        urls.push(...childUrls)
      }
    }

    return urls
  }

  // Regular sitemap — extract <url><loc>
  if (parsed.urlset?.url) {
    const entries: SitemapEntry[] = parsed.urlset.url
    return entries
      .map((entry) => (typeof entry.loc === 'string' ? entry.loc.trim() : ''))
      .filter(Boolean)
  }

  if (verbose) console.error(`No URLs found in ${sitemapUrl}`)
  return []
}

// ---------------------------------------------------------------------------
// CLI Argument Parsing
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    adapter: '',
    sitemap: '',
    output: null,
    pattern: null,
    exclude: [],
    max: 500,
    respectRobots: false,
    verbose: false,
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    switch (arg) {
      case '--adapter':
        opts.adapter = argv[++i] ?? ''
        break
      case '--sitemap':
        opts.sitemap = argv[++i] ?? ''
        break
      case '--output':
        opts.output = argv[++i] ?? null
        break
      case '--pattern':
        opts.pattern = argv[++i] ?? null
        break
      case '--exclude':
        opts.exclude = (argv[++i] ?? '').split(',').map((s) => s.trim()).filter(Boolean)
        break
      case '--max':
        opts.max = parseInt(argv[++i] ?? '500', 10)
        break
      case '--respect-robots':
        opts.respectRobots = true
        break
      case '--verbose':
        opts.verbose = true
        break
      case '--help':
      case '-h':
        printUsage()
        process.exit(0)
        break
      default:
        console.error(`Unknown argument: ${arg}`)
        printUsage()
        process.exit(1)
    }
  }

  return opts
}

function printUsage(): void {
  console.error(`
Usage: npx tsx scripts/discover-targets.ts [options]

Options:
  --adapter <id>       Adapter ID (e.g. sgammo, primaryarms, midwayusa)
  --sitemap <url>      Sitemap URL to crawl
  --output <path>      Output CSV file path (default: stdout)
  --pattern <path>     URL path pattern to include (e.g. "/product/")
  --exclude <paths>    Comma-separated URL patterns to exclude
  --max <n>            Maximum URLs to output (default: 500)
  --respect-robots     Check robots.txt and filter blocked URLs
  --verbose            Print progress to stderr
  --help               Show this help
`)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2))

  if (!opts.adapter) {
    console.error('Error: --adapter is required')
    process.exit(1)
  }

  if (!opts.sitemap) {
    console.error('Error: --sitemap is required')
    process.exit(1)
  }

  // Resolve adapter defaults
  const adapterInfo = KNOWN_ADAPTERS.find((a) => a.id === opts.adapter)
  if (!adapterInfo) {
    console.error(
      `Warning: Unknown adapter "${opts.adapter}". Known adapters: ${KNOWN_ADAPTERS.map((a) => a.id).join(', ')}`,
    )
  }

  // Determine include pattern
  const includePattern = opts.pattern ?? adapterInfo?.productPathPattern ?? null

  if (opts.verbose) {
    console.error(`Adapter: ${opts.adapter}`)
    console.error(`Sitemap: ${opts.sitemap}`)
    console.error(`Include pattern: ${includePattern ?? '(all URLs)'}`)
    if (opts.exclude.length > 0) {
      console.error(`Exclude patterns: ${opts.exclude.join(', ')}`)
    }
    console.error(`Max URLs: ${opts.max}`)
    console.error(`Respect robots: ${opts.respectRobots}`)
  }

  // Fetch robots.txt if needed
  let robotsRules: RobotsRules | null = null
  if (opts.respectRobots) {
    try {
      const sitemapDomain = new URL(opts.sitemap).hostname.replace(/^www\./, '')
      if (opts.verbose) console.error(`Fetching robots.txt for ${sitemapDomain}...`)
      robotsRules = await fetchRobotsTxt(sitemapDomain)
      if (!robotsRules.fetchSucceeded) {
        console.error('Warning: Failed to fetch robots.txt — all URLs will be blocked (fail-closed)')
      } else if (opts.verbose) {
        console.error(`Robots.txt: ${robotsRules.disallowed.length} disallow rules`)
      }
    } catch (error) {
      console.error(`Warning: Error fetching robots.txt: ${error}`)
      robotsRules = { disallowed: ['*'], fetchSucceeded: false }
    }
  }

  // Collect URLs from sitemap
  if (opts.verbose) console.error('Crawling sitemap...')
  const rawUrls = await collectUrls(opts.sitemap, opts.verbose)
  if (opts.verbose) console.error(`Found ${rawUrls.length} URLs in sitemap`)

  // Filter, canonicalize, deduplicate
  const seen = new Set<string>()
  const results: Array<{ url: string; adapterId: string }> = []

  let skippedPattern = 0
  let skippedExclude = 0
  let skippedRobots = 0
  let skippedDuplicate = 0

  for (const rawUrl of rawUrls) {
    if (results.length >= opts.max) break

    let url: URL
    try {
      url = new URL(rawUrl)
    } catch {
      continue
    }

    const pathname = url.pathname

    // Include filter
    if (includePattern && !pathname.includes(includePattern)) {
      skippedPattern++
      continue
    }

    // Exclude filter
    if (opts.exclude.some((ex) => pathname.includes(ex))) {
      skippedExclude++
      continue
    }

    // Robots.txt filter
    if (robotsRules && isBlockedByRobots(pathname + url.search, robotsRules)) {
      skippedRobots++
      continue
    }

    // Canonicalize and deduplicate
    const canonical = canonicalizeUrl(rawUrl)
    if (seen.has(canonical)) {
      skippedDuplicate++
      continue
    }
    seen.add(canonical)

    results.push({ url: canonical, adapterId: opts.adapter })
  }

  if (opts.verbose) {
    console.error(`\nResults:`)
    console.error(`  Discovered: ${results.length}`)
    console.error(`  Skipped (pattern): ${skippedPattern}`)
    console.error(`  Skipped (exclude): ${skippedExclude}`)
    console.error(`  Skipped (robots): ${skippedRobots}`)
    console.error(`  Skipped (duplicate): ${skippedDuplicate}`)
    console.error(`  Total scanned: ${rawUrls.length}`)
  }

  // Generate CSV
  const csvLines = ['url,adapterId']
  for (const row of results) {
    csvLines.push(`${row.url},${row.adapterId}`)
  }
  const csv = csvLines.join('\n') + '\n'

  // Output
  if (opts.output) {
    writeFileSync(opts.output, csv, 'utf-8')
    if (opts.verbose) console.error(`Wrote ${results.length} URLs to ${opts.output}`)
  } else {
    process.stdout.write(csv)
  }
}

main().catch((error) => {
  console.error(`Error: ${error instanceof Error ? error.message : error}`)
  process.exit(1)
})
