import { createHash, randomUUID } from 'crypto'
import { withRequestContext } from '@ironscout/logger'

const REDACTED = '[REDACTED]'
const DEFAULT_DEBUG_SAMPLE_RATE = 0.05
const DEFAULT_DEBUG_FIRST_N = 25
const RAW_EXCERPT_MAX_CHARS = 200

// ---------------------------------------------------------------------------
// Cached trace settings (refreshed by worker polling every 30s)
// ---------------------------------------------------------------------------
let cachedSampleRate = DEFAULT_DEBUG_SAMPLE_RATE
let cachedFirstN = DEFAULT_DEBUG_FIRST_N
let cachedRawExcerptsEnabled = false

/**
 * Refresh trace settings from admin DB (called by worker polling loop).
 * Uses dynamic import to avoid top-level DB dependency in test environments.
 * If the fetch fails the previous cached values are retained.
 */
export async function refreshTraceSettings(): Promise<void> {
  try {
    const {
      getHarvesterDebugSampleRate,
      getHarvesterDebugFirstN,
      isHarvesterRawExcerptsEnabled,
    } = await import('@ironscout/db')

    const [sampleRate, firstN, rawExcerpts] = await Promise.all([
      getHarvesterDebugSampleRate(),
      getHarvesterDebugFirstN(),
      isHarvesterRawExcerptsEnabled(),
    ])
    cachedSampleRate = parseSampleRate(String(sampleRate))
    cachedFirstN = parseFirstN(String(firstN))
    cachedRawExcerptsEnabled = rawExcerpts
  } catch {
    // Retain previous cached values on error
  }
}

const SENSITIVE_KEY_PATTERNS = [
  /authorization/i,
  /password/i,
  /secret/i,
  /token/i,
  /cookie/i,
  /api[-_]?key/i,
  /credential/i,
  /^source[-_]?id$/i,
  /^source[-_]?product[-_]?id$/i,
  /^retailer[-_]?id$/i,
  /^run[-_]?id$/i,
  /^job[-_]?id$/i,
  /^execution[-_]?id$/i,
  /^feed[-_]?id$/i,
  /^adapter[-_]?id$/i,
]

export const TRACE_REASON_CODES = {
  DRAFT_STATUS: 'DRAFT_STATUS',
  DISABLED_STATUS: 'DISABLED_STATUS',
  LOCK_BUSY: 'LOCK_BUSY',
  RETRY_LOCK_CONFLICT: 'RETRY_LOCK_CONFLICT',
  RUN_STATUS_MISMATCH: 'RUN_STATUS_MISMATCH',
  UNCHANGED_HASH: 'UNCHANGED_HASH',
  UNCHANGED_MTIME: 'UNCHANGED_MTIME',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  ROW_REJECTED: 'ROW_REJECTED',
  MISSING_CALIBER: 'MISSING_CALIBER',
  DUPLICATE_IDENTITY: 'DUPLICATE_IDENTITY',
  UNCHANGED_NO_WRITE: 'UNCHANGED_NO_WRITE',
  RESOLVER_REQUIRED: 'RESOLVER_REQUIRED',
  ALERT_NO_CHANGES: 'ALERT_NO_CHANGES',
  ENQUEUE_FAILED: 'ENQUEUE_FAILED',
  NO_FEEDS_DUE: 'NO_FEEDS_DUE',
  RETRY_TRANSIENT: 'RETRY_TRANSIENT',
  RETRY_PERMANENT: 'RETRY_PERMANENT',
  FAILURE_NETWORK: 'FAILURE_NETWORK',
  FAILURE_AUTH: 'FAILURE_AUTH',
  FAILURE_FORMAT: 'FAILURE_FORMAT',
} as const

export type TraceReasonCode = (typeof TRACE_REASON_CODES)[keyof typeof TRACE_REASON_CODES]

export interface TraceContext {
  traceId: string
  executionId: string
  runId?: string
  sourceId: string
  feedId?: string
  retailerId?: string
  affiliateId?: string
  jobId?: string
  stage?: string
  step?: string
  attempt?: number
  retryCount?: number
  itemKey?: string
}

export interface ItemKeyInput {
  sourceProductId?: string | null
  identityKey?: string | null
  impactItemId?: string | null
  sku?: string | null
  upc?: string | null
  url?: string | null
}

export interface ItemDebugSampleConfig {
  sampleRate: number
  firstN: number
}

