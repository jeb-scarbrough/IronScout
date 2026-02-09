import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma, Prisma } from '@ironscout/db'
import {
  getTierConfig,
  getMaxMarketPulseCalibers,
  getMaxDealsForYou,
  hasFeature,
  hasPriceHistoryAccess,
  getPriceHistoryDays,
  shapePriceHistory,
  visibleHistoricalPriceWhere,
} from '../config/tiers'
import { batchGetPricesViaProductLinks } from '../services/ai-search/price-resolver'
import { getUserTier, getAuthenticatedUserId } from '../middleware/auth'
import { loggers } from '../config/logger'
import {
  resolveDashboardState,
  getWatchlistPreview,
  type DashboardState,
  type DashboardStateContext
} from '../services/dashboard-state'
import { getMarketDeals, getMarketDealsWithGunLocker } from '../services/market-deals'
import { getUserCalibers, type CaliberValue } from '../services/gun-locker'
import { getLoadoutData } from '../services/loadout'

const log = loggers.dashboard

const router: any = Router()

// ============================================================================
// MY LOADOUT ENDPOINT
// Returns unified data for My Loadout dashboard:
// - Gun Locker firearms with ammo preferences and current prices
// - Watching items with prices and status
// - Market activity stats
// Per ADR-006: Assistive only, no recommendations or verdicts
// ============================================================================

router.get('/loadout', async (req: Request, res: Response) => {
  try {
    const userId = getAuthenticatedUserId(req)
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    const data = await getLoadoutData(userId)

    res.json(data)
  } catch (error) {
    log.error('Loadout error', { error }, error as Error)
    res.status(500).json({ error: 'Failed to load My Loadout' })
  }
})

// ============================================================================
// DASHBOARD STATE ENDPOINT (v4)
// Returns resolved dashboard state for state-driven UI rendering
// Per dashboard-product-spec.md: state resolution is server-side
// ============================================================================

router.get('/state', async (req: Request, res: Response) => {
  try {
    const userId = getAuthenticatedUserId(req)
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    const stateContext = await resolveDashboardState(userId)

    res.json(stateContext)
  } catch (error) {
    log.error('Dashboard state error', { error }, error as Error)
    res.status(500).json({ error: 'Failed to resolve dashboard state' })
  }
})

// ============================================================================
// WATCHLIST PREVIEW ENDPOINT (v4)
// Returns subset of watchlist items for dashboard preview
// Limit varies by state: 3 for most, 7 for POWER_USER
// ============================================================================

const watchlistPreviewSchema = z.object({
  limit: z.coerce.number().int().min(1).max(10).default(3)
})

router.get('/watchlist-preview', async (req: Request, res: Response) => {
  try {
    const userId = getAuthenticatedUserId(req)
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    const { limit } = watchlistPreviewSchema.parse(req.query)
    const items = await getWatchlistPreview(userId, limit)

    res.json({
      items,
      _meta: {
        itemsReturned: items.length,
        limit
      }
    })
  } catch (error) {
    log.error('Watchlist preview error', { error }, error as Error)
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid parameters', details: error.issues })
    }
    res.status(500).json({ error: 'Failed to fetch watchlist preview' })
  }
})

// ============================================================================
// MARKET DEALS ENDPOINT (dashboard_market_deals_v1_spec.md)
// Returns notable market-wide price events for dashboard display
// Eligibility: ≥15% below 30-day median, back in stock after 7+ days, lowest in 90 days
// Hero selection: largest drop %, then earliest timestamp, then productId ASC
// ============================================================================

router.get('/market-deals', async (req: Request, res: Response) => {
  try {
    // Auth is optional - market deals are public, but Gun Locker personalization requires auth
    const userId = getAuthenticatedUserId(req)

    if (userId) {
      // Get user's Gun Locker calibers for personalization
      const userCalibers = await getUserCalibers(userId)

      if (userCalibers.length > 0) {
        const { forYourGuns, otherDeals, hero, lastCheckedAt } = await getMarketDealsWithGunLocker(userCalibers)

        return res.json({
          hero,
          sections: [
            { title: 'Fits Your Gun Locker', deals: forYourGuns },
            { title: 'Other Notable Price Moves', deals: otherDeals },
          ],
          lastCheckedAt,
          _meta: {
            personalized: true,
            userCalibers,
          },
        })
      }
    }

    // Non-personalized: "Notable Price Moves Today"
    const { deals, hero, lastCheckedAt } = await getMarketDeals()

    res.json({
      hero,
      sections: [{ title: 'Notable Price Moves Today', deals: deals.slice(0, 5) }],
      lastCheckedAt,
      _meta: {
        personalized: false,
      },
    })
  } catch (error) {
    log.error('Market deals error', { error }, error as Error)
    res.status(500).json({ error: 'Failed to fetch market activity' })
  }
})

