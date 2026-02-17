/**
 * Caliber Market Snapshot Computation (ADR-025)
 *
 * Computes caliber-level market statistics using the daily-best CTE with
 * full ADR-015/005/021 corrections overlay. Writes results transactionally
 * to caliber_market_snapshots table.
 */

import {
  prisma,
  Prisma,
  CANONICAL_CALIBERS,
  getCaliberAliases,
  buildCaliberSnapshotStatsQuery,
  type CaliberValue,
} from '@ironscout/db'
import { createId } from '@paralleldrive/cuid2'
import { logger } from '../config/logger'

const log = logger.calibersnapshot

export interface CaliberSnapshotResult {
  caliber: string
  sampleCount: number
  median: number | null
  daysWithData: number
  productCount: number
  retailerCount: number
  durationMs: number
  droppedByBounds: number
}

export interface ComputeSnapshotsResult {
  calibersProcessed: number
  calibersWithData: number
  calibersInsufficient: number
  totalDurationMs: number
  results: CaliberSnapshotResult[]
}

/**
 * Compute caliber market snapshots for all canonical calibers.
 *
 * Per ADR-025: windowEnd is frozen ONCE at run start and shared by ALL calibers.
 * This ensures all snapshots from a single run share identical time bounds.
 */
export async function computeCaliberSnapshots(
  windowDays: number,
  version: string
): Promise<ComputeSnapshotsResult> {
  const runStart = Date.now()
  const windowEnd = new Date()
  const windowStart = new Date(windowEnd.getTime() - windowDays * 24 * 60 * 60 * 1000)

  const results: CaliberSnapshotResult[] = []
  let calibersWithData = 0
  let calibersInsufficient = 0

  // Exclude 'Other' — catch-all bucket where median computation is meaningless
  const calibers = CANONICAL_CALIBERS.filter((c): c is Exclude<CaliberValue, 'Other'> => c !== 'Other')

  log.info('CALIBER_SNAPSHOT_JOB_START', {
    event_name: 'CALIBER_SNAPSHOT_JOB_START',
    windowDays,
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
    caliberCount: calibers.length,
    computationVersion: version,
  })

  for (const caliber of calibers) {
    const caliberStart = Date.now()

    try {
      const aliases = getCaliberAliases(caliber)

      // Execute canonical snapshot SQL from shared source (drift prevention).
      const statsQuery = buildCaliberSnapshotStatsQuery({
        caliberAliases: aliases,
        windowStart,
        windowEnd,
      })

      const stats = await prisma.$queryRaw<Array<{
        median: Prisma.Decimal | null
        p25: Prisma.Decimal | null
        p75: Prisma.Decimal | null
        min: Prisma.Decimal | null
        max: Prisma.Decimal | null
        sampleCount: number
        daysWithData: number
        productCount: number
        retailerCount: number
        droppedByBounds: number
      }>>(statsQuery)

      const row = stats[0]
      const droppedByBounds = row.droppedByBounds ?? 0
      const caliberDurationMs = Date.now() - caliberStart
      const computedAt = new Date()

      // Transactional write: SUPERSEDE old → INSERT new
      const snapshotId = createId()
      await prisma.$transaction([
        prisma.$executeRaw`
          UPDATE caliber_market_snapshots
          SET status = 'SUPERSEDED'::"CaliberSnapshotStatus"
          WHERE caliber = ${caliber}
            AND "windowDays" = ${windowDays}
            AND status = 'CURRENT'::"CaliberSnapshotStatus"
        `,
        prisma.$executeRaw`
          INSERT INTO caliber_market_snapshots (
            id, caliber, "windowDays", "windowStart", "windowEnd",
            median, p25, p75, min, max,
            "sampleCount", "daysWithData", "productCount", "retailerCount",
            "computedAt", "computationVersion", "computationDurationMs",
            status, "createdAt"
          ) VALUES (
            ${snapshotId}, ${caliber}, ${windowDays}, ${windowStart}, ${windowEnd},
            ${row.median}, ${row.p25}, ${row.p75}, ${row.min}, ${row.max},
            ${row.sampleCount}, ${row.daysWithData}, ${row.productCount}, ${row.retailerCount},
            ${computedAt}, ${version}, ${caliberDurationMs},
            'CURRENT'::"CaliberSnapshotStatus", NOW()
          )
        `,
      ])

      if (row.sampleCount >= 5) {
        calibersWithData++
        log.info('CALIBER_SNAPSHOT_CALIBER_COMPUTED', {
          event_name: 'CALIBER_SNAPSHOT_CALIBER_COMPUTED',
          caliber,
          sampleCount: row.sampleCount,
          median: row.median?.toString() ?? null,
          daysWithData: row.daysWithData,
          productCount: row.productCount,
          retailerCount: row.retailerCount,
          durationMs: caliberDurationMs,
          droppedByBounds,
        })
      } else {
        calibersInsufficient++
        log.info('CALIBER_SNAPSHOT_CALIBER_INSUFFICIENT', {
          event_name: 'CALIBER_SNAPSHOT_CALIBER_INSUFFICIENT',
          caliber,
          sampleCount: row.sampleCount,
          durationMs: caliberDurationMs,
          droppedByBounds,
        })
      }

      results.push({
        caliber,
        sampleCount: row.sampleCount,
        median: row.median ? Number(row.median) : null,
        daysWithData: row.daysWithData,
        productCount: row.productCount,
        retailerCount: row.retailerCount,
        durationMs: caliberDurationMs,
        droppedByBounds,
      })
    } catch (error) {
      // Check for unique constraint violation (race condition with concurrent job)
      const prismaError = error as { code?: string }
      if (prismaError.code === 'P2002') {
        log.warn('CALIBER_SNAPSHOT_RACE_CONDITION', {
          event_name: 'CALIBER_SNAPSHOT_RACE_CONDITION',
          caliber,
          message: 'Unique constraint violation — concurrent job may have written first',
        })
        continue
      }

      log.error(
        'CALIBER_SNAPSHOT_CALIBER_ERROR',
        {
          event_name: 'CALIBER_SNAPSHOT_CALIBER_ERROR',
          caliber,
          errorMessage: error instanceof Error ? error.message : String(error),
        },
        error instanceof Error ? error : new Error(String(error))
      )
      throw error
    }
  }

  const totalDurationMs = Date.now() - runStart

  log.info('CALIBER_SNAPSHOT_JOB_COMPLETE', {
    event_name: 'CALIBER_SNAPSHOT_JOB_COMPLETE',
    calibersProcessed: results.length,
    calibersWithData,
    calibersInsufficient,
    totalDurationMs,
  })

  return {
    calibersProcessed: results.length,
    calibersWithData,
    calibersInsufficient,
    totalDurationMs,
    results,
  }
}
