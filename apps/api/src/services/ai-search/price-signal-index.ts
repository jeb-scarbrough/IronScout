/**
 * Price Signal Index Service
 *
 * Computes descriptive price context for ammunition products.
 * Provides relative positioning within observed price ranges.
 *
 * IMPORTANT (ADR-006): This service provides CONTEXT, not recommendations.
 * - No grades, scores, or verdicts
 * - No "deal", "value", "buy", "wait" language
 * - Output is purely descriptive and comparative
 *
 * Consumer UI receives:
 * - relativePricePct: How current price compares to trailing median
 * - positionInRange: 0-1 position within observed min/max
 * - contextBand: LOW / TYPICAL / HIGH classification
 * - meta: Data coverage information
 */

import { prisma, Prisma } from '@ironscout/db'
type Decimal = Prisma.Decimal

// ============================================================================
// PUBLIC TYPES (Consumer-facing)
// ============================================================================

/**
 * Context band classification based on price position
 * Uses conservative thresholds (0.30/0.70 position in min-max range)
 */
export type ContextBand = 'LOW' | 'TYPICAL' | 'HIGH' | 'INSUFFICIENT_DATA'

/**
 * Price context metadata for transparency
 */
export interface PriceContextMeta {
  windowDays: number
  sampleCount: number
  asOf: string // ISO timestamp
}

/**
 * Consumer-facing price signal output
 * Descriptive only - no recommendations or verdicts
 */
export interface PriceSignalIndex {
  /** Percentage relative to trailing median (negative = below median) */
  relativePricePct: number
  /** Position within observed range (0 = min, 1 = max) */
  positionInRange: number
  /** Descriptive classification */
  contextBand: ContextBand
  /** Data coverage metadata */
  meta: PriceContextMeta
}

// ============================================================================
// INTERNAL TYPES (Not exposed to consumers)
// ============================================================================

/**
 * Internal computation data - NOT for consumer UI
 * These hints are kept for future objective criteria development
 */
interface InternalSignalHints {
  /** Hint based on retailer tier - NOT shown to users */
  retailerConfidenceHint: 'high' | 'standard' | 'unknown'
  /** Hint based on brand data availability - NOT shown to users */
  brandDataCompletenessHint: 'complete' | 'partial' | 'unknown'
  /** Raw shipping cost for internal tracking */
  shippingCost: number | null
}

/**
 * Full internal result including hints
 */
interface InternalPriceSignal extends PriceSignalIndex {
  _internal: InternalSignalHints
}

/**
 * Product data needed for signal calculation
 */
interface ProductForSignal {
  id: string
  caliber: string | null
  roundCount: number | null
  brand: string | null
  prices: Array<{
    price: Decimal | number
    inStock: boolean
    shippingCost?: Decimal | number | null
    retailer: {
      tier: string
    }
  }>
}

// ============================================================================
// CONFIGURATION
// ============================================================================

/** Minimum samples required for meaningful context */
const MIN_SAMPLES_FOR_CONTEXT = 5

/** Default window for price history */
const DEFAULT_WINDOW_DAYS = 30

/** Position-in-range thresholds for context bands (0 = min, 1 = max) */
const LOW_THRESHOLD_POSITION = 0.30
const HIGH_THRESHOLD_POSITION = 0.70

// ============================================================================
// CALIBER PRICE CACHE
// ============================================================================

interface CaliberPriceStats {
  median: number
  min: number
  max: number
  p25: number
  p75: number
  sampleCount: number
  updatedAt: Date
}

let priceStatsCache: Map<string, CaliberPriceStats> = new Map()
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate price per round
 */
function calculatePricePerRound(price: Decimal | number, roundCount: number | null): number {
  const priceNum = typeof price === 'number' ? price : parseFloat(price.toString())
  const rounds = roundCount || 50 // Default assumption
  return priceNum / rounds
}

/**
 * Get price statistics for a caliber.
 *
 * ADR-024: Uses SQL PERCENTILE_CONT as the canonical median definition.
 * Daily-best = MIN corrected visible price-per-round per product per UTC day.
 * ADR-015 compliant: queries through product_links with full corrections overlay.
 */
