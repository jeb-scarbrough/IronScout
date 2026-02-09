/**
 * Structured logging helpers for Harvester workflows.
 *
 * Enforces common envelope fields and provides redaction utilities.
 * Must not log raw payloads, secrets, or full URLs with tracking params.
 */

import { createHash } from 'crypto'
import { sanitizeTraceMeta } from './trace'

export type LogContext = {
  workflow: string
  stage: string
  runId?: string
  executionId?: string
  traceId?: string
  sourceId?: string
  retailerId?: string
  feedId?: string
  adapterId?: string
  jobId?: string
  itemKey?: string
  step?: string
  attempt?: number
  retryCount?: number
  sourceProductId?: string
  [key: string]: unknown
}

type LogMeta = Record<string, unknown>

type BaseLogger = {
  debug: (event: string, meta?: LogMeta, err?: Error) => void
  info: (event: string, meta?: LogMeta, err?: Error) => void
  warn: (event: string, meta?: LogMeta, err?: Error) => void
  error: (event: string, meta?: LogMeta, err?: Error) => void
  fatal?: (event: string, meta?: LogMeta, err?: Error) => void
}

export function createWorkflowLogger(base: BaseLogger, context: LogContext) {
  const baseContext = compact(context)

  const logWith = (level: keyof BaseLogger, event: string, meta?: LogMeta, err?: Error) => {
    const payload = sanitizeTraceMeta({
      event_name: event,
      ...baseContext,
      ...(meta ? compact(meta) : {}),
    })
    const logFn = base[level]
    if (logFn) {
      logFn(event, payload, err)
    }
  }

  return {
    debug: (event: string, meta?: LogMeta, err?: Error) => logWith('debug', event, meta, err),
    info: (event: string, meta?: LogMeta, err?: Error) => logWith('info', event, meta, err),
    warn: (event: string, meta?: LogMeta, err?: Error) => logWith('warn', event, meta, err),
    error: (event: string, meta?: LogMeta, err?: Error) => logWith('error', event, meta, err),
    fatal: (event: string, meta?: LogMeta, err?: Error) =>
      base.fatal ? logWith('fatal', event, meta, err) : logWith('error', event, meta, err),
    child: (extra: Partial<LogContext>) =>
      createWorkflowLogger(base, { ...baseContext, ...compact(extra) } as LogContext),
  }
}

export function sanitizeUrl(url?: string | null): {
  urlHost?: string
  urlPath?: string
  urlHash?: string
} {
  if (!url) return {}
  try {
    const parsed = new URL(url)
    return {
      urlHost: parsed.host,
      urlPath: parsed.pathname,
      urlHash: hashValue(`${parsed.host}${parsed.pathname}`),
    }
  } catch {
    return { urlHash: hashValue(url) }
  }
}

export function hashValue(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16)
}

function compact<T extends Record<string, unknown>>(value: T): T {
  const next: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(value)) {
    if (val === undefined || val === null) continue
    next[key] = val
  }
  return next as T
}
