import { mkdirSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import crypto from 'node:crypto'
import { CALIBER_SLUG_MAP } from '../../../packages/db/calibers.js'

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://api.ironscout.ai').replace(/\/$/, '')
const SNAPSHOT_ENDPOINT = `${API_BASE_URL}/api/market-snapshots/calibers`
const OUTPUT_DIR = join(process.cwd(), 'public', 'market-snapshots', '30d')
const GENERATED_AT = new Date().toISOString()
const WINDOW_DAYS = 30
const ARTIFACT_SCHEMA_VERSION = 'market-snapshot/v1'
const INDEX_SCHEMA_VERSION = 'market-snapshot-index/v1'
const STAT_BASIS = 'dailyBestObserved'
const STAT_LABEL = 'Observed daily-best price per round'
const MEASUREMENT_TECHNIQUE =
  'SQL PERCENTILE_CONT over daily-best per-product-per-day observed in-stock prices'
const METHODOLOGY_NOTES = [
  'Daily-best is MIN(price_per_round) per (caliber, product, UTC day).',
  'Only in-stock observations included.',
  'Coverage varies by retailer and source.',
]

const ARTIFACT_SCHEMA = {
  type: 'object',
  required: [
    'schemaVersion',
    'caliberSlug',
    'windowDays',
    'statBasis',
    'statLabel',
    'pricePerRound',
    'counts',
    'computedAt',
    'windowStart',
    'windowEnd',
    'dataStatus',
    'methodology',
  ],
  additionalProperties: false,
  properties: {
    schemaVersion: { type: 'string', enum: [ARTIFACT_SCHEMA_VERSION] },
    caliberSlug: { type: 'string' },
    windowDays: { type: 'number' },
    statBasis: { type: 'string', enum: [STAT_BASIS] },
    statLabel: { type: 'string' },
    pricePerRound: {
      type: 'object',
      required: ['median', 'p25', 'p75', 'min', 'max'],
      additionalProperties: false,
      properties: {
        median: { type: ['number', 'null'] },
        p25: { type: ['number', 'null'] },
        p75: { type: ['number', 'null'] },
        min: { type: ['number', 'null'] },
        max: { type: ['number', 'null'] },
      },
    },
    counts: {
      type: 'object',
      required: ['sampleCount', 'daysWithData', 'productCount', 'retailerCount'],
      additionalProperties: false,
      properties: {
        sampleCount: { type: 'number' },
        daysWithData: { type: 'number' },
        productCount: { type: 'number' },
        retailerCount: { type: 'number' },
      },
    },
    computedAt: { type: ['string', 'null'] },
    windowStart: { type: ['string', 'null'] },
    windowEnd: { type: ['string', 'null'] },
    dataStatus: { type: 'string', enum: ['SUFFICIENT', 'INSUFFICIENT_DATA', 'UNAVAILABLE'] },
    methodology: {
      type: 'object',
      required: ['measurementTechnique', 'notes'],
      additionalProperties: false,
      properties: {
        measurementTechnique: { type: 'string' },
        notes: {
          type: 'array',
          items: { type: 'string' },
        },
      },
    },
  },
}

const INDEX_SCHEMA = {
  type: 'object',
  required: ['schemaVersion', 'windowDays', 'generatedAt', 'sourceApiEndpoint', 'artifacts'],
  additionalProperties: false,
  properties: {
    schemaVersion: { type: 'string', enum: [INDEX_SCHEMA_VERSION] },
    windowDays: { type: 'number' },
    generatedAt: { type: 'string' },
    sourceApiEndpoint: { type: 'string' },
    artifacts: {
      type: 'array',
      items: {
        type: 'object',
        required: ['caliberSlug', 'artifactUrl', 'artifactSha256', 'dataStatus', 'sampleCount', 'computedAt'],
        additionalProperties: false,
        properties: {
          caliberSlug: { type: 'string' },
          artifactUrl: { type: 'string' },
          artifactSha256: { type: 'string' },
          dataStatus: { type: 'string', enum: ['SUFFICIENT', 'INSUFFICIENT_DATA', 'UNAVAILABLE'] },
          sampleCount: { type: 'number' },
          computedAt: { type: ['string', 'null'] },
        },
      },
    },
  },
}

function toNumber(value) {
  if (value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function toInt(value) {
  if (value === null || value === undefined) return 0
  const parsed = Number.parseInt(String(value), 10)
  return Number.isFinite(parsed) ? parsed : 0
}

function toIsoString(value) {
  if (typeof value !== 'string' || value.length === 0) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function subtractDays(isoTimestamp, windowDays) {
  if (isoTimestamp === null) return null
  const parsed = new Date(isoTimestamp)
  if (Number.isNaN(parsed.getTime())) return null
  parsed.setUTCDate(parsed.getUTCDate() - windowDays)
  return parsed.toISOString()
}

function validateType(value, expectedType) {
  if (expectedType === 'null') return value === null
  if (expectedType === 'array') return Array.isArray(value)
  if (expectedType === 'number') return typeof value === 'number' && Number.isFinite(value)
  return typeof value === expectedType
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

function stableStringify(value) {
  return JSON.stringify(normalizeForStableStringify(value))
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function validateSchema(value, schema, path = '$') {
  const errors = []
  const expectedTypes = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : []

  if (expectedTypes.length > 0 && !expectedTypes.some((type) => validateType(value, type))) {
    errors.push(`${path}: expected type ${expectedTypes.join(' | ')}`)
    return errors
  }

  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${path}: expected one of ${schema.enum.join(', ')}`)
  }

  if (schema.type === 'object' && value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const objectValue = value
    const required = schema.required || []
    for (const key of required) {
      if (!(key in objectValue)) {
        errors.push(`${path}.${key}: missing required field`)
      }
    }

    if (schema.additionalProperties === false && schema.properties) {
      for (const key of Object.keys(objectValue)) {
        if (!(key in schema.properties)) {
          errors.push(`${path}.${key}: unexpected field`)
        }
      }
    }

    if (schema.properties) {
      for (const [key, propertySchema] of Object.entries(schema.properties)) {
        if (key in objectValue) {
          errors.push(...validateSchema(objectValue[key], propertySchema, `${path}.${key}`))
        }
      }
    }
  }

  if (schema.type === 'array' && Array.isArray(value) && schema.items) {
    for (let i = 0; i < value.length; i += 1) {
      errors.push(...validateSchema(value[i], schema.items, `${path}[${i}]`))
    }
  }

  return errors
}

function assertSchema(value, schema, label) {
  const errors = validateSchema(value, schema)
  if (errors.length === 0) return
  throw new Error(
    `${label} failed schema validation:\n${errors.map((error) => `- ${error}`).join('\n')}`
  )
}

function normalizeRow(row) {
  const sampleCount = toInt(row.sampleCount)
  const windowDays = toInt(row.windowDays) || WINDOW_DAYS
  const computedAt = toIsoString(row.computedAt)
  const windowEnd = toIsoString(row.windowEnd) ?? computedAt
  const windowStart = toIsoString(row.windowStart) ?? subtractDays(windowEnd, windowDays)
  const dataStatus =
    row.dataStatus === 'SUFFICIENT' || row.dataStatus === 'INSUFFICIENT_DATA'
      ? row.dataStatus
      : sampleCount >= 5
        ? 'SUFFICIENT'
        : 'INSUFFICIENT_DATA'

  return {
    windowDays: windowDays,
    windowStart: windowStart,
    windowEnd: windowEnd,
    statBasis: STAT_BASIS,
    statLabel: typeof row.statLabel === 'string' ? row.statLabel : STAT_LABEL,
    pricePerRound: {
      median: toNumber(row.median),
      p25: toNumber(row.p25),
      p75: toNumber(row.p75),
      min: toNumber(row.min),
      max: toNumber(row.max),
    },
    counts: {
      sampleCount: sampleCount,
      daysWithData: toInt(row.daysWithData),
      productCount: toInt(row.productCount),
      retailerCount: toInt(row.retailerCount),
    },
    computedAt: computedAt,
    dataStatus: dataStatus,
    methodology: {
      measurementTechnique:
        typeof row.methodology === 'string' && row.methodology.length > 0
          ? row.methodology
          : MEASUREMENT_TECHNIQUE,
      notes: METHODOLOGY_NOTES,
    },
  }
}

function createUnavailableArtifact(slug) {
  return {
    schemaVersion: ARTIFACT_SCHEMA_VERSION,
    caliberSlug: slug,
    windowDays: WINDOW_DAYS,
    statBasis: STAT_BASIS,
    statLabel: STAT_LABEL,
    pricePerRound: {
      median: null,
      p25: null,
      p75: null,
      min: null,
      max: null,
    },
    counts: {
      sampleCount: 0,
      daysWithData: 0,
      productCount: 0,
      retailerCount: 0,
    },
    computedAt: null,
    windowStart: null,
    windowEnd: null,
    dataStatus: 'UNAVAILABLE',
    methodology: {
      measurementTechnique: MEASUREMENT_TECHNIQUE,
      notes: METHODOLOGY_NOTES,
    },
  }
}

function createArtifact(slug, row) {
  const normalized = row ? normalizeRow(row) : createUnavailableArtifact(slug)
  if ('schemaVersion' in normalized) return normalized

  return {
    schemaVersion: ARTIFACT_SCHEMA_VERSION,
    caliberSlug: slug,
    windowDays: normalized.windowDays,
    statBasis: normalized.statBasis,
    statLabel: normalized.statLabel,
    pricePerRound: normalized.pricePerRound,
    counts: normalized.counts,
    computedAt: normalized.computedAt,
    windowStart: normalized.windowStart,
    windowEnd: normalized.windowEnd,
    dataStatus: normalized.dataStatus,
    methodology: normalized.methodology,
  }
}

async function fetchSnapshots() {
  const response = await fetch(SNAPSHOT_ENDPOINT, {
    headers: { accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error(`Snapshot API request failed with status ${response.status}`)
  }

  const payload = await response.json()
  if (!payload || !Array.isArray(payload.snapshots)) {
    throw new Error('Snapshot API payload missing snapshots[] array')
  }

  return payload.snapshots
}

async function main() {
  console.log(`[market-snapshots] generating static artifacts from ${SNAPSHOT_ENDPOINT}`)

  rmSync(OUTPUT_DIR, { recursive: true, force: true })
  mkdirSync(OUTPUT_DIR, { recursive: true })

  let rows = []
  try {
    rows = await fetchSnapshots()
    console.log(`[market-snapshots] fetched ${rows.length} snapshots`)
  } catch (error) {
    console.warn(
      `[market-snapshots] fetch failed, writing UNAVAILABLE artifacts: ${error instanceof Error ? error.message : String(error)}`
    )
  }

  const byCaliber = new Map(rows.map((row) => [row.caliber, row]))
  const index = []

  for (const [slug, caliber] of Object.entries(CALIBER_SLUG_MAP)) {
    const artifact = createArtifact(slug, byCaliber.get(caliber) ?? null)
    assertSchema(artifact, ARTIFACT_SCHEMA, `artifact ${slug}`)
    const artifactSha256 = sha256(stableStringify(artifact))
    const outputPath = join(OUTPUT_DIR, `${slug}.json`)
    writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf-8')
    index.push({
      caliberSlug: slug,
      artifactUrl: `/market-snapshots/30d/${slug}.json`,
      artifactSha256,
      dataStatus: artifact.dataStatus,
      sampleCount: artifact.counts.sampleCount,
      computedAt: artifact.computedAt,
    })
  }

  const indexArtifact = {
    schemaVersion: INDEX_SCHEMA_VERSION,
    windowDays: WINDOW_DAYS,
    generatedAt: GENERATED_AT,
    sourceApiEndpoint: SNAPSHOT_ENDPOINT,
    artifacts: index,
  }
  assertSchema(indexArtifact, INDEX_SCHEMA, 'index artifact')

  writeFileSync(
    join(OUTPUT_DIR, 'index.json'),
    `${JSON.stringify(indexArtifact, null, 2)}\n`,
    'utf-8'
  )

  console.log(`[market-snapshots] wrote ${index.length} artifacts to ${OUTPUT_DIR}`)
}

main().catch((error) => {
  console.error(`[market-snapshots] failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