async function getCaliberPriceStats(caliber: string): Promise<CaliberPriceStats> {
  const cacheKey = caliber.toLowerCase()
  const cached = priceStatsCache.get(cacheKey)

  if (cached && (Date.now() - cached.updatedAt.getTime()) < CACHE_TTL_MS) {
    return cached
  }

  const windowStart = new Date()
  windowStart.setDate(windowStart.getDate() - DEFAULT_WINDOW_DAYS)

  // ADR-024: Canonical median via SQL PERCENTILE_CONT over daily-best prices.
  // ADR-015: Full corrections overlay (IGNORE exclusion, MULTIPLIER application).
  const rows = await prisma.$queryRaw<Array<{
    median: any
    min: any
    max: any
    p25: any
    p75: any
    sampleCount: number
  }>>`
    WITH daily_best AS (
      SELECT
        p.id as product_id,
        DATE_TRUNC('day', pr."observedAt" AT TIME ZONE 'UTC') as day,
        MIN(
          (pr.price * COALESCE((
            SELECT CASE WHEN COUNT(*) = 0 THEN 1.0 WHEN COUNT(*) > 2 THEN NULL ELSE EXP(SUM(LN(pc.value))) END
            FROM price_corrections pc
            WHERE pc."revokedAt" IS NULL AND pc.action = 'MULTIPLIER'
              AND pr."observedAt" >= pc."startTs" AND pr."observedAt" < pc."endTs"
              AND (
                (pc."scopeType" = 'PRODUCT' AND pc."scopeId"::text = p.id::text) OR
                (pc."scopeType" = 'RETAILER' AND pc."scopeId"::text = r.id::text) OR
                (pc."scopeType" = 'SOURCE' AND pc."scopeId" = pr."sourceId") OR
                (pc."scopeType" = 'AFFILIATE' AND pc."scopeId" = pr."affiliateId") OR
                (pc."scopeType" = 'FEED_RUN' AND pr."ingestionRunId" IS NOT NULL AND pc."scopeId" = pr."ingestionRunId")
              )
          ), 1.0)) / p."roundCount"
        ) as price_per_round
      FROM products p
      JOIN product_links pl ON pl."productId" = p.id
      JOIN prices pr ON pr."sourceProductId" = pl."sourceProductId"
      JOIN retailers r ON r.id = pr."retailerId"
      LEFT JOIN merchant_retailers mr ON mr."retailerId" = r.id AND mr.status = 'ACTIVE'
      LEFT JOIN affiliate_feed_runs afr ON afr.id = pr."affiliateFeedRunId"
      LEFT JOIN sources s ON s.id = pr."sourceId"
      LEFT JOIN scrape_adapter_status sas ON sas."adapterId" = s."adapterId"
      WHERE p.caliber ILIKE ${'%' + caliber + '%'}
        AND p."roundCount" IS NOT NULL AND p."roundCount" > 0
        AND pl.status IN ('MATCHED', 'CREATED')
        AND pr."inStock" = true
        AND pr."observedAt" >= ${windowStart}
        AND r."visibilityStatus" = 'ELIGIBLE'
        AND (mr.id IS NULL OR (mr."listingStatus" = 'LISTED' AND mr.status = 'ACTIVE'))
        AND (pr."affiliateFeedRunId" IS NULL OR afr."ignoredAt" IS NULL)
        -- ADR-015: Exclude prices with active IGNORE corrections
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
        -- ADR-015: Exclude prices with > 2 MULTIPLIER corrections
        AND (
          SELECT COUNT(*)
          FROM price_corrections pc
          WHERE pc."revokedAt" IS NULL AND pc.action = 'MULTIPLIER'
            AND pr."observedAt" >= pc."startTs" AND pr."observedAt" < pc."endTs"
            AND (
              (pc."scopeType" = 'PRODUCT' AND pc."scopeId"::text = p.id::text) OR
              (pc."scopeType" = 'RETAILER' AND pc."scopeId"::text = r.id::text) OR
              (pc."scopeType" = 'SOURCE' AND pc."scopeId" = pr."sourceId") OR
              (pc."scopeType" = 'AFFILIATE' AND pc."scopeId" = pr."affiliateId") OR
              (pc."scopeType" = 'FEED_RUN' AND pr."ingestionRunId" IS NOT NULL AND pc."scopeId" = pr."ingestionRunId")
            )
        ) <= 2
        -- ADR-021: Allow SCRAPE prices only when guardrails pass
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
      CASE WHEN COUNT(*) >= ${MIN_SAMPLES_FOR_CONTEXT}
        THEN PERCENTILE_CONT(0.5)  WITHIN GROUP (ORDER BY price_per_round) END AS median,
      MIN(price_per_round)   AS min,
      MAX(price_per_round)   AS max,
      CASE WHEN COUNT(*) >= ${MIN_SAMPLES_FOR_CONTEXT}
        THEN PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY price_per_round) END AS p25,
      CASE WHEN COUNT(*) >= ${MIN_SAMPLES_FOR_CONTEXT}
        THEN PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY price_per_round) END AS p75,
      COUNT(*)::int          AS "sampleCount"
    FROM daily_best
    WHERE price_per_round > 0 AND price_per_round < 10
  `

  const row = rows[0]

  if (!row) {
    return {
      median: 0,
      min: 0,
      max: 0,
      p25: 0,
      p75: 0,
      sampleCount: 0,
      updatedAt: new Date()
    }
  }

  const stats: CaliberPriceStats = {
    median: row.median != null ? parseFloat(row.median.toString()) : 0,
    min: row.min != null ? parseFloat(row.min.toString()) : 0,
    max: row.max != null ? parseFloat(row.max.toString()) : 0,
    p25: row.p25 != null ? parseFloat(row.p25.toString()) : 0,
    p75: row.p75 != null ? parseFloat(row.p75.toString()) : 0,
    sampleCount: row.sampleCount,
    updatedAt: new Date()
  }

  priceStatsCache.set(cacheKey, stats)

  return stats
}