// ============================================================================
// MARKET PULSE ENDPOINT
// Returns price context indicators for user's top calibers
// Free: 2 calibers max, current price + trend
// Premium: All calibers, price timing signal (1-100), charts
//
// Query params:
//   windowDays=1|7 (default 7) - trend comparison window
// ============================================================================

const pulseQuerySchema = z.object({
  windowDays: z.enum(['1', '7']).default('7').transform(v => parseInt(v, 10) as 1 | 7)
})

router.get('/pulse', async (req: Request, res: Response) => {
  try {
    // Parse and validate query params
    const { windowDays } = pulseQuerySchema.parse(req.query)

    // Get authenticated user from JWT
    const userId = getAuthenticatedUserId(req)
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    // Anchor timestamp for consistency across all caliber calculations
    const asOf = new Date()

    const userTier = await getUserTier(req)
    const maxCalibers = getMaxMarketPulseCalibers(userTier)

    // Get user's calibers from saved items (watchlist)
    // Per ADR-011A Section 17.2: All user-facing queries MUST include deletedAt: null
    const watchlistItems = await prisma.watchlist_items.findMany({
      where: { userId, deletedAt: null },
      include: { products: { select: { caliber: true } } }
    })

    // Extract unique calibers (products may be null for SEARCH intent items)
    const calibersSet = new Set<string>()
    watchlistItems.forEach((w: any) => {
      if (w.products?.caliber) calibersSet.add(w.products.caliber)
    })

    // Default calibers if user has none tracked
    if (calibersSet.size === 0) {
      calibersSet.add('9mm')
      calibersSet.add('.223 Rem')
    }

    let calibers = Array.from(calibersSet)

    // Apply tier limit
    if (maxCalibers !== -1 && calibers.length > maxCalibers) {
      calibers = calibers.slice(0, maxCalibers)
    }

    // Check feature availability
    const showPriceTimingSignal = hasFeature(userTier, 'priceTimingSignal')

    // ================================================================
    // BATCHED market pulse calculation (eliminates N+1 per-caliber queries)
    // Single query for all calibers → group in JS
    // ================================================================

    // 1. Single query: all products across all calibers
    const allProducts = await prisma.products.findMany({
      where: { caliber: { in: calibers } },
      select: { id: true, caliber: true },
      take: 100 * calibers.length // ~100 per caliber
    })

    // Group product IDs by caliber
    const productsByCaliber = new Map<string, string[]>()
    for (const cal of calibers) productsByCaliber.set(cal, [])
    for (const p of allProducts) {
      if (p.caliber) {
        const ids = productsByCaliber.get(p.caliber)
        if (ids) ids.push(p.id)
      }
    }

    // 2. Single batch: all prices across all product IDs
    const allProductIds = allProducts.map(p => p.id)
    const allPricesMap = allProductIds.length > 0
      ? await batchGetPricesViaProductLinks(allProductIds)
      : new Map()

    // 3. Single batch: all product_links for historical price lookup
    const windowStart = new Date(asOf)
    windowStart.setDate(windowStart.getDate() - windowDays)

    const allLinks = allProductIds.length > 0
      ? await prisma.product_links.findMany({
          where: {
            productId: { in: allProductIds },
            status: { in: ['MATCHED', 'CREATED'] }
          },
          select: { sourceProductId: true, productId: true }
        })
      : []

    // Build sourceProductId → productId mapping
    const sourceToProductId = new Map<string, string>()
    for (const link of allLinks) {
      if (link.productId) sourceToProductId.set(link.sourceProductId, link.productId)
    }

    // 4. Single batch: all historical prices
    const allSourceProductIds = allLinks.map(link => link.sourceProductId)
    const allHistoricalPrices = allSourceProductIds.length > 0
      ? await prisma.prices.findMany({
          where: {
            sourceProductId: { in: allSourceProductIds },
            observedAt: { lt: windowStart },
            ...visibleHistoricalPriceWhere(),
          },
          select: { price: true, sourceProductId: true },
          orderBy: { observedAt: 'desc' },
          take: 50 * calibers.length
        })
      : []

    // Group historical prices by caliber (via sourceProductId → productId → caliber)
    const productIdToCaliber = new Map<string, string>()
    for (const p of allProducts) {
      if (p.caliber) productIdToCaliber.set(p.id, p.caliber)
    }

    const historicalPricesByCaliber = new Map<string, number[]>()
    for (const cal of calibers) historicalPricesByCaliber.set(cal, [])
    for (const hp of allHistoricalPrices) {
      const productId = sourceToProductId.get(hp.sourceProductId)
      if (productId) {
        const cal = productIdToCaliber.get(productId)
        if (cal) {
          const arr = historicalPricesByCaliber.get(cal)
          if (arr && arr.length < 50) arr.push(parseFloat(hp.price.toString()))
        }
      }
    }

    // 5. Assemble pulse data per caliber (pure JS, no more DB calls)
    const pulseData = calibers.map(caliber => {
      const productIds = productsByCaliber.get(caliber) || []

      if (productIds.length === 0) {
        return {
          caliber,
          currentAvg: null,
          trend: 'STABLE' as const,
          trendPercent: 0,
          priceTimingSignal: showPriceTimingSignal ? null : undefined,
          priceContext: 'INSUFFICIENT_DATA' as const,
          contextMeta: { windowDays, sampleCount: 0, asOf: asOf.toISOString() }
        }
      }

      // Collect current in-stock prices for this caliber
      const currentPrices: number[] = []
      for (const pid of productIds) {
        const prices = allPricesMap.get(pid) || []
        for (const price of prices) {
          if (price.inStock) {
            currentPrices.push(parseFloat(price.price.toString()))
          }
        }
      }

      const sampledPrices = currentPrices.slice(0, 50)

      if (sampledPrices.length === 0) {
        return {
          caliber,
          currentAvg: null,
          trend: 'STABLE' as const,
          trendPercent: 0,
          priceTimingSignal: showPriceTimingSignal ? null : undefined,
          priceContext: 'INSUFFICIENT_DATA' as const,
          contextMeta: { windowDays, sampleCount: 0, asOf: asOf.toISOString() }
        }
      }

      const currentAvg = sampledPrices.reduce((sum, p) => sum + p, 0) / sampledPrices.length

      // Historical trend from pre-batched data
      const historicalPricesRaw = historicalPricesByCaliber.get(caliber) || []
      let trend: 'UP' | 'DOWN' | 'STABLE' = 'STABLE'
      let trendPercent = 0

      if (historicalPricesRaw.length > 0) {
        const historicalAvg =
          historicalPricesRaw.reduce((sum, p) => sum + p, 0) / historicalPricesRaw.length
        trendPercent = ((currentAvg - historicalAvg) / historicalAvg) * 100
        if (trendPercent < -3) trend = 'DOWN'
        else if (trendPercent > 3) trend = 'UP'
      }

      let priceContext: 'LOWER_THAN_RECENT' | 'WITHIN_RECENT_RANGE' | 'HIGHER_THAN_RECENT' = 'WITHIN_RECENT_RANGE'
      if (trend === 'DOWN') priceContext = 'LOWER_THAN_RECENT'
      else if (trend === 'UP') priceContext = 'HIGHER_THAN_RECENT'

      return {
        caliber,
        currentAvg: Math.round(currentAvg * 100) / 100,
        trend,
        trendPercent: Math.round(trendPercent * 10) / 10,
        priceContext,
        contextMeta: { windowDays, sampleCount: sampledPrices.length, asOf: asOf.toISOString() }
      }
    })

    // Cache for 5 minutes, keyed by windowDays (handled by CDN/proxy via Vary header)
    res.set('Cache-Control', 'private, max-age=300')
    res.set('Vary', 'Authorization')

    res.json({
      pulse: pulseData,
      _meta: {
        tier: userTier,
        calibersShown: calibers.length,
        calibersLimit: maxCalibers,
        windowDays,
        asOf: asOf.toISOString()
      }
    })
  } catch (error) {
    log.error('Market pulse error', { error }, error as Error)
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid parameters', details: error.issues })
    }
    res.status(500).json({ error: 'Failed to fetch market pulse' })
  }
})

