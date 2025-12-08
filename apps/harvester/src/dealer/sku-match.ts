/**
 * Dealer SKU Matching Worker
 * 
 * Matches dealer SKUs to canonical SKUs using:
 * 1. UPC exact match (HIGH confidence)
 * 2. Attribute matching - caliber + grain + brand + pack size (MEDIUM confidence)
 * 3. Fuzzy matching with AI hints (LOW confidence, flagged for review)
 */

import { Worker, Job } from 'bullmq'
import { prisma } from '@ironscout/db'
import { redisConnection } from '../config/redis'
import { QUEUE_NAMES, DealerSkuMatchJobData } from '../config/queues'
import {
  extractCaliber,
  extractGrainWeight,
  extractCaseMaterial,
  classifyPurpose,
  extractRoundCount,
} from '../normalizer/ammo-utils'

// ============================================================================
// TYPES
// ============================================================================

interface ParsedAttributes {
  caliber: string | null
  grain: number | null
  packSize: number | null
  bulletType: string | null
  brand: string | null
  caseMaterial: string | null
  purpose: string | null
}

interface MatchResult {
  canonicalSkuId: string | null
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE'
  needsReview: boolean
}

// ============================================================================
// ATTRIBUTE PARSING
// ============================================================================

function parseAttributes(sku: {
  rawTitle: string
  rawCaliber?: string | null
  rawGrain?: string | null
  rawBulletType?: string | null
  rawBrand?: string | null
  rawCase?: string | null
  rawPackSize?: number | null
}): ParsedAttributes {
  // Use raw values if provided, otherwise parse from title
  const caliber = sku.rawCaliber || extractCaliber(sku.rawTitle)
  
  // Parse grain from raw value or title
  let grain: number | null = null
  if (sku.rawGrain) {
    grain = parseInt(String(sku.rawGrain), 10)
    if (isNaN(grain)) grain = null
  }
  if (!grain) {
    grain = extractGrainWeight(sku.rawTitle)
  }
  
  // Pack size
  let packSize = sku.rawPackSize || null
  if (!packSize) {
    packSize = extractRoundCount(sku.rawTitle)
  }
  
  // Bullet type - try raw value first, then parse
  const bulletType = sku.rawBulletType || extractBulletType(sku.rawTitle)
  
  // Brand - clean up if provided
  const brand = sku.rawBrand ? normalizeBrand(sku.rawBrand) : extractBrand(sku.rawTitle)
  
  // Case material
  const caseMaterial = sku.rawCase || extractCaseMaterial(sku.rawTitle)
  
  // Purpose
  const purpose = classifyPurpose(sku.rawTitle)
  
  return {
    caliber,
    grain,
    packSize,
    bulletType,
    brand,
    caseMaterial,
    purpose,
  }
}

// ============================================================================
// BULLET TYPE EXTRACTION
// ============================================================================

const BULLET_TYPE_PATTERNS: Array<{ pattern: RegExp; type: string }> = [
  { pattern: /\bfmj\b/i, type: 'FMJ' },
  { pattern: /\bjhp\b/i, type: 'JHP' },
  { pattern: /\bhp\b/i, type: 'HP' },
  { pattern: /\bhst\b/i, type: 'HST' },
  { pattern: /\bgold\s?dot\b/i, type: 'GDHP' },
  { pattern: /\bv-?max\b/i, type: 'VMAX' },
  { pattern: /\bsp\b/i, type: 'SP' },
  { pattern: /\bjsp\b/i, type: 'JSP' },
  { pattern: /\btmj\b/i, type: 'TMJ' },
  { pattern: /\bwadcutter\b/i, type: 'WADCUTTER' },
  { pattern: /\bswc\b/i, type: 'SWC' },
  { pattern: /\bfrangible\b/i, type: 'FRANGIBLE' },
  { pattern: /\bballistic\s?tip\b/i, type: 'BALLISTIC_TIP' },
  { pattern: /\bsoft\s?point\b/i, type: 'SP' },
  { pattern: /\bhollow\s?point\b/i, type: 'HP' },
  { pattern: /\bfull\s?metal\s?jacket\b/i, type: 'FMJ' },
]

function extractBulletType(title: string): string | null {
  for (const { pattern, type } of BULLET_TYPE_PATTERNS) {
    if (pattern.test(title)) {
      return type
    }
  }
  return null
}

// ============================================================================
// BRAND EXTRACTION & NORMALIZATION
// ============================================================================

