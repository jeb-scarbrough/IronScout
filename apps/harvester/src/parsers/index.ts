// Base parser interface for affiliate feeds

/**
 * Core parsed product fields - common across all affiliate networks
 */
export interface ParsedProduct {
  // Required fields
  retailer: string
  name: string
  price: number
  inStock: boolean
  url: string

  // Common optional fields
  upc?: string
  sku?: string
  category?: string
  brand?: string
  imageUrl?: string
  description?: string

  // Extended fields (Impact Product Catalog compatible)
  /** Unique product ID from the affiliate network */
  catalogItemId?: string
  /** Mobile-specific URL */
  mobileUrl?: string
  /** Original/MSRP price before discount */
  originalPrice?: number
  /** Discount percentage (0-100) */
  discountPercentage?: number
  /** Price type: REGULAR, SALE, or CLEARANCE */
  priceType?: 'REGULAR' | 'SALE' | 'CLEARANCE'
  /** Sale start date (ISO-8601, informational only) */
  saleStartsAt?: string
  /** Sale end date (ISO-8601, informational only) */
  saleEndsAt?: string
  /** ISO-4217 currency code (e.g., USD) */
  currency?: string
  /** Raw stock availability text */
  stockAvailabilityText?: string
  /** Product condition (new, used, refurbished) */
  condition?: string
  /** Bullet points / key features */
  bullets?: string
  /** Tag keywords / labels */
  labels?: string
  /** Gender demographic */
  gender?: string
  /** Age group target */
  ageGroup?: string
  /** Color attributes */
  colors?: string
  /** Material attributes */
  material?: string
  /** Pattern/style */
  pattern?: string
  /** Size/variant dimension */
  size?: string
  /** Physical weight */
  weight?: string

  /** Raw data preserved for debugging/auditing */
  rawData?: Record<string, unknown>
}

export interface FeedParser {
  parse(content: string): Promise<ParsedProduct[]>
}

export { ImpactParser } from './impact'
export { AvantLinkParser } from './avantlink'
export { ShareASaleParser } from './shareasale'