/**
 * Determine retailer confidence hint (internal only)
 */
function getRetailerConfidenceHint(tier: string): InternalSignalHints['retailerConfidenceHint'] {
  if (tier === 'PREMIUM') return 'high'
  if (tier === 'STANDARD') return 'standard'
  return 'unknown'
}

/**
 * Determine brand data completeness hint (internal only)
 */
function getBrandDataCompletenessHint(brand: string | null): InternalSignalHints['brandDataCompletenessHint'] {
  if (!brand) return 'unknown'
  // Simple heuristic: known brands have more complete data
  const knownBrands = [
    'federal', 'hornady', 'winchester', 'remington', 'cci',
    'speer', 'pmc', 'magtech', 'fiocchi', 'aguila', 'blazer'
  ]
  const lowerBrand = brand.toLowerCase()
  if (knownBrands.some(kb => lowerBrand.includes(kb))) {
    return 'complete'
  }
  return 'partial'
}

/**
 * Determine context band from position in range
 */
function determineContextBand(positionInRange: number, sampleCount: number): ContextBand {
  if (sampleCount < MIN_SAMPLES_FOR_CONTEXT) {
    return 'INSUFFICIENT_DATA'
  }

  if (positionInRange <= LOW_THRESHOLD_POSITION) {
    return 'LOW'
  } else if (positionInRange >= HIGH_THRESHOLD_POSITION) {
    return 'HIGH'
  }
  return 'TYPICAL'
}

// ============================================================================
// MAIN COMPUTATION
// ============================================================================

/**
 * Calculate price signal index for a product
 *
 * Returns descriptive context about price positioning.
 * Does NOT return recommendations, grades, or verdicts.
 */
