import { readFile } from 'fs/promises'
import { promises as dns } from 'dns'

const DEFAULT_DELAY_MS = 1000
const MIN_DELAY_MS = 1000
const MAX_DELAY_MS = 60000

async function main() {
  const opts = parseArgs(process.argv.slice(2))

  if (opts.help) {
    printHelp()
    return
  }

  const urls = new Set()
  for (const url of opts.urls) urls.add(url)
  if (opts.file) {
    const content = await readFile(opts.file, 'utf8')
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      urls.add(trimmed)
    }
  }

  if (urls.size === 0) {
    fail('Provide at least one --url or --file')
  }

  const delayMs = Number.isFinite(opts.delayMs) ? Math.max(0, opts.delayMs) : DEFAULT_DELAY_MS
  const robots = new RobotsPolicy()

  const adapter = await loadAdapter()
  const ctx = {
    sourceId: opts.sourceId,
    retailerId: opts.retailerId,
    runId: 'dev_run',
    targetId: 'dev_target',
    now: new Date(),
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
      child: () => ctx.logger,
    },
  }

  const results = []
  for (const url of urls) {
    await ensurePublicUrl(url)
    if (opts.allowlistDomain) {
      await ensureSameDomain(url, opts.allowlistDomain)
    }
    const robotsCheck = await robots.check(url)
    if (!robotsCheck.fetchSucceeded) {
      throw new Error(`robots.txt fetch failed for ${getRegistrableDomain(url)}`)
    }
    if (!robotsCheck.allowed) {
      results.push({ url, extract: { ok: false, reason: 'ROBOTS_DISALLOWED' } })
      continue
    }
    const effectiveDelay = clampDelayMs(Math.max(delayMs, robotsCheck.crawlDelayMs ?? DEFAULT_DELAY_MS))
    const html = await fetchText(url)
    const extracted = adapter.extract(html, url, ctx)

    if (!extracted.ok) {
      results.push({ url, extract: { ok: false, reason: extracted.reason } })
    } else {
      const normalized = adapter.normalize(extracted.offer, ctx)
      results.push({
        url,
        extract: {
          ok: true,
          offer: extracted.offer,
        },
        normalize: normalized,
      })
    }

    if (effectiveDelay > 0) await sleep(effectiveDelay)
  }

  if (opts.json) {
    console.log(JSON.stringify(results, null, 2))
    return
  }

  if (opts.csv) {
    printCsv(results)
    return
  }

  if (opts.table) {
    printTable(results)
    return
  }

  printText(results)
}

function parseArgs(argv) {
  const out = {
    help: false,
    urls: [],
    file: null,
    json: false,
    csv: false,
    table: false,
    delayMs: DEFAULT_DELAY_MS,
    sourceId: 'source_sgammo',
    retailerId: 'retailer_sgammo',
    allowlistDomain: null,
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') {
      out.help = true
    } else if (arg === '--url') {
      out.urls.push(argv[++i])
    } else if (arg === '--file') {
      out.file = argv[++i]
    } else if (arg === '--json') {
      out.json = true
    } else if (arg === '--csv') {
      out.csv = true
    } else if (arg === '--table') {
      out.table = true
    } else if (arg === '--delay-ms') {
      out.delayMs = Number.parseInt(argv[++i], 10)
    } else if (arg === '--source-id') {
      out.sourceId = argv[++i]
    } else if (arg === '--retailer-id') {
      out.retailerId = argv[++i]
    } else if (arg === '--allowlist-domain') {
      out.allowlistDomain = argv[++i]
    } else {
      fail(`Unknown arg: ${arg}`)
    }
  }

  const outputFlags = [out.json, out.csv, out.table].filter(Boolean).length
  if (outputFlags > 1) {
    fail('Only one output format may be selected: --json, --csv, or --table')
  }

  return out
}

