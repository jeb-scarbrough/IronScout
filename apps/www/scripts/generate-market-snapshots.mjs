import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { dirname, join, resolve } from 'path'
import crypto from 'node:crypto'
import { CALIBER_SLUG_MAP } from '../../../packages/db/calibers.js'

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://api.ironscout.ai').replace(/\/$/, '')
const SNAPSHOT_ENDPOINT = `${API_BASE_URL}/api/market-snapshots/calibers`
const OUTPUT_DIR = join(process.cwd(), 'public', 'market-snapshots', '30d')
const GENERATED_AT = new Date().toISOString()
const WINDOW_DAYS = 30
const COVERAGE_POLICY = 'site_routed_only'
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
const INDEX_METHODOLOGY_NOTES = [
  ...METHODOLOGY_NOTES,
  'Artifacts are published only for calibers with site routes (CALIBER_SLUG_MAP).',
]
const SKIP_REASONS = Object.freeze({
  NOT_IN_CALIBER_SLUG_MAP: 'NOT_IN_CALIBER_SLUG_MAP',
  DATA_STATUS_NOT_OK: 'DATA_STATUS_NOT_OK',
  INVALID_SCHEMA: 'INVALID_SCHEMA',
})
const DEFAULT_SKIP_DETAIL_CAP = 25
const VALID_DATA_STATUSES = new Set(['SUFFICIENT', 'INSUFFICIENT_DATA', 'UNAVAILABLE'])
const FIXTURE_FILE = typeof process.env.MARKET_SNAPSHOT_FIXTURE_FILE === 'string'
  && process.env.MARKET_SNAPSHOT_FIXTURE_FILE.trim().length > 0
  ? resolve(process.cwd(), process.env.MARKET_SNAPSHOT_FIXTURE_FILE.trim())
  : null

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
  required: [
    'schemaVersion',
    'windowDays',
    'generatedAt',
    'sourceApiEndpoint',
    'coverage',
    'methodology',
    'artifacts',
  ],
  additionalProperties: false,
  properties: {
    schemaVersion: { type: 'string', enum: [INDEX_SCHEMA_VERSION] },
    windowDays: { type: 'number' },
    generatedAt: { type: 'string' },
    sourceApiEndpoint: { type: 'string' },
    coverage: {
      type: 'object',
      required: ['routedCaliberCount', 'apiCaliberCount', 'policy'],
      additionalProperties: false,
      properties: {
        routedCaliberCount: { type: 'number' },
        apiCaliberCount: { type: 'number' },
        policy: { type: 'string', enum: [COVERAGE_POLICY] },
      },
    },
    methodology: {
      type: 'object',
      required: ['notes'],
      additionalProperties: false,
      properties: {
        notes: {
          type: 'array',
          items: { type: 'string' },
        },
      },
    },
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

function parseBooleanEnv(value) {
  if (typeof value !== 'string') return false
  const normalized = value.trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes'
}

function parseOptionalIntEnv(value) {
  if (typeof value !== 'string' || value.trim().length === 0) return null
  const parsed = Number.parseInt(value.trim(), 10)
  return Number.isFinite(parsed) ? parsed : null
}

function getGitShaFromEnv() {
  const candidates = [
    process.env.GIT_SHA,
    process.env.VERCEL_GIT_COMMIT_SHA,
    process.env.RENDER_GIT_COMMIT,
    process.env.GITHUB_SHA,
    process.env.COMMIT_SHA,
  ]
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim()
    }
  }
  return null
}

