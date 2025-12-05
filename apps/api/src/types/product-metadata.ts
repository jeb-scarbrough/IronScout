/**
 * Product Metadata Types
 * 
 * These types work alongside the structured Prisma schema fields.
 * Use the JSON metadata field for:
 * - Data that changes frequently or varies by source
 * - Computed/cached values
 * - Future extensibility without migrations
 * 
 * Structured schema fields handle:
 * - bulletType, pressureRating, isSubsonic, muzzleVelocityFps
 * - shortBarrelOptimized, suppressorSafe, lowFlash, etc.
 */

// Re-export enum types from Prisma for convenience
export type BulletType = 
  | 'JHP' | 'HP' | 'BJHP' | 'XTP' | 'HST' | 'GDHP' | 'VMAX'
  | 'FMJ' | 'TMJ' | 'CMJ' | 'MC' | 'BALL'
  | 'SP' | 'JSP' | 'PSP' | 'RN' | 'FPRN'
  | 'FRANGIBLE' | 'AP' | 'TRACER' | 'BLANK' | 'WADCUTTER' | 'SWC' | 'LSWC'
  | 'BUCKSHOT' | 'BIRDSHOT' | 'SLUG'
  | 'OTHER'

export type PressureRating = 'STANDARD' | 'PLUS_P' | 'PLUS_P_PLUS' | 'NATO' | 'UNKNOWN'

export type DataSource = 'MANUFACTURER' | 'RETAILER_FEED' | 'PARSED' | 'MANUAL' | 'AI_INFERRED' | 'UNKNOWN'

/**
 * Terminal performance data (stored in metadata JSON)
 * This data varies significantly by test conditions and isn't always available
 */
export interface TerminalPerformance {
  // FBI gel test results
  penetrationDepthIn?: number      // Penetration in calibrated gel (inches)
  expansionDiameterIn?: number     // Expanded diameter (inches)
  weightRetentionPercent?: number  // % of original weight retained
  
  // Velocity thresholds
  minExpansionVelocityFps?: number // Minimum velocity for reliable expansion
  
  // Test conditions
  testBarrelLengthIn?: number      // Barrel used for testing
  testMedium?: string              // e.g., "10% FBI gel", "Clear Ballistics"
  
  // Source of data
  dataSource?: string              // e.g., "Manufacturer", "Lucky Gunner", "ShootingTheBull410"
}

/**
 * Brand/manufacturer quality indicators
 */
export interface BrandQuality {
  // Quality tier (can be used for ranking)
  tier?: 'budget' | 'mid-tier' | 'premium' | 'match-grade'
  
  // Consistency rating based on reviews/tests
  consistencyRating?: 'excellent' | 'good' | 'fair' | 'variable'
  
  // Country of manufacture
  manufacturerCountry?: string
  
  // Parent company (for brand grouping)
  parentCompany?: string
}

/**
 * Computed scores (cached, updated periodically)
 */
export interface ComputedScores {
  // Best Value Score (0-100) - Premium feature
  bestValueScore?: number
  bestValueFactors?: {
    priceVsCaliberAvg: number     // How price compares to caliber average
    shippingValue: number          // Shipping cost impact
    retailerTrust: number          // Retailer tier score
    brandQuality: number           // Brand tier score
    purposeFit: number             // How well it fits common purposes
  }
  bestValueReason?: string         // Human-readable explanation
  
  // Purpose match scores (0-100) for each purpose
  purposeScores?: {
    defense?: number
    target?: number
    hunting?: number
    competition?: number
    training?: number
  }
  
  // Last computed timestamp
  scoresComputedAt?: string        // ISO date string
}

/**
 * Price analytics (cached)
 */
export interface PriceAnalytics {
  // Historical price data
  avgPrice30d?: number             // 30-day average CPR
  minPrice30d?: number             // 30-day minimum CPR
  maxPrice30d?: number             // 30-day maximum CPR
  priceVolatility?: number         // Standard deviation
  
  // Trend indicators
  priceTrend?: 'rising' | 'falling' | 'stable'
  daysSinceLastDrop?: number
  
  // Prediction (Premium feature)
  predictedDirection?: 'up' | 'down' | 'stable'
  predictionConfidence?: number    // 0-1
  predictionReason?: string
  
  // Last updated
  analyticsUpdatedAt?: string      // ISO date string
}

/**
 * Source tracking for data provenance
 */
export interface SourceInfo {
  // Where this product data came from
  originalSourceId?: string        // Source ID from sources table
  affiliateNetwork?: string        // Which affiliate network
  feedProductId?: string           // Product ID in the original feed
  
  // Data extraction info
  parsedFields?: string[]          // Which fields were parsed from name
  parsingConfidence?: number       // 0-1 confidence in parsing
  
  // Last sync
  lastSyncedAt?: string            // ISO date string
}

/**
 * Complete metadata structure for Product.metadata JSON field
 */
export interface ProductMetadata {
  // Terminal performance (gel test data, etc.)
  terminal?: TerminalPerformance
  
  // Brand quality indicators
  brandQuality?: BrandQuality
  
  // Cached computed scores
  scores?: ComputedScores
  
  // Price analytics
  priceAnalytics?: PriceAnalytics
  
  // Data source tracking
  source?: SourceInfo
  
  // Allow additional fields without type errors
  [key: string]: unknown
}

