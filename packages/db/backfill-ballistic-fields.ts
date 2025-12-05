/**
 * Backfill Ballistic Fields
 * 
 * Parses existing product names to populate the new structured ballistic fields.
 * Run this after applying the add_ballistic_fields.sql migration.
 * 
 * Usage:
 *   npx ts-node backfill-ballistic-fields.ts
 *   
 * Options:
 *   --dry-run    Show what would be updated without making changes
 *   --limit N    Process only N products
 *   --verbose    Show detailed output for each product
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ============================================
// Product Name Parser (inline for standalone script)
// ============================================

type BulletType = 
  | 'JHP' | 'HP' | 'BJHP' | 'XTP' | 'HST' | 'GDHP' | 'VMAX'
  | 'FMJ' | 'TMJ' | 'CMJ' | 'MC' | 'BALL'
  | 'SP' | 'JSP' | 'PSP' | 'RN' | 'FPRN'
  | 'FRANGIBLE' | 'AP' | 'TRACER' | 'BLANK' | 'WADCUTTER' | 'SWC' | 'LSWC'
  | 'BUCKSHOT' | 'BIRDSHOT' | 'SLUG'
  | 'OTHER'

type PressureRating = 'STANDARD' | 'PLUS_P' | 'PLUS_P_PLUS' | 'NATO' | 'UNKNOWN'

interface ParsedData {
  bulletType?: BulletType
  pressureRating?: PressureRating
  isSubsonic?: boolean
  muzzleVelocityFps?: number
  matchGrade?: boolean
  lowFlash?: boolean
  shortBarrelOptimized?: boolean
  dataConfidence: number
  parsedFields: string[]
}

const BULLET_TYPE_PATTERNS: Array<{ pattern: RegExp; type: BulletType }> = [
  { pattern: /\bHST\b/i, type: 'HST' },
  { pattern: /\bGold\s*Dot\b/i, type: 'GDHP' },
  { pattern: /\bXTP\b/i, type: 'XTP' },
  { pattern: /\bV-?Max\b/i, type: 'VMAX' },
  { pattern: /\bFTX\b/i, type: 'JHP' },
  { pattern: /\bFlexLock\b/i, type: 'JHP' },
  { pattern: /\bBJHP\b/i, type: 'BJHP' },
  { pattern: /\bBonded\s*(JHP|HP)\b/i, type: 'BJHP' },
  { pattern: /\bJHP\b/i, type: 'JHP' },
  { pattern: /\bJacketed\s*Hollow\s*Point\b/i, type: 'JHP' },
  { pattern: /\bHollow\s*Point\b/i, type: 'HP' },
  { pattern: /\bHP\b(?!\+)/i, type: 'HP' },
  { pattern: /\bTMJ\b/i, type: 'TMJ' },
  { pattern: /\bCMJ\b/i, type: 'CMJ' },
  { pattern: /\bFMJ\b/i, type: 'FMJ' },
  { pattern: /\bFull\s*Metal\s*Jacket\b/i, type: 'FMJ' },
  { pattern: /\bMC\b/i, type: 'MC' },
  { pattern: /\bBall\b/i, type: 'BALL' },
  { pattern: /\bJSP\b/i, type: 'JSP' },
  { pattern: /\bPSP\b/i, type: 'PSP' },
  { pattern: /\bSP\b/i, type: 'SP' },
  { pattern: /\bSoft\s*Point\b/i, type: 'SP' },
  { pattern: /\bFrangible\b/i, type: 'FRANGIBLE' },
  { pattern: /\bWadcutter\b/i, type: 'WADCUTTER' },
  { pattern: /\bSWC\b/i, type: 'SWC' },
  { pattern: /\bLSWC\b/i, type: 'LSWC' },
  { pattern: /\bBuckshot\b/i, type: 'BUCKSHOT' },
  { pattern: /\bBirdshot\b/i, type: 'BIRDSHOT' },
  { pattern: /\bSlug\b/i, type: 'SLUG' },
  { pattern: /\b00\s*Buck\b/i, type: 'BUCKSHOT' },
]

const PRESSURE_PATTERNS: Array<{ pattern: RegExp; rating: PressureRating }> = [
  { pattern: /\+P\+/i, rating: 'PLUS_P_PLUS' },
  { pattern: /\+P(?!\+)/i, rating: 'PLUS_P' },
  { pattern: /\bNATO\b/i, rating: 'NATO' },
]

function parseProductName(name: string, description?: string): ParsedData {
  const text = `${name} ${description || ''}`.toLowerCase()
  const parsedFields: string[] = []
  
  const result: ParsedData = {
    dataConfidence: 0,
    parsedFields: [],
  }
  
  // Extract bullet type
  for (const { pattern, type } of BULLET_TYPE_PATTERNS) {
    if (pattern.test(text)) {
      result.bulletType = type
      parsedFields.push('bulletType')
      break
    }
  }
  
  // Extract pressure rating
  for (const { pattern, rating } of PRESSURE_PATTERNS) {
    if (pattern.test(text)) {
      result.pressureRating = rating
      parsedFields.push('pressureRating')
      break
    }
  }
  
  // Check for subsonic
  if (/\bSubsonic\b/i.test(text) || /\bSub[- ]?Sonic\b/i.test(text)) {
    result.isSubsonic = true
    parsedFields.push('isSubsonic')
  }
  
  // Check for match grade
  if (/\bMatch\b/i.test(text) || /\bCompetition\b/i.test(text) || /\bPrecision\b/i.test(text)) {
    result.matchGrade = true
    parsedFields.push('matchGrade')
  }
  
  // Check for low flash
  if (/\bLow[- ]?Flash\b/i.test(text) || /\bReduced[- ]?Flash\b/i.test(text)) {
    result.lowFlash = true
    parsedFields.push('lowFlash')
  }
  
  // Check for short barrel
  if (/\bShort[- ]?Barrel\b/i.test(text) || /\bCritical\s*(Defense|Duty)\b/i.test(text)) {
    result.shortBarrelOptimized = true
    parsedFields.push('shortBarrelOptimized')
  }
  
  // Extract velocity
  const velocityMatch = text.match(/(\d{3,4})\s*(?:fps|ft\/s)/i)
  if (velocityMatch) {
    const velocity = parseInt(velocityMatch[1], 10)
    if (velocity >= 500 && velocity <= 4000) {
      result.muzzleVelocityFps = velocity
      parsedFields.push('muzzleVelocityFps')
      
      // Infer subsonic from velocity
      if (result.isSubsonic === undefined && velocity < 1125) {
        result.isSubsonic = true
        parsedFields.push('isSubsonic (inferred)')
      }
    }
  }
  
  result.dataConfidence = parsedFields.length > 0 ? 0.75 : 0
  result.parsedFields = parsedFields
  
  return result
}

// ============================================
// Main Backfill Logic
// ============================================

async function backfillBallisticFields(options: {
  dryRun?: boolean
  limit?: number
  verbose?: boolean
} = {}) {
  const { dryRun = false, limit, verbose = false } = options
  
  console.log('='.repeat(60))
  console.log('Backfill Ballistic Fields')
  console.log('='.repeat(60))
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`)
  if (limit) console.log(`Limit: ${limit} products`)
  console.log('')
  
  // Fetch products that don't have bulletType set yet
  const products = await prisma.product.findMany({
    where: {
      bulletType: null,
    },
    select: {
      id: true,
      name: true,
      description: true,
      caliber: true,
      grainWeight: true,
    },
    take: limit,
  })
  
  console.log(`Found ${products.length} products to process`)
  console.log('')
  
  let updated = 0
  let skipped = 0
  const stats = {
    bulletType: 0,
    pressureRating: 0,
    isSubsonic: 0,
    matchGrade: 0,
    lowFlash: 0,
    shortBarrelOptimized: 0,
    muzzleVelocityFps: 0,
  }
  
  for (const product of products) {
    const parsed = parseProductName(product.name, product.description || undefined)
    
    // Only update if we found something
    if (parsed.parsedFields.length === 0) {
      skipped++
      if (verbose) {
        console.log(`SKIP: ${product.name.substring(0, 60)}... (no data found)`)
      }
      continue
    }
    
    // Build update data
    const updateData: any = {
      dataSource: 'PARSED',
      dataConfidence: parsed.dataConfidence,
    }
    
    if (parsed.bulletType) {
      updateData.bulletType = parsed.bulletType
      stats.bulletType++
    }
    if (parsed.pressureRating) {
      updateData.pressureRating = parsed.pressureRating
      stats.pressureRating++
    }
    if (parsed.isSubsonic !== undefined) {
      updateData.isSubsonic = parsed.isSubsonic
      stats.isSubsonic++
    }
    if (parsed.matchGrade) {
      updateData.matchGrade = parsed.matchGrade
      stats.matchGrade++
    }
    if (parsed.lowFlash) {
      updateData.lowFlash = parsed.lowFlash
      stats.lowFlash++
    }
    if (parsed.shortBarrelOptimized) {
      updateData.shortBarrelOptimized = parsed.shortBarrelOptimized
      stats.shortBarrelOptimized++
    }
    if (parsed.muzzleVelocityFps) {
      updateData.muzzleVelocityFps = parsed.muzzleVelocityFps
      stats.muzzleVelocityFps++
    }
    
    if (verbose) {
      console.log(`UPDATE: ${product.name.substring(0, 50)}...`)
      console.log(`  Fields: ${parsed.parsedFields.join(', ')}`)
    }
    
    if (!dryRun) {
      await prisma.product.update({
        where: { id: product.id },
        data: updateData,
      })
    }
    
    updated++
  }
  
  // Print summary
  console.log('')
  console.log('='.repeat(60))
  console.log('Summary')
  console.log('='.repeat(60))
  console.log(`Total processed: ${products.length}`)
  console.log(`Updated: ${updated}`)
  console.log(`Skipped: ${skipped}`)
  console.log('')
  console.log('Fields populated:')
  Object.entries(stats).forEach(([field, count]) => {
    if (count > 0) {
      console.log(`  ${field}: ${count}`)
    }
  })
  
  if (dryRun) {
    console.log('')
    console.log('*** DRY RUN - No changes were made ***')
    console.log('Run without --dry-run to apply changes')
  }
}

// ============================================
// CLI
// ============================================

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const verbose = args.includes('--verbose')
const limitIdx = args.indexOf('--limit')
const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : undefined

backfillBallisticFields({ dryRun, limit, verbose })
  .then(() => {
    console.log('')
    console.log('Done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })
  .finally(() => {
    prisma.$disconnect()
  })
