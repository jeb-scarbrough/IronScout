import { prisma, Prisma } from '@ironscout/db'
import { parseSearchIntent, SearchIntent, ParseOptions } from './intent-parser'
import { QUALITY_INDICATORS, CASE_MATERIAL_BY_PURPOSE } from './ammo-knowledge'
import { generateEmbedding, buildProductText } from './embedding-service'
import {
  applyPremiumRanking,
  applyFreeRanking,
  ProductForRanking,
  PremiumRankedProduct
} from './premium-ranking'
import { batchCalculatePriceSignalIndex, PriceSignalIndex } from './price-signal-index'
import { batchGetPricesWithConfidence } from './price-resolver'
import { BulletType, PressureRating, BULLET_TYPE_CATEGORIES } from '../../types/product-metadata'
import { loggers } from '../../config/logger'
import { generateOutUrl } from '../outbound-url'
import type { LensMetadata, ProductWithOffers } from '../lens'
import { isLensEnabled, applyLensPipeline, InvalidLensError } from '../lens'

const log = loggers.ai

/**
 * Expand combined caliber values (from Gun Locker canonical enum) into
 * their individual normalized forms so that caliberNorm ILIKE filters
 * match products stored as e.g. '5.56 NATO' or '.223 Remington'.
 *
 * Example: '.223/5.56' → ['.223', '5.56']
 *          '.308/7.62x51' → ['.308', '7.62x51']
 *          '9mm' → ['9mm']  (no change)
 */
function expandCaliberFilter(calibers: string[]): string[] {
  const expanded: string[] = []
  for (const cal of calibers) {
    if (cal.includes('/')) {
      // Split on '/' and trim each part
      expanded.push(...cal.split('/').map(c => c.trim()).filter(Boolean))
    } else {
      expanded.push(cal)
    }
  }
  return expanded
}

function toPriceNumber(value: unknown): number {
  if (typeof value === 'number') return value
  if (value && typeof (value as { toString?: () => string }).toString === 'function') {
    const parsed = parseFloat((value as { toString: () => string }).toString())
    return Number.isNaN(parsed) ? Infinity : parsed
  }
  return Infinity
}

function getObservedAtMs(value: unknown): number {
  if (!value) return 0
  if (value instanceof Date) return value.getTime()
  const parsed = new Date(value as string | number).getTime()
  return Number.isNaN(parsed) ? 0 : parsed
}

function dedupeLatestByRetailer(prices: any[]): any[] {
  const byRetailer = new Map<string, any>()
  const unkeyed: any[] = []

  for (const price of prices) {
    const retailerId = price?.retailers?.id ?? price?.retailerId
    if (!retailerId) {
      unkeyed.push(price)
      continue
    }

    const existing = byRetailer.get(retailerId)
    if (!existing) {
      byRetailer.set(retailerId, price)
      continue
    }

    const existingObservedAt = getObservedAtMs(existing.observedAt)
    const currentObservedAt = getObservedAtMs(price.observedAt)

    if (currentObservedAt > existingObservedAt) {
      byRetailer.set(retailerId, price)
      continue
    }

    if (currentObservedAt === existingObservedAt) {
      const currentPrice = toPriceNumber(price.price)
      const existingPrice = toPriceNumber(existing.price)
      if (currentPrice < existingPrice) {
        byRetailer.set(retailerId, price)
      }
    }
  }

  return [...byRetailer.values(), ...unkeyed]
}

function dedupeAndSortPrices(prices: any[]): any[] {
  const deduped = dedupeLatestByRetailer(prices)
  return [...deduped].sort((a, b) => toPriceNumber(a.price) - toPriceNumber(b.price))
}

function getProductSortPricePerRound(product: any): number {
  const prices = Array.isArray(product?.prices) ? product.prices : []
  if (prices.length === 0) return Number.POSITIVE_INFINITY

  const inStockPrices = prices.filter((price: any) => price?.inStock)
  const sourcePrices = inStockPrices.length > 0 ? inStockPrices : prices

  let lowestTotal = Number.POSITIVE_INFINITY
  for (const price of sourcePrices) {
    lowestTotal = Math.min(lowestTotal, toPriceNumber(price?.price))
  }

  if (!Number.isFinite(lowestTotal)) return Number.POSITIVE_INFINITY

  const roundCount = Number(product?.roundCount)
  if (!Number.isFinite(roundCount) || roundCount <= 0) {
    return lowestTotal
  }

  return lowestTotal / roundCount
}

/**
 * Explicit filters that can override AI intent
 */
export interface ExplicitFilters {
  caliber?: string
  purpose?: string
  caseMaterial?: string
  minPrice?: number
  maxPrice?: number
  minGrain?: number
  maxGrain?: number
  inStock?: boolean
  brand?: string

  // =============================================
  // Premium Filters (NEW - Phase 2)
  // =============================================
  bulletType?: BulletType
  pressureRating?: PressureRating
  isSubsonic?: boolean

  // Performance characteristic filters
  shortBarrelOptimized?: boolean
  lowFlash?: boolean
  matchGrade?: boolean

  // Velocity range (Premium)
  minVelocity?: number
  maxVelocity?: number
}

/**
 * Search result with AI-enhanced ranking
 */
export interface AISearchResult {
  products: any[]
  intent: SearchIntent
  facets: Record<string, Record<string, number>>
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  searchMetadata: {
    parsedFilters: Record<string, any>
    explicitFilters: ExplicitFilters
    aiEnhanced: boolean
    vectorSearchUsed: boolean
    processingTimeMs: number
    userTier: 'FREE' | 'PREMIUM'
    premiumFeaturesUsed?: string[]
    /** Detailed timing breakdown for debugging */
    timing?: {
      intentParseMs: number
      dbQueryMs: number
      priceResolveMs: number
      rankingMs: number
      lensMs?: number
      embeddingMs?: number
    }
  }
  /** Lens metadata (only present when lens is enabled) */
  lens?: LensMetadata
}

/**
 * Search options
 */
export interface AISearchOptions {
  page?: number
  limit?: number
  sortBy?: 'relevance' | 'price_asc' | 'price_desc' | 'date_desc' | 'date_asc' | 'price_context'
  useVectorSearch?: boolean
  explicitFilters?: ExplicitFilters
  userTier?: 'FREE' | 'PREMIUM'
  /** Optional lens ID for lens-based filtering (requires lens enabled) */
  lensId?: string
  /** Request ID for telemetry correlation */
  requestId?: string
}

