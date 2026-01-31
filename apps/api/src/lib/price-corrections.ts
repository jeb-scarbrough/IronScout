/**
 * ADR-015: Price Corrections SQL Helpers
 *
 * Provides SQL fragments for applying price corrections overlay:
 * - IGNORE corrections: exclude prices entirely
 * - MULTIPLIER corrections: adjust visible_price = raw_price * Π(multipliers)
 *
 * Rules:
 * - Max 2 multipliers per price event
 * - More than 2 multipliers → event becomes not visible
 * - IGNORE always wins (checked separately)
 */

/**
 * SQL CTE fragment for calculating multiplier corrections for a price
 *
 * This returns a single row per price with:
 * - multiplier_count: number of applicable MULTIPLIER corrections
 * - combined_multiplier: product of all multiplier values
 *
 * Usage in queries:
 * ```sql
 * WITH price_multipliers AS (
 *   ${getPriceMultipliersCTE('pr', 'p', 'r')}
 * )
 * SELECT
 *   pr.price * COALESCE(pm.combined_multiplier, 1.0) as visible_price
 * FROM prices pr
 * LEFT JOIN price_multipliers pm ON pm.price_row_id = pr.id
 * WHERE pm.multiplier_count IS NULL OR pm.multiplier_count <= 2
 * ```
 */
export function getPriceMultipliersCTE(
  priceAlias: string = 'pr',
  productAlias: string = 'p',
  retailerAlias: string = 'r'
): string {
  return `
    SELECT
      ${priceAlias}.id as price_row_id,
      COUNT(pc.id) as multiplier_count,
      CASE
        WHEN COUNT(pc.id) = 0 THEN 1.0
        WHEN COUNT(pc.id) > 2 THEN NULL -- Invalid: more than 2 multipliers
        ELSE EXP(SUM(LN(pc.value)))    -- Product of multipliers
      END as combined_multiplier
    FROM prices ${priceAlias}_inner
    LEFT JOIN price_corrections pc ON
      pc."revokedAt" IS NULL
      AND pc.action = 'MULTIPLIER'
      AND ${priceAlias}_inner."observedAt" >= pc."startTs"
      AND ${priceAlias}_inner."observedAt" < pc."endTs"
      AND (
        (pc."scopeType" = 'PRODUCT' AND pc."scopeId" = ${priceAlias}_inner."productId") OR
        (pc."scopeType" = 'RETAILER' AND pc."scopeId" = ${priceAlias}_inner."retailerId") OR
        (pc."scopeType" = 'SOURCE' AND pc."scopeId" = ${priceAlias}_inner."sourceId") OR
        (pc."scopeType" = 'AFFILIATE' AND pc."scopeId" = ${priceAlias}_inner."affiliateId") OR
        (pc."scopeType" = 'FEED_RUN' AND ${priceAlias}_inner."ingestionRunId" IS NOT NULL AND pc."scopeId" = ${priceAlias}_inner."ingestionRunId")
      )
    WHERE ${priceAlias}_inner.id = ${priceAlias}.id
    GROUP BY ${priceAlias}_inner.id
  `
}

/**
 * SQL subquery for getting the combined multiplier for a price row.
 *
 * Returns NULL if > 2 multipliers apply (which should exclude the price).
 * Returns 1.0 if no multipliers apply.
 *
 * Usage:
 * ```sql
 * SELECT
 *   pr.price * (${getMultiplierSubquery('pr')}) as visible_price
 * FROM prices pr
 * WHERE (${getMultiplierCountSubquery('pr')}) <= 2
 * ```
 */
