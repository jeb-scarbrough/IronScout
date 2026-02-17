import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'

export const DEFAULT_TOLERANCE = 1e-6
export const DEFAULT_DIFF_LIMIT = 25
export const SNAPSHOT_KEY_FIELDS = ['computedAt', 'windowStart', 'windowEnd']

function escapeJsonPointerSegment(segment) {
  return String(segment).replace(/~/g, '~0').replace(/\//g, '~1')
}

function toJsonPointer(segments) {
  if (segments.length === 0) return '/'
  return `/${segments.map(escapeJsonPointerSegment).join('/')}`
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function normalizeForStableStringify(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeForStableStringify(entry))
  }
  if (isPlainObject(value)) {
    const out = {}
    for (const key of Object.keys(value).sort()) {
      out[key] = normalizeForStableStringify(value[key])
    }
    return out
  }
  return value
}

export function stableStringify(value) {
  return JSON.stringify(normalizeForStableStringify(value))
}

export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

export function toRelativePath(rootDir, filePath) {
  return path.relative(rootDir, filePath).replace(/\\/g, '/')
}

export async function pathExists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

export async function readJsonFile(filePath) {
  const raw = await fs.readFile(filePath, 'utf8')
  return { raw, json: JSON.parse(raw) }
}

function parseScriptAttributes(rawAttributes) {
  const attrs = {}
  const regex = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g
  let match
  while ((match = regex.exec(rawAttributes)) !== null) {
    const key = String(match[1]).toLowerCase()
    const value = match[2] ?? match[3] ?? match[4] ?? ''
    attrs[key] = value
  }
  return attrs
}

export function extractScriptTags(html) {
  const scripts = []
  const regex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi
  let match
  while ((match = regex.exec(html)) !== null) {
    scripts.push({
      attributes: parseScriptAttributes(match[1] ?? ''),
      content: (match[2] ?? '').trim(),
    })
  }
  return scripts
}

export function findScriptByIdAndType(scripts, id, type) {
  return scripts.find(
    (script) =>
      script.attributes.id === id
      && (script.attributes.type ?? '').toLowerCase() === type.toLowerCase()
  ) ?? null
}

export function findJsonLdScripts(scripts) {
  return scripts.filter(
    (script) => (script.attributes.type ?? '').toLowerCase() === 'application/ld+json'
  )
}

function typeIncludesDataset(typeValue) {
  if (typeof typeValue === 'string') return typeValue === 'Dataset'
  if (Array.isArray(typeValue)) return typeValue.includes('Dataset')
  return false
}

function walkJsonForDataset(node, found) {
  if (found.value !== null) return
  if (Array.isArray(node)) {
    for (const entry of node) {
      walkJsonForDataset(entry, found)
      if (found.value !== null) return
    }
    return
  }
  if (!isPlainObject(node)) return
  if (typeIncludesDataset(node['@type'])) {
    found.value = node
    return
  }
  if (Array.isArray(node['@graph'])) {
    walkJsonForDataset(node['@graph'], found)
    if (found.value !== null) return
  }
  for (const key of Object.keys(node)) {
    walkJsonForDataset(node[key], found)
    if (found.value !== null) return
  }
}

export function extractDatasetJsonLdFromScripts(jsonLdScripts) {
  for (const script of jsonLdScripts) {
    let parsed
    try {
      parsed = JSON.parse(script.content)
    } catch {
      continue
    }
    const found = { value: null }
    walkJsonForDataset(parsed, found)
    if (found.value !== null) {
      return found.value
    }
  }
  return null
}

function addDiff(diffs, segments, expected, actual, delta = null) {
  const diff = {
    pointer: toJsonPointer(segments),
    expected,
    actual,
  }
  if (delta !== null) {
    diff.delta = delta
  }
  diffs.push(diff)
}

