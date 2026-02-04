#!/usr/bin/env node
"use strict"

import { existsSync, cpSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { resolve, join, dirname, extname } from 'path'
import { fileURLToPath } from 'url'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { parseArgs } from '../lib/utils.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '../..')
const templateRoot = resolve(projectRoot, 'apps/harvester/src/scraper/adapters/__template__')
const adaptersRoot = resolve(projectRoot, 'apps/harvester/src/scraper/adapters')
const DEFAULT_USER_AGENT = 'IronScout/1.0 (+https://ironscout.ai/bot; bot@ironscout.ai)'
const scraperConfigDir = resolve(projectRoot, '.ironscout', 'scraper')

async function loadCheerio() {
  try {
    return await import('cheerio')
  } catch {
    return null
  }
}

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
  return `${question}\n  (default: ${display})\n> `
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

function toCamelCase(value) {
  const cleaned = value
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
  if (!cleaned) return ''
  const parts = cleaned.split(' ')
  const first = parts[0].toLowerCase()
  const rest = parts
    .slice(1)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('')
  return `${first}${rest}`
}

function replaceAdapterConstants(contents, adapterId, adapterVersion, adapterDomain, adapterVar) {
  let updated = contents
  updated = updated.replace(/const ADAPTER_ID = '.*?'/, `const ADAPTER_ID = '${adapterId}'`)
  updated = updated.replace(/const ADAPTER_VERSION = '.*?'/, `const ADAPTER_VERSION = '${adapterVersion}'`)
  updated = updated.replace(/const ADAPTER_DOMAIN = '.*?'/, `const ADAPTER_DOMAIN = '${adapterDomain}'`)
  updated = updated.replace(/export const templateAdapter/, `export const ${adapterVar}`)
  return updated
}

function updateTestFile(contents, adapterVar, adapterId) {
  let updated = contents.replace(/templateAdapter/g, adapterVar)
  updated = updated.replace(/adapter template/g, `${adapterId} adapter`)
  return updated
}

function updateReadme(contents, adapterId, adapterDomain) {
  const lines = contents.split('\n')
  const nextLines = [`# ${adapterId} Adapter`, '', `Domain: ${adapterDomain}`, '', ...lines.slice(1)]
  return nextLines.join('\n')
}

function printHelp() {
  console.log('new-adapter.mjs')
  console.log('  --id <adapterId> (required)')
  console.log('  --domain <domain> (required)')
  console.log('  --version <semver> (default: 0.0.0)')
  console.log('  --no-register (skip adapter registry update)')
  console.log('')
  console.log('adapterId guidance:')
  console.log('  - short, lowercase slug (e.g., sgammo, primaryarms)')
  console.log('  - must match sources.adapterId and adapter folder name')
  console.log('')
  console.log('Example:')
  console.log('  node scripts/scraper/new-adapter.mjs --id primaryarms --domain primaryarms.com --version 1.0.0')
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

async function promptText(question, defaultValue = '') {
  if (!process.stdin.isTTY) return ''
  const rl = createInterface({ input, output })
  try {
    const raw = (await rl.question(question)).trim()
    return raw || defaultValue
  } finally {
    rl.close()
  }
}

function findLastLineIndex(lines, predicate) {
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (predicate(lines[i])) return i
  }
  return -1
}

function registerAdapter(adapterId, adapterVar) {
  const registryPath = resolve(projectRoot, 'apps/harvester/src/scraper/adapters/index.ts')
  if (!existsSync(registryPath)) {
    fail(`Adapter registry missing at ${registryPath}`)
  }

  const importLine = `import { ${adapterVar} } from './${adapterId}/index.js'`
  const registerLine = `  registry.register(${adapterVar})`
  const exportLine = `export { ${adapterVar} } from './${adapterId}/index.js'`

  let contents = readFileSync(registryPath, 'utf8')

  if (contents.includes(importLine) || contents.includes(exportLine)) {
    return { status: 'exists', path: registryPath }
  }

  const registerMarker = '  // Future adapters register here:'

  const lines = contents.split('\n')
  const importIndex = findLastLineIndex(
    lines,
    line => line.startsWith('import {') && line.includes("from './") && line.includes('/index.js')
  )
  if (importIndex === -1) {
    fail('Unable to locate adapter import block in registry file')
  }
  lines.splice(importIndex + 1, 0, importLine)

  const registerIndex = lines.findIndex(line => line.includes(registerMarker))
  if (registerIndex < 0) {
    fail('Unable to locate registerAllAdapters insert point in registry file')
  }
  lines.splice(registerIndex, 0, registerLine)

  const exportIndex = findLastLineIndex(
    lines,
    line => line.startsWith('export {') && line.includes("from './") && line.includes('/index.js')
  )
  if (exportIndex === -1) {
    fail('Unable to locate adapter export block in registry file')
  }
  lines.splice(exportIndex + 1, 0, exportLine)

  writeFileSync(registryPath, lines.join('\n'), 'utf8')
  return { status: 'updated', path: registryPath }
}

async function fetchFixtureContent(url, headers) {
  const response = await fetch(url, {
    method: 'GET',
    headers,
    redirect: 'follow',
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return await response.text()
}

function detectFixtureExtension(raw, hintExt) {
  const ext = (hintExt || '').toLowerCase()
  if (ext === '.json') return 'json'
  if (ext === '.html' || ext === '.htm') return 'html'

  const trimmed = raw.trim()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json'
  return 'html'
}

function isUrl(value) {
  return typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'))
}

function normalizeSourceInput(value, label) {
  if (!value) return value
  const tokens = String(value).trim().split(/\s+/).filter(Boolean)
  if (tokens.length <= 1) return value.trim()

  const urlToken = tokens.find(token => isUrl(token))
  if (urlToken) {
    console.warn(`Note: ${label} received multiple values. Using URL: ${urlToken}`)
    return urlToken
  }

  const pathToken = tokens.find(token => existsSync(token))
  if (pathToken) {
    console.warn(`Note: ${label} received multiple values. Using file path: ${pathToken}`)
    return pathToken
  }

  console.warn(`Note: ${label} received multiple values. Using first entry: ${tokens[0]}`)
  return tokens[0]
}

function safeJsonParse(raw) {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function normalizeJsonArray(value) {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

function flattenJsonLd(value) {
  const output = []
  const queue = normalizeJsonArray(value).slice()
  while (queue.length > 0) {
    const current = queue.shift()
    if (!current || typeof current !== 'object') continue
    if (Array.isArray(current)) {
      queue.push(...current)
      continue
    }
    if (current['@graph']) {
      queue.push(...normalizeJsonArray(current['@graph']))
    }
    output.push(current)
  }
  return output
}

function typeMatches(value, target) {
  if (!value) return false
  const targetLower = String(target).toLowerCase()
  if (Array.isArray(value)) {
    return value.some(item => String(item).toLowerCase() === targetLower)
  }
  return String(value).toLowerCase() === targetLower
}

function collectJsonLdObjects(html, cheerio) {
  const scripts = []
  if (cheerio) {
    const $ = cheerio.load(html)
    $('script[type="application/ld+json"]').each((_, el) => {
      const text = $(el).text().trim()
      if (text) scripts.push(text)
    })
  } else {
    const regex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
    let match
    while ((match = regex.exec(html)) !== null) {
      const text = (match[1] || '').trim()
      if (text) scripts.push(text)
    }
  }

  const objects = []
  for (const script of scripts) {
    const parsed = safeJsonParse(script)
    if (!parsed) continue
    objects.push(...flattenJsonLd(parsed))
  }
  return objects
}

function extractJsonLdSignals(objects) {
  const product = objects.find(obj => typeMatches(obj?.['@type'] ?? obj?.type, 'Product'))
  let offers = []
  if (product?.offers) {
    offers = normalizeJsonArray(product.offers)
  }
  if (offers.length === 0) {
    offers = objects.filter(obj => typeMatches(obj?.['@type'] ?? obj?.type, 'Offer'))
  }
  const offer = offers.find(entry => entry && typeof entry === 'object')

  const price =
    offer?.price ??
    offer?.priceSpecification?.price ??
    offer?.priceSpecification?.minPrice ??
    offer?.priceSpecification?.maxPrice ??
    null
  const availabilityRaw = offer?.availability ?? null
  const availability = availabilityRaw ? String(availabilityRaw).split('/').pop() : ''
  const name = product?.name ?? ''

  return {
    found: Boolean(product || offer),
    name,
    price,
    availability,
    offerCount: offers.length,
  }
}

function extractJsonApiSignals(data) {
  const queue = [data]
  const seen = new Set()
  const maxNodes = 400
  let name = ''
  let price = null
  let availability = ''

  while (queue.length > 0 && seen.size < maxNodes) {
    const node = queue.shift()
    if (!node || typeof node !== 'object') continue
    if (seen.has(node)) continue
    seen.add(node)

    if (!name && typeof node.name === 'string') {
      name = node.name
    }
    if (!name && typeof node.title === 'string') {
      name = node.title
    }
    if (price === null && typeof node.price !== 'undefined') {
      price = node.price
    }
    if (price === null && node.price?.value) {
      price = node.price.value
    }
    if (!availability) {
      const raw =
        node.availability ??
        node.stockStatus ??
        node.inventoryStatus ??
        node.inStock ??
        node.isInStock
      if (typeof raw === 'string') availability = raw
      if (typeof raw === 'boolean') availability = raw ? 'IN_STOCK' : 'OUT_OF_STOCK'
    }

    if (price !== null && name && availability) break

    for (const value of Object.values(node)) {
      if (value && typeof value === 'object') queue.push(value)
    }
  }

  return { name, price, availability }
}

function detectExtractionStrategy(content, fixtureName, cheerio) {
  if (!content) return null
  const ext = (fixtureName || '').toLowerCase()
  const isJson = ext.endsWith('.json')
  if (isJson) {
    const parsed = safeJsonParse(content)
    if (!parsed) {
      return {
        strategy: 'json_api',
        label: 'JSON API',
        reason: 'Fixture appears to be JSON but could not be parsed.',
        samples: {},
      }
    }
    const jsonLdSignals = extractJsonLdSignals(flattenJsonLd(parsed))
    if (jsonLdSignals.found) {
      return {
        strategy: 'json_ld',
        label: 'JSON-LD',
        reason: 'Fixture JSON includes Product/Offer signals.',
        samples: jsonLdSignals,
      }
    }
    return {
      strategy: 'json_api',
      label: 'JSON API',
      reason: 'Fixture is JSON; parse product fields directly.',
      samples: extractJsonApiSignals(parsed),
    }
  }

  const jsonLdSignals = extractJsonLdSignals(collectJsonLdObjects(content, cheerio))
  if (jsonLdSignals.found) {
    return {
      strategy: 'json_ld',
      label: 'JSON-LD',
      reason: 'Detected Product/Offer in JSON-LD script tags.',
      samples: jsonLdSignals,
    }
  }

  return {
    strategy: 'html',
    label: 'HTML',
    reason: 'No JSON-LD Product/Offer detected; use HTML selectors.',
    samples: {},
  }
}

function printStrategyDecision(info, fixtureLabel) {
  if (!info) return
  console.log('')
  console.log(`Extraction strategy hint (based on ${fixtureLabel} fixture):`)
  console.log(`  Detected: ${info.label}`)
  console.log(`  Reason: ${info.reason}`)
  if (info.strategy === 'json_ld') {
    console.log('  Recommendation: Prefer JSON-LD extraction for title/price/availability.')
  } else if (info.strategy === 'json_api') {
    console.log('  Recommendation: Prefer JSON API extraction (no HTML selectors).')
  } else {
    console.log('  Recommendation: Use HTML selectors in selectors.ts.')
  }
  if (info.samples) {
    const { name, price, availability, offerCount } = info.samples
    const sampleLines = []
    if (name) sampleLines.push(`name="${name}"`)
    if (price !== null && typeof price !== 'undefined') sampleLines.push(`price="${price}"`)
    if (availability) sampleLines.push(`availability="${availability}"`)
    if (offerCount) sampleLines.push(`offers=${offerCount}`)
    if (sampleLines.length > 0) {
      console.log(`  Signals: ${sampleLines.join(', ')}`)
    }
  }
  console.log('')
}

function truncateValue(value, max = 120) {
  if (!value) return ''
  const cleaned = String(value).replace(/\s+/g, ' ').trim()
  if (cleaned.length <= max) return cleaned
  return `${cleaned.slice(0, max - 3)}...`
}

function selectorsFromContents(contents, keys) {
  const map = {}
  for (const key of keys) {
    map[key] = readSelectorValue(contents, key)
  }
  return map
}

function sampleSelectorValue($el, key) {
  const text = $el.text().trim()
  if (text) return { value: text, source: 'text' }

  const candidatesByKey = {
    image: ['src', 'data-src', 'content'],
    sku: ['data-sku', 'content', 'value'],
    productId: ['data-product-id', 'content', 'value'],
    upc: ['data-upc', 'content', 'value'],
    price: ['content', 'data-price', 'value'],
    title: ['content', 'value'],
    inStock: ['content', 'data-status', 'aria-label', 'value'],
    outOfStock: ['content', 'data-status', 'aria-label', 'value'],
    backorder: ['content', 'data-status', 'aria-label', 'value'],
  }

  const candidates = candidatesByKey[key] || ['content', 'value', 'href', 'src', 'aria-label']
  for (const attr of candidates) {
    const value = $el.attr(attr)
    if (value) return { value, source: `attr:${attr}` }
  }

  const attrs = $el.attr() || {}
  for (const [attr, value] of Object.entries(attrs)) {
    if (value) return { value, source: `attr:${attr}` }
  }

  return { value: '', source: '' }
}

function printSelectorSamples(label, html, selectors, cheerio, keys) {
  if (!html || !cheerio) return
  const $ = cheerio.load(html)
  console.log(`Selector samples (${label}):`)
  for (const key of keys) {
    const selector = selectors[key]
    if (!selector) {
      console.log(`  - ${key}: (unset)`)
      continue
    }
    const matches = $(selector)
    if (matches.length === 0) {
      console.log(`  - ${key}: 0 matches [${selector}]`)
      continue
    }
    const sample = sampleSelectorValue(matches.first(), key)
    const sampleValue = sample.value ? truncateValue(sample.value) : '(empty)'
    const sampleSource = sample.source ? ` ${sample.source}` : ''
    const countLabel = matches.length === 1 ? '1 match' : `${matches.length} matches`
    console.log(`  - ${key}: ${countLabel} [${selector}] => ${sampleValue}${sampleSource}`)
  }
  console.log('')
}

async function collectFixture(source, fixturesDir, basename, headers) {
  if (!source) return null

  let content = ''
  let hintExt = ''
  if (existsSync(source)) {
    content = readFileSync(source, 'utf8')
    hintExt = extname(source)
  } else if (isUrl(source)) {
    content = await fetchFixtureContent(source, headers)
  } else {
    console.warn(`Warning: fixture source not found: ${source}`)
    return null
  }

  const extension = detectFixtureExtension(content, hintExt)
  const filename = `${basename}.${extension}`
  const filePath = join(fixturesDir, filename)
  writeFileSync(filePath, content, 'utf8')
  console.log(`Saved fixture: ${filePath}`)
  return filename
}

function readSelectorValue(contents, key) {
  const regex = new RegExp(`${key}:\\s*'([^']*)'`)
  const match = contents.match(regex)
  return match ? match[1] : ''
}

function updateSelectorValue(contents, key, value) {
  const escaped = value.replace(/'/g, "\\'")
  const regex = new RegExp(`(${key}:\\s*)'[^']*'`)
  if (!regex.test(contents)) return contents
  return contents.replace(regex, `$1'${escaped}'`)
}

function selectorFromTag(tag, fallbackTag) {
  const tagMatch = tag.match(/^<\s*([a-zA-Z0-9-]+)/)
  const tagName = tagMatch ? tagMatch[1] : fallbackTag
  const idMatch = tag.match(/\bid=['"]([^'"]+)['"]/i)
  if (idMatch) return `#${idMatch[1]}`
  const classMatch = tag.match(/\bclass=['"]([^'"]+)['"]/i)
  if (classMatch) {
    const firstClass = classMatch[1]
      .split(/\s+/)
      .map(value => value.trim())
      .filter(Boolean)[0]
    if (firstClass) return `${tagName}.${firstClass}`
  }
  return tagName
}

function findTagWithClassOrId(html, pattern) {
  const regex = new RegExp(`<([a-zA-Z0-9-]+)[^>]*(class|id)=['"][^'"]*${pattern.source}[^'"]*['"][^>]*>`, 'i')
  const match = html.match(regex)
  if (!match) return null
  return match[0]
}

function inferSelectorsFromHtml(html) {
  const suggestions = {}
  const h1Match = html.match(/<h1\\b[^>]*>/i)
  if (h1Match) {
    suggestions.title = selectorFromTag(h1Match[0], 'h1')
  }

  const priceTag = findTagWithClassOrId(html, /(price|amount|sale|current|our-price)/)
  if (priceTag) {
    suggestions.price = selectorFromTag(priceTag, 'span')
  }

  const inStockTag = findTagWithClassOrId(html, /(in-stock|instock|available|stock-status)/)
  if (inStockTag) {
    suggestions.inStock = selectorFromTag(inStockTag, 'span')
  }

  const outStockTag = findTagWithClassOrId(html, /(out-of-stock|oos|sold-out|backorder|unavailable)/)
  if (outStockTag) {
    suggestions.outOfStock = selectorFromTag(outStockTag, 'span')
  }

  const backorderTag = findTagWithClassOrId(html, /(backorder|preorder)/)
  if (backorderTag) {
    suggestions.backorder = selectorFromTag(backorderTag, 'span')
  }

  return suggestions
}

function applySelectorSuggestions(contents, suggestions) {
  let updated = contents
  for (const [key, value] of Object.entries(suggestions)) {
    if (!value) continue
    const current = readSelectorValue(updated, key)
    if (!current) {
      updated = updateSelectorValue(updated, key, value)
    }
  }
  return updated
}

async function promptSelectorValue(key, currentValue) {
  const raw = await promptText(`Selector for ${key} (leave blank to keep${currentValue ? `: ${currentValue}` : ''}): `)
  if (!raw) return null
  if (raw === '-') return ''
  return raw
}

function writeAdapterTest(testPath, adapterVar, adapterId, inStockFixture, oosFixture, inStockUrl, oosUrl) {
  const inUrl = inStockUrl || `https://${adapterId}.example/test`
  const oosUrlValue = oosUrl || `https://${adapterId}.example/test-oos`
  const tests = []
  if (inStockFixture) {
    tests.push(`  it('extracts in-stock fixture', () => {
    const fixturePath = join(__dirname, 'fixtures', '${inStockFixture}')
    const html = readFileSync(fixturePath, 'utf8')

    const extracted = ${adapterVar}.extract(html, '${inUrl}', ctx)
    if (!extracted.ok) {
      throw new Error(\`extract failed: \${extracted.reason} \${extracted.details ?? ''}\`)
    }
  })`)
  }
  if (oosFixture) {
    tests.push(`  it('extracts out-of-stock fixture', () => {
    const fixturePath = join(__dirname, 'fixtures', '${oosFixture}')
    const html = readFileSync(fixturePath, 'utf8')

    const extracted = ${adapterVar}.extract(html, '${oosUrlValue}', ctx)
    if (!extracted.ok) {
      throw new Error(\`extract failed: \${extracted.reason} \${extracted.details ?? ''}\`)
    }
  })`)
  }

  const body = `import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { ${adapterVar} } from '../adapter.js'

const ctx = {
  sourceId: 'source_test',
  retailerId: 'retailer_test',
  runId: 'run_test',
  targetId: 'target_test',
  now: new Date('2026-01-01T00:00:00Z'),
  logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
}

describe('${adapterId} adapter', () => {
${tests.join('\n\n')}
})
`

  writeFileSync(testPath, body, 'utf8')
  console.log(`Updated test: ${testPath}`)
}

async function runGuidedSetup(adapterId, adapterVar, adapterDomain) {
  if (!process.stdin.isTTY) return
  const proceed = await promptYesNo('Run guided setup to update selectors + fixtures + tests now? (Y/n) ', false)
  if (!proceed) return

  const adapterRoot = resolve(projectRoot, 'apps/harvester/src/scraper/adapters', adapterId)
  const selectorsPath = join(adapterRoot, 'selectors.ts')
  const fixturesDir = join(adapterRoot, '__tests__', 'fixtures')
  const testPath = join(adapterRoot, '__tests__', 'adapter.test.ts')
  const selectorKeys = [
    'title',
    'price',
    'inStock',
    'outOfStock',
    'backorder',
    'sku',
    'productId',
    'upc',
    'image',
  ]

  mkdirSync(fixturesDir, { recursive: true })

  const { path: configPath, data: storedConfig } = loadScraperConfig(adapterId)
  const storedGuided = storedConfig?.guidedSetup || {}

  const fixtureCandidates = {
    inStock: [
      join(fixturesDir, 'in-stock.html'),
      join(fixturesDir, 'in-stock.json'),
      join(fixturesDir, 'in-stock.htm'),
    ],
    oos: [
      join(fixturesDir, 'out-of-stock.html'),
      join(fixturesDir, 'out-of-stock.json'),
      join(fixturesDir, 'out-of-stock.htm'),
    ],
  }

  const inferredGuided = { ...storedGuided }
  if (existsSync(testPath)) {
    const testContents = readFileSync(testPath, 'utf8')
    const urlMatches = [...testContents.matchAll(/extract\([^,]+,\s*'([^']+)'/g)].map(match => match[1])
    if (!inferredGuided.inStockUrl && urlMatches[0]) inferredGuided.inStockUrl = urlMatches[0]
    if (!inferredGuided.oosUrl && urlMatches[1]) inferredGuided.oosUrl = urlMatches[1]
  }

  if (!inferredGuided.inStockSource) {
    const fixturePath = fixtureCandidates.inStock.find(path => existsSync(path))
    if (fixturePath) {
      inferredGuided.inStockSource = fixturePath
    } else if (inferredGuided.inStockUrl) {
      inferredGuided.inStockSource = inferredGuided.inStockUrl
    }
  }

  if (!inferredGuided.oosSource) {
    const fixturePath = fixtureCandidates.oos.find(path => existsSync(path))
    if (fixturePath) {
      inferredGuided.oosSource = fixturePath
    } else if (inferredGuided.oosUrl) {
      inferredGuided.oosSource = inferredGuided.oosUrl
    }
  }

  if (
    inferredGuided.acceptHeader ||
    inferredGuided.inStockSource ||
    inferredGuided.inStockUrl ||
    inferredGuided.oosSource ||
    inferredGuided.oosUrl
  ) {
    console.log('Tip: Press Enter to keep the default shown in brackets.')
  }

  let headers = {
    'User-Agent': DEFAULT_USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/json',
  }

  const customHeader = await promptText(
    buildPrompt('Custom Accept header for fixtures? (leave blank to skip):', inferredGuided.acceptHeader || ''),
    inferredGuided.acceptHeader || ''
  )
  if (customHeader) {
    headers = { ...headers, Accept: customHeader }
  }

  const inStockSourceRaw = await promptText(
    buildPrompt('In-stock URL or file path (leave blank to skip):', inferredGuided.inStockSource || ''),
    inferredGuided.inStockSource || ''
  )
  const inStockSource = normalizeSourceInput(inStockSourceRaw, 'In-stock source')
  let inStockFixture = null
  try {
    inStockFixture = await collectFixture(inStockSource, fixturesDir, 'in-stock', headers)
  } catch (error) {
    console.warn(`Warning: failed to save in-stock fixture: ${error?.message || error}`)
  }
  let inStockUrl = isUrl(inStockSource) ? inStockSource : ''
  if (!inStockUrl) {
    const inStockUrlRaw = await promptText(
      buildPrompt('In-stock product URL (optional, used in test context):', inferredGuided.inStockUrl || ''),
      inferredGuided.inStockUrl || ''
    )
    inStockUrl = normalizeSourceInput(inStockUrlRaw, 'In-stock product URL')
  }

  const oosSourceRaw = await promptText(
    buildPrompt('Out-of-stock URL or file path (leave blank to skip):', inferredGuided.oosSource || ''),
    inferredGuided.oosSource || ''
  )
  const oosSource = normalizeSourceInput(oosSourceRaw, 'Out-of-stock source')
  let oosFixture = null
  try {
    oosFixture = await collectFixture(oosSource, fixturesDir, 'out-of-stock', headers)
  } catch (error) {
    console.warn(`Warning: failed to save out-of-stock fixture: ${error?.message || error}`)
  }
  let oosUrl = isUrl(oosSource) ? oosSource : ''
  if (!oosUrl) {
    const oosUrlRaw = await promptText(
      buildPrompt('Out-of-stock product URL (optional, used in test context):', inferredGuided.oosUrl || ''),
      inferredGuided.oosUrl || ''
    )
    oosUrl = normalizeSourceInput(oosUrlRaw, 'Out-of-stock product URL')
  }

  saveScraperConfig(configPath, {
    ...(storedConfig || {}),
    adapterId,
    adapterDomain,
    guidedSetup: {
      acceptHeader: customHeader,
      inStockSource,
      inStockUrl,
      oosSource,
      oosUrl,
    },
  })

  const cheerio = await loadCheerio()
  const inStockPath = inStockFixture ? join(fixturesDir, inStockFixture) : ''
  const oosPath = oosFixture ? join(fixturesDir, oosFixture) : ''
  const inStockContent = inStockPath && existsSync(inStockPath) ? readFileSync(inStockPath, 'utf8') : ''
  const oosContent = oosPath && existsSync(oosPath) ? readFileSync(oosPath, 'utf8') : ''
  const primaryFixture = inStockFixture || oosFixture
  const primaryContent = inStockFixture ? inStockContent : oosContent
  let strategyInfo = null
  if (primaryFixture && primaryContent) {
    strategyInfo = detectExtractionStrategy(primaryContent, primaryFixture, cheerio)
    printStrategyDecision(strategyInfo, inStockFixture ? 'in-stock' : 'out-of-stock')
  }

  let useHtmlSelectors = true
  if (strategyInfo?.strategy && strategyInfo.strategy !== 'html') {
    const skipSelectors = await promptYesNo(
      'JSON-LD/JSON API detected. Skip HTML selector setup and update adapter manually? (Y/n) '
    )
    useHtmlSelectors = !skipSelectors
  }

  if (existsSync(selectorsPath)) {
    let contents = readFileSync(selectorsPath, 'utf8')

    if (useHtmlSelectors) {
      let autoDetect = false
      if (inStockFixture && inStockFixture.endsWith('.html')) {
        autoDetect = await promptYesNo('Auto-detect selectors from in-stock fixture HTML? (Y/n) ')
      } else if (inStockFixture && inStockFixture.endsWith('.json')) {
        console.warn('Warning: in-stock fixture is JSON; auto-detect is skipped.')
      }

      if (autoDetect && inStockFixture) {
        const inStockPath = join(fixturesDir, inStockFixture)
        if (existsSync(inStockPath)) {
          const html = readFileSync(inStockPath, 'utf8')
          const suggestions = inferSelectorsFromHtml(html)
          contents = applySelectorSuggestions(contents, suggestions)
          console.log('Applied selector suggestions:', suggestions)
        }
      } else {
        for (const key of selectorKeys) {
          const current = readSelectorValue(contents, key)
          const nextValue = await promptSelectorValue(key, current)
          if (nextValue === null) continue
          contents = updateSelectorValue(contents, key, nextValue)
        }
      }

      writeFileSync(selectorsPath, contents, 'utf8')
      console.log(`Updated selectors: ${selectorsPath}`)

      const selectors = selectorsFromContents(contents, selectorKeys)
      if (inStockFixture?.endsWith('.html')) {
        printSelectorSamples('in-stock fixture', inStockContent, selectors, cheerio, selectorKeys)
      }
      if (oosFixture?.endsWith('.html')) {
        printSelectorSamples('out-of-stock fixture', oosContent, selectors, cheerio, selectorKeys)
      }
    } else {
      console.log('Skipping selector setup. Update adapter.ts to parse JSON-LD or JSON API instead.')
    }
  } else {
    console.warn(`Warning: selectors.ts not found at ${selectorsPath}`)
  }

  if (existsSync(testPath)) {
    writeAdapterTest(testPath, adapterVar, adapterId, inStockFixture, oosFixture, inStockUrl, oosUrl)
  } else {
    console.warn(`Warning: adapter test not found at ${testPath}`)
  }

  console.log('')
  console.log(`Next: pnpm --filter @ironscout/harvester test:run ${testPath}`)
  console.log('Then: pnpm --filter @ironscout/harvester build')
  console.log(`Domain: ${adapterDomain}`)
}

async function main() {
  const args = parseArgs()
  const flags = args.flags

  if (flags.help || flags.h) {
    printHelp()
    return
  }

  const adapterId = flags.id || flags.adapter || args._[0]
  const adapterDomain = flags.domain || args._[1]
  const adapterVersion = flags.version || '0.0.0'
  const skipRegister = flags['no-register'] === true

  if (!adapterId) {
    fail('Missing --id <adapterId>. Usage: pnpm scraper:new --id <adapterId> --domain <domain> --version 0.1.0')
  }
  if (!adapterDomain) {
    fail('Missing --domain <domain>. Usage: pnpm scraper:new --id <adapterId> --domain <domain> --version 0.1.0')
  }

  if (!existsSync(templateRoot)) {
    fail(`Adapter template missing at ${templateRoot}`)
  }

  const targetRoot = resolve(adaptersRoot, adapterId)
  const adapterExists = existsSync(targetRoot)
  if (adapterExists) {
    console.warn(`Warning: Adapter folder already exists: ${targetRoot}`)
  }

  const adapterVar = `${toCamelCase(adapterId)}Adapter`
  if (!adapterVar || adapterVar === 'Adapter') {
    fail(`Invalid adapter id: ${adapterId}`)
  }

  if (!adapterExists) {
    cpSync(templateRoot, targetRoot, { recursive: true })
  }

  const adapterPath = join(targetRoot, 'adapter.ts')
  const testPath = join(targetRoot, '__tests__', 'adapter.test.ts')
  const readmePath = join(targetRoot, 'README.md')
  const indexPath = join(targetRoot, 'index.ts')

  if (existsSync(adapterPath)) {
    const adapterContents = readFileSync(adapterPath, 'utf8')
    if (!adapterExists) {
      writeFileSync(
        adapterPath,
        replaceAdapterConstants(adapterContents, adapterId, adapterVersion, adapterDomain, adapterVar),
        'utf8'
      )
    }
  } else if (!adapterExists) {
    fail(`Missing adapter template at ${adapterPath}`)
  }

  if (existsSync(testPath) && !adapterExists) {
    const testContents = readFileSync(testPath, 'utf8')
    writeFileSync(testPath, updateTestFile(testContents, adapterVar, adapterId), 'utf8')
  }

  if (existsSync(readmePath) && !adapterExists) {
    const readmeContents = readFileSync(readmePath, 'utf8')
    writeFileSync(readmePath, updateReadme(readmeContents, adapterId, adapterDomain), 'utf8')
  }

  if (!existsSync(indexPath)) {
    writeFileSync(indexPath, `export { ${adapterVar} } from './adapter.js'\n`, 'utf8')
  }

  if (!skipRegister) {
    registerAdapter(adapterId, adapterVar)
  }

  await runGuidedSetup(adapterId, adapterVar, adapterDomain)
}

main().catch(error => {
  console.error(error?.message || error)
  process.exit(1)
})
