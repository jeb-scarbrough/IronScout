/**
 * Price Check Service
 *
 * Spec reference: mobile_price_check_v1_spec.md (deferred to v1.1).
 * This service implements current v1 behavior. Internal analytics (user-linked) are handled elsewhere.
 * - Answers: "Is this price normal, high, or unusually low right now?"
 * - Classification requires ≥5 price points in trailing 30 days
 * - No verdicts or recommendations
 */

import { prisma, getCaliberAliases, buildCaliberPriceCheckStatsQuery, type CaliberValue } from '@ironscout/db'
import { CANONICAL_CALIBERS, isValidCaliber } from './gun-locker'

/**
 * Price classification
 */
export type PriceClassification = 'LOWER' | 'TYPICAL' | 'HIGHER' | 'INSUFFICIENT_DATA'

/**
 * Price Check result
 */
export interface PriceCheckResult {
  classification: PriceClassification
  enteredPricePerRound: number
  caliber: CaliberValue
  context: {
    minPrice: number | null
    maxPrice: number | null
    medianPrice: number | null
    pricePointCount: number
    daysWithData: number
  }
  freshnessIndicator: string
  message: string
}

/**
 * Check a price against recent market data
 *
 * @param caliber - Canonical caliber value
 * @param pricePerRound - Entered price per round in cents (e.g., 0.30 = $0.30/rd)
 * @param brand - Optional brand filter
 * @param grain - Optional grain weight filter
 * @param roundCount - Optional round count filter
 * @param caseMaterial - Optional case material filter
 * @param bulletType - Optional bullet type filter
 */
export async function checkPrice(
  caliber: string,
  pricePerRound: number,
  brand?: string,
  grain?: number,
  roundCount?: number,
  caseMaterial?: string,
  bulletType?: string
): Promise<PriceCheckResult> {
  // Validate caliber is canonical
  if (!isValidCaliber(caliber)) {
    throw new Error(`Invalid caliber: ${caliber}. Must be one of: ${CANONICAL_CALIBERS.join(', ')}`)
  }

  const now = new Date()
  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  // Normalize caliber for database query (handle aliases, all lowercased)
  const caliberAliases = getCaliberAliases(caliber as CaliberValue)

  // Prepare optional filter values (null = no filter applied)
  const brandPattern = brand ? `%${brand.toLowerCase()}%` : null
  const grainValue = grain ?? null
  const roundCountValue = roundCount ?? null
  const caseMaterialPattern = caseMaterial ? `%${caseMaterial.toLowerCase()}%` : null
  const bulletTypeValue = bulletType ?? null

  // Use shared canonical query builder (ADR-024/ADR-025) for daily-best stats.
  const stats = await prisma.$queryRaw<
    Array<{
      medianPrice: any
      minPrice: any
      maxPrice: any
      p25: any
      p75: any
      pricePointCount: number
      daysWithData: number
    }>
  >(buildCaliberPriceCheckStatsQuery({
    caliberAliases,
    windowStart: thirtyDaysAgo,
    windowEnd: now,
    brandPattern,
    grainValue,
    roundCountValue,
    caseMaterialPattern,
    bulletTypeValue,
  }))

  const row = stats[0]
  const pricePointCount = row?.pricePointCount ?? 0
  const daysWithData = row?.daysWithData ?? 0

  // Handle sparse/no data per spec
  if (pricePointCount === 0) {
    return {
      classification: 'INSUFFICIENT_DATA',
      enteredPricePerRound: pricePerRound,
      caliber: caliber as CaliberValue,
      context: {
        minPrice: null,
        maxPrice: null,
        medianPrice: null,
        pricePointCount: 0,
        daysWithData: 0,
      },
      freshnessIndicator: '',
      message: `No recent data for ${getCaliberLabel(caliber)}.`,
    }
  }

  // All statistics computed via SQL PERCENTILE_CONT (ADR-024: canonical median)
  const minPrice = parseFloat(row.minPrice.toString())
  const maxPrice = parseFloat(row.maxPrice.toString())
  const medianPrice = parseFloat(row.medianPrice.toString())

  // Per spec: Classification requires ≥5 price points
  if (pricePointCount < 5) {
    return {
      classification: 'INSUFFICIENT_DATA',
      enteredPricePerRound: pricePerRound,
      caliber: caliber as CaliberValue,
      context: {
        minPrice: round(minPrice, 4),
        maxPrice: round(maxPrice, 4),
        medianPrice: round(medianPrice, 4),
        pricePointCount,
        daysWithData,
      },
      freshnessIndicator: `Based on prices from the last ${daysWithData} days`,
      message: `Limited data. Recent range: $${formatPrice(minPrice)}–$${formatPrice(maxPrice)}/rd.`,
    }
  }

  // Classify price relative to SQL-computed percentiles (ADR-024)
  const p25 = parseFloat(row.p25.toString())
  const p75 = parseFloat(row.p75.toString())

  let classification: PriceClassification
  let message: string

  if (pricePerRound <= p25) {
    classification = 'LOWER'
    message = 'Lower than usual'
  } else if (pricePerRound >= p75) {
    classification = 'HIGHER'
    message = 'Higher than usual'
  } else {
    classification = 'TYPICAL'
    message = 'Typical range'
  }

  return {
    classification,
    enteredPricePerRound: pricePerRound,
    caliber: caliber as CaliberValue,
    context: {
      minPrice: round(minPrice, 4),
      maxPrice: round(maxPrice, 4),
      medianPrice: round(medianPrice, 4),
      pricePointCount,
      daysWithData,
    },
    freshnessIndicator: `Based on prices from the last ${daysWithData} days`,
    message,
  }
}

// getCaliberAliases is now imported from @ironscout/db (ADR-025)

/**
 * Get human-readable caliber label
 */
function getCaliberLabel(caliber: string): string {
  const labels: Record<CaliberValue, string> = {
    '9mm': '9mm',
    '.38 Special': '.38 Special',
    '.357 Magnum': '.357 Magnum',
    '.25 ACP': '.25 ACP',
    '.32 ACP': '.32 ACP',
    '10mm Auto': '10mm Auto',
    '.45 ACP': '.45 ACP',
    '.45 Colt': '.45 Colt',
    '.40 S&W': '.40 S&W',
    '.380 ACP': '.380 ACP',
    '.22 LR': '.22 LR',
    '.22 WMR': '.22 WMR',
    '.17 HMR': '.17 HMR',
    '.223/5.56': '.223 / 5.56',
    '.308/7.62x51': '.308 / 7.62x51',
    '.30-06': '.30-06',
    '.300 AAC Blackout': '.300 Blackout',
    '6.5 Creedmoor': '6.5 Creedmoor',
    '7.62x39': '7.62x39',
    '.243 Winchester': '.243 Winchester',
    '.270 Winchester': '.270 Winchester',
    '.30-30 Winchester': '.30-30 Winchester',
    '12ga': '12 Gauge',
    '20ga': '20 Gauge',
    '16ga': '16 Gauge',
    '.410 Bore': '.410 Bore',
    'Other': 'Other',
  }
  return labels[caliber as CaliberValue] || caliber
}

function round(value: number, decimals: number): number {
  const multiplier = Math.pow(10, decimals)
  return Math.round(value * multiplier) / multiplier
}

function formatPrice(price: number): string {
  return price.toFixed(2)
}

// Consumer-facing PriceCheckEvent telemetry (aggregation pipeline) is deferred
// to v1.1 per mobile_price_check_v1_spec.md. Internal analytics are handled by
// price_check_query_logs via query-analytics.ts.