// ============================================================================
// PERSONALIZED FEED ENDPOINT
// Returns personalized items based on alerts/watchlist
// Free: 5 items max, basic ranking
// Premium: 20 items, stock indicators, relative value context
//
// Query params:
//   scope=global  - Non-personalized, all calibers (for Best Prices section)
//   scope=watchlist - Personalized based on user's watchlist (default)
//   limit=N - Override max items returned (for global scope only)
// ============================================================================

const dealsQuerySchema = z.object({
  scope: z.enum(['global', 'watchlist']).default('watchlist'),
  limit: z.coerce.number().int().min(1).max(20).optional()
})

router.get('/deals', async (req: Request, res: Response) => {
  try {
    // Parse query params
    const { scope, limit: queryLimit } = dealsQuerySchema.parse(req.query)
    const isGlobalScope = scope === 'global'

    // For global scope, auth is optional (public endpoint)
    // For watchlist scope, auth is required
    const userId = getAuthenticatedUserId(req)
    if (!isGlobalScope && !userId) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    const userTier = userId ? await getUserTier(req) : 'FREE'

    // Determine max deals
    // For global scope: use limit param (default 5), cap at 20
    // For watchlist scope: use tier-based limit
    const maxDeals = isGlobalScope
      ? Math.min(queryLimit ?? 5, 20)
      : getMaxDealsForYou(userTier)

    const showPricePosition = !isGlobalScope && hasFeature(userTier, 'pricePositionIndex')
    const showStockIndicators = !isGlobalScope && hasFeature(userTier, 'stockIndicators')
    const showExplanations = !isGlobalScope && hasFeature(userTier, 'aiExplanations')

    // For global scope: no personalization
    // For watchlist scope: personalize based on user's watchlist
    let calibers: string[] = []
    let watchedProductIds = new Set<string>()

    if (!isGlobalScope && userId) {
      // Get user's calibers from saved items (watchlist) for personalization
      // Per ADR-011A Section 17.2: All user-facing queries MUST include deletedAt: null
      const watchlistItems = await prisma.watchlist_items.findMany({
        where: { userId, deletedAt: null },
        include: { products: { select: { caliber: true, id: true } } }
      })

      // Extract calibers and product IDs for personalization
      const calibersSet = new Set<string>()

      // Products may be null for SEARCH intent items; filter safely
      watchlistItems.forEach((w: any) => {
        if (w.products?.caliber) calibersSet.add(w.products.caliber)
        if (w.products?.id) watchedProductIds.add(w.products.id)
      })

      calibers = Array.from(calibersSet)
    }

    // ================================================================
    // OPTIMIZED: Query current_visible_prices directly with DB-side
    // sorting and limiting instead of fetching 10x products and
    // sorting in JS. Uses the ADR-015 derived table.
    // ================================================================

    // Build caliber filter
    const caliberFilter = (!isGlobalScope && calibers.length > 0)
      ? calibers
      : null

    // Freshness cutoff for global scope
    const twentyFourHoursAgo = new Date()
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24)

    // Single query: best price per product, sorted and limited in DB
    // Uses current_visible_prices (ADR-015) joined to products
    const bestPriceDeals = await prisma.$queryRaw<Array<{
      priceId: string
      productId: string
      productName: string
      productCaliber: string | null
      productBrand: string | null
      productImageUrl: string | null
      productRoundCount: number | null
      productGrainWeight: number | null
      price: any
      currency: string
      url: string
      inStock: boolean
      observedAt: Date
      retailerId: string
      retailerName: string
      retailerTier: string
    }>>`
      WITH ranked AS (
        SELECT
          cvp.id as "priceId",
          p.id as "productId",
          p.name as "productName",
          p.caliber as "productCaliber",
          p.brand as "productBrand",
          p."imageUrl" as "productImageUrl",
          p."roundCount" as "productRoundCount",
          p."grainWeight" as "productGrainWeight",
          cvp."visiblePrice" as price,
          cvp.currency,
          cvp.url,
          cvp."inStock",
          cvp."observedAt",
          cvp."retailerId",
          cvp."retailerName",
          cvp."retailerTier",
          ROW_NUMBER() OVER (
            PARTITION BY p.id
            ORDER BY
              CASE WHEN cvp."retailerTier" = 'PREMIUM' THEN 0 ELSE 1 END,
              cvp."visiblePrice" ASC
          ) as rn
        FROM current_visible_prices cvp
        JOIN products p ON p.id = cvp."productId"
        WHERE cvp."inStock" = true
          AND cvp."observedAt" >= ${isGlobalScope ? twentyFourHoursAgo : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)}
          ${caliberFilter ? Prisma.sql`AND p.caliber = ANY(${caliberFilter})` : Prisma.empty}
      )
      SELECT * FROM ranked
      WHERE rn = 1
      ORDER BY
        CASE WHEN "retailerTier" = 'PREMIUM' THEN 0 ELSE 1 END,
        price ASC
      LIMIT ${maxDeals}
    `

    if (bestPriceDeals.length === 0) {
      return res.json({
        items: [],
        _meta: {
          scope,
          tier: isGlobalScope ? null : userTier,
          itemsShown: 0,
          itemsLimit: maxDeals,
          personalized: !isGlobalScope && calibers.length > 0,
          ...(isGlobalScope ? {} : { calibersUsed: calibers })
        }
      })
    }

    // Format deals from the single query result
    const deals = bestPriceDeals.map(row => {
      const priceNum = parseFloat(row.price.toString())
      const pricePerRound =
        row.productRoundCount && row.productRoundCount > 0
          ? priceNum / row.productRoundCount
          : null

      const deal: any = {
        id: row.priceId,
        product: {
          id: row.productId,
          name: row.productName,
          caliber: row.productCaliber,
          brand: row.productBrand,
          imageUrl: row.productImageUrl,
          roundCount: row.productRoundCount,
          grainWeight: row.productGrainWeight,
        },
        retailer: {
          id: row.retailerId,
          name: row.retailerName,
          tier: row.retailerTier,
        },
        price: priceNum,
        pricePerRound: pricePerRound ? Math.round(pricePerRound * 1000) / 1000 : null,
        url: row.url,
        inStock: row.inStock,
        updatedAt: row.observedAt?.toISOString() ?? null
      }

      // For watchlist scope, include user-specific fields
      if (!isGlobalScope) {
        deal.isWatched = watchedProductIds.has(row.productId)

        if (showPricePosition) {
          deal.pricePosition = {
            index: null,
            basis: 'SKU_MARKET_7D' as const,
            referenceSampleSize: 0,
            calculatedAt: null
          }
        }

        if (showExplanations && deal.isWatched) {
          deal.explanation = 'Matches your watchlist preferences'
        }
      }

      return deal
    })

    res.json({
      items: deals,
      _meta: {
        scope,
        tier: isGlobalScope ? null : userTier,
        itemsShown: deals.length,
        itemsLimit: maxDeals,
        personalized: !isGlobalScope && calibers.length > 0,
        ...(isGlobalScope ? {} : { calibersUsed: calibers })
      }
    })
  } catch (error) {
    log.error('Deals for you error', { error }, error as Error)
    res.status(500).json({ error: 'Failed to fetch results' })
  }
})

