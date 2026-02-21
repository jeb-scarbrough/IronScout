import { Prisma } from './generated/prisma/client.js'

/**
 * Canonical computation version for caliber snapshot rows.
 * Bump when snapshot methodology changes (independent of schemaVersion).
 */
export const CALIBER_SNAPSHOT_COMPUTATION_VERSION = 'snapshot/2026-02-16.1'

/**
 * Build canonical caliber snapshot stats query (ADR-024 / ADR-025).
 *
 * This is the shared source for:
 * - daily-best primitive
 * - ADR-015 corrections overlay
 * - ADR-005 retailer visibility predicate
 * - ADR-021 scrape guardrails
 */
export function buildCaliberSnapshotStatsQuery({
  caliberAliases,
  windowStart,
  windowEnd,
}) {
  return Prisma.sql`
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
      WHERE LOWER(p.caliber) = ANY(${caliberAliases}::text[])
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
}

/**
 * Build per-product trailing-window median query for market-deals style comparisons.
 *
 * Uses the same trust-critical overlay as the canonical snapshot query:
 * - ADR-015 corrections
 * - ADR-005 visibility/listing
 * - ADR-021 scrape guardrails
 */
export function buildProductMedianPriceQuery({
  productIds,
  windowStart,
  windowEnd,
  inStockOnly = true,
}) {
  return Prisma.sql`
    WITH daily_best AS (
      SELECT
        p.id as "productId",
        DATE_TRUNC('day', pr."observedAt" AT TIME ZONE 'UTC') as day,
        MIN(
          pr.price * COALESCE((
            SELECT CASE WHEN COUNT(*) = 0 THEN 1.0 ELSE EXP(SUM(LN(pc.value))) END
            FROM price_corrections pc
            WHERE pc."revokedAt" IS NULL AND pc.action = 'MULTIPLIER'
              AND pc.value > 0
              AND pr."observedAt" >= pc."startTs" AND pr."observedAt" < pc."endTs"
              AND (
                (pc."scopeType" = 'PRODUCT' AND pc."scopeId"::text = p.id::text) OR
                (pc."scopeType" = 'RETAILER' AND pc."scopeId"::text = r.id::text) OR
                (pc."scopeType" = 'SOURCE' AND pc."scopeId" = pr."sourceId") OR
                (pc."scopeType" = 'AFFILIATE' AND pc."scopeId" = pr."affiliateId") OR
                (pc."scopeType" = 'FEED_RUN' AND pr."ingestionRunId" IS NOT NULL AND pc."scopeId" = pr."ingestionRunId")
              )
          ), 1.0)
        ) as daily_best
      FROM products p
      JOIN product_links pl ON pl."productId" = p.id
      JOIN prices pr ON pr."sourceProductId" = pl."sourceProductId"
      JOIN retailers r ON r.id = pr."retailerId"
      LEFT JOIN merchant_retailers mr ON mr."retailerId" = r.id AND mr.status = 'ACTIVE'
      LEFT JOIN affiliate_feed_runs afr ON afr.id = pr."affiliateFeedRunId"
      LEFT JOIN sources s ON s.id = pr."sourceId"
      LEFT JOIN scrape_adapter_status sas ON sas."adapterId" = s."adapterId"
      WHERE p.id = ANY(${productIds}::text[])
        AND pl.status IN ('MATCHED', 'CREATED')
        AND pr."observedAt" >= ${windowStart}
        AND pr."observedAt" < ${windowEnd}
        ${inStockOnly ? Prisma.sql`AND pr."inStock" = true` : Prisma.empty}
        AND r."visibilityStatus" = 'ELIGIBLE'
        AND (mr.id IS NULL OR (mr."listingStatus" = 'LISTED' AND mr.status = 'ACTIVE'))
        AND (pr."affiliateFeedRunId" IS NULL OR afr."ignoredAt" IS NULL)
        AND NOT EXISTS (
          SELECT 1 FROM price_corrections pc
          WHERE pc."revokedAt" IS NULL
            AND pc.action = 'IGNORE'
            AND pr."observedAt" >= pc."startTs"
            AND pr."observedAt" < pc."endTs"
            AND (
              (pc."scopeType" = 'PRODUCT' AND pc."scopeId"::text = p.id::text) OR
              (pc."scopeType" = 'RETAILER' AND pc."scopeId"::text = r.id::text) OR
              (pc."scopeType" = 'SOURCE' AND pc."scopeId" = pr."sourceId") OR
              (pc."scopeType" = 'AFFILIATE' AND pc."scopeId" = pr."affiliateId") OR
              (pc."scopeType" = 'FEED_RUN' AND pr."ingestionRunId" IS NOT NULL AND pc."scopeId" = pr."ingestionRunId")
            )
        )
        AND (
          SELECT COUNT(*)
          FROM price_corrections pc
          WHERE pc."revokedAt" IS NULL AND pc.action = 'MULTIPLIER'
            AND pc.value > 0
            AND pr."observedAt" >= pc."startTs" AND pr."observedAt" < pc."endTs"
            AND (
              (pc."scopeType" = 'PRODUCT' AND pc."scopeId"::text = p.id::text) OR
              (pc."scopeType" = 'RETAILER' AND pc."scopeId"::text = r.id::text) OR
              (pc."scopeType" = 'SOURCE' AND pc."scopeId" = pr."sourceId") OR
              (pc."scopeType" = 'AFFILIATE' AND pc."scopeId" = pr."affiliateId") OR
              (pc."scopeType" = 'FEED_RUN' AND pr."ingestionRunId" IS NOT NULL AND pc."scopeId" = pr."ingestionRunId")
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
      GROUP BY p.id, DATE_TRUNC('day', pr."observedAt" AT TIME ZONE 'UTC')
    )
    SELECT
      "productId",
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY daily_best) as "medianPrice",
      COUNT(*)::int as "priceCount"
    FROM daily_best
    GROUP BY "productId"
  `
}

/**
 * Build caliber price-check stats query with optional product-attribute filters.
 *
 * Returns median/p25/p75/min/max and coverage over daily-best price_per_round.
 */
export function buildCaliberPriceCheckStatsQuery({
  caliberAliases,
  windowStart,
  windowEnd,
  brandPattern = null,
  grainValue = null,
  roundCountValue = null,
  caseMaterialPattern = null,
  bulletTypeValue = null,
}) {
  return Prisma.sql`
    WITH daily_best AS (
      SELECT
        p.id as product_id,
        DATE_TRUNC('day', pr."observedAt" AT TIME ZONE 'UTC') as observed_day,
        MIN(
          CASE WHEN p."roundCount" > 0
            THEN (pr.price * COALESCE((
              SELECT CASE WHEN COUNT(*) = 0 THEN 1.0 ELSE EXP(SUM(LN(pc.value))) END
              FROM price_corrections pc
              WHERE pc."revokedAt" IS NULL AND pc.action = 'MULTIPLIER'
                AND pc.value > 0
                AND pr."observedAt" >= pc."startTs" AND pr."observedAt" < pc."endTs"
                AND (
                  (pc."scopeType" = 'PRODUCT' AND pc."scopeId"::text = p.id::text) OR
                  (pc."scopeType" = 'RETAILER' AND pc."scopeId"::text = r.id::text) OR
                  (pc."scopeType" = 'SOURCE' AND pc."scopeId" = pr."sourceId") OR
                  (pc."scopeType" = 'AFFILIATE' AND pc."scopeId" = pr."affiliateId") OR
                  (pc."scopeType" = 'FEED_RUN' AND pr."ingestionRunId" IS NOT NULL AND pc."scopeId" = pr."ingestionRunId")
                )
            ), 1.0)) / p."roundCount"
            ELSE pr.price * COALESCE((
              SELECT CASE WHEN COUNT(*) = 0 THEN 1.0 ELSE EXP(SUM(LN(pc.value))) END
              FROM price_corrections pc
              WHERE pc."revokedAt" IS NULL AND pc.action = 'MULTIPLIER'
                AND pc.value > 0
                AND pr."observedAt" >= pc."startTs" AND pr."observedAt" < pc."endTs"
                AND (
                  (pc."scopeType" = 'PRODUCT' AND pc."scopeId"::text = p.id::text) OR
                  (pc."scopeType" = 'RETAILER' AND pc."scopeId"::text = r.id::text) OR
                  (pc."scopeType" = 'SOURCE' AND pc."scopeId" = pr."sourceId") OR
                  (pc."scopeType" = 'AFFILIATE' AND pc."scopeId" = pr."affiliateId") OR
                  (pc."scopeType" = 'FEED_RUN' AND pr."ingestionRunId" IS NOT NULL AND pc."scopeId" = pr."ingestionRunId")
                )
            ), 1.0)
          END
        ) as price_per_round
      FROM products p
      JOIN product_links pl ON pl."productId" = p.id
      JOIN prices pr ON pr."sourceProductId" = pl."sourceProductId"
      JOIN retailers r ON r.id = pr."retailerId"
      LEFT JOIN merchant_retailers mr ON mr."retailerId" = r.id AND mr.status = 'ACTIVE'
      LEFT JOIN affiliate_feed_runs afr ON afr.id = pr."affiliateFeedRunId"
      LEFT JOIN sources s ON s.id = pr."sourceId"
      LEFT JOIN scrape_adapter_status sas ON sas."adapterId" = s."adapterId"
      WHERE pl.status IN ('MATCHED', 'CREATED')
        AND pr."observedAt" >= ${windowStart}
        AND pr."observedAt" < ${windowEnd}
        AND pr."inStock" = true
        AND r."visibilityStatus" = 'ELIGIBLE'
        AND (mr.id IS NULL OR (mr."listingStatus" = 'LISTED' AND mr.status = 'ACTIVE'))
        AND (pr."affiliateFeedRunId" IS NULL OR afr."ignoredAt" IS NULL)
        AND NOT EXISTS (
          SELECT 1 FROM price_corrections pc
          WHERE pc."revokedAt" IS NULL
            AND pc.action = 'IGNORE'
            AND pr."observedAt" >= pc."startTs"
            AND pr."observedAt" < pc."endTs"
            AND (
              (pc."scopeType" = 'PRODUCT' AND pc."scopeId"::text = p.id::text) OR
              (pc."scopeType" = 'RETAILER' AND pc."scopeId"::text = r.id::text) OR
              (pc."scopeType" = 'SOURCE' AND pc."scopeId" = pr."sourceId") OR
              (pc."scopeType" = 'AFFILIATE' AND pc."scopeId" = pr."affiliateId") OR
              (pc."scopeType" = 'FEED_RUN' AND pr."ingestionRunId" IS NOT NULL AND pc."scopeId" = pr."ingestionRunId")
            )
        )
        AND (
          SELECT COUNT(*)
          FROM price_corrections pc
          WHERE pc."revokedAt" IS NULL AND pc.action = 'MULTIPLIER'
            AND pc.value > 0
            AND pr."observedAt" >= pc."startTs" AND pr."observedAt" < pc."endTs"
            AND (
              (pc."scopeType" = 'PRODUCT' AND pc."scopeId"::text = p.id::text) OR
              (pc."scopeType" = 'RETAILER' AND pc."scopeId"::text = r.id::text) OR
              (pc."scopeType" = 'SOURCE' AND pc."scopeId" = pr."sourceId") OR
              (pc."scopeType" = 'AFFILIATE' AND pc."scopeId" = pr."affiliateId") OR
              (pc."scopeType" = 'FEED_RUN' AND pr."ingestionRunId" IS NOT NULL AND pc."scopeId" = pr."ingestionRunId")
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
        AND LOWER(p.caliber) = ANY(${caliberAliases}::text[])
        AND (${brandPattern}::text IS NULL OR LOWER(p.brand) LIKE ${brandPattern}::text)
        AND (${grainValue}::int IS NULL OR p."grainWeight" = ${grainValue}::int)
        AND (${roundCountValue}::int IS NULL OR p."roundCount" = ${roundCountValue}::int)
        AND (${caseMaterialPattern}::text IS NULL OR LOWER(p."caseMaterial") LIKE ${caseMaterialPattern}::text)
        AND (${bulletTypeValue}::text IS NULL OR p."bulletType" = ${bulletTypeValue}::text)
      GROUP BY p.id, DATE_TRUNC('day', pr."observedAt" AT TIME ZONE 'UTC')
    )
    SELECT
      PERCENTILE_CONT(0.5)  WITHIN GROUP (ORDER BY price_per_round) AS "medianPrice",
      MIN(price_per_round)   AS "minPrice",
      MAX(price_per_round)   AS "maxPrice",
      PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY price_per_round) AS p25,
      PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY price_per_round) AS p75,
      COUNT(*)::int          AS "pricePointCount",
      COUNT(DISTINCT observed_day)::int AS "daysWithData"
    FROM daily_best
  `
}
