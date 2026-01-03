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
import { visiblePriceWhere } from '../../config/tiers'
type Decimal = Prisma.Decimal

// ============================================================================
// PUBLIC TYPES (Consumer-facing)
// ============================================================================

/**
 * Context band classification based on price position
 * Uses conservative thresholds (30th/70th percentile)
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

/** Percentile thresholds for context bands */
const LOW_THRESHOLD_PERCENTILE = 0.30
const HIGH_THRESHOLD_PERCENTILE = 0.70

// ============================================================================
// CALIBER PRICE CACHE
// ============================================================================

interface CaliberPriceStats {
  median: number
  min: number
  max: number
  p30: number
  p70: number
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
 * Calculate percentile value from sorted array
 */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const index = Math.ceil(p * sorted.length) - 1
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))]
}

/**
 * Get price statistics for a caliber
 */
async function getCaliberPriceStats(caliber: string): Promise<CaliberPriceStats> {
  const cacheKey = caliber.toLowerCase()
  const cached = priceStatsCache.get(cacheKey)

  if (cached && (Date.now() - cached.updatedAt.getTime()) < CACHE_TTL_MS) {
    return cached
  }

  // Calculate from database
  const windowStart = new Date()
  windowStart.setDate(windowStart.getDate() - DEFAULT_WINDOW_DAYS)

  const products = await prisma.products.findMany({
    where: {
      caliber: { contains: caliber, mode: 'insensitive' },
      roundCount: { not: null, gt: 0 },
    },
    select: {
      roundCount: true,
      prices: {
        where: {
          inStock: true,
          createdAt: { gte: windowStart },
          // ADR-015: Filter out prices from ignored runs
          ...visiblePriceWhere(),
        },
        select: { price: true },
        take: 1,
        orderBy: { price: 'asc' }
      }
    },
    take: 500 // Sample size
  })

  const pricesPerRound = products
    .filter((p) => p.prices.length > 0 && p.roundCount)
    .map((p) => calculatePricePerRound(p.prices[0].price, p.roundCount))
    .filter((ppr) => ppr > 0 && ppr < 10) // Filter outliers
    .sort((a, b) => a - b)

  if (pricesPerRound.length < MIN_SAMPLES_FOR_CONTEXT) {
    return {
      median: 0,
      min: 0,
      max: 0,
      p30: 0,
      p70: 0,
      sampleCount: pricesPerRound.length,
      updatedAt: new Date()
    }
  }

  const stats: CaliberPriceStats = {
    median: percentile(pricesPerRound, 0.5),
    min: pricesPerRound[0],
    max: pricesPerRound[pricesPerRound.length - 1],
    p30: percentile(pricesPerRound, LOW_THRESHOLD_PERCENTILE),
    p70: percentile(pricesPerRound, HIGH_THRESHOLD_PERCENTILE),
    sampleCount: pricesPerRound.length,
    updatedAt: new Date()
  }

  // Cache the result
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

  if (positionInRange <= LOW_THRESHOLD_PERCENTILE) {
    return 'LOW'
  } else if (positionInRange >= HIGH_THRESHOLD_PERCENTILE) {
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
        ? getRetailerConfidenceHint(bestPrice.retailer.tier)
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