// ============================================================================
// PRICE DELTA ENDPOINT
// Returns price differences vs user's target prices (from alerts)
// This is purely arithmetic comparison - not a claim of actual savings
// Both tiers get the same data; no "verified savings" claims
// ============================================================================

router.get('/savings', async (req: Request, res: Response) => {
  try {
    // Get authenticated user from JWT
    const userId = getAuthenticatedUserId(req)
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    const userTier = await getUserTier(req)

    // Price Delta feature was deprecated with ADR-011
    // targetPrice no longer exists on the data model
    // Return empty data for backwards compatibility
    const deltaBreakdown: Array<{
      productId: string
      productName: string
      baselinePrice: number
      baselineType: 'USER_TARGET'
      currentPrice: number
      deltaAmount: number
      deltaPercent: number
    }> = []
    const totalDeltaAmount = 0

    res.json({
      priceDelta: {
        totalDeltaAmount: 0,
        breakdown: deltaBreakdown,
        alertsBelowTarget: 0,
        totalAlerts: 0
      },
      // Legacy field names for backwards compatibility during migration
      savings: {
        potentialSavings: 0,
        breakdown: [],
        alertsWithSavings: 0,
        totalAlerts: 0
      },
      _meta: {
        tier: userTier
      },
      _deprecated: 'Price delta/savings feature was deprecated with ADR-011. targetPrice no longer exists.'
    })
  } catch (error) {
    log.error('Savings error', { error }, error as Error)
    res.status(500).json({ error: 'Failed to fetch savings' })
  }
})