function printHelp() {
  console.log('test-sgammo-urls.mjs')
  console.log('  --url <url> (repeatable)')
  console.log('  --file <path> (one URL per line)')
  console.log('  --delay-ms 1000 (delay between fetches; never faster than robots crawl-delay)')
  console.log('  --json (machine-readable output)')
  console.log('  --csv (csv output)')
  console.log('  --table (table output)')
  console.log('  --source-id <id> (optional, default source_sgammo)')
  console.log('  --retailer-id <id> (optional, default retailer_sgammo)')
  console.log('  --allowlist-domain <domain> (require URLs to match domain)')
}

function fail(message) {
  console.error(`Error: ${message}`)
  process.exit(1)
}

async function loadAdapter() {
  try {
    const module = await import('../../apps/harvester/src/scraper/adapters/sgammo/adapter.ts')
    return module.sgammoAdapter
  } catch (error) {
    const message = error?.message || error
    fail(
      `Failed to load sgammo adapter (${message}). ` +
        'Run with: pnpm exec tsx scripts/dev/test-sgammo-urls.mjs ...'
    )
  }
}

async function fetchText(url) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000)

  const response = await fetch(url, {
    method: 'GET',
    redirect: 'follow',
    signal: controller.signal,
  })

  clearTimeout(timeoutId)

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return await response.text()
}

function printText(results) {
  for (const result of results) {
    if (!result.extract.ok) {
      console.log(`${result.url}`)
      console.log(`  extract: FAIL (${result.extract.reason})`)
      continue
    }

    const offer = result.extract.offer
    console.log(`${result.url}`)
    console.log(`  extract: OK`)
    for (const [key, value] of Object.entries(serializeOffer(offer))) {
      console.log(`  ${key}: ${value}`)
    }
    console.log(`  normalize: ${result.normalize?.status ?? 'unknown'}`)
    if (result.normalize?.status && result.normalize.status !== 'ok') {
      console.log(`  normalizeReason: ${result.normalize.reason ?? ''}`)
    }
  }
}

function printCsv(results) {
  const offerKeys = getOfferKeys()
  const header = ['extract_ok', ...offerKeys, 'normalize_status', 'normalize_reason', 'extract_reason']
  console.log(header.join(','))
  for (const result of results) {
    const offer = result.extract.ok ? serializeOffer(result.extract.offer) : {}
    const row = [
      csvCell(result.extract.ok ? 'true' : 'false'),
      ...offerKeys.map(key => csvCell(offer[key] ?? '')),
      csvCell(result.normalize?.status ?? ''),
      csvCell(result.normalize?.status && result.normalize.status !== 'ok' ? result.normalize.reason ?? '' : ''),
      csvCell(result.extract.ok ? '' : result.extract.reason ?? ''),
    ]
    console.log(row.join(','))
  }
}

function csvCell(value) {
  const str = String(value ?? '')
  if (str.includes('"') || str.includes(',') || str.includes('\n')) {
    return `"${str.replaceAll('"', '""')}"`
  }
  return str
}

function printTable(results) {
  const offerKeys = getOfferKeys()
  const rows = results.map(result => {
    const offer = result.extract.ok ? serializeOffer(result.extract.offer) : {}
    const base = {
      extract_ok: result.extract.ok ? 'yes' : 'no',
      normalize_status: result.normalize?.status ?? '',
      normalize_reason:
        result.normalize?.status && result.normalize.status !== 'ok' ? result.normalize.reason ?? '' : '',
      extract_reason: result.extract.ok ? '' : result.extract.reason ?? '',
    }
    for (const key of offerKeys) {
      base[key] = offer[key] ?? ''
    }
    return base
  })
  const headers = ['extract_ok', ...offerKeys, 'normalize_status', 'normalize_reason', 'extract_reason']
  const widths = Object.fromEntries(headers.map(h => [h, h.length]))
  for (const row of rows) {
    for (const key of headers) {
      widths[key] = Math.max(widths[key], String(row[key]).length)
    }
  }
  const line = headers.map(h => h.padEnd(widths[h])).join('  ')
  console.log(line)
  console.log(headers.map(h => '-'.repeat(widths[h])).join('  '))
  for (const row of rows) {
    console.log(headers.map(h => String(row[h]).padEnd(widths[h])).join('  '))
  }
}

