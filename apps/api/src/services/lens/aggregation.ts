/**
 * Product Offer Aggregation
 *
 * Aggregates product offers into the Aggregated Product View for lens evaluation.
 * Implements the Search Lens Specification v1.1.0.
 *
 * Aggregation rules:
 * - price: min(offer.price) across visible offers
 * - availability: max(offer.availabilityRank) where IN_STOCK > LOW_STOCK > OUT_OF_STOCK
 * - pricePerRound: derived from aggregated price and canonical packSize
 */

import { AggregatedProduct, Availability, AVAILABILITY_RANK } from './types'

/**
 * A visible offer from a retailer.
 * These come from the prices table via product_links.
 */
export interface VisibleOffer {
  id: string
  price: number  // Decimal stored as number
  currency: string
  inStock: boolean
  availability?: Availability | null
  retailerId: string
  retailerName?: string
}

/**
 * A product with its offers, as returned from search queries.
 */
export interface ProductWithOffers {
  id: string
  name: string
  description?: string | null
  category?: string | null
  brand?: string | null
  imageUrl?: string | null
  upc?: string | null
  caliber?: string | null
  grainWeight?: number | null
  caseMaterial?: string | null
  purpose?: string | null
  roundCount?: number | null
  bulletType?: string | null
  pressureRating?: string | null
  muzzleVelocityFps?: number | null
  isSubsonic?: boolean | null
  dataConfidence?: number | null

  // Offers from product_links
  prices: VisibleOffer[]
}

/**
 * Derive availability from an offer.
 * Maps inStock boolean to Availability enum, with optional explicit availability.
 */
function deriveAvailability(offer: VisibleOffer): Availability {
  // Use explicit availability if provided
  if (offer.availability) {
    return offer.availability
  }
  // Fall back to inStock boolean
  return offer.inStock ? 'IN_STOCK' : 'OUT_OF_STOCK'
}

/**
 * Get the best (highest rank) availability from offers.
 * IN_STOCK > LOW_STOCK > OUT_OF_STOCK
 */
function getBestAvailability(offers: VisibleOffer[]): Availability {
  if (offers.length === 0) {
    return 'OUT_OF_STOCK'
  }

  let bestRank = AVAILABILITY_RANK.OUT_OF_STOCK
  let bestAvailability: Availability = 'OUT_OF_STOCK'

  for (const offer of offers) {
    const avail = deriveAvailability(offer)
    const rank = AVAILABILITY_RANK[avail]
    if (rank > bestRank) {
      bestRank = rank
      bestAvailability = avail
    }
  }

  return bestAvailability
}

/**
 * Get the minimum price from offers.
 * Returns null if no offers.
 */
function getMinPrice(offers: VisibleOffer[]): number | null {
  if (offers.length === 0) {
    return null
  }

  let minPrice = Infinity
  for (const offer of offers) {
    if (typeof offer.price === 'number' && offer.price < minPrice) {
      minPrice = offer.price
    }
  }

  return minPrice === Infinity ? null : minPrice
}

/**
 * Calculate price per round.
 *
 * Derivation per spec:
 * - If price is null → null
 * - If packSize is null or packSize <= 0 → null
 * - Else → round_half_up(price / packSize, 4)
 *
 * @param price - The aggregated price
 * @param packSize - The canonical pack size
 * @returns Price per round with 4 decimal precision, or null
 */
function calculatePricePerRound(price: number | null, packSize: number | null): number | null {
  if (price === null) {
    return null
  }

  if (packSize === null || packSize <= 0) {
    return null
  }

  // Calculate and round to 4 decimal places
  const ppr = price / packSize
  return Math.round(ppr * 10000) / 10000
}

/**
 * Aggregate a product with its offers into an AggregatedProduct.
 *
 * @param product - The product with its visible offers
 * @returns The aggregated product view for lens evaluation
 */
export function aggregateProduct(product: ProductWithOffers): AggregatedProduct {
  const visibleOffers = product.prices || []

  // Aggregate offer-level fields
  const price = getMinPrice(visibleOffers)
  const availability = getBestAvailability(visibleOffers)

  // Derive price per round
  const packSize = product.roundCount ?? null
  const pricePerRound = calculatePricePerRound(price, packSize)

  return {
    // Product-level fields
    productId: product.id,
    bulletType: product.bulletType ?? null,
    grain: product.grainWeight ?? null,
    casing: product.caseMaterial ?? null,
    packSize,
    canonicalConfidence: product.dataConfidence ?? null,

    // Offer-level aggregated fields
    price,
    availability,

    // Derived fields
    pricePerRound,

    // Original data for response
    _originalProduct: product,
    _visibleOfferCount: visibleOffers.length,
  }
}

/**
 * Aggregate multiple products with their offers.
 *
 * @param products - Products with offers
 * @returns Aggregated product views
 */
export function aggregateProducts(products: ProductWithOffers[]): AggregatedProduct[] {
  return products.map(aggregateProduct)
}

/**
 * Check if a product has any visible offers.
 */
export function hasVisibleOffers(product: ProductWithOffers): boolean {
  return product.prices && product.prices.length > 0
}

/**
 * Get offer summary for telemetry.
 * Returns aggregation details for the top N products.
 *
 * @param products - Aggregated products
 * @param topN - Number of products to include
 * @returns Offer summary for each product
 */
export function getOfferSummary(
  products: AggregatedProduct[],
  topN: number = 20
): Array<{
  productId: string
  visibleOfferCount: number
  aggregatedPrice: number | null
  availabilityRank: number
  pricePerRound: number | null
}> {
  return products.slice(0, topN).map(p => ({
    productId: p.productId,
    visibleOfferCount: p._visibleOfferCount,
    aggregatedPrice: p.price,
    availabilityRank: AVAILABILITY_RANK[p.availability],
    pricePerRound: p.pricePerRound,
  }))
}