/**
 * AI-powered semantic search with optional explicit filter overrides
 *
 * The search process:
 * 1. Parse natural language query to extract intent (caliber, purpose, grain, etc.)
 * 2. Merge explicit filters on top of AI intent (explicit filters take priority)
 * 3. Execute hybrid search (vector + structured)
 * 4. Apply performance-aware ranking with price context
 *
 * V1: All users get full search capabilities (no tier restrictions)
 */
export async function aiSearch(
  query: string,
  options: AISearchOptions = {}
): Promise<AISearchResult> {
  const startTime = Date.now()
  const timing: AISearchResult['searchMetadata']['timing'] = {
    intentParseMs: 0,
    dbQueryMs: 0,
    priceResolveMs: 0,
    rankingMs: 0,
  }

  const {
    page = 1,
    limit = 20,
    sortBy = 'relevance',
    useVectorSearch = true,
    explicitFilters = {},
    userTier = 'PREMIUM', // V1: All users get premium capabilities
    lensId,
    requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
  } = options

  // V1: All users get premium features
  const isPremium = true
  const premiumFeaturesUsed: string[] = []
  let lensMetadata: LensMetadata | undefined

  log.info('SEARCH_START', {
    requestId,
    query,
    page,
    limit,
    sortBy,
    userTier,
    explicitFilters,
    hasFilters: Object.keys(explicitFilters).length > 0,
    lensId,
    vectorSearchEnabled: useVectorSearch,
  })

  // Track Premium filter usage
  if (explicitFilters.bulletType) premiumFeaturesUsed.push('bulletType filter')
  if (explicitFilters.pressureRating) premiumFeaturesUsed.push('pressureRating filter')
  if (explicitFilters.isSubsonic !== undefined) premiumFeaturesUsed.push('subsonic filter')
  if (explicitFilters.shortBarrelOptimized) premiumFeaturesUsed.push('shortBarrel filter')
  if (sortBy === 'price_context') premiumFeaturesUsed.push('price_context sort')

  // 1. Parse the natural language query into structured intent
  const intentStart = Date.now()
  const parseOptions: ParseOptions = { userTier }
  const intent = await parseSearchIntent(query, parseOptions)
  timing.intentParseMs = Date.now() - intentStart

  log.info('SEARCH_INTENT_PARSED', {
    requestId,
    durationMs: timing.intentParseMs,
    calibers: intent.calibers,
    purpose: intent.purpose,
    grainWeights: intent.grainWeights,
    caseMaterials: intent.caseMaterials,
    brands: intent.brands,
    qualityLevel: intent.qualityLevel,
    confidence: intent.confidence,
    keywords: intent.keywords,
  })

  // 2. Merge explicit filters with AI intent (explicit takes priority)
  const mergedIntent = mergeFiltersWithIntent(intent, explicitFilters)

  log.info('SEARCH_FILTERS_MERGED', {
    requestId,
    merged: {
      calibers: mergedIntent.calibers,
      purpose: mergedIntent.purpose,
      grainWeights: mergedIntent.grainWeights,
      caseMaterials: mergedIntent.caseMaterials,
      brands: mergedIntent.brands,
    },
    explicitFilters,
  })

  // 3. Build Prisma where clause from merged intent (including Premium filters)
  const where = buildWhereClause(mergedIntent, explicitFilters, isPremium)

  log.info('SEARCH_WHERE_CLAUSE', {
    requestId,
    where: JSON.stringify(where),
    whereKeyCount: Object.keys(where).length,
  })

  // 4. Build price/stock conditions
  // Note: These are applied AFTER fetching products since prices come via product_links
  // (Spec v1.2 §0.0: prices.productId is denormalized, query through product_links)
  const priceConditions = buildPriceConditions(mergedIntent, explicitFilters)

  // 5. Fetch products - use vector search if enabled and sorting by relevance
  const skip = (page - 1) * limit
  let products: any[]
  let vectorSearchUsed = false
  let total: number
  // Populated by standardSearch/vectorEnhancedSearch; reused by lens pipeline
  let confidenceMap: Map<string, number> = new Map()
  const hasExplicitFilters = Object.keys(explicitFilters).length > 0

  const dbStart = Date.now()

  // IMPORTANT: Use vector search whenever it's enabled and no explicit filters are set.
  // The sortBy parameter only affects ordering AFTER results are fetched.
  // This prevents the result set from changing when the user toggles sort.
  if (useVectorSearch && !hasExplicitFilters) {
    try {
      // Try vector-enhanced search (only when no explicit filters)
      const embeddingStart = Date.now()
      const vectorResult = await vectorEnhancedSearch(query, mergedIntent, explicitFilters, { skip, limit: limit * 2 }, isPremium)
      products = vectorResult.products
      confidenceMap = vectorResult.confidenceMap
      timing.embeddingMs = Date.now() - embeddingStart
      vectorSearchUsed = true
      // For vector search, count using base where clause
      // Note: Can't filter on embedding field since it's Unsupported("vector") in Prisma
      total = await prisma.products.count({ where })

      log.info('SEARCH_VECTOR_COMPLETE', {
        requestId,
        productsCount: products.length,
        total,
        embeddingMs: timing.embeddingMs,
      })

      // Fall back to standard search if vector search returns no results
      // This handles cases where products don't have embeddings yet
      if (products.length === 0 && total > 0) {
        log.warn('SEARCH_VECTOR_FALLBACK', {
          requestId,
          reason: 'vector_empty_but_products_exist',
          total,
        })
        const fallbackResult = await standardSearch(where, skip, limit * 2, isPremium)
        products = fallbackResult.products
        confidenceMap = fallbackResult.confidenceMap
        vectorSearchUsed = false
      }
    } catch (error) {
      log.warn('SEARCH_VECTOR_ERROR', {
        requestId,
        error: error instanceof Error ? error.message : String(error),
      })
      const fallbackResult = await standardSearch(where, skip, limit * 2, isPremium)
      products = fallbackResult.products
      confidenceMap = fallbackResult.confidenceMap
      total = await prisma.products.count({ where })
    }
  } else {
    // Use standard Prisma search with explicit filters
    log.info('SEARCH_STANDARD_START', {
      requestId,
      hasExplicitFilters,
      sortBy,
    })
    const standardResult = await standardSearch(where, skip, limit * 2, isPremium)
    products = standardResult.products
    confidenceMap = standardResult.confidenceMap
    total = await prisma.products.count({ where })

    log.info('SEARCH_STANDARD_COMPLETE', {
      requestId,
      productsCount: products.length,
      total,
    })
  }

  timing.dbQueryMs = Date.now() - dbStart

  // Apply price/stock filters to fetched prices
  // (Prices are fetched via product_links, so filter here instead of in Prisma where)
  if (Object.keys(priceConditions).length > 0) {
    const beforePriceFilter = products.length
    products = products.map((p: any) => {
      if (!p.prices) return p
      let filteredPrices = p.prices
      if (priceConditions.inStock) {
        filteredPrices = filteredPrices.filter((pr: any) => pr.inStock)
      }
      if (priceConditions.price?.gte !== undefined) {
        filteredPrices = filteredPrices.filter((pr: any) =>
          parseFloat(pr.price.toString()) >= priceConditions.price.gte
        )
      }
      if (priceConditions.price?.lte !== undefined) {
        filteredPrices = filteredPrices.filter((pr: any) =>
          parseFloat(pr.price.toString()) <= priceConditions.price.lte
        )
      }
      return { ...p, prices: filteredPrices }
    })

    log.info('SEARCH_PRICE_FILTER_APPLIED', {
      requestId,
      priceConditions,
      beforeCount: beforePriceFilter,
      afterCount: products.length,
    })
  }

  // Filter out products with no visible prices
  // Products may exist but have all prices filtered out by price conditions
  // EXCEPTION: When lens is enabled, keep zero-offer products per spec
  // (they'll have price=null, availability=OUT_OF_STOCK and sort last)
  const originalCount = products.length
  const hasPriceOrStockConditions = Object.keys(priceConditions).length > 0
  const keepZeroOfferProductsForLens = isLensEnabled() && !hasPriceOrStockConditions

  if (!keepZeroOfferProductsForLens) {
    products = products.filter((p: any) => p.prices && p.prices.length > 0)

    if (products.length !== originalCount) {
      log.info('SEARCH_ZERO_PRICE_FILTER', {
        requestId,
        before: originalCount,
        after: products.length,
        filteredOut: originalCount - products.length,
      })
      // Adjust total estimate based on ratio of products with prices
      const ratio = products.length / (originalCount || 1)
      total = Math.max(products.length, Math.floor(total * ratio))
    }
  } else {
    log.info('SEARCH_LENS_KEEPING_ZERO_PRICE', {
      requestId,
      totalProducts: originalCount,
      withPrices: products.filter((p: any) => p.prices && p.prices.length > 0).length,
      reason: 'lens_enabled_without_price_or_stock_conditions',
    })
  }

  // Ensure total is at least the number of products returned on this page
  if (page === 1 && products.length > total) {
    log.warn('SEARCH_COUNT_MISMATCH', {
      requestId,
      productsLength: products.length,
      total,
    })
    total = products.length
  }

  // =============================================
  // LENS PIPELINE (when lens is enabled)
  // =============================================
  if (isLensEnabled()) {
    const lensStart = Date.now()
    log.info('SEARCH_LENS_START', {
      requestId,
      lensId,
      productCount: products.length,
    })

    try {
      // Per search-lens-v1.md: canonicalConfidence source = ProductResolver.matchScore
      // Reuse confidenceMap already populated by standardSearch/vectorEnhancedSearch
      // to avoid a duplicate batchGetPricesWithConfidence call

      // Merge linkConfidence into products for lens aggregation
      const productsWithConfidence = products.map((p: any) => ({
        ...p,
        linkConfidence: confidenceMap.get(p.id) ?? null,
      }))

      // Run the lens pipeline with the fetched products
      const lensResult = await applyLensPipeline({
        query,
        products: productsWithConfidence as ProductWithOffers[],
        userLensId: lensId,
        requestId,
      })

      lensMetadata = lensResult.metadata
      premiumFeaturesUsed.push('lens_pipeline')

      // Use lens-ordered products for the rest of the flow
      // The lens pipeline already applies eligibility filtering and ordering
      const lensProducts = lensResult.products.map(ap => ap._originalProduct)

      // Update total based on lens eligibility filtering
      if (lensResult.zeroResults) {
        total = 0
      } else {
        total = lensResult.products.length
      }

      // Continue with lens-filtered products
      products = lensProducts as any[]
      timing.lensMs = Date.now() - lensStart

      log.info('SEARCH_LENS_COMPLETE', {
        requestId,
        lensId: lensMetadata.id,
        autoApplied: lensMetadata.autoApplied,
        reasonCode: lensMetadata.reasonCode,
        resultCount: products.length,
        zeroResults: lensResult.zeroResults,
        durationMs: timing.lensMs,
      })
    } catch (error) {
      // Handle InvalidLensError by re-throwing (will be caught by route handler)
      if (error instanceof InvalidLensError) {
        throw error
      }

      // Log other errors but don't fail the search
      log.error('SEARCH_LENS_ERROR', {
        requestId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  // 7. Apply tier-appropriate ranking
  // CRITICAL: When lens pipeline is active, lens ordering MUST be preserved.
  // Per search-lens-v1.md: "Ordering derives from declared ordering rules only"
  const rankingStart = Date.now()
  let rankedProducts: any[]
  // Lens ordering is active only when the lens ran AND the user hasn't
  // explicitly requested a different sort.  Explicit sortBy always wins.
  const userRequestedExplicitSort = sortBy !== 'relevance'
  const lensOrderingActive = lensMetadata !== undefined && !userRequestedExplicitSort

  if (lensOrderingActive) {
    // Lens pipeline already applied deterministic ordering - preserve it
    rankedProducts = products
    log.info('SEARCH_RANKING_LENS_PRESERVED', {
      requestId,
      productCount: products.length,
    })
  } else if (isPremium && (sortBy === 'relevance' || sortBy === 'price_context')) {
    // PREMIUM: Apply performance-aware ranking with price context
    premiumFeaturesUsed.push('premium_ranking')

    const premiumRanked = await applyPremiumRanking(products as ProductForRanking[], {
      premiumIntent: intent.premiumIntent,
      userPurpose: mergedIntent.purpose,
      includePriceSignal: sortBy === 'price_context' || sortBy === 'relevance',
      limit: limit * 2
    })

    // Sort by price context (lower prices first) if requested
    if (sortBy === 'price_context') {
      premiumRanked.sort((a, b) => {
        // Sort by position in range (lower = better price context)
        const aPos = a.premiumRanking.priceSignal?.positionInRange ?? 0.5
        const bPos = b.premiumRanking.priceSignal?.positionInRange ?? 0.5
        return aPos - bPos
      })
    }

    rankedProducts = premiumRanked
    log.info('SEARCH_RANKING_PREMIUM_APPLIED', {
      requestId,
      productCount: premiumRanked.length,
    })
  } else if (!isPremium && sortBy === 'relevance' && mergedIntent.confidence > 0.5 && !vectorSearchUsed) {
    // FREE: Basic re-ranking
    rankedProducts = reRankProducts(products, mergedIntent)
    log.info('SEARCH_RANKING_FREE_APPLIED', {
      requestId,
      productCount: rankedProducts.length,
    })
  } else {
    rankedProducts = products
    log.info('SEARCH_RANKING_NONE', {
      requestId,
      productCount: products.length,
    })
  }

  timing.rankingMs = Date.now() - rankingStart

  // 8. Apply date sorting if requested
  // CRITICAL: Skip when lens ordering is active - lens determines order
  if (!lensOrderingActive && (sortBy === 'date_asc' || sortBy === 'date_desc')) {
    rankedProducts = rankedProducts.sort((a: any, b: any) => {
      const comparison = getObservedAtMs(a.createdAt) - getObservedAtMs(b.createdAt)
      return sortBy === 'date_asc' ? comparison : -comparison
    })
  }

  // 9. Apply price sorting if requested
  // CRITICAL: Skip when lens ordering is active - lens determines order
  if (!lensOrderingActive && (sortBy === 'price_asc' || sortBy === 'price_desc')) {
    rankedProducts = rankedProducts.sort((a: any, b: any) => {
      const comparison = getProductSortPricePerRound(a) - getProductSortPricePerRound(b)
      return sortBy === 'price_asc' ? comparison : -comparison
    })
  }

  // 10. Trim to requested limit
  rankedProducts = rankedProducts.slice(0, limit)

  // 11. Calculate price context for ALL users (verdict for everyone, depth for premium)
  // For premium users with premiumRanking, use existing priceSignal
  // For all others, calculate it now
  const priceResolveStart = Date.now()
  const productsNeedingPriceSignal = rankedProducts.filter(
    (p: any) => !p.premiumRanking?.priceSignal
  )

  let priceSignalMap = new Map<string, PriceSignalIndex>()
  if (productsNeedingPriceSignal.length > 0) {
    priceSignalMap = await batchCalculatePriceSignalIndex(productsNeedingPriceSignal)
  }
  timing.priceResolveMs = Date.now() - priceResolveStart

  // Merge price signals into products
  rankedProducts = rankedProducts.map((p: any) => {
    // Use existing priceSignal from premiumRanking if available
    const existingSignal = p.premiumRanking?.priceSignal
    const calculatedSignal = priceSignalMap.get(p.id)
    return {
      ...p,
      _priceSignal: existingSignal || calculatedSignal
    }
  })

  // 12. Format products (with Premium data if applicable)
  const formattedProducts = rankedProducts.map(p => formatProduct(p, isPremium))

  // 13. Build facets (with Premium facets if applicable)
  const facets = await buildFacets(where, isPremium)

  const processingTimeMs = Date.now() - startTime

  log.info('SEARCH_COMPLETE', {
    requestId,
    query,
    totalResults: total,
    returnedResults: formattedProducts.length,
    processingTimeMs,
    timing,
    vectorSearchUsed,
    lensApplied: lensMetadata?.id,
    premiumFeaturesUsed,
  })

  // V1: All users get full intent with explanations
  return {
    products: formattedProducts,
    intent,
    facets,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    },
    searchMetadata: {
      parsedFilters: {
        calibers: intent.calibers,
        purpose: intent.purpose,
        grainWeights: intent.grainWeights,
        caseMaterials: intent.caseMaterials,
        qualityLevel: intent.qualityLevel,
        // V1: All advanced parsed fields included
        ...(intent.premiumIntent ? {
          environment: intent.premiumIntent.environment,
          barrelLength: intent.premiumIntent.barrelLength,
          suppressorUse: intent.premiumIntent.suppressorUse,
          safetyConstraints: intent.premiumIntent.safetyConstraints,
          preferredBulletTypes: intent.premiumIntent.preferredBulletTypes
        } : {})
      },
      explicitFilters,
      aiEnhanced: intent.confidence > 0.5,
      vectorSearchUsed,
      processingTimeMs,
      userTier: 'PREMIUM', // V1: All users get premium
      timing,
      ...(premiumFeaturesUsed.length > 0 ? { premiumFeaturesUsed } : {})
    },
    // Include lens metadata when lens pipeline is enabled
    ...(lensMetadata ? { lens: lensMetadata } : {})
  }
}

/**
 * Merge explicit filters with AI-parsed intent
 * Explicit filters take priority over AI interpretation
 */
function mergeFiltersWithIntent(intent: SearchIntent, filters: ExplicitFilters): SearchIntent {
  const merged = { ...intent }

  // Track if caliber was explicitly changed from AI interpretation
  const caliberExplicitlyChanged = filters.caliber &&
    !intent.calibers?.some(c => c.toLowerCase().includes(filters.caliber!.toLowerCase()))

  // Explicit caliber overrides AI-detected calibers
  if (filters.caliber) {
    merged.calibers = [filters.caliber]

    // If caliber changed, discard AI grain weights (they're caliber-specific)
    if (caliberExplicitlyChanged) {
      log.debug('Caliber explicitly changed - discarding AI grain weights')
      merged.grainWeights = undefined
    }
  }

  // Explicit purpose overrides AI-detected purpose
  if (filters.purpose) {
    merged.purpose = filters.purpose
  }

  // Explicit case material overrides AI-detected
  if (filters.caseMaterial) {
    merged.caseMaterials = [filters.caseMaterial]
  }

  // Explicit grain range overrides AI-detected
  if (filters.minGrain != null || filters.maxGrain != null) {
    merged.grainWeights = undefined
  }

  // Explicit price range (use != null to properly handle null values)
  if (filters.minPrice != null) {
    merged.minPrice = filters.minPrice
  }
  if (filters.maxPrice != null) {
    merged.maxPrice = filters.maxPrice
  }

  // Explicit in-stock filter
  if (filters.inStock != null) {
    merged.inStockOnly = filters.inStock
  }

  // Explicit brand
  if (filters.brand) {
    merged.brands = [filters.brand]
  }

  // Premium filters - update premiumIntent if present
  if (merged.premiumIntent) {
    if (filters.bulletType) {
      merged.premiumIntent.preferredBulletTypes = [filters.bulletType]
    }
  }

  return merged
}

/**
 * Build Prisma where clause from search intent and explicit filters
 *
 * IMPORTANT: AI intent values (purpose, brands, grainWeights, caseMaterials) are NOT
 * used as hard filters. They are only used for scoring/ranking. Only explicit user
 * filters are applied as hard database filters to avoid zero-result searches.
 */
function buildWhereClause(intent: SearchIntent, explicitFilters: ExplicitFilters, isPremium: boolean): any {
  const where: any = {}
  const orConditions: any[] = []

  log.debug('SEARCH_BUILD_WHERE_START', {
    intentCalibers: intent.calibers,
    intentPurpose: intent.purpose,
    intentBrands: intent.brands,
    explicitFilters,
  })

  // Caliber filter - ALWAYS apply if present (caliber is fundamental to search)
  // Use caliberNorm for filtering (normalized form, always populated by resolver)
  // Expand combined calibers like '.223/5.56' into individual parts for matching
  const rawCalibers = explicitFilters.caliber ? [explicitFilters.caliber] : intent.calibers
  const calibers = rawCalibers ? expandCaliberFilter(rawCalibers) : undefined
  if (calibers && calibers.length > 0) {
    where.OR = calibers.map(cal => ({
      caliberNorm: { contains: cal, mode: 'insensitive' }
    }))
    log.debug('SEARCH_FILTER_CALIBER', { calibers, rawCalibers, source: explicitFilters.caliber ? 'explicit' : 'intent' })
  }

  // Purpose filter - ONLY apply if user explicitly specified
  // AI intent purpose is used for scoring, not hard filtering
  if (explicitFilters.purpose) {
    if (where.OR) {
      where.AND = [
        { OR: where.OR },
        { purpose: { contains: explicitFilters.purpose, mode: 'insensitive' } }
      ]
      delete where.OR
    } else {
      where.purpose = { contains: explicitFilters.purpose, mode: 'insensitive' }
    }
    log.debug('SEARCH_FILTER_PURPOSE', { purpose: explicitFilters.purpose })
  }
  // NOTE: AI intent purpose is used for scoring/ranking, not hard filtering

  // Grain weight filter - only apply if user explicitly specified min/max
  // AI intent may return default grain weights which would filter out products
  // that don't match those exact values. Use grain weights for scoring instead.
  // Use != null to handle both null and undefined (Prisma operators cannot accept null)
  if (explicitFilters.minGrain != null || explicitFilters.maxGrain != null) {
    const grainCondition: any = {}
    if (explicitFilters.minGrain != null) {
      grainCondition.gte = explicitFilters.minGrain
    }
    if (explicitFilters.maxGrain != null) {
      grainCondition.lte = explicitFilters.maxGrain
    }
    addCondition(where, { grainWeight: grainCondition })
    log.debug('SEARCH_FILTER_GRAIN', { grainCondition })
  }
  // NOTE: AI intent grainWeights are used for scoring/ranking, not hard filtering

  // Case material filter - only apply if user explicitly specified
  // AI intent may return default case materials which would filter out products
  // that don't have this field populated
  if (explicitFilters.caseMaterial) {
    addCondition(where, {
      caseMaterial: { contains: explicitFilters.caseMaterial, mode: 'insensitive' }
    })
    log.debug('SEARCH_FILTER_CASEMATERIAL', { caseMaterial: explicitFilters.caseMaterial })
  }
  // NOTE: AI intent caseMaterials are used for scoring/ranking, not hard filtering

  // Brand filter - ONLY apply if user explicitly specified
  // AI intent brands are used for scoring, not hard filtering
  if (explicitFilters.brand) {
    addCondition(where, {
      brand: { contains: explicitFilters.brand, mode: 'insensitive' }
    })
    log.debug('SEARCH_FILTER_BRAND', { brand: explicitFilters.brand })
  }
  // NOTE: AI intent brands are used for scoring/ranking, not hard filtering

  // =============================================
  // Premium Filters (NEW - Phase 2)
  // =============================================

  if (isPremium) {
    // Bullet type filter
    if (explicitFilters.bulletType) {
      addCondition(where, { bulletType: explicitFilters.bulletType })
      log.debug('SEARCH_FILTER_BULLETTYPE', { bulletType: explicitFilters.bulletType })
    }

    // Pressure rating filter
    if (explicitFilters.pressureRating) {
      addCondition(where, { pressureRating: explicitFilters.pressureRating })
      log.debug('SEARCH_FILTER_PRESSURERATING', { pressureRating: explicitFilters.pressureRating })
    }

    // Subsonic filter
    if (explicitFilters.isSubsonic !== undefined) {
      addCondition(where, { isSubsonic: explicitFilters.isSubsonic })
      log.debug('SEARCH_FILTER_SUBSONIC', { isSubsonic: explicitFilters.isSubsonic })
    }

    // Performance characteristic filters
    if (explicitFilters.shortBarrelOptimized) {
      addCondition(where, { shortBarrelOptimized: true })
    }
    if (explicitFilters.lowFlash) {
      addCondition(where, { lowFlash: true })
    }
    if (explicitFilters.matchGrade) {
      addCondition(where, { matchGrade: true })
    }

    // Velocity range filter
    // Use != null to handle both null and undefined (Prisma operators cannot accept null)
    if (explicitFilters.minVelocity != null || explicitFilters.maxVelocity != null) {
      const velocityCondition: any = {}
      if (explicitFilters.minVelocity != null) {
        velocityCondition.gte = explicitFilters.minVelocity
      }
      if (explicitFilters.maxVelocity != null) {
        velocityCondition.lte = explicitFilters.maxVelocity
      }
      addCondition(where, { muzzleVelocityFps: velocityCondition })
    }
  }

  // If no structured filters matched, fall back to text search
  if (Object.keys(where).length === 0 && intent.originalQuery) {
    const keywords = intent.keywords || intent.originalQuery.split(/\s+/).filter(w => w.length > 2 || /^\d+$/.test(w))

    if (keywords.length > 0) {
      keywords.forEach(keyword => {
        orConditions.push(
          { name: { contains: keyword, mode: 'insensitive' } },
          { description: { contains: keyword, mode: 'insensitive' } },
          { brand: { contains: keyword, mode: 'insensitive' } }
        )
      })

      where.OR = orConditions
      log.debug('SEARCH_FILTER_KEYWORDS', { keywords })
    }
  }

  log.debug('SEARCH_BUILD_WHERE_COMPLETE', {
    whereClause: JSON.stringify(where),
    filterCount: Object.keys(where).length,
  })

  return where
}

/**
 * Helper to add condition to where clause
 */
function addCondition(where: any, condition: any): void {
  if (where.AND) {
    where.AND.push(condition)
  } else if (where.OR) {
    where.AND = [{ OR: where.OR }, condition]
    delete where.OR
  } else {
    Object.assign(where, condition)
  }
}

/**
 * Standard Prisma-based search
 *
 * Prices are fetched through product_links per Spec v1.2 §0.0.
 * This is the canonical query path for price grouping.
 */
async function standardSearch(where: any, skip: number, take: number, includePremiumFields: boolean): Promise<{ products: any[]; confidenceMap: Map<string, number> }> {
  const queryStart = Date.now()

  const baseSelect = {
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
    // Premium fields
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
  }

  // Fetch products through product_links (Spec v1.2 §0.0)
  const products = await prisma.products.findMany({
    where,
    skip,
    take,
    select: baseSelect,
    orderBy: { createdAt: 'desc' },
  })

  const dbDuration = Date.now() - queryStart

  if (products.length === 0) {
    log.debug('SEARCH_STANDARD_NO_PRODUCTS', { where: JSON.stringify(where), dbDurationMs: dbDuration })
    return { products: [], confidenceMap: new Map() }
  }

  // Batch fetch prices + confidence via product_links
  // Returns both pricesMap and confidenceMap to avoid re-fetching in the lens pipeline
  const priceStart = Date.now()
  const productIds = products.map((p: { id: string }) => p.id)
  const { pricesMap, confidenceMap } = await batchGetPricesWithConfidence(productIds)
  const priceDuration = Date.now() - priceStart

  log.debug('SEARCH_STANDARD_PRICES_FETCHED', {
    productCount: products.length,
    dbDurationMs: dbDuration,
    priceDurationMs: priceDuration,
  })

  return {
    products: products.map((p: { id: string }) => ({
      ...p,
      prices: dedupeAndSortPrices(pricesMap.get(p.id) || []),
    })),
    confidenceMap,
  }
}

/**
 * Vector-enhanced semantic search using pgvector
 *
 * Uses a CTE to combine the vector similarity ranking and full product
 * fetch into a single SQL round-trip, eliminating the redundant products_pkey
 * IN-clause fetch. Results come pre-sorted by similarity.
 *
 * Ships on existing raw SQL pattern (dynamic WHERE composition).
 * Follow-up: migrate to Prisma.sql composition to eliminate raw unsafe queries.
 */
async function vectorEnhancedSearch(
  query: string,
  intent: SearchIntent,
  explicitFilters: ExplicitFilters,
  options: { skip: number; limit: number },
  isPremium: boolean
): Promise<{ products: any[]; confidenceMap: Map<string, number> }> {
  const { skip, limit } = options

  // Build the search text
  const searchText = [
    query,
    intent.purpose ? `for ${intent.purpose.toLowerCase()}` : '',
    intent.calibers?.join(' ') || '',
    intent.qualityLevel || '',
    // Add Premium intent context for better matching
    ...(isPremium && intent.premiumIntent ? [
      intent.premiumIntent.environment || '',
      intent.premiumIntent.preferredBulletTypes?.join(' ') || ''
    ] : [])
  ].filter(Boolean).join(' ')

  log.debug('SEARCH_VECTOR_EMBEDDING_START', { searchText })

  // Generate query embedding
  const embeddingStart = Date.now()
  const queryEmbedding = await generateEmbedding(searchText)
  const embeddingDuration = Date.now() - embeddingStart
  const embeddingStr = `[${queryEmbedding.join(',')}]`

  log.debug('SEARCH_VECTOR_EMBEDDING_COMPLETE', { durationMs: embeddingDuration })

  // Build filter conditions for SQL
  // IMPORTANT: Only apply caliber as hard filter, other AI intent values are for scoring
  const conditions: string[] = ['embedding IS NOT NULL']
  const params: any[] = []

  // Caliber filter - use caliberNorm (normalized form, always populated by resolver)
  // Expand combined calibers like '.223/5.56' into individual parts for matching
  const rawCalibers = explicitFilters.caliber ? [explicitFilters.caliber] : intent.calibers
  const calibers = rawCalibers ? expandCaliberFilter(rawCalibers) : undefined
  if (calibers?.length) {
    const caliberPatterns = calibers.map(c => `%${c}%`)
    conditions.push(`"caliberNorm" ILIKE ANY($${params.length + 1})`)
    params.push(caliberPatterns)
  }

  // Purpose filter - ONLY if explicitly specified
  if (explicitFilters.purpose) {
    conditions.push(`purpose ILIKE $${params.length + 1}`)
    params.push(`%${explicitFilters.purpose}%`)
  }

  // Case material filter - only apply if user explicitly specified
  if (explicitFilters.caseMaterial) {
    conditions.push(`"caseMaterial" ILIKE $${params.length + 1}`)
    params.push(`%${explicitFilters.caseMaterial}%`)
  }

  // Brand filter - ONLY if explicitly specified
  if (explicitFilters.brand) {
    conditions.push(`brand ILIKE $${params.length + 1}`)
    params.push(`%${explicitFilters.brand}%`)
  }

  // Grain weight range - only if explicitly specified
  if (explicitFilters.minGrain !== undefined) {
    conditions.push(`"grainWeight" >= $${params.length + 1}`)
    params.push(explicitFilters.minGrain)
  }
  if (explicitFilters.maxGrain !== undefined) {
    conditions.push(`"grainWeight" <= $${params.length + 1}`)
    params.push(explicitFilters.maxGrain)
  }

  const whereClause = conditions.join(' AND ')

  // Append embedding, limit, and offset as positional parameters
  // SECURITY: Never interpolate these values into the SQL string
  const embeddingParamIdx = params.length + 1
  params.push(embeddingStr)
  const limitParamIdx = params.length + 1
  params.push(limit + skip)
  const offsetParamIdx = params.length + 1
  params.push(skip)

  log.debug('SEARCH_VECTOR_SQL', { whereClause, paramCount: params.length })

  // Two static column lists (premium / non-premium) — no dynamic composition
  const premiumColumns = `,
       p."bulletType", p."pressureRating", p."muzzleVelocityFps",
       p."isSubsonic", p."shortBarrelOptimized", p."suppressorSafe",
       p."lowFlash", p."lowRecoil", p."controlledExpansion",
       p."matchGrade", p."factoryNew", p."dataSource", p."dataConfidence",
       p.metadata`

  const selectColumns = `
       r.similarity, p.id, p.name, p.description, p.category, p.brand,
       p."imageUrl", p.upc, p.caliber, p."grainWeight", p."caseMaterial",
       p.purpose, p."roundCount", p."createdAt"${isPremium ? premiumColumns : ''}`

  // Execute CTE: vector similarity ranking + full product fetch in one round-trip
  const vectorStart = Date.now()
  const products = await prisma.$queryRawUnsafe<any[]>(`
    WITH ranked AS (
      SELECT id, 1 - (embedding <=> $${embeddingParamIdx}::vector) as similarity
      FROM products
      WHERE ${whereClause}
      ORDER BY embedding <=> $${embeddingParamIdx}::vector
      LIMIT $${limitParamIdx}
      OFFSET $${offsetParamIdx}
    )
    SELECT ${selectColumns}
    FROM ranked r
    JOIN products p ON p.id = r.id
    ORDER BY r.similarity DESC
  `, ...params)
  const vectorDuration = Date.now() - vectorStart

  log.debug('SEARCH_VECTOR_QUERY_COMPLETE', {
    resultCount: products.length,
    durationMs: vectorDuration,
  })

  if (products.length === 0) {
    return { products: [], confidenceMap: new Map() }
  }

  // Batch fetch prices + confidence via product_links
  // Returns both pricesMap and confidenceMap to avoid re-fetching in the lens pipeline
  const ids = products.map((p: { id: string }) => p.id)
  const { pricesMap, confidenceMap } = await batchGetPricesWithConfidence(ids)

  // Results come pre-sorted by similarity from the CTE ORDER BY
  return {
    products: products.map((p: any) => ({
      ...p,
      prices: dedupeAndSortPrices(pricesMap.get(p.id) || []),
      _relevanceScore: Math.round((p.similarity || 0) * 100),
      _vectorSimilarity: p.similarity || 0,
    })),
    confidenceMap,
  }
}

/**
 * Build price/stock conditions
 */
function buildPriceConditions(intent: SearchIntent, explicitFilters: ExplicitFilters): any {
  const conditions: any = {}

  const minPrice = explicitFilters.minPrice ?? intent.minPrice
  const maxPrice = explicitFilters.maxPrice ?? intent.maxPrice

  // Use != null to handle both null and undefined
  // Prisma operators like gte/lte cannot accept null values
  if (minPrice != null) {
    conditions.price = { gte: minPrice }
  }

  if (maxPrice != null) {
    conditions.price = conditions.price
      ? { ...conditions.price, lte: maxPrice }
      : { lte: maxPrice }
  }

  const inStock = explicitFilters.inStock ?? intent.inStockOnly
  if (inStock) {
    conditions.inStock = true
  }

  return conditions
}

/**
 * Re-rank products based on AI intent analysis (FREE tier)
 * Uses AI intent values for SCORING, not filtering
 */
function reRankProducts(products: any[], intent: SearchIntent): any[] {
  return products.map(product => {
    let score = 0

    // Score by grain weight match (AI intent used for scoring, not filtering)
    if (intent.grainWeights && intent.grainWeights.length > 0 && product.grainWeight) {
      if (intent.grainWeights.includes(product.grainWeight)) {
        score += 30
      } else {
        const closestMatch = intent.grainWeights.reduce((prev, curr) =>
          Math.abs(curr - product.grainWeight) < Math.abs(prev - product.grainWeight) ? curr : prev
        )
        const diff = Math.abs(closestMatch - product.grainWeight)
        if (diff <= 5) score += 20
        else if (diff <= 10) score += 10
      }
    }

    // Score by quality level
    if (intent.qualityLevel) {
      const productName = (product.name || '').toLowerCase()

      if (intent.qualityLevel === 'match-grade') {
        if (QUALITY_INDICATORS.matchGrade.some(q => productName.includes(q))) {
          score += 25
        }
      } else if (intent.qualityLevel === 'budget') {
        if (QUALITY_INDICATORS.budget.some(q => productName.includes(q))) {
          score += 20
        }
        const lowestPrice = product.prices[0]?.price
        if (lowestPrice && parseFloat(lowestPrice.toString()) < 0.50) {
          score += 15
        }
      } else if (intent.qualityLevel === 'premium') {
        if (QUALITY_INDICATORS.premium.some(q => productName.includes(q))) {
          score += 20
        }
      }
    }

    // Score by case material preference (AI intent used for scoring, not filtering)
    if (intent.caseMaterials && product.caseMaterial) {
      if (intent.caseMaterials.includes(product.caseMaterial)) {
        score += 15
      }
    } else if (intent.purpose && product.caseMaterial) {
      const preferredMaterials = CASE_MATERIAL_BY_PURPOSE[intent.purpose]
      if (preferredMaterials?.includes(product.caseMaterial)) {
        score += 10
      }
    }

    // Score by brand match (AI intent used for scoring, not filtering)
    if (intent.brands && product.brand) {
      if (intent.brands.some(b => b.toLowerCase() === product.brand.toLowerCase())) {
        score += 20
      }
    }

    // Score by purpose match (AI intent used for scoring, not filtering)
    if (intent.purpose && product.purpose) {
      if (product.purpose.toLowerCase().includes(intent.purpose.toLowerCase())) {
        score += 15
      }
    }

    // Score by in-stock availability
    const hasInStock = product.prices.some((p: any) => p.inStock)
    if (hasInStock) {
      score += 10
    }

    // Score by retailer tier
    const hasPremiumRetailer = product.prices.some((p: any) => p.retailers?.tier === 'PREMIUM')
    if (hasPremiumRetailer) {
      score += 5
    }

    return { ...product, _relevanceScore: score }
  }).sort((a, b) => b._relevanceScore - a._relevanceScore)
}

/**
 * Format product for API response
 *
 * Price context tiering (The Rule):
 * - Everyone gets the conclusion (contextBand)
 * - Premium gets the reasoning (relativePricePct, positionInRange, meta)
 */
function formatProduct(product: any, isPremium: boolean): any {
  // Build price context - verdict for everyone, depth for premium
  let priceContext: any = undefined
  const priceSignal = product._priceSignal

  if (priceSignal && priceSignal.contextBand) {
    if (isPremium) {
      // Premium: Full depth - quantification, history, confidence
      priceContext = {
        contextBand: priceSignal.contextBand,
        relativePricePct: priceSignal.relativePricePct,
        positionInRange: priceSignal.positionInRange,
        meta: priceSignal.meta
      }
    } else {
      // FREE: Just the verdict - no numbers, no charts, no tuning knobs
      priceContext = {
        contextBand: priceSignal.contextBand
      }
    }
  }

  const base = {
    id: product.id,
    name: product.name,
    description: product.description,
    category: product.category,
    brand: product.brand,
    imageUrl: product.imageUrl,
    upc: product.upc,
    caliber: product.caliber,
    grainWeight: product.grainWeight,
    caseMaterial: product.caseMaterial,
    purpose: product.purpose,
    roundCount: product.roundCount,
    relevanceScore: product._relevanceScore,
    // Price context - everyone gets verdict, premium gets depth
    ...(priceContext && { priceContext }),
    prices: product.prices.map((price: any) => ({
      id: price.id,
      price: parseFloat(price.price.toString()),
      currency: price.currency,
      url: price.url,
      out_url: generateOutUrl(price.url, price.retailers.id, product.id),
      inStock: price.inStock,
      retailer: {
        id: price.retailers.id,
        name: price.retailers.name,
        tier: price.retailers.tier,
        logoUrl: price.retailers.logoUrl
      }
    }))
  }

  // Add Premium fields if available
  if (isPremium) {
    const premiumFields: any = {}

    // Structured ballistic fields
    if (product.bulletType) premiumFields.bulletType = product.bulletType
    if (product.pressureRating) premiumFields.pressureRating = product.pressureRating
    if (product.muzzleVelocityFps) premiumFields.muzzleVelocityFps = product.muzzleVelocityFps
    if (product.isSubsonic !== null) premiumFields.isSubsonic = product.isSubsonic

    // Performance characteristics
    if (product.shortBarrelOptimized) premiumFields.shortBarrelOptimized = product.shortBarrelOptimized
    if (product.suppressorSafe) premiumFields.suppressorSafe = product.suppressorSafe
    if (product.lowFlash) premiumFields.lowFlash = product.lowFlash
    if (product.lowRecoil) premiumFields.lowRecoil = product.lowRecoil
    if (product.controlledExpansion) premiumFields.controlledExpansion = product.controlledExpansion
    if (product.matchGrade) premiumFields.matchGrade = product.matchGrade
    if (product.factoryNew !== null) premiumFields.factoryNew = product.factoryNew

    // Data quality
    if (product.dataSource) premiumFields.dataSource = product.dataSource
    if (product.dataConfidence) premiumFields.dataConfidence = parseFloat(product.dataConfidence.toString())

    // Premium ranking data
    if (product.premiumRanking) {
      premiumFields.premiumRanking = {
        finalScore: product.premiumRanking.finalScore,
        breakdown: product.premiumRanking.breakdown,
        badges: product.premiumRanking.badges,
        explanation: product.premiumRanking.explanation,
        // Price signal: descriptive context only (ADR-006 compliant)
        priceSignal: product.premiumRanking.priceSignal ? {
          relativePricePct: product.premiumRanking.priceSignal.relativePricePct,
          positionInRange: product.premiumRanking.priceSignal.positionInRange,
          contextBand: product.premiumRanking.priceSignal.contextBand,
          meta: product.premiumRanking.priceSignal.meta
        } : undefined
      }
    }

    if (Object.keys(premiumFields).length > 0) {
      return { ...base, premium: premiumFields }
    }
  }

  return base
}

/**
 * Build facets for filtering UI.
 *
 * Fetches all matching product rows with facet columns in a single query,
 * then aggregates counts in memory. At ~2,255 products this is ~100x cheaper
 * than 6-9 separate groupBy round-trips that each scan the full table.
 */
async function buildFacets(where: any, isPremium: boolean): Promise<Record<string, Record<string, number>>> {
  const rows = await prisma.products.findMany({
    where,
    select: {
      caliber: true,
      grainWeight: true,
      caseMaterial: true,
      purpose: true,
      brand: true,
      category: true,
      ...(isPremium ? { bulletType: true, pressureRating: true, isSubsonic: true } : {}),
    },
  })

  if (rows.length > 10_000) {
    log.warn('FACET_ROW_COUNT_HIGH', { count: rows.length })
  }

  // Define facet fields: [dbField, outputKey]
  const baseFacets: Array<[string, string]> = [
    ['caliber', 'calibers'],
    ['grainWeight', 'grainWeights'],
    ['caseMaterial', 'caseMaterials'],
    ['purpose', 'purposes'],
    ['brand', 'brands'],
    ['category', 'categories'],
  ]

  if (isPremium) {
    baseFacets.push(
      ['bulletType', 'bulletTypes'],
      ['pressureRating', 'pressureRatings'],
      ['isSubsonic', 'isSubsonic'],
    )
  }

  // Aggregate counts in memory from the single result set
  const facets: Record<string, Record<string, number>> = {}

  for (const [field, outputKey] of baseFacets) {
    const counts: Record<string, number> = {}

    for (const row of rows) {
      const value = (row as any)[field]
      if (value == null) continue
      // Map value to string key (handles booleans like isSubsonic)
      const key = String(value)
      counts[key] = (counts[key] || 0) + 1
    }

    // Only include non-empty facets
    if (Object.keys(counts).length > 0) {
      facets[outputKey] = counts
    }
  }

  return facets
}

/**
 * Get search suggestions based on partial query
 */
export async function getSearchSuggestions(partialQuery: string): Promise<string[]> {
  const suggestions: string[] = []
  const lowerQuery = partialQuery.toLowerCase()

  // Suggest based on common platforms
  const platforms = ['AR-15', 'AR-10', 'AK-47', 'Glock', '1911', 'Shotgun']
  platforms.forEach(p => {
    if (p.toLowerCase().includes(lowerQuery)) {
      suggestions.push(`${p} ammo`)
      suggestions.push(`${p} target practice`)
      suggestions.push(`${p} defense ammo`)
    }
  })

  // Suggest based on common calibers
  const calibers = ['9mm', '.223', '5.56', '.308', '.45 ACP', '12 gauge']
  calibers.forEach(c => {
    if (c.toLowerCase().includes(lowerQuery)) {
      suggestions.push(`${c} ammo`)
      suggestions.push(`${c} target ammo`)
      suggestions.push(`${c} defense ammo`)
      suggestions.push(`${c} bulk`)
    }
  })

  // Suggest based on purposes
  if ('target'.includes(lowerQuery) || 'practice'.includes(lowerQuery)) {
    suggestions.push('target practice ammo')
    suggestions.push('range ammo')
    suggestions.push('bulk target ammo')
  }

  if ('defense'.includes(lowerQuery) || 'self'.includes(lowerQuery)) {
    suggestions.push('self defense ammo')
    suggestions.push('home defense ammo')
    suggestions.push('hollow point')
  }

  // Remove duplicates and limit
  return [...new Set(suggestions)].slice(0, 8)
}

// =============================================
// Exported for Testing
// =============================================

/**
 * Export internal functions for unit testing.
 * These are implementation details and should not be used outside tests.
 */
export const _testExports = {
  mergeFiltersWithIntent,
  buildWhereClause,
  buildPriceConditions,
  reRankProducts,
  formatProduct,
  addCondition,
  vectorEnhancedSearch,
  getProductSortPricePerRound,
}