function getOfferKeys() {
  return [
    'sourceId',
    'retailerId',
    'url',
    'title',
    'priceCents',
    'currency',
    'availability',
    'observedAt',
    'identityKey',
    'retailerSku',
    'retailerProductId',
    'upc',
    'brand',
    'caliber',
    'grainWeight',
    'roundCount',
    'caseMaterial',
    'bulletType',
    'loadType',
    'shellLength',
    'costPerRoundCents',
    'shippingCents',
    'taxIncluded',
    'imageUrl',
    'adapterVersion',
  ]
}

function serializeOffer(offer) {
  return {
    sourceId: offer.sourceId ?? '',
    retailerId: offer.retailerId ?? '',
    url: offer.url ?? '',
    title: offer.title ?? '',
    priceCents: offer.priceCents ?? '',
    currency: offer.currency ?? '',
    availability: offer.availability ?? '',
    observedAt: offer.observedAt instanceof Date ? offer.observedAt.toISOString() : offer.observedAt ?? '',
    identityKey: offer.identityKey ?? '',
    retailerSku: offer.retailerSku ?? '',
    retailerProductId: offer.retailerProductId ?? '',
    upc: offer.upc ?? '',
    brand: offer.brand ?? '',
    caliber: offer.caliber ?? '',
    grainWeight: offer.grainWeight ?? '',
    roundCount: offer.roundCount ?? '',
    caseMaterial: offer.caseMaterial ?? '',
    bulletType: offer.bulletType ?? '',
    loadType: offer.loadType ?? '',
    shellLength: offer.shellLength ?? '',
    costPerRoundCents: offer.costPerRoundCents ?? '',
    shippingCents: offer.shippingCents ?? '',
    taxIncluded: offer.taxIncluded ?? '',
    imageUrl: offer.imageUrl ?? '',
    adapterVersion: offer.adapterVersion ?? '',
  }
}

function clampDelayMs(value) {
  return Math.max(MIN_DELAY_MS, Math.min(MAX_DELAY_MS, value))
}

function getRegistrableDomain(url) {
  try {
    const parsed = new URL(url)
    return normalizeDomain(parsed.hostname)
  } catch {
    return ''
  }
}

function normalizeDomain(host) {
  const lower = host.toLowerCase()
  if (lower.startsWith('www.')) {
    return lower.slice(4)
  }
  return lower
}

async function ensureSameDomain(url, expectedDomain) {
  const domain = getRegistrableDomain(url)
  const expected = normalizeDomain(expectedDomain)
  if (!domain || !expected) {
    fail(`Unable to determine domain for ${url}`)
  }
  if (domain !== expected && !domain.endsWith(`.${expected}`) && !expected.endsWith(`.${domain}`)) {
    fail(`Domain mismatch for ${url}: ${domain} (expected ${expected})`)
  }
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

class RobotsPolicy {
  constructor() {
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

    if (matchesAnyRule(path, rules.disallowed)) {
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
        const response = await fetch(robotsUrl, {
          method: 'GET',
          redirect: 'follow',
          signal: controller.signal,
        })
        clearTimeout(timeoutId)

        if (response.status === 404) {
          const rules = {
            disallowed: [],
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
        disallowed: ['*'],
        crawlDelayMs: null,
        cachedAt: Date.now(),
        fetchSucceeded: false,
      }
      this.cache.set(domain, rules)
      return rules
    }

    const parsed = parseRobotsTxt(text)
    this.cache.set(domain, parsed)
    return parsed
  }
}

function parseRobotsTxt(text) {
  const rules = {
    disallowed: [],
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
      if (isGlobal) {
        rules.disallowed.push(value)
      }
    } else if (directive === 'crawl-delay') {
      const isGlobal = currentAgents.includes('*')
      if (isGlobal) {
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

main().catch(error => {
  console.error(`Error: ${error?.message || error}`)
  process.exit(1)
})
