/**
 * Premium Ranking Service
 * 
 * Applies performance-aware ranking for Premium users based on:
 * - Intent-derived ranking boosts (from PremiumSearchIntent)
 * - Structured product fields (bulletType, pressureRating, isSubsonic, etc.)
 * - Best Value Scores
 * - Purpose optimization
 * 
 * FREE users get basic relevance ranking (caliber/purpose/grain match)
 * PREMIUM users get deep ranking considering performance characteristics
 */

import { PremiumSearchIntent, SafetyConstraint } from './intent-parser'
import { calculateBestValueScore, BestValueScore } from './best-value-score'
import { 
  extractPerformanceBadges, 
  PerformanceBadge,
  BULLET_TYPE_CATEGORIES,
  BulletType,
  PressureRating 
} from '../../types/product-metadata'

/**
 * Product with all Premium-relevant fields
 */
export interface ProductForRanking {
  id: string
  name: string
  caliber: string | null
  grainWeight: number | null
  brand: string | null
  purpose: string | null
  roundCount: number | null
  
  // New structured ballistic fields (Phase 1 schema)
  bulletType?: BulletType | null
  pressureRating?: PressureRating | null
  muzzleVelocityFps?: number | null
  isSubsonic?: boolean | null
  shortBarrelOptimized?: boolean | null
  suppressorSafe?: boolean | null
  lowFlash?: boolean | null
  lowRecoil?: boolean | null
  controlledExpansion?: boolean | null
  matchGrade?: boolean | null
  factoryNew?: boolean | null
  dataSource?: string | null
  dataConfidence?: number | null
  
  // Metadata JSON (for terminal performance, cached scores, etc.)
  metadata?: unknown
  
  // Prices with retailer info
  prices: Array<{
    price: any
    inStock: boolean
    shippingCost?: any
    retailer: {
      id: string
      tier: string
    }
  }>
  
  // Existing relevance score from basic search
  _relevanceScore?: number
  _vectorSimilarity?: number
}

/**
 * Premium-enhanced product with ranking scores
 */
export interface PremiumRankedProduct extends ProductForRanking {
  premiumRanking: {
    // Final composite score (0-100)
    finalScore: number
    
    // Score breakdown
    breakdown: {
      baseRelevance: number       // From basic search (0-40)
      performanceMatch: number    // From Premium fields (0-30)
      relativeValueScore: number  // Relative value contribution (0-20)
      safetyBonus: number         // Safety constraint bonus (0-10)
    }
    
    // Best Value data (if calculated)
    bestValue?: BestValueScore
    
    // Performance badges to display
    badges: PerformanceBadge[]
    
    // AI-generated ranking explanation
    explanation?: string
  }
}

/**
 * Ranking configuration options
 */
export interface PremiumRankingOptions {
  // Premium intent from parser
  premiumIntent?: PremiumSearchIntent
  
  // User's stated purpose (if any)
  userPurpose?: string
  
  // Whether to calculate Best Value scores (expensive)
  includeBestValue?: boolean
  
  // Maximum products to process
  limit?: number
}

/**
 * Apply Premium ranking to a list of products
 * 
 * @param products - Products from search results
 * @param options - Ranking configuration
 * @returns Products sorted by Premium ranking with scores attached
 */
export async function applyPremiumRanking(
  products: ProductForRanking[],
  options: PremiumRankingOptions = {}
): Promise<PremiumRankedProduct[]> {
  const { 
    premiumIntent, 
    userPurpose,
    includeBestValue = true,
    limit = 50
  } = options
  
  // Process up to limit products
  const toProcess = products.slice(0, limit)
  
  // Calculate Best Value scores in parallel if requested
  const bestValueMap = new Map<string, BestValueScore>()
  if (includeBestValue) {
    const scores = await Promise.all(
      toProcess.map(p => calculateBestValueScore(p, userPurpose))
    )
    toProcess.forEach((product, index) => {
      bestValueMap.set(product.id, scores[index])
    })
  }
  
  // Apply Premium ranking to each product
  const rankedProducts = toProcess.map(product => {
    const bestValue = bestValueMap.get(product.id)
    const ranking = calculateProductRanking(product, {
      premiumIntent,
      userPurpose,
      bestValue
    })
    
    return {
      ...product,
      premiumRanking: ranking
    } as PremiumRankedProduct
  })
  
  // Sort by final score descending
  rankedProducts.sort((a, b) => b.premiumRanking.finalScore - a.premiumRanking.finalScore)
  
  return rankedProducts
}