// ============================================================================
// PRICE HISTORY ENDPOINT
// Returns price history for a caliber
  // V1: 30/90/365 day charts for all users
// ============================================================================

const priceHistorySchema = z.object({
  days: z.coerce.number().int().min(7).max(365).default(30)
})

router.get('/price-history/:caliber', async (req: Request, res: Response) => {
  try {
    // Get authenticated user from JWT
    const userId = getAuthenticatedUserId(req)
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    const caliber = req.params.caliber as string
    const { days } = priceHistorySchema.parse(req.query)

    const userTier = await getUserTier(req)

    // Check if user has access to price history
    if (!hasPriceHistoryAccess(userTier)) {
        return res.status(403).json({
          error: 'Price history unavailable',
          message: 'Price history is not available for this request.',
          tier: userTier
        })
    }

    // Enforce tier-based history limit
    const maxDays = getPriceHistoryDays(userTier)
    const effectiveDays = Math.min(days, maxDays)

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - effectiveDays)

    // Get price history aggregated by day
    // Per Spec v1.2 0.0: Query through product_links for prices
    const decodedCaliber = decodeURIComponent(caliber)
    const products = await prisma.products.findMany({
      where: { caliber: decodedCaliber },
      select: { id: true }
    })

    const productIds = products.map(product => product.id)
    const links = productIds.length === 0
      ? []
      : await prisma.product_links.findMany({
          where: {
            productId: { in: productIds },
            status: { in: ['MATCHED', 'CREATED'] }
          },
          select: { sourceProductId: true }
        })

    const sourceProductIds = links.map(link => link.sourceProductId)
    const prices = sourceProductIds.length === 0
      ? []
      : await prisma.prices.findMany({
          where: {
            sourceProductId: { in: sourceProductIds },
            observedAt: { gte: startDate },
            ...visibleHistoricalPriceWhere(),
          },
          select: {
            price: true,
            observedAt: true
          },
          orderBy: { observedAt: 'asc' }
        })

    // Aggregate by day
    const dailyData: Record<string, { prices: number[]; date: string }> = {}

    for (const price of prices) {
      const dateKey = price.observedAt.toISOString().split('T')[0]
      if (!dailyData[dateKey]) {
        dailyData[dateKey] = { prices: [], date: dateKey }
      }
      // price is a Decimal-like object; convert explicitly to number
      dailyData[dateKey].prices.push(parseFloat(price.price.toString()))
    }

    // Calculate daily averages
    const history = Object.values(dailyData).map(day => ({
      date: day.date,
      avgPrice: Math.round((day.prices.reduce((a, b) => a + b, 0) / day.prices.length) * 100) / 100,
      minPrice: Math.round(Math.min(...day.prices) * 100) / 100,
      maxPrice: Math.round(Math.max(...day.prices) * 100) / 100,
      dataPoints: day.prices.length
    }))

    // Shape history based on tier (FREE gets summary only, PREMIUM gets full history)
    const shapedHistory = shapePriceHistory(history, userTier)

    res.json({
      caliber: decodedCaliber,
      days: effectiveDays,
      ...shapedHistory,
      _meta: {
        tier: userTier,
        requestedDays: days,
        effectiveDays,
        maxDaysAllowed: maxDays,
        ...(userTier === 'FREE' && {
          upgradeMessage: 'Price history availability varies by product.'
        })
      }
    })
  } catch (error) {
    log.error('Price history error', { error }, error as Error)
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid parameters', details: error.issues })
    }
    res.status(500).json({ error: 'Failed to fetch price history' })
  }
})

export { router as dashboardRouter }

