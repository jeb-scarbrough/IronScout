/**
 * Product Name Parser
 * 
 * Extracts structured ballistic data from product names/descriptions.
 * Used to seed the new schema fields from existing data.
 * 
 * Examples:
 * - "Federal HST 9mm 124gr JHP +P" → bulletType: HST, pressureRating: PLUS_P
 * - "Winchester 9mm 147gr FMJ Subsonic" → bulletType: FMJ, isSubsonic: true
 * - "Hornady Critical Defense 9mm 115gr FTX" → bulletType: JHP (FTX maps to JHP)
 */

import { BulletType, PressureRating, DataSource } from './product-metadata'

export interface ParsedProductData {
  bulletType?: BulletType
  pressureRating?: PressureRating
  isSubsonic?: boolean
  muzzleVelocityFps?: number
  grainWeight?: number
  caliber?: string
  matchGrade?: boolean
  lowFlash?: boolean
  shortBarrelOptimized?: boolean
  dataSource: DataSource
  dataConfidence: number
  parsedFields: string[]
}

// Bullet type patterns (order matters - more specific first)
const BULLET_TYPE_PATTERNS: Array<{ pattern: RegExp; type: BulletType; confidence: number }> = [
  // Premium defensive brands (map to appropriate type)
  { pattern: /\bHST\b/i, type: 'HST', confidence: 0.95 },
  { pattern: /\bGold\s*Dot\b/i, type: 'GDHP', confidence: 0.95 },
  { pattern: /\bXTP\b/i, type: 'XTP', confidence: 0.95 },
  { pattern: /\bV-?Max\b/i, type: 'VMAX', confidence: 0.95 },
  { pattern: /\bFTX\b/i, type: 'JHP', confidence: 0.90 }, // Hornady FTX = JHP variant
  { pattern: /\bFlexLock\b/i, type: 'JHP', confidence: 0.90 }, // Hornady FlexLock = JHP
  
  // Bonded JHP (barrier blind)
  { pattern: /\bBJHP\b/i, type: 'BJHP', confidence: 0.95 },
  { pattern: /\bBonded\s*(JHP|HP)\b/i, type: 'BJHP', confidence: 0.90 },
  { pattern: /\bBarrier\s*Blind\b/i, type: 'BJHP', confidence: 0.85 },
  
  // Hollow points
  { pattern: /\bJHP\b/i, type: 'JHP', confidence: 0.95 },
  { pattern: /\bJacketed\s*Hollow\s*Point\b/i, type: 'JHP', confidence: 0.95 },
  { pattern: /\bHollow\s*Point\b/i, type: 'HP', confidence: 0.90 },
  { pattern: /\bHP\b(?!\+)/i, type: 'HP', confidence: 0.85 }, // HP but not +P
  
  // FMJ variants
  { pattern: /\bTMJ\b/i, type: 'TMJ', confidence: 0.95 },
  { pattern: /\bTotal\s*Metal\s*Jacket\b/i, type: 'TMJ', confidence: 0.95 },
  { pattern: /\bCMJ\b/i, type: 'CMJ', confidence: 0.95 },
  { pattern: /\bFMJ\b/i, type: 'FMJ', confidence: 0.95 },
  { pattern: /\bFull\s*Metal\s*Jacket\b/i, type: 'FMJ', confidence: 0.95 },
  { pattern: /\bMC\b/i, type: 'MC', confidence: 0.80 },
  { pattern: /\bMetal\s*Case\b/i, type: 'MC', confidence: 0.90 },
  { pattern: /\bBall\b/i, type: 'BALL', confidence: 0.75 },
  
  // Soft points
  { pattern: /\bJSP\b/i, type: 'JSP', confidence: 0.95 },
  { pattern: /\bJacketed\s*Soft\s*Point\b/i, type: 'JSP', confidence: 0.95 },
  { pattern: /\bPSP\b/i, type: 'PSP', confidence: 0.95 },
  { pattern: /\bSP\b/i, type: 'SP', confidence: 0.85 },
  { pattern: /\bSoft\s*Point\b/i, type: 'SP', confidence: 0.90 },
  
  // Specialty
  { pattern: /\bFrangible\b/i, type: 'FRANGIBLE', confidence: 0.95 },
  { pattern: /\bWadcutter\b/i, type: 'WADCUTTER', confidence: 0.95 },
  { pattern: /\bSWC\b/i, type: 'SWC', confidence: 0.90 },
  { pattern: /\bSemi[- ]?Wadcutter\b/i, type: 'SWC', confidence: 0.95 },
  { pattern: /\bLSWC\b/i, type: 'LSWC', confidence: 0.95 },
  { pattern: /\bRound\s*Nose\b/i, type: 'RN', confidence: 0.85 },
  { pattern: /\bRN\b/i, type: 'RN', confidence: 0.75 },
  { pattern: /\bFlat\s*Point\b/i, type: 'FPRN', confidence: 0.85 },
  { pattern: /\bTracer\b/i, type: 'TRACER', confidence: 0.95 },
  
  // Shotgun
  { pattern: /\bBuckshot\b/i, type: 'BUCKSHOT', confidence: 0.95 },
  { pattern: /\bBirdshot\b/i, type: 'BIRDSHOT', confidence: 0.95 },
  { pattern: /\bSlug\b/i, type: 'SLUG', confidence: 0.90 },
  { pattern: /\b00\s*Buck\b/i, type: 'BUCKSHOT', confidence: 0.95 },
]