const KNOWN_BRANDS: Array<{ pattern: RegExp; normalized: string }> = [
  { pattern: /\bfederal\b/i, normalized: 'Federal' },
  { pattern: /\bhornady\b/i, normalized: 'Hornady' },
  { pattern: /\bremington\b/i, normalized: 'Remington' },
  { pattern: /\bwinchester\b/i, normalized: 'Winchester' },
  { pattern: /\bspeer\b/i, normalized: 'Speer' },
  { pattern: /\bfiocchi\b/i, normalized: 'Fiocchi' },
  { pattern: /\bsellier.*bellot|s&b\b/i, normalized: 'Sellier & Bellot' },
  { pattern: /\bpmc\b/i, normalized: 'PMC' },
  { pattern: /\bmagtech\b/i, normalized: 'Magtech' },
  { pattern: /\baguila\b/i, normalized: 'Aguila' },
  { pattern: /\bcci\b/i, normalized: 'CCI' },
  { pattern: /\bamerican\s?eagle\b/i, normalized: 'American Eagle' },
  { pattern: /\bblazer\b/i, normalized: 'Blazer' },
  { pattern: /\btulaammo|tula\b/i, normalized: 'TulAmmo' },
  { pattern: /\bwolf\b/i, normalized: 'Wolf' },
  { pattern: /\bbarnaul\b/i, normalized: 'Barnaul' },
  { pattern: /\bnorma\b/i, normalized: 'Norma' },
  { pattern: /\bgeco\b/i, normalized: 'GECO' },
  { pattern: /\bprvi\s?partizan|ppu\b/i, normalized: 'Prvi Partizan' },
  { pattern: /\bsig\s?sauer|sig\b/i, normalized: 'SIG Sauer' },
  { pattern: /\bunderwood\b/i, normalized: 'Underwood' },
  { pattern: /\bbuffalo\s?bore\b/i, normalized: 'Buffalo Bore' },
  { pattern: /\bnosler\b/i, normalized: 'Nosler' },
  { pattern: /\bbarnes\b/i, normalized: 'Barnes' },
]