/**
 * Calculate Premium ranking for a single product
 */
function calculateProductRanking(
  product: ProductForRanking,
  context: {
    premiumIntent?: PremiumSearchIntent
    userPurpose?: string
    bestValue?: BestValueScore
  }
): PremiumRankedProduct['premiumRanking'] {
  const { premiumIntent, userPurpose, bestValue } = context
  
  // Initialize breakdown
  const breakdown = {
    baseRelevance: 0,
    performanceMatch: 0,
    relativeValueScore: 0,
    safetyBonus: 0
  }
  
  // =============================================
  // 1. Base Relevance (0-40 points)
  // =============================================
  // Start with existing relevance score if available
  if (product._relevanceScore !== undefined) {
    // Normalize to 0-40 range
    breakdown.baseRelevance = Math.min(40, (product._relevanceScore / 100) * 40)
  } else if (product._vectorSimilarity !== undefined) {
    // Use vector similarity
    breakdown.baseRelevance = Math.min(40, product._vectorSimilarity * 40)
  } else {
    // Default middle score
    breakdown.baseRelevance = 20
  }
  
  // =============================================
  // 2. Performance Match (0-30 points)
  // =============================================
  if (premiumIntent?.rankingBoosts) {
    breakdown.performanceMatch = calculatePerformanceMatch(product, premiumIntent.rankingBoosts)
  } else if (userPurpose) {
    // Calculate performance match from purpose even without explicit boosts
    breakdown.performanceMatch = calculatePurposePerformanceMatch(product, userPurpose)
  }
  
  // =============================================
  // 3. Relative Value Score (0-20 points)
  // =============================================
  if (bestValue && bestValue.score > 0) {
    // Convert 0-100 relative value to 0-20 contribution
    breakdown.relativeValueScore = (bestValue.score / 100) * 20
  }
  
  // =============================================
  // 4. Safety Constraint Bonus (0-10 points)
  // =============================================
  if (premiumIntent?.safetyConstraints?.length) {
    breakdown.safetyBonus = calculateSafetyBonus(product, premiumIntent.safetyConstraints)
  }
  
  // =============================================
  // Calculate Final Score
  // =============================================
  const finalScore = Math.round(
    breakdown.baseRelevance +
    breakdown.performanceMatch +
    breakdown.relativeValueScore +
    breakdown.safetyBonus
  )
  
  // =============================================
  // Extract Performance Badges
  // =============================================
  const badges = extractPerformanceBadges(product)
  
  // =============================================
  // Generate Explanation
  // =============================================
  const explanation = generateRankingExplanation(product, breakdown, premiumIntent)
  
  return {
    finalScore: Math.min(100, finalScore),
    breakdown,
    bestValue,
    badges,
    explanation
  }
}

/**
 * Calculate performance match score based on ranking boosts
 */
function calculatePerformanceMatch(
  product: ProductForRanking,
  boosts: NonNullable<PremiumSearchIntent['rankingBoosts']>
): number {
  let score = 0
  const maxScore = 30
  let boostFactors = 0
  let matchedBoosts = 0
  
  // Short barrel optimization
  if (boosts.shortBarrelOptimized !== undefined) {
    boostFactors++
    if (product.shortBarrelOptimized) {
      score += boosts.shortBarrelOptimized * 10
      matchedBoosts++
    } else if (isShortBarrelOptimizedInferred(product)) {
      score += boosts.shortBarrelOptimized * 6 // Partial credit for inferred
    }
  }
  
  // Low flash
  if (boosts.lowFlash !== undefined) {
    boostFactors++
    if (product.lowFlash) {
      score += boosts.lowFlash * 10
      matchedBoosts++
    }
  }
  
  // Controlled expansion
  if (boosts.controlledExpansion !== undefined) {
    boostFactors++
    if (product.controlledExpansion) {
      score += boosts.controlledExpansion * 10
      matchedBoosts++
    } else if (isControlledExpansionInferred(product)) {
      score += boosts.controlledExpansion * 5
    }
  }
  
  // Suppressor safe
  if (boosts.suppressorSafe !== undefined) {
    boostFactors++
    if (product.suppressorSafe || product.isSubsonic) {
      score += boosts.suppressorSafe * 10
      matchedBoosts++
    }
  }
  
  // Match grade
  if (boosts.matchGrade !== undefined) {
    boostFactors++
    if (product.matchGrade) {
      score += boosts.matchGrade * 10
      matchedBoosts++
    }
  }
  
  // Normalize to 0-30 range
  return Math.min(maxScore, score)
}