// Pressure rating patterns
const PRESSURE_PATTERNS: Array<{ pattern: RegExp; rating: PressureRating; confidence: number }> = [
  { pattern: /\+P\+/i, rating: 'PLUS_P_PLUS', confidence: 0.98 },
  { pattern: /\+P(?!\+)/i, rating: 'PLUS_P', confidence: 0.98 },
  { pattern: /\bNATO\b/i, rating: 'NATO', confidence: 0.90 },
  { pattern: /\bMil[- ]?Spec\b/i, rating: 'NATO', confidence: 0.80 },
]

// Subsonic patterns
const SUBSONIC_PATTERNS: RegExp[] = [
  /\bSubsonic\b/i,
  /\bSub[- ]?Sonic\b/i,
  /\bSub\b/i, // Sometimes abbreviated
]

// Match grade patterns
const MATCH_PATTERNS: RegExp[] = [
  /\bMatch\b/i,
  /\bMatch[- ]?Grade\b/i,
  /\bCompetition\b/i,
  /\bPrecision\b/i,
  /\bTarget\s*Master\b/i,
]

// Low flash patterns
const LOW_FLASH_PATTERNS: RegExp[] = [
  /\bLow[- ]?Flash\b/i,
  /\bReduced[- ]?Flash\b/i,
  /\bFlash[- ]?Reduced\b/i,
  /\bNite\b/i, // Often indicates low-flash variants
]

// Short barrel patterns
const SHORT_BARREL_PATTERNS: RegExp[] = [
  /\bShort[- ]?Barrel\b/i,
  /\bCompact\b/i,
  /\bMicro\b/i,
  /\bCritical\s*Defense\b/i, // Hornady Critical Defense is short-barrel optimized
  /\bCritical\s*Duty\b/i,    // Hornady Critical Duty
]

// Velocity patterns
const VELOCITY_PATTERN = /(\d{3,4})\s*(?:fps|ft\/s|feet\s*per\s*second)/i

// Grain weight patterns
const GRAIN_PATTERN = /(\d{2,3})\s*(?:gr|grain|grn)/i

/**
 * Parse a product name/description to extract structured data
 */