export function createTraceContext(seed: Partial<TraceContext>): TraceContext {
  const runOrExecution = seed.executionId ?? seed.runId ?? `job-${Date.now()}`
  return {
    traceId: seed.traceId ?? randomUUID(),
    executionId: runOrExecution,
    runId: seed.runId,
    sourceId: seed.sourceId ?? 'unknown',
    feedId: seed.feedId,
    retailerId: seed.retailerId,
    affiliateId: seed.affiliateId,
    jobId: seed.jobId,
    stage: seed.stage,
    step: seed.step,
    attempt: seed.attempt,
    retryCount: seed.retryCount,
    itemKey: seed.itemKey,
  }
}

export function extendTraceContext(
  context: TraceContext,
  updates: Partial<TraceContext>
): TraceContext {
  const merged = {
    ...context,
    ...updates,
  }
  if (!merged.executionId) {
    merged.executionId = merged.runId ?? context.executionId
  }
  if (!merged.sourceId) {
    merged.sourceId = context.sourceId
  }
  return merged
}

export function traceLogFields(context: TraceContext): Record<string, unknown> {
  return compact({
    traceId: context.traceId,
    executionId: context.executionId,
    runId: context.runId ?? context.executionId,
    sourceId: context.sourceId,
    feedId: context.feedId,
    retailerId: context.retailerId,
    affiliateId: context.affiliateId,
    jobId: context.jobId,
    stage: context.stage,
    step: context.step,
    attempt: context.attempt,
    retryCount: context.retryCount,
    itemKey: context.itemKey,
  })
}

export function withTrace<T>(context: TraceContext, fn: () => T): T {
  return withRequestContext(traceLogFields(context), fn)
}

export function buildItemKey(input: ItemKeyInput): string {
  if (input.sourceProductId) return `sp:${input.sourceProductId}`
  if (input.identityKey) return `id:${input.identityKey}`
  if (input.impactItemId) return `impact:${input.impactItemId}`
  if (input.sku) return `sku:${input.sku}`
  if (input.upc) return `upc:${input.upc}`
  if (input.url) return `url:${shortHash(input.url)}`
  return `item:${shortHash(JSON.stringify(input))}`
}

export function getItemDebugSampleConfig(): ItemDebugSampleConfig {
  return {
    sampleRate: cachedSampleRate,
    firstN: cachedFirstN,
  }
}

export function createItemDebugSampler(
  traceId: string,
  config: ItemDebugSampleConfig = getItemDebugSampleConfig()
): (itemKey: string) => boolean {
  let logged = 0

  return (itemKey: string) => {
    if (logged < config.firstN) {
      logged++
      return true
    }

    if (config.sampleRate >= 1) return true
    if (config.sampleRate <= 0) return false

    return deterministicSample(`${traceId}:${itemKey}`, config.sampleRate)
  }
}

export function sanitizeTraceMeta<T>(value: T): T {
  return sanitizeValue(value) as T
}

export function safeRawExcerpt(value: string): string | undefined {
  if (!isRawExcerptEnabled()) return undefined
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (!normalized) return undefined
  return normalized.slice(0, RAW_EXCERPT_MAX_CHARS)
}

export function isRawExcerptEnabled(): boolean {
  return cachedRawExcerptsEnabled
}

function shortHash(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16)
}

function deterministicSample(seed: string, sampleRate: number): boolean {
  const bytes = createHash('sha256').update(seed).digest()
  const ratio = bytes.readUInt32BE(0) / 0xffffffff
  return ratio < sampleRate
}

function parseSampleRate(raw: string | undefined): number {
  const value = Number(raw ?? DEFAULT_DEBUG_SAMPLE_RATE)
  if (!Number.isFinite(value)) return DEFAULT_DEBUG_SAMPLE_RATE
  if (value <= 0) return 0
  if (value >= 1) return 1
  return value
}

function parseFirstN(raw: string | undefined): number {
  const value = Number(raw ?? DEFAULT_DEBUG_FIRST_N)
  if (!Number.isFinite(value) || value < 0) return DEFAULT_DEBUG_FIRST_N
  return Math.floor(value)
}

function sanitizeValue(value: unknown): unknown {
  if (value === null || value === undefined) return value
  if (Array.isArray(value)) return value.map((entry) => sanitizeValue(entry))
  if (typeof value !== 'object') return value

  const output: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(value)) {
    if (SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key))) {
      output[key] = REDACTED
      continue
    }
    output[key] = sanitizeValue(entry)
  }
  return output
}

function compact<T extends Record<string, unknown>>(value: T): T {
  const out: Record<string, unknown> = {}
  for (const [key, current] of Object.entries(value)) {
    if (current === undefined || current === null) continue
    out[key] = current
  }
  return out as T
}