/**
 * Calculate performance match from purpose without explicit boosts
 */
function calculatePurposePerformanceMatch(
  product: ProductForRanking,
  purpose: string
): number {
  const lowerPurpose = purpose.toLowerCase()
  let score = 0
  
  if (lowerPurpose.includes('defense') || lowerPurpose.includes('self')) {
    // Defensive use - favor appropriate characteristics
    if (product.bulletType && BULLET_TYPE_CATEGORIES.defensive.includes(product.bulletType as BulletType)) {
      score += 12
    }
    if (product.controlledExpansion) score += 6
    if (product.lowFlash) score += 5
    if (product.shortBarrelOptimized) score += 5
    
    // Penalize FMJ for defense
    if (product.bulletType && BULLET_TYPE_CATEGORIES.training.includes(product.bulletType as BulletType)) {
      score -= 8
    }
  } else if (lowerPurpose.includes('target') || lowerPurpose.includes('practice') || lowerPurpose.includes('training')) {
    // Target/practice - favor FMJ, value
    if (product.bulletType && BULLET_TYPE_CATEGORIES.training.includes(product.bulletType as BulletType)) {
      score += 10
    }
    if (product.factoryNew === false) score += 5 // Remanufactured OK for target
  } else if (lowerPurpose.includes('hunt')) {
    // Hunting - favor soft points, premium
    if (product.bulletType && BULLET_TYPE_CATEGORIES.hunting.includes(product.bulletType as BulletType)) {
      score += 12
    }
    if (product.matchGrade) score += 5
  } else if (lowerPurpose.includes('competition') || lowerPurpose.includes('match')) {
    // Competition - favor match grade
    if (product.matchGrade) score += 15
    if (product.lowRecoil) score += 5
  } else if (lowerPurpose.includes('suppressor') || lowerPurpose.includes('subsonic')) {
    // Suppressor use
    if (product.suppressorSafe) score += 15
    if (product.isSubsonic) score += 10
  }
  
  // Cap at 30
  return Math.min(30, Math.max(0, score))
}

/**
 * Calculate safety constraint bonus
 */
function calculateSafetyBonus(
  product: ProductForRanking,
  constraints: SafetyConstraint[]
): number {
  let bonus = 0
  const maxBonus = 10
  
  for (const constraint of constraints) {
    switch (constraint) {
      case 'low-overpenetration':
        if (product.controlledExpansion) bonus += 4
        if (product.bulletType && ['JHP', 'HP', 'BJHP', 'HST', 'GDHP'].includes(product.bulletType)) {
          bonus += 3
        }
        if (product.bulletType === 'FRANGIBLE') bonus += 5
        break
        
      case 'low-flash':
        if (product.lowFlash) bonus += 5
        break
        
      case 'low-recoil':
        if (product.lowRecoil) bonus += 5
        // Lighter grain weights typically have less recoil
        if (product.grainWeight && product.caliber) {
          if (isLightWeight(product.caliber, product.grainWeight)) {
            bonus += 2
          }
        }
        break
        
      case 'barrier-blind':
        if (product.bulletType === 'BJHP') bonus += 5
        break
        
      case 'frangible':
        if (product.bulletType === 'FRANGIBLE') bonus += 5
        break
    }
  }
  
  return Math.min(maxBonus, bonus)
}

/**
 * Generate human-readable ranking explanation
 */