/**
 * Helper to safely parse product metadata
 */
export function parseProductMetadata(metadata: unknown): ProductMetadata {
  if (!metadata || typeof metadata !== 'object') {
    return {}
  }
  return metadata as ProductMetadata
}

/**
 * Helper to get a nested metadata value safely
 */
export function getMetadataValue<T>(
  metadata: unknown, 
  path: string, 
  defaultValue: T
): T {
  const parsed = parseProductMetadata(metadata)
  const keys = path.split('.')
  let current: unknown = parsed
  
  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = (current as Record<string, unknown>)[key]
    } else {
      return defaultValue
    }
  }
  
  return (current as T) ?? defaultValue
}

/**
 * Performance badges to show on product cards (Premium only)
 * Generated from both schema fields AND metadata
 */
export type PerformanceBadge = 
  | 'short-barrel-optimized'
  | 'suppressor-safe'
  | 'low-flash'
  | 'low-recoil'
  | 'match-grade'
  | 'subsonic'
  | '+P'
  | '+P+'
  | 'nato-spec'
  | 'controlled-expansion'
  | 'high-expansion'
  | 'bonded'
  | 'barrier-blind'
  | 'frangible'
  | 'lead-free'

/**
 * Extract performance badges from product (schema fields + metadata)
 */
export function extractPerformanceBadges(product: {
  pressureRating?: PressureRating | null
  isSubsonic?: boolean | null
  shortBarrelOptimized?: boolean | null
  suppressorSafe?: boolean | null
  lowFlash?: boolean | null
  lowRecoil?: boolean | null
  matchGrade?: boolean | null
  controlledExpansion?: boolean | null
  bulletType?: BulletType | null
  metadata?: unknown
}): PerformanceBadge[] {
  const badges: PerformanceBadge[] = []
  
  // From schema fields
  if (product.pressureRating === 'PLUS_P') badges.push('+P')
  if (product.pressureRating === 'PLUS_P_PLUS') badges.push('+P+')
  if (product.pressureRating === 'NATO') badges.push('nato-spec')
  if (product.isSubsonic) badges.push('subsonic')
  if (product.shortBarrelOptimized) badges.push('short-barrel-optimized')
  if (product.suppressorSafe) badges.push('suppressor-safe')
  if (product.lowFlash) badges.push('low-flash')
  if (product.lowRecoil) badges.push('low-recoil')
  if (product.matchGrade) badges.push('match-grade')
  if (product.controlledExpansion) badges.push('controlled-expansion')
  
  // From bullet type
  if (product.bulletType === 'BJHP') badges.push('bonded', 'barrier-blind')
  if (product.bulletType === 'FRANGIBLE') badges.push('frangible')
  
  // From metadata
  const meta = parseProductMetadata(product.metadata)
  if (meta.terminal?.expansionDiameterIn && meta.terminal.expansionDiameterIn > 0.6) {
    badges.push('high-expansion')
  }
  
  return [...new Set(badges)] // Remove duplicates
}

/**
 * Bullet type categories for filtering/grouping
 */
export const BULLET_TYPE_CATEGORIES = {
  defensive: ['JHP', 'HP', 'BJHP', 'XTP', 'HST', 'GDHP'] as BulletType[],
  training: ['FMJ', 'TMJ', 'CMJ', 'MC', 'BALL'] as BulletType[],
  hunting: ['SP', 'JSP', 'PSP', 'VMAX'] as BulletType[],
  specialty: ['FRANGIBLE', 'AP', 'TRACER', 'WADCUTTER', 'SWC'] as BulletType[],
  shotgun: ['BUCKSHOT', 'BIRDSHOT', 'SLUG'] as BulletType[],
}

/**
 * Human-readable bullet type names
 */
export const BULLET_TYPE_LABELS: Record<BulletType, string> = {
  JHP: 'Jacketed Hollow Point',
  HP: 'Hollow Point',
  BJHP: 'Bonded JHP',
  XTP: 'XTP (Hornady)',
  HST: 'HST (Federal)',
  GDHP: 'Gold Dot HP',
  VMAX: 'V-Max',
  FMJ: 'Full Metal Jacket',
  TMJ: 'Total Metal Jacket',
  CMJ: 'Complete Metal Jacket',
  MC: 'Metal Case',
  BALL: 'Ball',
  SP: 'Soft Point',
  JSP: 'Jacketed Soft Point',
  PSP: 'Pointed Soft Point',
  RN: 'Round Nose',
  FPRN: 'Flat Point RN',
  FRANGIBLE: 'Frangible',
  AP: 'Armor Piercing',
  TRACER: 'Tracer',
  BLANK: 'Blank',
  WADCUTTER: 'Wadcutter',
  SWC: 'Semi-Wadcutter',
  LSWC: 'Lead SWC',
  BUCKSHOT: 'Buckshot',
  BIRDSHOT: 'Birdshot',
  SLUG: 'Slug',
  OTHER: 'Other',
}

/**
 * Pressure rating labels
 */
export const PRESSURE_RATING_LABELS: Record<PressureRating, string> = {
  STANDARD: 'Standard',
  PLUS_P: '+P',
  PLUS_P_PLUS: '+P+',
  NATO: 'NATO Spec',
  UNKNOWN: 'Unknown',
}
