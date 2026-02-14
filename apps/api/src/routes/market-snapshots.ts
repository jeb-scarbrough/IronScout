/**
 * Market Snapshots API Routes (ADR-025)
 *
 * Public endpoints for caliber-level market statistics.
 * Data sourced from precomputed caliber_market_snapshots table.
 *
 * Routes:
 * - GET /calibers      — All current snapshots (26 calibers)
 * - GET /calibers/:caliber — Single caliber snapshot or 404
 *
 * Per ADR-006: Response is purely descriptive, no recommendations.
 * Per ADR-025: Public, no auth required. Cached in Redis (5 min TTL).
 */

import { Router, Request, Response } from 'express'
import { prisma, Prisma } from '@ironscout/db'
import { getRedisClient } from '../config/redis'
import { loggers } from '../config/logger'

const log = loggers.server

export const marketSnapshotsRouter: Router = Router()

// Cache configuration
const CACHE_TTL_SECONDS = 300 // 5 minutes
const CACHE_KEY_ALL = 'market-snapshots:calibers:all'
const CACHE_KEY_PREFIX = 'market-snapshots:calibers:'

/**
 * Convert Prisma Decimal to number with 6 decimal places, or null.
 */
function formatDecimal6(value: Prisma.Decimal | null): number | null {
  if (value === null || value === undefined) return null
  return parseFloat(Number(value).toFixed(6))
}

/**
 * Map a DB snapshot row to the public API shape.
 */
function toPublicSnapshot(row: any) {
  return {
    caliber: row.caliber,
    windowDays: row.windowDays,
    statBasis: 'dailyBestObserved' as const,
    statLabel: 'Observed daily-best price per round',
    median: formatDecimal6(row.median),
    p25: formatDecimal6(row.p25),
    p75: formatDecimal6(row.p75),
    min: formatDecimal6(row.min),
    max: formatDecimal6(row.max),
    sampleCount: row.sampleCount,
    daysWithData: row.daysWithData,
    productCount: row.productCount,
    retailerCount: row.retailerCount,
    computedAt: row.computedAt.toISOString(),
    dataStatus: row.sampleCount >= 5 ? 'SUFFICIENT' : 'INSUFFICIENT_DATA',
  }
}

/**
 * GET /calibers — All current snapshots
 */
marketSnapshotsRouter.get('/calibers', async (_req: Request, res: Response) => {
  try {
    const redis = getRedisClient()

    // Check cache
    const cached = await redis.get(CACHE_KEY_ALL).catch(() => null)
    if (cached) {
      res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600')
      return res.json(JSON.parse(cached))
    }

    // Query all CURRENT snapshots for 30-day window
    const rows = await prisma.caliber_market_snapshots.findMany({
      where: { status: 'CURRENT', windowDays: 30 },
      orderBy: { caliber: 'asc' },
    })

    const snapshots = rows.map(toPublicSnapshot)

    // Compute meta
    const newestComputedAt = rows.length > 0
      ? rows.reduce((latest, r) => r.computedAt > latest ? r.computedAt : latest, rows[0].computedAt)
      : null

    const response = {
      snapshots,
      meta: {
        windowDays: 30,
        statBasis: 'dailyBestObserved' as const,
        computedAt: newestComputedAt ? newestComputedAt.toISOString() : null,
        calibersWithData: snapshots.filter(s => s.sampleCount >= 5).length,
        totalCalibers: snapshots.length,
      },
    }

    // Cache in Redis
    await redis.set(CACHE_KEY_ALL, JSON.stringify(response), 'EX', CACHE_TTL_SECONDS).catch(() => {})

    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600')
    return res.json(response)
  } catch (error) {
    log.error('Failed to fetch caliber snapshots', {}, error as Error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * GET /calibers/:caliber — Single caliber snapshot
 */
marketSnapshotsRouter.get('/calibers/:caliber', async (req: Request<{ caliber: string }>, res: Response) => {
  try {
    const caliberParam = decodeURIComponent(req.params.caliber)
    const redis = getRedisClient()
    const cacheKey = `${CACHE_KEY_PREFIX}${caliberParam}`

    // Check cache
    const cached = await redis.get(cacheKey).catch(() => null)
    if (cached) {
      const parsed = JSON.parse(cached)
      if (parsed === null) {
        return res.status(404).json({ error: 'Caliber not found' })
      }
      res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600')
      return res.json(parsed)
    }

    // Query single caliber
    const row = await prisma.caliber_market_snapshots.findFirst({
      where: { caliber: caliberParam, status: 'CURRENT', windowDays: 30 },
    })

    if (!row) {
      // Cache the miss to avoid repeated DB queries for unknown calibers
      await redis.set(cacheKey, JSON.stringify(null), 'EX', CACHE_TTL_SECONDS).catch(() => {})
      return res.status(404).json({ error: 'Caliber not found' })
    }

    const snapshot = toPublicSnapshot(row)

    // Cache in Redis
    await redis.set(cacheKey, JSON.stringify(snapshot), 'EX', CACHE_TTL_SECONDS).catch(() => {})

    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600')
    return res.json(snapshot)
  } catch (error) {
    log.error('Failed to fetch caliber snapshot', { caliber: req.params.caliber }, error as Error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})