function generateRankingExplanation(
  product: ProductForRanking,
  breakdown: PremiumRankedProduct['premiumRanking']['breakdown'],
  premiumIntent?: PremiumSearchIntent
): string {
  const parts: string[] = []
  
  // Start with performance match explanation
  if (breakdown.performanceMatch > 15) {
    const features: string[] = []
    
    if (product.shortBarrelOptimized) features.push('short-barrel performance')
    if (product.lowFlash) features.push('reduced muzzle flash')
    if (product.controlledExpansion) features.push('controlled expansion')
    if (product.suppressorSafe || product.isSubsonic) features.push('suppressor compatibility')
    if (product.matchGrade) features.push('match-grade accuracy')
    if (product.lowRecoil) features.push('low recoil')
    
    if (features.length > 0) {
      parts.push(`Optimized for ${features.join(', ')}.`)
    }
  }
  
  // Add bullet type context
  if (product.bulletType) {
    if (BULLET_TYPE_CATEGORIES.defensive.includes(product.bulletType as BulletType)) {
      if (product.bulletType === 'BJHP') {
        parts.push('Bonded jacket ensures reliable expansion through barriers.')
      } else if (product.bulletType === 'HST') {
        parts.push('Federal HST is a proven defensive load.')
      } else if (product.bulletType === 'GDHP') {
        parts.push('Gold Dot is trusted by law enforcement.')
      }
    }
  }
  
  // Add pressure rating context
  if (product.pressureRating === 'PLUS_P') {
    if (premiumIntent?.barrelLength === 'short') {
      parts.push('+P velocity helps compensate for shorter barrel length.')
    } else {
      parts.push('+P loading provides higher velocity.')
    }
  }
  
  // Add value context
  if (breakdown.relativeValueScore > 15) {
    parts.push('Strong value compared to similar ammunition.')
  }
  
  // Add safety context
  if (breakdown.safetyBonus > 5 && premiumIntent?.safetyConstraints?.includes('low-overpenetration')) {
    parts.push('Designed to minimize overpenetration risk.')
  }
  
  // Default explanation if nothing specific
  if (parts.length === 0) {
    if (product.bulletType && BULLET_TYPE_CATEGORIES.training.includes(product.bulletType as BulletType)) {
      parts.push('Reliable FMJ for training and practice.')
    } else {
      parts.push('Good match for your search criteria.')
    }
  }
  
  return parts.join(' ')
}

/**
 * Infer short-barrel optimization from product name/bullet type
 */
function isShortBarrelOptimizedInferred(product: ProductForRanking): boolean {
  const name = (product.name || '').toLowerCase()
  
  // Known short-barrel optimized lines
  const shortBarrelIndicators = [
    'critical defense',
    'short barrel',
    'compact',
    'micro',
    'hst micro',
    'ranger bonded',
    'critical duty'
  ]
  
  return shortBarrelIndicators.some(ind => name.includes(ind))
}

/**
 * Infer controlled expansion from bullet type
 */
function isControlledExpansionInferred(product: ProductForRanking): boolean {
  // Most JHP variants are designed for controlled expansion
  if (product.bulletType) {
    return ['JHP', 'HP', 'BJHP', 'XTP', 'HST', 'GDHP'].includes(product.bulletType)
  }
  return false
}

/**
 * Check if grain weight is "light" for caliber
 */
function isLightWeight(caliber: string, grainWeight: number): boolean {
  const cal = caliber.toLowerCase()
  
  if (cal.includes('9mm') && grainWeight <= 115) return true
  if ((cal.includes('.45') || cal.includes('45 acp')) && grainWeight <= 185) return true
  if ((cal.includes('.223') || cal.includes('5.56')) && grainWeight <= 55) return true
  if ((cal.includes('.308') || cal.includes('7.62')) && grainWeight <= 150) return true
  if ((cal.includes('.40') || cal.includes('40 s&w')) && grainWeight <= 155) return true
  
  return false
}

/**
 * Quick ranking for FREE tier (no Best Value, simpler scoring)
 */
export function applyFreeRanking(
  products: ProductForRanking[],
  userPurpose?: string
): ProductForRanking[] {
  return products.map(product => {
    let score = product._relevanceScore || 50
    
    // Basic purpose matching
    if (userPurpose && product.purpose) {
      if (product.purpose.toLowerCase().includes(userPurpose.toLowerCase())) {
        score += 20
      }
    }
    
    // Basic bullet type matching for purpose
    if (userPurpose && product.bulletType) {
      const lowerPurpose = userPurpose.toLowerCase()
      if (lowerPurpose.includes('defense')) {
        if (BULLET_TYPE_CATEGORIES.defensive.includes(product.bulletType as BulletType)) {
          score += 15
        }
      } else if (lowerPurpose.includes('target')) {
        if (BULLET_TYPE_CATEGORIES.training.includes(product.bulletType as BulletType)) {
          score += 15
        }
      }
    }
    
    return { ...product, _relevanceScore: score }
  }).sort((a, b) => (b._relevanceScore || 0) - (a._relevanceScore || 0))
}

// Export types
export type { BestValueScore }
