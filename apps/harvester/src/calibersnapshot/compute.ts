/**
 * Caliber Market Snapshot Computation (ADR-025)
 *
 * Computes caliber-level market statistics using the daily-best CTE with
 * full ADR-015/005/021 corrections overlay. Writes results transactionally
 * to caliber_market_snapshots table.
 */

import { prisma, Prisma, CANONICAL_CALIBERS, getCaliberAliases, type CaliberValue } from '@ironscout/db'
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

      // Execute the ADR-025 snapshot SQL query.
      // qualifying_prices CTE is defined once; stats, coverage, and bounds_dropped
      // all read from it — no duplication.
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
      }>>`
        WITH qualifying_prices AS (
          SELECT
            p.id AS product_id,
            pr."retailerId",
            DATE_TRUNC('day', pr."observedAt" AT TIME ZONE 'UTC') AS day,
            MIN(
              (pr.price * COALESCE((
                SELECT CASE WHEN COUNT(*) = 0 THEN 1.0
                            ELSE EXP(SUM(LN(pc.value))) END
                FROM price_corrections pc
                WHERE pc."revokedAt" IS NULL AND pc.action = 'MULTIPLIER'
                  AND pc.value > 0
                  AND pr."observedAt" >= pc."startTs" AND pr."observedAt" < pc."endTs"
                  AND (
                    (pc."scopeType" = 'PRODUCT'  AND pc."scopeId"::text = p.id::text) OR
                    (pc."scopeType" = 'RETAILER' AND pc."scopeId"::text = r.id::text) OR
                    (pc."scopeType" = 'SOURCE'   AND pc."scopeId" = pr."sourceId") OR
                    (pc."scopeType" = 'AFFILIATE' AND pc."scopeId" = pr."affiliateId") OR
                    (pc."scopeType" = 'FEED_RUN' AND pr."ingestionRunId" IS NOT NULL
                                                  AND pc."scopeId" = pr."ingestionRunId")
                  )
              ), 1.0)) / p."roundCount"
            ) AS price_per_round
          FROM products p
          JOIN product_links pl ON pl."productId" = p.id
          JOIN prices pr ON pr."sourceProductId" = pl."sourceProductId"
          JOIN retailers r ON r.id = pr."retailerId"
          LEFT JOIN merchant_retailers mr ON mr."retailerId" = r.id AND mr.status = 'ACTIVE'
          LEFT JOIN affiliate_feed_runs afr ON afr.id = pr."affiliateFeedRunId"
          LEFT JOIN sources s ON s.id = pr."sourceId"
          LEFT JOIN scrape_adapter_status sas ON sas."adapterId" = s."adapterId"
          WHERE LOWER(p.caliber) = ANY(${aliases}::text[])
            AND p."roundCount" IS NOT NULL AND p."roundCount" > 0
            AND pl.status IN ('MATCHED', 'CREATED')
            AND pr."inStock" = true
            AND pr."observedAt" >= ${windowStart}
            AND pr."observedAt" < ${windowEnd}
            AND r."visibilityStatus" = 'ELIGIBLE'
            AND (mr.id IS NULL OR (mr."listingStatus" = 'LISTED' AND mr.status = 'ACTIVE'))
            AND (pr."affiliateFeedRunId" IS NULL OR afr."ignoredAt" IS NULL)
            AND NOT EXISTS (
              SELECT 1 FROM price_corrections pc
              WHERE pc."revokedAt" IS NULL AND pc.action = 'IGNORE'
                AND pr."observedAt" >= pc."startTs" AND pr."observedAt" < pc."endTs"
                AND (
                  (pc."scopeType" = 'PRODUCT'  AND pc."scopeId"::text = p.id::text) OR
                  (pc."scopeType" = 'RETAILER' AND pc."scopeId"::text = r.id::text) OR
                  (pc."scopeType" = 'SOURCE'   AND pc."scopeId" = pr."sourceId") OR
                  (pc."scopeType" = 'AFFILIATE' AND pc."scopeId" = pr."affiliateId") OR
                  (pc."scopeType" = 'FEED_RUN' AND pr."ingestionRunId" IS NOT NULL
                                                AND pc."scopeId" = pr."ingestionRunId")
                )
            )
            AND (
              SELECT COUNT(*)
              FROM price_corrections pc
              WHERE pc."revokedAt" IS NULL AND pc.action = 'MULTIPLIER'
                AND pc.value > 0
                AND pr."observedAt" >= pc."startTs" AND pr."observedAt" < pc."endTs"
                AND (
                  (pc."scopeType" = 'PRODUCT'  AND pc."scopeId"::text = p.id::text) OR
                  (pc."scopeType" = 'RETAILER' AND pc."scopeId"::text = r.id::text) OR
                  (pc."scopeType" = 'SOURCE'   AND pc."scopeId" = pr."sourceId") OR
                  (pc."scopeType" = 'AFFILIATE' AND pc."scopeId" = pr."affiliateId") OR
                  (pc."scopeType" = 'FEED_RUN' AND pr."ingestionRunId" IS NOT NULL
                                                AND pc."scopeId" = pr."ingestionRunId")
                )
            ) <= 2
            AND (
              pr."ingestionRunType" IS NULL
              OR pr."ingestionRunType" != 'SCRAPE'
              OR (
                pr."ingestionRunType" = 'SCRAPE'
                AND s."adapterId" IS NOT NULL
                AND s."robotsCompliant" = true
                AND s."tosReviewedAt" IS NOT NULL
                AND s."tosApprovedBy" IS NOT NULL
                AND sas."enabled" = true
              )
            )
          GROUP BY p.id, pr."retailerId",
                   DATE_TRUNC('day', pr."observedAt" AT TIME ZONE 'UTC')
        ),
        daily_best AS (
          SELECT product_id, day, MIN(price_per_round) AS price_per_round
          FROM qualifying_prices
          WHERE price_per_round > 0 AND price_per_round < 10
          GROUP BY product_id, day
        ),
        coverage AS (
          SELECT
            COUNT(DISTINCT product_id)::int  AS product_count,
            COUNT(DISTINCT "retailerId")::int AS retailer_count
          FROM qualifying_prices
          WHERE price_per_round > 0 AND price_per_round < 10
        ),
        bounds_dropped AS (
          SELECT COUNT(*)::int AS count
          FROM qualifying_prices
          WHERE price_per_round <= 0 OR price_per_round >= 10
        ),
        stats AS (
          SELECT
            CASE WHEN COUNT(*) >= 5
              THEN PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY db.price_per_round) END AS median,
            CASE WHEN COUNT(*) >= 5
              THEN PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY db.price_per_round) END AS p25,
            CASE WHEN COUNT(*) >= 5
              THEN PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY db.price_per_round) END AS p75,
            MIN(db.price_per_round) AS min,
            MAX(db.price_per_round) AS max,
            COUNT(*)::int                AS "sampleCount",
            COUNT(DISTINCT db.day)::int  AS "daysWithData"
          FROM daily_best db
        )
        SELECT
          s.median, s.p25, s.p75, s.min, s.max,
          s."sampleCount", s."daysWithData",
          c.product_count    AS "productCount",
          c.retailer_count   AS "retailerCount",
          bd.count           AS "droppedByBounds"
        FROM stats s
        CROSS JOIN coverage c
        CROSS JOIN bounds_dropped bd
      `

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