export function parseProductName(name: string, description?: string): ParsedProductData {
  const text = `${name} ${description || ''}`.toLowerCase()
  const parsedFields: string[] = []
  let totalConfidence = 0
  let fieldCount = 0
  
  const result: ParsedProductData = {
    dataSource: 'PARSED',
    dataConfidence: 0,
    parsedFields: [],
  }
  
  // Extract bullet type
  for (const { pattern, type, confidence } of BULLET_TYPE_PATTERNS) {
    if (pattern.test(text)) {
      result.bulletType = type
      totalConfidence += confidence
      fieldCount++
      parsedFields.push('bulletType')
      break
    }
  }
  
  // Extract pressure rating
  for (const { pattern, rating, confidence } of PRESSURE_PATTERNS) {
    if (pattern.test(text)) {
      result.pressureRating = rating
      totalConfidence += confidence
      fieldCount++
      parsedFields.push('pressureRating')
      break
    }
  }
  
  // Check for subsonic
  for (const pattern of SUBSONIC_PATTERNS) {
    if (pattern.test(text)) {
      result.isSubsonic = true
      totalConfidence += 0.90
      fieldCount++
      parsedFields.push('isSubsonic')
      break
    }
  }
  
  // Check for match grade
  for (const pattern of MATCH_PATTERNS) {
    if (pattern.test(text)) {
      result.matchGrade = true
      totalConfidence += 0.85
      fieldCount++
      parsedFields.push('matchGrade')
      break
    }
  }
  
  // Check for low flash
  for (const pattern of LOW_FLASH_PATTERNS) {
    if (pattern.test(text)) {
      result.lowFlash = true
      totalConfidence += 0.85
      fieldCount++
      parsedFields.push('lowFlash')
      break
    }
  }
  
  // Check for short barrel optimization
  for (const pattern of SHORT_BARREL_PATTERNS) {
    if (pattern.test(text)) {
      result.shortBarrelOptimized = true
      totalConfidence += 0.80
      fieldCount++
      parsedFields.push('shortBarrelOptimized')
      break
    }
  }
  
  // Extract velocity
  const velocityMatch = text.match(VELOCITY_PATTERN)
  if (velocityMatch) {
    const velocity = parseInt(velocityMatch[1], 10)
    if (velocity >= 500 && velocity <= 4000) {
      result.muzzleVelocityFps = velocity
      totalConfidence += 0.90
      fieldCount++
      parsedFields.push('muzzleVelocityFps')
      
      // Infer subsonic from velocity if not explicitly stated
      if (result.isSubsonic === undefined && velocity < 1125) {
        result.isSubsonic = true
        parsedFields.push('isSubsonic (inferred)')
      }
    }
  }
  
  // Extract grain weight
  const grainMatch = text.match(GRAIN_PATTERN)
  if (grainMatch) {
    const grain = parseInt(grainMatch[1], 10)
    if (grain >= 15 && grain <= 700) {
      result.grainWeight = grain
      totalConfidence += 0.95
      fieldCount++
      parsedFields.push('grainWeight')
    }
  }
  
  // Calculate average confidence
  result.dataConfidence = fieldCount > 0 
    ? Math.round((totalConfidence / fieldCount) * 100) / 100 
    : 0
  result.parsedFields = parsedFields
  
  return result
}

/**
 * Batch parse products and return updates
 */
export function batchParseProducts(products: Array<{ id: string; name: string; description?: string | null }>) {
  return products.map(product => ({
    id: product.id,
    ...parseProductName(product.name, product.description || undefined),
  }))
}

/**
 * Determine if a product is likely subsonic based on caliber + grain
 * (When velocity data is not available)
 */
export function inferSubsonicFromGrain(caliber: string, grainWeight: number): boolean | undefined {
  const cal = caliber.toLowerCase()
  
  // 9mm: 147gr+ is typically subsonic
  if (cal.includes('9mm') || cal.includes('9x19')) {
    return grainWeight >= 147
  }
  
  // .45 ACP: 230gr standard is subsonic, lighter loads may not be
  if (cal.includes('.45') || cal.includes('45 acp')) {
    return grainWeight >= 230
  }
  
  // .300 Blackout: 190gr+ is subsonic
  if (cal.includes('300') && cal.includes('blackout')) {
    return grainWeight >= 190
  }
  
  // .22 LR: Look for explicit subsonic marking (can't infer from grain)
  // Most .22 LR is supersonic even at 40gr
  
  return undefined // Can't reliably infer
}
