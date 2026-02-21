/**
 * Price Resolver Utilities
 *
 * Helper functions for accessing prices through the Product Resolver's
 * product_links table. Per Spec v1.2 §0.0, this is the canonical path
 * for price grouping.
 *
 * Per ADR-015: Hot-path queries now read from current_visible_prices
 * derived table instead of evaluating corrections at query time.
 *
 * Query path: products → product_links → source_products → current_visible_prices
 */

import { prisma, Prisma } from '@ironscout/db'
import { getPriceLookbackDays } from '../../config/tiers'

/** Row shape returned by the consolidated JOIN query */
interface PriceJoinRow {
  productId: string
  confidence: string | number // Decimal comes back as string from raw SQL
  id: string
  sourceProductId: string
  retailerId: string
  merchantId: string | null
  sourceId: string | null
  price: string | number // Decimal
  visiblePrice: string | number // Decimal
  currency: string
  url: string
  inStock: boolean
  observedAt: Date
  shippingCost: string | number | null // Decimal
  retailerName: string
  retailerTier: string
  ingestionRunType: string | null
  ingestionRunId: string | null
  recomputedAt: Date
  recomputeJobId: string | null
}

/**
 * Compute the lookback cutoff date for current visible prices.
 * Mirrors currentVisiblePriceWhere() but returns a Date for raw SQL.
 */
function getLookbackCutoff(): Date {
  const lookbackDays = getPriceLookbackDays()
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - lookbackDays)
  return cutoffDate
}

/**
 * Transform a raw JOIN row into the API-compatible price shape.
 */
function transformPriceRow(row: PriceJoinRow) {
  return {
    id: row.id,
    sourceProductId: row.sourceProductId,
    retailerId: row.retailerId,
    merchantId: row.merchantId,
    sourceId: row.sourceId,
    price: row.visiblePrice, // Use corrected price as the visible price
    visiblePrice: row.visiblePrice,
    currency: row.currency,
    url: row.url,
    inStock: row.inStock,
    observedAt: row.observedAt,
    shippingCost: row.shippingCost,
    retailerName: row.retailerName,
    retailerTier: row.retailerTier,
    ingestionRunType: row.ingestionRunType,
    ingestionRunId: row.ingestionRunId,
    recomputedAt: row.recomputedAt,
    recomputeJobId: row.recomputeJobId,
    retailers: {
      id: row.retailerId,
      name: row.retailerName,
      tier: row.retailerTier,
    },
  }
}

/**
 * Get prices for a canonical product through product_links
 *
 * Per ADR-015: Now reads from current_visible_prices derived table
 * instead of evaluating corrections at query time.
 *
 * Query path: product_links JOIN current_visible_prices (single query)
 *
 * @param productId - Canonical product ID
 * @returns Prices with retailer info (denormalized in derived table)
 */
export async function getPricesViaProductLinks(productId: string) {
  const cutoffDate = getLookbackCutoff()

  // Single JOIN query replaces the two-query pattern.
  // product_links.sourceProductId has a UNIQUE constraint, so the JOIN
  // cannot produce duplicated price rows — each CVP row maps to exactly
  // one product_link.
  const rows = await prisma.$queryRaw<PriceJoinRow[]>`
    SELECT
      pl."productId",
      pl.confidence,
      cvp.id, cvp."sourceProductId", cvp."retailerId", cvp."merchantId",
      cvp."sourceId", cvp.price, cvp."visiblePrice", cvp.currency, cvp.url,
      cvp."inStock", cvp."observedAt", cvp."shippingCost",
      cvp."retailerName", cvp."retailerTier",
      cvp."ingestionRunType", cvp."ingestionRunId",
      cvp."recomputedAt", cvp."recomputeJobId"
    FROM product_links pl
    JOIN current_visible_prices cvp
      ON cvp."sourceProductId" = pl."sourceProductId"
    WHERE pl."productId" = ${productId}
      AND pl.status IN ('MATCHED', 'CREATED')
      AND cvp."observedAt" >= ${cutoffDate}
    ORDER BY cvp."retailerTier" DESC, cvp."visiblePrice" ASC
  `

  return rows.map(transformPriceRow)
}

/**
 * Result from batch price resolution including confidence.
 */
export interface BatchPriceResult {
  /** Map of productId → prices */
  pricesMap: Map<string, any[]>
  /** Map of productId → max product_links.confidence (ProductResolver.matchScore) */
  confidenceMap: Map<string, number>
}

/**
 * Get prices for multiple canonical products through product_links
 * Optimized for batch operations
 *
 * @param productIds - Array of canonical product IDs
 * @returns Map of productId → prices
 */
export async function batchGetPricesViaProductLinks(
  productIds: string[]
): Promise<Map<string, any[]>> {
  const result = await batchGetPricesWithConfidence(productIds)
  return result.pricesMap
}

/**
 * Get prices and confidence for multiple canonical products through product_links.
 * Per search-lens-v1.md: canonicalConfidence source = ProductResolver.matchScore
 *
 * Per ADR-015: Now reads from current_visible_prices derived table
 * instead of evaluating corrections at query time.
 *
 * Consolidated into a single JOIN query (P0 optimization). One DB round-trip
 * instead of two. product_links.sourceProductId has a UNIQUE constraint, so the
 * JOIN cannot produce duplicated price rows — each CVP row maps to exactly one
 * product_link. Confidence is tracked as MAX(pl.confidence) per productId during
 * the single result iteration.
 *
 * @param productIds - Array of canonical product IDs
 * @returns Prices and max confidence per product
 */