function normalizeBrand(brand: string): string {
  const cleaned = brand.trim()
  
  for (const { pattern, normalized } of KNOWN_BRANDS) {
    if (pattern.test(cleaned)) {
      return normalized
    }
  }
  
  // Title case the brand if not recognized
  return cleaned.split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

function extractBrand(title: string): string | null {
  for (const { pattern, normalized } of KNOWN_BRANDS) {
    if (pattern.test(title)) {
      return normalized
    }
  }
  return null
}

// ============================================================================
// MATCHING LOGIC
// ============================================================================

async function matchByUPC(upc: string): Promise<MatchResult> {
  const canonical = await prisma.canonicalSku.findUnique({
    where: { upc },
  })
  
  if (canonical) {
    return {
      canonicalSkuId: canonical.id,
      confidence: 'HIGH',
      needsReview: false,
    }
  }
  
  return { canonicalSkuId: null, confidence: 'NONE', needsReview: false }
}

async function matchByAttributes(attrs: ParsedAttributes): Promise<MatchResult> {
  // Need at minimum caliber and brand for matching
  if (!attrs.caliber || !attrs.brand) {
    return { canonicalSkuId: null, confidence: 'NONE', needsReview: true }
  }
  
  // Build query
  const where: any = {
    caliber: attrs.caliber,
    brand: attrs.brand,
  }
  
  if (attrs.grain) {
    where.grain = attrs.grain
  }
  
  if (attrs.packSize) {
    where.packSize = attrs.packSize
  }
  
  const matches = await prisma.canonicalSku.findMany({
    where,
    take: 5,
  })
  
  if (matches.length === 1) {
    // Exact single match
    return {
      canonicalSkuId: matches[0].id,
      confidence: attrs.grain && attrs.packSize ? 'MEDIUM' : 'LOW',
      needsReview: !attrs.grain || !attrs.packSize,
    }
  }
  
  if (matches.length > 1) {
    // Multiple matches - try to narrow down
    const exactMatch = matches.find(m => 
      m.grain === attrs.grain && 
      m.packSize === attrs.packSize &&
      m.bulletType === attrs.bulletType
    )
    
    if (exactMatch) {
      return {
        canonicalSkuId: exactMatch.id,
        confidence: 'MEDIUM',
        needsReview: false,
      }
    }
    
    // Flag for review if multiple ambiguous matches
    return {
      canonicalSkuId: null,
      confidence: 'LOW',
      needsReview: true,
    }
  }
  
  // No match found
  return { canonicalSkuId: null, confidence: 'NONE', needsReview: true }
}

async function findOrCreateCanonical(
  attrs: ParsedAttributes,
  upc?: string
): Promise<MatchResult> {
  // Need minimum attributes to create a canonical SKU
  if (!attrs.caliber || !attrs.brand || !attrs.grain || !attrs.packSize) {
    return { canonicalSkuId: null, confidence: 'NONE', needsReview: true }
  }
  
  // Create canonical SKU name
  const name = [
    attrs.brand,
    attrs.caliber,
    `${attrs.grain}gr`,
    attrs.bulletType || '',
    `${attrs.packSize}rd`,
  ].filter(Boolean).join(' ')
  
  const canonical = await prisma.canonicalSku.create({
    data: {
      upc: upc || null,
      caliber: attrs.caliber,
      grain: attrs.grain,
      caseType: attrs.caseMaterial,
      bulletType: attrs.bulletType,
      brand: attrs.brand,
      packSize: attrs.packSize,
      name,
    },
  })
  
  return {
    canonicalSkuId: canonical.id,
    confidence: upc ? 'HIGH' : 'MEDIUM',
    needsReview: false,
  }
}

// ============================================================================
// WORKER
// ============================================================================

async function processSkuMatch(job: Job<DealerSkuMatchJobData>) {
  const { dealerId, feedRunId, dealerSkuIds } = job.data
  
  let matchedCount = 0
  let createdCount = 0
  let reviewCount = 0
  
  console.log(`[SKU Match] Processing ${dealerSkuIds.length} SKUs for dealer ${dealerId}`)
  
  for (const skuId of dealerSkuIds) {
    try {
      const sku = await prisma.dealerSku.findUnique({
        where: { id: skuId },
      })
      
      if (!sku) continue
      
      // Parse attributes
      const attrs = parseAttributes(sku)
      
      // Update parsed attributes on the SKU
      await prisma.dealerSku.update({
        where: { id: skuId },
        data: {
          parsedCaliber: attrs.caliber,
          parsedGrain: attrs.grain,
          parsedPackSize: attrs.packSize,
          parsedBulletType: attrs.bulletType,
          parsedBrand: attrs.brand,
        },
      })
      
      // Try matching strategies in order
      let result: MatchResult = { canonicalSkuId: null, confidence: 'NONE', needsReview: true }
      
      // 1. Try UPC match first
      if (sku.rawUpc) {
        result = await matchByUPC(sku.rawUpc)
      }
      
      // 2. Try attribute match
      if (!result.canonicalSkuId) {
        result = await matchByAttributes(attrs)
      }
      
      // 3. Create new canonical if we have enough data and no match
      if (!result.canonicalSkuId && attrs.caliber && attrs.brand && attrs.grain && attrs.packSize) {
        result = await findOrCreateCanonical(attrs, sku.rawUpc || undefined)
        if (result.canonicalSkuId) createdCount++
      }
      
      // Update dealer SKU with match result
      await prisma.dealerSku.update({
        where: { id: skuId },
        data: {
          canonicalSkuId: result.canonicalSkuId,
          mappingConfidence: result.confidence,
          needsReview: result.needsReview,
          mappedAt: result.canonicalSkuId ? new Date() : null,
          mappedBy: result.canonicalSkuId ? 'auto' : null,
        },
      })
      
      if (result.canonicalSkuId) matchedCount++
      if (result.needsReview) reviewCount++
      
    } catch (error) {
      console.error(`[SKU Match] Error processing SKU ${skuId}:`, error)
    }
  }
  
  // Update feed run with match stats
  await prisma.dealerFeedRun.update({
    where: { id: feedRunId },
    data: {
      matchedCount: {
        increment: matchedCount,
      },
    },
  })
  
  console.log(`[SKU Match] Completed: ${matchedCount} matched, ${createdCount} created, ${reviewCount} need review`)
  
  return { matchedCount, createdCount, reviewCount }
}

// ============================================================================
// WORKER EXPORT
// ============================================================================

export const dealerSkuMatchWorker = new Worker(
  QUEUE_NAMES.DEALER_SKU_MATCH,
  processSkuMatch,
  {
    connection: redisConnection,
    concurrency: 10,
  }
)

dealerSkuMatchWorker.on('completed', (job) => {
  console.log(`[SKU Match] Job ${job.id} completed`)
})

dealerSkuMatchWorker.on('failed', (job, error) => {
  console.error(`[SKU Match] Job ${job?.id} failed:`, error)
})