export async function calculatePriceSignalIndex(
  product: ProductForSignal
): Promise<PriceSignalIndex> {
  const now = new Date()

  // Default response for insufficient data
  const insufficientDataResponse: PriceSignalIndex = {
    relativePricePct: 0,
    positionInRange: 0.5,
    contextBand: 'INSUFFICIENT_DATA',
    meta: {
      windowDays: DEFAULT_WINDOW_DAYS,
      sampleCount: 0,
      asOf: now.toISOString()
    }
  }

  // Get the best (lowest) in-stock price
  const inStockPrices = product.prices.filter(p => p.inStock)
  if (inStockPrices.length === 0) {
    return insufficientDataResponse
  }

  const bestPrice = inStockPrices.sort((a, b) => {
    const aPrice = typeof a.price === 'number' ? a.price : parseFloat(a.price.toString())
    const bPrice = typeof b.price === 'number' ? b.price : parseFloat(b.price.toString())
    return aPrice - bPrice
  })[0]

  const pricePerRound = calculatePricePerRound(bestPrice.price, product.roundCount)

  // Get caliber statistics
  if (!product.caliber) {
    return insufficientDataResponse
  }

  const stats = await getCaliberPriceStats(product.caliber)

  if (stats.sampleCount < MIN_SAMPLES_FOR_CONTEXT) {
    return {
      ...insufficientDataResponse,
      meta: {
        windowDays: DEFAULT_WINDOW_DAYS,
        sampleCount: stats.sampleCount,
        asOf: now.toISOString()
      }
    }
  }

  // Calculate relative price percentage (vs median)
  const relativePricePct = stats.median > 0
    ? ((pricePerRound - stats.median) / stats.median) * 100
    : 0

  // Calculate position in range (0 = min, 1 = max)
  const range = stats.max - stats.min
  const positionInRange = range > 0
    ? Math.max(0, Math.min(1, (pricePerRound - stats.min) / range))
    : 0.5

  // Determine context band
  const contextBand = determineContextBand(positionInRange, stats.sampleCount)

  return {
    relativePricePct: Math.round(relativePricePct * 10) / 10, // 1 decimal place
    positionInRange: Math.round(positionInRange * 100) / 100, // 2 decimal places
    contextBand,
    meta: {
      windowDays: DEFAULT_WINDOW_DAYS,
      sampleCount: stats.sampleCount,
      asOf: now.toISOString()
    }
  }
}

/**
 * Calculate internal signal with hints (for internal use only)
 * Includes retailerConfidenceHint and brandDataCompletenessHint
 */
export async function calculateInternalPriceSignal(
  product: ProductForSignal
): Promise<InternalPriceSignal> {
  const publicSignal = await calculatePriceSignalIndex(product)

  // Get the best in-stock price for internal hints
  const inStockPrices = product.prices.filter(p => p.inStock)
  const bestPrice = inStockPrices.length > 0
    ? inStockPrices.sort((a, b) => {
        const aPrice = typeof a.price === 'number' ? a.price : parseFloat(a.price.toString())
        const bPrice = typeof b.price === 'number' ? b.price : parseFloat(b.price.toString())
        return aPrice - bPrice
      })[0]
    : null

  const shippingCost = bestPrice?.shippingCost
    ? (typeof bestPrice.shippingCost === 'number'
        ? bestPrice.shippingCost
        : parseFloat(bestPrice.shippingCost.toString()))
    : null

  return {
    ...publicSignal,
    _internal: {
      retailerConfidenceHint: bestPrice
        ? getRetailerConfidenceHint(bestPrice.retailer?.tier)
        : 'unknown',
      brandDataCompletenessHint: getBrandDataCompletenessHint(product.brand),
      shippingCost
    }
  }
}

/**
 * Batch calculate price signal indices for multiple products
 */
export async function batchCalculatePriceSignalIndex(
  products: ProductForSignal[]
): Promise<Map<string, PriceSignalIndex>> {
  const signals = new Map<string, PriceSignalIndex>()

  // Process in parallel with limited concurrency
  const BATCH_SIZE = 10
  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE)
    const batchSignals = await Promise.all(
      batch.map(p => calculatePriceSignalIndex(p))
    )
    batch.forEach((product, index) => {
      signals.set(product.id, batchSignals[index])
    })
  }

  return signals
}

/**
 * Clear the price statistics cache
 */
export function clearPriceStatsCache(): void {
  priceStatsCache.clear()
}

/**
 * Pre-warm the cache for common calibers
 */
export async function warmPriceStatsCache(): Promise<void> {
  const commonCalibers = [
    '9mm', '.223', '5.56', '.308', '.45 ACP',
    '.40 S&W', '.380', '12 Gauge', '.22 LR'
  ]

  await Promise.all(commonCalibers.map(cal => getCaliberPriceStats(cal)))
}