export async function batchGetPricesWithConfidence(
  productIds: string[]
): Promise<BatchPriceResult> {
  if (productIds.length === 0) {
    return { pricesMap: new Map(), confidenceMap: new Map() }
  }

  const cutoffDate = getLookbackCutoff()

  // Single JOIN query replaces the two-query pattern (product_links + current_visible_prices).
  // Uses safe tagged template (parameterized), not the unsafe raw string variant.
  const rows = await prisma.$queryRaw<PriceJoinRow[]>`
    SELECT
      pl."productId",
      pl.confidence,
      cvp.id, cvp."sourceProductId", cvp."retailerId", cvp."merchantId",
      cvp."sourceId", cvp.price, cvp."visiblePrice", cvp.currency, cvp.url,
      cvp."inStock", cvp."observedAt", cvp."shippingCost",
      cvp."retailerName", cvp."retailerTier",
      cvp."ingestionRunType", cvp."ingestionRunId",
      cvp."recomputedAt", cvp."recomputeJobId"
    FROM product_links pl
    JOIN current_visible_prices cvp
      ON cvp."sourceProductId" = pl."sourceProductId"
    WHERE pl."productId" = ANY(${productIds}::text[])
      AND pl.status IN ('MATCHED', 'CREATED')
      AND cvp."observedAt" >= ${cutoffDate}
    ORDER BY pl."productId", cvp."retailerTier" DESC, cvp."visiblePrice" ASC
  `

  // Single iteration builds both pricesMap and confidenceMap
  const pricesMap = new Map<string, any[]>(productIds.map(id => [id, []]))
  const confidenceMap = new Map<string, number>(productIds.map(id => [id, 0]))

  for (const row of rows) {
    const productId = row.productId
    if (!productId) continue

    // Track max confidence per product (ProductResolver.matchScore)
    const linkConfidence = Number(row.confidence)
    const currentMax = confidenceMap.get(productId) ?? 0
    if (linkConfidence > currentMax) {
      confidenceMap.set(productId, linkConfidence)
    }

    // Transform and group by productId
    pricesMap.get(productId)?.push(transformPriceRow(row))
  }

  return { pricesMap, confidenceMap }
}

/**
 * Search products and get prices via product_links
 *
 * This is the spec-compliant search that JOINs through product_links
 * for price grouping. Use this for new code paths.
 *
 * @param where - Prisma where clause for products
 * @param options - Pagination and field selection options
 * @returns Products with prices resolved through product_links
 */
export async function searchWithResolvedPrices(
  where: Prisma.productsWhereInput,
  options: {
    skip?: number
    take?: number
    select?: Prisma.productsSelect
    includePremiumFields?: boolean
  } = {}
): Promise<any[]> {
  const { skip = 0, take = 20, includePremiumFields = false } = options

  // First, get products
  const products = await prisma.products.findMany({
    where,
    skip,
    take,
    select: options.select || {
      id: true,
      name: true,
      description: true,
      category: true,
      brand: true,
      imageUrl: true,
      upc: true,
      caliber: true,
      grainWeight: true,
      caseMaterial: true,
      purpose: true,
      roundCount: true,
      createdAt: true,
      canonicalKey: true,
      ...(includePremiumFields ? {
        bulletType: true,
        pressureRating: true,
        muzzleVelocityFps: true,
        isSubsonic: true,
        shortBarrelOptimized: true,
        suppressorSafe: true,
        lowFlash: true,
        lowRecoil: true,
        controlledExpansion: true,
        matchGrade: true,
        factoryNew: true,
        dataSource: true,
        dataConfidence: true,
        metadata: true,
      } : {}),
    },
    orderBy: { createdAt: 'desc' },
  })

  if (products.length === 0) {
    return []
  }

  // Batch get prices through product_links
  const productIds = products.map((p: { id: string }) => p.id)
  const pricesMap = await batchGetPricesViaProductLinks(productIds)

  // Merge prices into products
  return products.map((p: { id: string }) => ({
    ...p,
    prices: pricesMap.get(p.id) || [],
  }))
}

/**
 * Check if a product has prices resolved through product_links
 * Useful for determining if a product is using the new resolver path
 *
 * @param productId - Canonical product ID
 * @returns True if product has linked prices
 */
export async function hasResolvedPrices(productId: string): Promise<boolean> {
  // Per Spec v1.2 §0.0: Both MATCHED and CREATED links represent resolved prices
  const count = await prisma.product_links.count({
    where: {
      productId,
      status: { in: ['MATCHED', 'CREATED'] },
    },
  })
  return count > 0
}

/**
 * Get resolver statistics for a product
 * Useful for debugging and admin UI
 *
 * @param productId - Canonical product ID
 * @returns Link stats including match types and confidence
 */
export async function getProductLinkStats(productId: string) {
  const links = await prisma.product_links.findMany({
    where: { productId },
    select: {
      status: true,
      matchType: true,
      confidence: true,
      resolverVersion: true,
      resolvedAt: true,
    },
  })

  return {
    totalLinks: links.length,
    matchedLinks: links.filter(l => l.status === 'MATCHED').length,
    byMatchType: links.reduce((acc, l) => {
      acc[l.matchType] = (acc[l.matchType] || 0) + 1
      return acc
    }, {} as Record<string, number>),
    avgConfidence: links.length > 0
      ? links.reduce((sum, l) => sum + Number(l.confidence), 0) / links.length
      : 0,
    resolverVersions: [...new Set(links.map(l => l.resolverVersion))],
  }
}