function collectComputationVersions(rows) {
  const versions = new Set()
  for (const row of rows) {
    if (row === null || typeof row !== 'object') continue
    if (typeof row.computationVersion === 'string' && row.computationVersion.trim().length > 0) {
      versions.add(row.computationVersion.trim())
    }
  }
  const list = [...versions].sort((a, b) => a.localeCompare(b))
  if (list.length === 0) return null
  if (list.length === 1) return list[0]
  return list
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

function createEmptySkipReasonCounts() {
  return {
    [SKIP_REASONS.NOT_IN_CALIBER_SLUG_MAP]: 0,
    [SKIP_REASONS.DATA_STATUS_NOT_OK]: 0,
    [SKIP_REASONS.INVALID_SCHEMA]: 0,
  }
}

function createEmptySkipDetails() {
  return {
    [SKIP_REASONS.NOT_IN_CALIBER_SLUG_MAP]: [],
    [SKIP_REASONS.DATA_STATUS_NOT_OK]: [],
    [SKIP_REASONS.INVALID_SCHEMA]: [],
  }
}

function collectRawSkipDetails(rows, routedCalibers) {
  const details = createEmptySkipDetails()

  rows.forEach((row, index) => {
    if (row === null || typeof row !== 'object') {
      details[SKIP_REASONS.INVALID_SCHEMA].push(`row[${index}]`)
      return
    }

    const caliber = typeof row.caliber === 'string' && row.caliber.length > 0 ? row.caliber : null
    if (caliber === null) {
      details[SKIP_REASONS.INVALID_SCHEMA].push(`row[${index}]`)
      return
    }

    if (!routedCalibers.has(caliber)) {
      details[SKIP_REASONS.NOT_IN_CALIBER_SLUG_MAP].push(caliber)
    }

    if (row.dataStatus !== undefined && !VALID_DATA_STATUSES.has(row.dataStatus)) {
      details[SKIP_REASONS.DATA_STATUS_NOT_OK].push(`${caliber}: ${String(row.dataStatus)}`)
    }
  })

  return details
}

function sliceDetails(entries, count) {
  if (!Array.isArray(entries) || count <= 0) return []
  return entries.slice(0, count)
}

function buildRunSummary(rows, artifactFilesWritten) {
  const routedCaliberCount = Object.keys(CALIBER_SLUG_MAP).length
  const apiSnapshotsFetched = rows.length
  const routedCalibers = new Set(Object.values(CALIBER_SLUG_MAP))
  const rawSkipDetails = collectRawSkipDetails(rows, routedCalibers)

  const skippedByReason = createEmptySkipReasonCounts()
  let remainingSkips = Math.max(0, apiSnapshotsFetched - routedCaliberCount)

  const invalidCount = Math.min(rawSkipDetails[SKIP_REASONS.INVALID_SCHEMA].length, remainingSkips)
  skippedByReason[SKIP_REASONS.INVALID_SCHEMA] = invalidCount
  remainingSkips -= invalidCount

  const dataStatusCount = Math.min(rawSkipDetails[SKIP_REASONS.DATA_STATUS_NOT_OK].length, remainingSkips)
  skippedByReason[SKIP_REASONS.DATA_STATUS_NOT_OK] = dataStatusCount
  remainingSkips -= dataStatusCount

  const notInCaliberSlugMapCount = remainingSkips
  skippedByReason[SKIP_REASONS.NOT_IN_CALIBER_SLUG_MAP] = notInCaliberSlugMapCount
  remainingSkips = 0

  const skippedTotal =
    skippedByReason[SKIP_REASONS.NOT_IN_CALIBER_SLUG_MAP]
    + skippedByReason[SKIP_REASONS.DATA_STATUS_NOT_OK]
    + skippedByReason[SKIP_REASONS.INVALID_SCHEMA]
  const artifactsWritten = apiSnapshotsFetched - skippedTotal
  const gitSha = getGitShaFromEnv()
  const computationVersion = collectComputationVersions(rows)

  return {
    coverage: {
      routedCaliberCount,
      apiCaliberCount: apiSnapshotsFetched,
      policy: COVERAGE_POLICY,
    },
    apiSnapshotsFetched,
    artifactsWritten,
    artifactFilesWritten,
    skippedTotal,
    skippedByReason,
    versions: {
      artifactSchemaVersion: ARTIFACT_SCHEMA_VERSION,
      indexSchemaVersion: INDEX_SCHEMA_VERSION,
      computationVersion,
      gitSha,
    },
    skippedDetails: {
      [SKIP_REASONS.NOT_IN_CALIBER_SLUG_MAP]: sliceDetails(
        rawSkipDetails[SKIP_REASONS.NOT_IN_CALIBER_SLUG_MAP],
        skippedByReason[SKIP_REASONS.NOT_IN_CALIBER_SLUG_MAP]
      ),
      [SKIP_REASONS.DATA_STATUS_NOT_OK]: sliceDetails(
        rawSkipDetails[SKIP_REASONS.DATA_STATUS_NOT_OK],
        skippedByReason[SKIP_REASONS.DATA_STATUS_NOT_OK]
      ),
      [SKIP_REASONS.INVALID_SCHEMA]: sliceDetails(
        rawSkipDetails[SKIP_REASONS.INVALID_SCHEMA],
        skippedByReason[SKIP_REASONS.INVALID_SCHEMA]
      ),
    },
    reconciliationOk: artifactsWritten + skippedTotal === apiSnapshotsFetched,
  }
}

function maybeEmitSkipDetails(summary) {
  const detailMode = parseBooleanEnv(process.env.MARKET_SNAPSHOT_SKIP_DETAILS)
  const detailFileRaw = process.env.MARKET_SNAPSHOT_SKIP_DETAILS_FILE
  const detailFile = typeof detailFileRaw === 'string' && detailFileRaw.trim().length > 0
    ? resolve(process.cwd(), detailFileRaw.trim())
    : null
  if (!detailMode && detailFile === null) return

  const cap = parseOptionalIntEnv(process.env.MARKET_SNAPSHOT_SKIP_DETAIL_CAP) ?? DEFAULT_SKIP_DETAIL_CAP
  const detailPayload = {}

  for (const reason of Object.values(SKIP_REASONS)) {
    const entries = summary.skippedDetails[reason] ?? []
    const total = summary.skippedByReason[reason] ?? 0
    const values = entries.slice(0, cap)
    detailPayload[reason] = {
      total,
      values,
      omitted: Math.max(0, total - values.length),
    }
  }

  if (detailMode) {
    console.log(`[market-snapshots] skip-details ${JSON.stringify(detailPayload)}`)
  }

  if (detailFile !== null) {
    mkdirSync(dirname(detailFile), { recursive: true })
    writeFileSync(detailFile, `${JSON.stringify(detailPayload, null, 2)}\n`, 'utf-8')
  }
}

function maybeEnforceUnmappedIncreaseGuard(summary) {
  const guardEnabled = parseBooleanEnv(process.env.MARKET_SNAPSHOT_FAIL_ON_UNMAPPED_INCREASE)
  if (!guardEnabled) return

  const baselineApiCount = parseOptionalIntEnv(process.env.MARKET_SNAPSHOT_BASELINE_API_CALIBER_COUNT)
  const baselineNotInMapCount = parseOptionalIntEnv(
    process.env.MARKET_SNAPSHOT_BASELINE_NOT_IN_CALIBER_SLUG_MAP
  )
  const overrideEnabled = parseBooleanEnv(process.env.MARKET_SNAPSHOT_ALLOW_UNMAPPED_INCREASE)

  if (baselineApiCount === null || baselineNotInMapCount === null) {
    throw new Error(
      'MARKET_SNAPSHOT_FAIL_ON_UNMAPPED_INCREASE requires MARKET_SNAPSHOT_BASELINE_API_CALIBER_COUNT and MARKET_SNAPSHOT_BASELINE_NOT_IN_CALIBER_SLUG_MAP'
    )
  }

  console.log(
    `[market-snapshots] guardrail ${JSON.stringify({
      guardEnabled: true,
      baseline: {
        apiCaliberCount: baselineApiCount,
        unmappedCount: baselineNotInMapCount,
      },
      current: {
        apiCaliberCount: summary.apiSnapshotsFetched,
        unmappedCount: summary.skippedByReason[SKIP_REASONS.NOT_IN_CALIBER_SLUG_MAP],
      },
      overrideEnabled,
    })}`
  )

  const unmappedIncreased =
    summary.apiSnapshotsFetched > baselineApiCount
    && summary.skippedByReason[SKIP_REASONS.NOT_IN_CALIBER_SLUG_MAP] > baselineNotInMapCount

  if (unmappedIncreased && !overrideEnabled) {
    throw new Error(
      `Unmapped API snapshot count increased: apiSnapshotsFetched=${summary.apiSnapshotsFetched} baseline=${baselineApiCount}, NOT_IN_CALIBER_SLUG_MAP=${summary.skippedByReason[SKIP_REASONS.NOT_IN_CALIBER_SLUG_MAP]} baseline=${baselineNotInMapCount}. Set MARKET_SNAPSHOT_ALLOW_UNMAPPED_INCREASE=true to override intentionally.`
    )
  }
}

function logRunSummary(summary) {
  const logPayload = {
    apiSnapshotsFetched: summary.apiSnapshotsFetched,
    artifactsWritten: summary.artifactsWritten,
    artifactFilesWritten: summary.artifactFilesWritten,
    skippedTotal: summary.skippedTotal,
    reconciliation: `${summary.artifactsWritten}+${summary.skippedTotal}=${summary.apiSnapshotsFetched}`,
    skippedByReason: summary.skippedByReason,
    coverage: summary.coverage,
    versions: summary.versions,
    reconciliationOk: summary.reconciliationOk,
  }
  console.log(`[market-snapshots] run-summary ${JSON.stringify(logPayload)}`)
}

async function fetchSnapshots() {
  if (FIXTURE_FILE !== null) {
    const raw = readFileSync(FIXTURE_FILE, 'utf-8')
    const payload = JSON.parse(raw)
    if (Array.isArray(payload)) {
      return payload
    }
    if (payload && Array.isArray(payload.snapshots)) {
      return payload.snapshots
    }
    throw new Error(
      `Fixture file ${FIXTURE_FILE} must be either snapshots[] array or { snapshots: [] } object`
    )
  }

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

const INDEXNOW_KEY = process.env.INDEXNOW_KEY || '0bc93fb8d0fdb68be43464ab170a68a9'
const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow'
const WWW_BASE_URL = (process.env.NEXT_PUBLIC_WWW_URL || 'https://www.ironscout.ai').replace(/\/$/, '')

/**
 * Submit changed caliber URLs to IndexNow for faster search engine indexing.
 * Only pings when running against the production API (not fixtures).
 */
async function submitIndexNow(changedSlugs) {
  if (FIXTURE_FILE !== null) {
    console.log('[market-snapshots] skipping IndexNow submission (fixture mode)')
    return
  }

  if (parseBooleanEnv(process.env.MARKET_SNAPSHOT_SKIP_INDEXNOW)) {
    console.log('[market-snapshots] skipping IndexNow submission (MARKET_SNAPSHOT_SKIP_INDEXNOW=true)')
    return
  }

  if (changedSlugs.length === 0) {
    console.log('[market-snapshots] no changed slugs, skipping IndexNow')
    return
  }

  const host = new URL(WWW_BASE_URL).host
  const urls = [
    // Hub pages that aggregate snapshot data
    WWW_BASE_URL,
    `${WWW_BASE_URL}/calibers`,
    // Individual caliber pages that changed
    ...changedSlugs.map((slug) => `${WWW_BASE_URL}/caliber/${slug}`),
  ]

  const payload = {
    host,
    key: INDEXNOW_KEY,
    keyLocation: `${WWW_BASE_URL}/${INDEXNOW_KEY}.txt`,
    urlList: urls,
  }

  try {
    const response = await fetch(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload),
    })

    if (response.ok || response.status === 202) {
      console.log(`[market-snapshots] IndexNow: submitted ${urls.length} URLs (status: ${response.status})`)
    } else {
      const body = await response.text().catch(() => '')
      console.warn(`[market-snapshots] IndexNow: submission failed (status: ${response.status}): ${body}`)
    }
  } catch (error) {
    console.warn(`[market-snapshots] IndexNow: network error: ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function main() {
  const sourceLabel = FIXTURE_FILE !== null ? `fixture ${FIXTURE_FILE}` : SNAPSHOT_ENDPOINT
  const sourceApiEndpoint = FIXTURE_FILE !== null ? `fixture:${FIXTURE_FILE}` : SNAPSHOT_ENDPOINT
  console.log(`[market-snapshots] generating static artifacts from ${sourceLabel}`)

  // Read existing artifact hashes before overwriting, for IndexNow change detection
  const previousHashes = new Map()
  try {
    for (const file of readdirSync(OUTPUT_DIR)) {
      if (!file.endsWith('.json') || file === 'index.json') continue
      const slug = file.replace(/\.json$/, '')
      const raw = readFileSync(join(OUTPUT_DIR, file), 'utf-8')
      previousHashes.set(slug, sha256(stableStringify(JSON.parse(raw))))
    }
  } catch {
    // OUTPUT_DIR may not exist yet
  }

  rmSync(OUTPUT_DIR, { recursive: true, force: true })
  mkdirSync(OUTPUT_DIR, { recursive: true })

  let rows = []
  try {
    rows = await fetchSnapshots()
  } catch (error) {
    console.warn(
      `[market-snapshots] fetch failed, writing UNAVAILABLE artifacts: ${error instanceof Error ? error.message : String(error)}`
    )
  }

  const byCaliber = new Map(
    rows
      .filter((row) => row && typeof row.caliber === 'string' && row.caliber.length > 0)
      .map((row) => [row.caliber, row])
  )
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

  const summary = buildRunSummary(rows, index.length)
  maybeEnforceUnmappedIncreaseGuard(summary)
  maybeEmitSkipDetails(summary)
  logRunSummary(summary)

  const indexArtifact = {
    schemaVersion: INDEX_SCHEMA_VERSION,
    windowDays: WINDOW_DAYS,
    generatedAt: GENERATED_AT,
    sourceApiEndpoint: sourceApiEndpoint,
    coverage: summary.coverage,
    methodology: {
      notes: INDEX_METHODOLOGY_NOTES,
    },
    artifacts: index,
  }
  assertSchema(indexArtifact, INDEX_SCHEMA, 'index artifact')

  writeFileSync(
    join(OUTPUT_DIR, 'index.json'),
    `${JSON.stringify(indexArtifact, null, 2)}\n`,
    'utf-8'
  )

  console.log(`[market-snapshots] wrote ${index.length} artifact files to ${OUTPUT_DIR}`)

  // Detect which caliber slugs actually changed and ping IndexNow
  const changedSlugs = index
    .filter((entry) => entry.artifactSha256 !== previousHashes.get(entry.caliberSlug))
    .map((entry) => entry.caliberSlug)

  if (changedSlugs.length > 0) {
    console.log(`[market-snapshots] ${changedSlugs.length} artifact(s) changed: ${changedSlugs.join(', ')}`)
  } else {
    console.log('[market-snapshots] no artifact changes detected')
  }

  await submitIndexNow(changedSlugs)
}

main().catch((error) => {
  console.error(`[market-snapshots] failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
