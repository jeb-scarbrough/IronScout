/**
 * Query Analytics Logging Service
 *
 * Logs successful search queries and price checks for internal product analytics.
 * All writes are fire-and-forget — they never block or fail user-facing responses.
 *
 * Logged data supports:
 * - Search pattern analysis (popular calibers, zero-result queries)
 * - Price check demand signals
 * - Lens adoption tracking
 * - Future Lens and feature roadmap decisions
 *
 * Privacy:
 * - No raw query stored; only normalized+redacted text (capped at 250 chars)
 * - PII-flagged queries get NULL queryNormRedacted
 * - DSAR: userId, userAgent, referrer, gunLockerCalibers anonymized on account deletion
 * - 1-year retention (purge job deferred to separate issue)
 */

import { prisma, Prisma } from '@ironscout/db'
import { hashQuery, normalizeQuery, hasPii, redactPii } from '../lib/pii'
import { getUserCalibers } from './gun-locker'
import { loggers } from '../config/logger'

const log = loggers.search

export interface SearchQueryLogInput {
  query: string
  userId: string | null
  sortBy: string | null
  page: number
  lensId: string | null
  intentCalibers: string[]
  intentPurpose: string | null
  intentBrands: string[]
  intentConfidence: number | null
  filtersApplied: Record<string, unknown> | null
  resultCount: number
  returnedCount: number
  vectorSearchUsed: boolean
  responseTimeMs: number
  timingBreakdown: Record<string, unknown> | null
  referrer: string | null
  userAgent: string | null
}

export interface PriceCheckQueryLogInput {
  userId: string | null
  caliber: string
  pricePerRound: number
  brand: string | null
  grain: number | null
  roundCount: number | null
  caseMaterial: string | null
  bulletType: string | null
  classification: string | null
  pricePointCount: number | null
  daysWithData: number | null
  medianPrice: number | null
  referrer: string | null
  userAgent: string | null
}

/**
 * Log a successful search query. Fire-and-forget.
 */
export function logSearchQuery(input: SearchQueryLogInput): void {
  _logSearchQueryAsync(input).catch((err) => {
    log.warn('Failed to log search query analytics', { error: (err as Error).message })
  })
}

async function _logSearchQueryAsync(input: SearchQueryLogInput): Promise<void> {
  const piiFlag = hasPii(input.query)
  const gunLockerCalibers = input.userId
    ? await getUserCalibers(input.userId).catch(() => [] as string[])
    : []

  await prisma.search_query_logs.create({
    data: {
      userId: input.userId,
      queryHash: hashQuery(input.query),
      queryLength: input.query.length, // UTF-16 code units (JS string .length)
      queryPiiFlag: piiFlag,
      queryNormRedacted: piiFlag ? null : redactPii(normalizeQuery(input.query)).slice(0, 250),
      lensId: input.lensId,
      sortBy: input.sortBy,
      page: input.page,
      intentCalibers: input.intentCalibers,
      intentPurpose: input.intentPurpose,
      intentBrands: input.intentBrands,
      intentConfidence: input.intentConfidence,
      filtersApplied: (input.filtersApplied ?? undefined) as Prisma.InputJsonValue | undefined,
      resultCount: input.resultCount,
      returnedCount: input.returnedCount,
      vectorSearchUsed: input.vectorSearchUsed,
      responseTimeMs: input.responseTimeMs,
      timingBreakdown: (input.timingBreakdown ?? undefined) as Prisma.InputJsonValue | undefined,
      isAuthenticated: input.userId != null,
      gunLockerCalibers,
      referrer: input.referrer,
      userAgent: input.userAgent?.slice(0, 200) ?? null,
    },
  })
}

/**
 * Log a successful price check query. Fire-and-forget.
 */
export function logPriceCheckQuery(input: PriceCheckQueryLogInput): void {
  _logPriceCheckQueryAsync(input).catch((err) => {
    log.warn('Failed to log price check query analytics', { error: (err as Error).message })
  })
}

async function _logPriceCheckQueryAsync(input: PriceCheckQueryLogInput): Promise<void> {
  const gunLockerCalibers = input.userId
    ? await getUserCalibers(input.userId).catch(() => [] as string[])
    : []

  await prisma.price_check_query_logs.create({
    data: {
      userId: input.userId,
      caliber: input.caliber,
      pricePerRound: input.pricePerRound,
      brand: input.brand,
      grain: input.grain,
      roundCount: input.roundCount,
      caseMaterial: input.caseMaterial,
      bulletType: input.bulletType,
      classification: input.classification,
      pricePointCount: input.pricePointCount,
      daysWithData: input.daysWithData,
      medianPrice: input.medianPrice,
      isAuthenticated: input.userId != null,
      gunLockerCalibers,
      referrer: input.referrer,
      userAgent: input.userAgent?.slice(0, 200) ?? null,
    },
  })
}
