import { createHash } from 'node:crypto'
import type { NormalizedScrapeOffer } from '../types.js'

export interface FixtureMeta {
  capturedAt: string
  capturedFrom: string
  capturedBy: string
  notes: string
}

export type FixtureMetaValidationResult =
  | { ok: true; value: FixtureMeta }
  | { ok: false; error: string }

export type FixtureFreshnessResult =
  | { ok: true; status: 'ok' | 'warn'; ageDays: number; warning?: string }
  | { ok: false; status: 'fail'; ageDays: number; error: string }

export interface FixtureFreshnessOptions {
  now?: Date
  warnAfterDays?: number
  failAfterDays?: number
  strict?: boolean
}

interface DeterministicHashOptions {
  excludeFields?: string[]
}

const DEFAULT_EXCLUDED_HASH_FIELDS = ['observedAt', 'createdAt', 'updatedAt']

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asTrimmedString(value: unknown, field: string): string | null {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }
  return trimmed
}

function isOfferHashCandidate(value: unknown): value is {
  url: string
  retailerProductId?: string
  retailerSku?: string
} {
  return (
    isPlainObject(value) &&
    typeof value.url === 'string' &&
    (value.retailerProductId === undefined || typeof value.retailerProductId === 'string') &&
    (value.retailerSku === undefined || typeof value.retailerSku === 'string')
  )
}

function stableNormalizeForHash(value: unknown, excludedKeys: Set<string>): unknown {
  if (Array.isArray(value)) {
    const items = value.map(item => stableNormalizeForHash(item, excludedKeys))
    if (items.every(isOfferHashCandidate)) {
      return [...items].sort((a, b) => {
        const aTuple = `${a.url}|${a.retailerProductId ?? ''}|${a.retailerSku ?? ''}`
        const bTuple = `${b.url}|${b.retailerProductId ?? ''}|${b.retailerSku ?? ''}`
        return aTuple.localeCompare(bTuple)
      })
    }
    return items
  }

  if (isPlainObject(value)) {
    const sortedKeys = Object.keys(value)
      .filter(key => !excludedKeys.has(key))
      .sort((a, b) => a.localeCompare(b))

    const next: Record<string, unknown> = {}
    for (const key of sortedKeys) {
      next[key] = stableNormalizeForHash(value[key], excludedKeys)
    }
    return next
  }

  return value
}

export function sortOffersForHash(offers: NormalizedScrapeOffer[]): NormalizedScrapeOffer[] {
  return [...offers].sort((a, b) => {
    const aTuple = `${a.url}|${a.retailerProductId ?? ''}|${a.retailerSku ?? ''}`
    const bTuple = `${b.url}|${b.retailerProductId ?? ''}|${b.retailerSku ?? ''}`
    return aTuple.localeCompare(bTuple)
  })
}

export function deterministicHash(value: unknown, options: DeterministicHashOptions = {}): string {
  const excludedKeys = new Set(options.excludeFields ?? DEFAULT_EXCLUDED_HASH_FIELDS)
  const payload = stableNormalizeForHash(value, excludedKeys)
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex')
}

export function validateFixtureMeta(raw: unknown): FixtureMetaValidationResult {
  if (!isPlainObject(raw)) {
    return { ok: false, error: 'fixtures/meta.json must be a JSON object' }
  }

  const capturedAt = asTrimmedString(raw.capturedAt, 'capturedAt')
  if (!capturedAt) {
    return { ok: false, error: 'fixtures/meta.json.capturedAt is required' }
  }
  const parsed = new Date(capturedAt)
  if (Number.isNaN(parsed.getTime())) {
    return { ok: false, error: 'fixtures/meta.json.capturedAt must be a valid ISO timestamp' }
  }

  const capturedFrom = asTrimmedString(raw.capturedFrom, 'capturedFrom')
  if (!capturedFrom) {
    return { ok: false, error: 'fixtures/meta.json.capturedFrom is required' }
  }

  const capturedBy = asTrimmedString(raw.capturedBy, 'capturedBy')
  if (!capturedBy) {
    return { ok: false, error: 'fixtures/meta.json.capturedBy is required' }
  }

  const notes = asTrimmedString(raw.notes, 'notes')
  if (!notes) {
    return { ok: false, error: 'fixtures/meta.json.notes is required' }
  }

  return {
    ok: true,
    value: {
      capturedAt,
      capturedFrom,
      capturedBy,
      notes,
    },
  }
}

export function evaluateFixtureFreshness(
  meta: FixtureMeta,
  options: FixtureFreshnessOptions = {}
): FixtureFreshnessResult {
  const warnAfterDays = options.warnAfterDays ?? 90
  const failAfterDays = options.failAfterDays ?? 180
  const strict = options.strict ?? false
  const now = options.now ?? new Date()

  const capturedAt = new Date(meta.capturedAt)
  const ageMs = Math.max(0, now.getTime() - capturedAt.getTime())
  const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24))

  if (strict && ageDays > failAfterDays) {
    return {
      ok: false,
      status: 'fail',
      ageDays,
      error: `Fixture metadata is stale (${ageDays} days old, strict threshold ${failAfterDays} days)`,
    }
  }

  if (ageDays > warnAfterDays) {
    return {
      ok: true,
      status: 'warn',
      ageDays,
      warning: `Fixture metadata is stale (${ageDays} days old, warning threshold ${warnAfterDays} days)`,
    }
  }

  return {
    ok: true,
    status: 'ok',
    ageDays,
  }
}