function walkDiff(expected, actual, segments, diffs, options) {
  if (diffs.length >= options.limit) return

  if (isFiniteNumber(expected) && isFiniteNumber(actual)) {
    const delta = Math.abs(expected - actual)
    if (delta > options.tolerance) {
      addDiff(diffs, segments, expected, actual, delta)
    }
    return
  }

  if (Array.isArray(expected) || Array.isArray(actual)) {
    if (!Array.isArray(expected) || !Array.isArray(actual)) {
      addDiff(diffs, segments, expected, actual)
      return
    }
    if (expected.length !== actual.length) {
      addDiff(diffs, [...segments, 'length'], expected.length, actual.length)
    }
    const length = Math.max(expected.length, actual.length)
    for (let i = 0; i < length; i += 1) {
      if (diffs.length >= options.limit) return
      walkDiff(expected[i], actual[i], [...segments, i], diffs, options)
    }
    return
  }

  if (isPlainObject(expected) || isPlainObject(actual)) {
    if (!isPlainObject(expected) || !isPlainObject(actual)) {
      addDiff(diffs, segments, expected, actual)
      return
    }
    const keys = new Set([...Object.keys(expected), ...Object.keys(actual)])
    for (const key of [...keys].sort()) {
      if (diffs.length >= options.limit) return
      walkDiff(expected[key], actual[key], [...segments, key], diffs, options)
    }
    return
  }

  if (expected !== actual) {
    addDiff(diffs, segments, expected, actual)
  }
}

export function diffJson(expected, actual, opts = {}) {
  const options = {
    tolerance: DEFAULT_TOLERANCE,
    limit: DEFAULT_DIFF_LIMIT,
    ...opts,
  }
  const diffs = []
  walkDiff(expected, actual, [], diffs, options)
  return diffs
}

export function buildKeyFieldMismatches(expected, actual, keyFields = SNAPSHOT_KEY_FIELDS) {
  const mismatches = []
  for (const field of keyFields) {
    if ((expected?.[field] ?? null) !== (actual?.[field] ?? null)) {
      mismatches.push({
        field,
        expected: expected?.[field] ?? null,
        actual: actual?.[field] ?? null,
      })
    }
  }
  return mismatches
}

async function readDirEntries(dirPath) {
  try {
    return await fs.readdir(dirPath, { withFileTypes: true })
  } catch {
    return []
  }
}

export async function collectExpectedSnapshotRoutes(rootDir) {
  const caliberDir = path.join(rootDir, 'content', 'calibers')
  const caliberTypeDir = path.join(rootDir, 'content', 'caliber-types')
  const routes = []

  const caliberEntries = await readDirEntries(caliberDir)
  for (const entry of caliberEntries) {
    if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== '.md') continue
    const slug = path.basename(entry.name, '.md')
    routes.push({
      slug,
      routeType: 'caliber',
      route: `/caliber/${slug}/`,
      htmlPath: path.join(rootDir, 'out', 'caliber', slug, 'index.html'),
      artifactPath: path.join(rootDir, 'public', 'market-snapshots', '30d', `${slug}.json`),
    })
  }

  const caliberTypeEntries = await readDirEntries(caliberTypeDir)
  for (const caliberEntry of caliberTypeEntries) {
    if (!caliberEntry.isDirectory()) continue
    const slug = caliberEntry.name
    const typeEntries = await readDirEntries(path.join(caliberTypeDir, slug))
    for (const typeEntry of typeEntries) {
      if (!typeEntry.isFile() || path.extname(typeEntry.name).toLowerCase() !== '.md') continue
      const typeSlug = path.basename(typeEntry.name, '.md')
      routes.push({
        slug,
        routeType: 'caliber-type',
        typeSlug,
        route: `/caliber/${slug}/${typeSlug}/`,
        htmlPath: path.join(rootDir, 'out', 'caliber', slug, typeSlug, 'index.html'),
        artifactPath: path.join(rootDir, 'public', 'market-snapshots', '30d', `${slug}.json`),
      })
    }
  }

  routes.sort((a, b) => a.route.localeCompare(b.route))
  return routes
}

export async function findMissingHtmlRoutes(routes) {
  const missing = []
  for (const routeInfo of routes) {
    // eslint-disable-next-line no-await-in-loop
    const exists = await pathExists(routeInfo.htmlPath)
    if (!exists) {
      missing.push(routeInfo)
    }
  }
  return missing
}

export function printGateResult(gate, checked, errors, warnings = []) {
  if (errors.length > 0) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          gate,
          checked,
          warningCount: warnings.length,
          warnings,
          errorCount: errors.length,
          errors,
        },
        null,
        2
      )
    )
    process.exit(1)
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        gate,
        checked,
        warningCount: warnings.length,
        warnings,
      },
      null,
      2
    )
  )
}