export function getMultiplierSubquery(priceAlias: string = 'pr'): string {
  return `
    COALESCE(
      (
        SELECT
          CASE
            WHEN COUNT(pc.id) = 0 THEN 1.0
            WHEN COUNT(pc.id) > 2 THEN NULL
            ELSE EXP(SUM(LN(pc.value)))
          END
        FROM price_corrections pc
        WHERE pc."revokedAt" IS NULL
          AND pc.action = 'MULTIPLIER'
          AND ${priceAlias}."observedAt" >= pc."startTs"
          AND ${priceAlias}."observedAt" < pc."endTs"
          AND (
            (pc."scopeType" = 'PRODUCT' AND pc."scopeId" = ${priceAlias}."productId") OR
            (pc."scopeType" = 'RETAILER' AND pc."scopeId" = ${priceAlias}."retailerId") OR
            (pc."scopeType" = 'SOURCE' AND pc."scopeId" = ${priceAlias}."sourceId") OR
            (pc."scopeType" = 'AFFILIATE' AND pc."scopeId" = ${priceAlias}."affiliateId") OR
            (pc."scopeType" = 'FEED_RUN' AND ${priceAlias}."ingestionRunId" IS NOT NULL AND pc."scopeId" = ${priceAlias}."ingestionRunId")
          )
      ),
      1.0
    )
  `
}

/**
 * SQL subquery for counting multipliers for a price row.
 * Used to filter out prices with > 2 multipliers.
 */
export function getMultiplierCountSubquery(priceAlias: string = 'pr'): string {
  return `
    (
      SELECT COUNT(pc.id)
      FROM price_corrections pc
      WHERE pc."revokedAt" IS NULL
        AND pc.action = 'MULTIPLIER'
        AND ${priceAlias}."observedAt" >= pc."startTs"
        AND ${priceAlias}."observedAt" < pc."endTs"
        AND (
          (pc."scopeType" = 'PRODUCT' AND pc."scopeId" = ${priceAlias}."productId") OR
          (pc."scopeType" = 'RETAILER' AND pc."scopeId" = ${priceAlias}."retailerId") OR
          (pc."scopeType" = 'SOURCE' AND pc."scopeId" = ${priceAlias}."sourceId") OR
          (pc."scopeType" = 'AFFILIATE' AND pc."scopeId" = ${priceAlias}."affiliateId") OR
          (pc."scopeType" = 'FEED_RUN' AND ${priceAlias}."ingestionRunId" IS NOT NULL AND pc."scopeId" = ${priceAlias}."ingestionRunId")
        )
    )
  `
}

/**
 * SQL WHERE clause fragment for IGNORE corrections.
 * Use this in a NOT EXISTS subquery.
 */
export function getIgnoreCorrectionClause(
  priceAlias: string = 'pr',
  productAlias: string = 'p',
  retailerAlias: string = 'r'
): string {
  return `
    NOT EXISTS (
      SELECT 1 FROM price_corrections pc
      WHERE pc."revokedAt" IS NULL
        AND pc.action = 'IGNORE'
        AND ${priceAlias}."observedAt" >= pc."startTs"
        AND ${priceAlias}."observedAt" < pc."endTs"
        AND (
          (pc."scopeType" = 'PRODUCT' AND pc."scopeId" = ${productAlias}.id) OR
          (pc."scopeType" = 'RETAILER' AND pc."scopeId" = ${retailerAlias}.id) OR
          (pc."scopeType" = 'SOURCE' AND pc."scopeId" = ${priceAlias}."sourceId") OR
          (pc."scopeType" = 'AFFILIATE' AND pc."scopeId" = ${priceAlias}."affiliateId") OR
          (pc."scopeType" = 'FEED_RUN' AND ${priceAlias}."ingestionRunId" IS NOT NULL AND pc."scopeId" = ${priceAlias}."ingestionRunId")
        )
    )
  `
}

/**
 * Combined clause for excluding prices that should not be visible:
 * - IGNORE corrections
 * - More than 2 MULTIPLIER corrections
 */
export function getVisibilityClause(priceAlias: string = 'pr'): string {
  return `
    ${getIgnoreCorrectionClause(priceAlias, 'p', 'r')}
    AND (${getMultiplierCountSubquery(priceAlias)}) <= 2
  `
}
