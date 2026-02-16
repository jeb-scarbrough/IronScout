import { beforeEach, describe, expect, it, vi } from 'vitest'

const MOCK_PRODUCTS = vi.hoisted(() => [
  {
    id: 'p1',
    name: 'Federal 9mm FMJ 115gr',
    description: 'Training load',
    category: 'AMMUNITION',
    brand: 'Federal',
    imageUrl: 'https://example.com/p1.png',
    upc: '111',
    caliber: '9mm',
    caliberNorm: '9mm',
    grainWeight: 115,
    caseMaterial: 'Brass',
    purpose: 'Target',
    roundCount: 50,
    createdAt: new Date('2026-01-04T00:00:00.000Z'),
    bulletType: 'FMJ',
    pressureRating: 'STANDARD',
    muzzleVelocityFps: 1120,
    isSubsonic: false,
    shortBarrelOptimized: false,
    suppressorSafe: false,
    lowFlash: false,
    lowRecoil: true,
    controlledExpansion: false,
    matchGrade: false,
    factoryNew: true,
    dataSource: 'PARSED',
    dataConfidence: 0.9,
    metadata: {},
  },
  {
    id: 'p2',
    name: 'Hornady 9mm JHP 124gr',
    description: 'Defense load',
    category: 'AMMUNITION',
    brand: 'Hornady',
    imageUrl: 'https://example.com/p2.png',
    upc: '222',
    caliber: '9mm',
    caliberNorm: '9mm',
    grainWeight: 124,
    caseMaterial: 'Brass',
    purpose: 'Defense',
    roundCount: 20,
    createdAt: new Date('2026-01-03T00:00:00.000Z'),
    bulletType: 'JHP',
    pressureRating: 'PLUS_P',
    muzzleVelocityFps: 1180,
    isSubsonic: false,
    shortBarrelOptimized: true,
    suppressorSafe: false,
    lowFlash: true,
    lowRecoil: false,
    controlledExpansion: true,
    matchGrade: false,
    factoryNew: true,
    dataSource: 'PARSED',
    dataConfidence: 0.9,
    metadata: {},
  },
  {
    id: 'p3',
    name: 'Federal 9mm FMJ 147gr Subsonic',
    description: 'Subsonic load',
    category: 'AMMUNITION',
    brand: 'Federal',
    imageUrl: 'https://example.com/p3.png',
    upc: '333',
    caliber: '9mm',
    caliberNorm: '9mm',
    grainWeight: 147,
    caseMaterial: 'Brass',
    purpose: 'Target',
    roundCount: 50,
    createdAt: new Date('2026-01-02T00:00:00.000Z'),
    bulletType: 'FMJ',
    pressureRating: 'STANDARD',
    muzzleVelocityFps: 950,
    isSubsonic: true,
    shortBarrelOptimized: false,
    suppressorSafe: true,
    lowFlash: true,
    lowRecoil: true,
    controlledExpansion: false,
    matchGrade: false,
    factoryNew: true,
    dataSource: 'PARSED',
    dataConfidence: 0.9,
    metadata: {},
  },
  {
    id: 'p4',
    name: 'Speer 9mm Match 124gr',
    description: 'Match load',
    category: 'AMMUNITION',
    brand: 'Speer',
    imageUrl: 'https://example.com/p4.png',
    upc: '444',
    caliber: '9mm',
    caliberNorm: '9mm',
    grainWeight: 124,
    caseMaterial: 'Brass',
    purpose: 'Target',
    roundCount: 50,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    bulletType: 'JHP',
    pressureRating: 'STANDARD',
    muzzleVelocityFps: 1140,
    isSubsonic: false,
    shortBarrelOptimized: false,
    suppressorSafe: false,
    lowFlash: false,
    lowRecoil: true,
    controlledExpansion: true,
    matchGrade: true,
    factoryNew: true,
    dataSource: 'PARSED',
    dataConfidence: 0.9,
    metadata: {},
  },
])

const PRICE_BY_PRODUCT_ID = vi.hoisted<Record<string, number>>(() => ({
  p1: 0.32,
  p2: 0.88,
  p3: 0.44,
  p4: 0.91,
}))

const POSITION_BY_PRODUCT_ID = vi.hoisted<Record<string, number>>(() => ({
  p1: 0.2,
  p2: 0.7,
  p3: 0.4,
  p4: 0.9,
}))

function projectSelectedFields(row: any, select?: Record<string, boolean>): any {
  if (!select) return { ...row }
  const projected: Record<string, unknown> = {}
  for (const key of Object.keys(select)) {
    if (select[key]) {
      projected[key] = row[key]
    }
  }
  return projected
}

vi.mock('@ironscout/db', () => ({
  prisma: {
    products: {
      findMany: vi.fn().mockImplementation(async (args: any = {}) => {
        let rows = [...MOCK_PRODUCTS]

        if (args.where?.id?.in) {
          const idSet = new Set(args.where.id.in as string[])
          rows = rows.filter(p => idSet.has(p.id))
        }

        if (args.orderBy?.createdAt === 'desc') {
          rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        }
        if (args.orderBy?.createdAt === 'asc') {
          rows.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        }

        const skip = args.skip ?? 0
        const take = args.take ?? rows.length
        rows = rows.slice(skip, skip + take)

        return rows.map(r => projectSelectedFields(r, args.select))
      }),
      count: vi.fn().mockResolvedValue(MOCK_PRODUCTS.length),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    $queryRawUnsafe: vi.fn().mockImplementation(async (_sql: string, ...params: unknown[]) => {
      const offset = Number(params[params.length - 1] ?? 0)
      const limit = Number(params[params.length - 2] ?? MOCK_PRODUCTS.length)
      const vectorRows = [
        { id: 'p1', similarity: 0.95 },
        { id: 'p2', similarity: 0.90 },
        { id: 'p3', similarity: 0.86 },
        { id: 'p4', similarity: 0.80 },
      ]
      return vectorRows.slice(offset, offset + limit)
    }),
    $disconnect: vi.fn(),
  },
  Prisma: {
    sql: vi.fn(),
  },
}))

vi.mock('../../intent-parser', async (importOriginal) => {
  const actual = await importOriginal() as any
  return {
    ...actual,
    parseSearchIntent: vi.fn().mockResolvedValue({
      calibers: ['9mm'],
      purpose: 'Target',
      confidence: 0.9,
      originalQuery: '9mm range ammo',
      keywords: ['9mm', 'range', 'ammo'],
    }),
  }
})

vi.mock('../../embedding-service', () => ({
  generateEmbedding: vi.fn().mockResolvedValue(new Array(8).fill(0.01)),
  buildProductText: vi.fn().mockReturnValue('9mm ammo'),
}))

vi.mock('../../price-resolver', () => ({
  batchGetPricesViaProductLinks: vi.fn().mockResolvedValue(new Map()),
  batchGetPricesWithConfidence: vi.fn().mockImplementation(async (productIds: string[]) => {
    const pricesMap = new Map()
    const confidenceMap = new Map()

    for (const id of productIds) {
      pricesMap.set(id, [
        {
          id: `price-${id}`,
          price: PRICE_BY_PRODUCT_ID[id] ?? 0.5,
          currency: 'USD',
          url: `https://example.com/${id}`,
          inStock: true,
          observedAt: new Date('2026-01-04T00:00:00.000Z'),
          retailers: {
            id: `ret-${id}`,
            name: `Retailer ${id}`,
            tier: 'STANDARD',
            logoUrl: null,
          },
        },
      ])
      confidenceMap.set(id, 0.95)
    }

    return { pricesMap, confidenceMap }
  }),
}))

vi.mock('../../price-signal-index', () => ({
  batchCalculatePriceSignalIndex: vi.fn().mockImplementation(async (products: any[]) => {
    const result = new Map()
    for (const product of products) {
      result.set(product.id, {
        relativePricePct: 0,
        positionInRange: POSITION_BY_PRODUCT_ID[product.id] ?? 0.5,
        contextBand: 'TYPICAL',
        meta: {
          windowDays: 30,
          sampleCount: 10,
          asOf: '2026-01-04T00:00:00.000Z',
        },
      })
    }
    return result
  }),
}))

vi.mock('../../premium-ranking', () => ({
  applyPremiumRanking: vi.fn().mockImplementation(async (products: any[]) => {
    return [...products]
      .sort((a, b) => (b._relevanceScore ?? 0) - (a._relevanceScore ?? 0))
      .map((product, idx) => ({
        ...product,
        premiumRanking: {
          finalScore: 100 - idx,
          breakdown: {
            baseRelevance: 30,
            performanceMatch: 20,
            priceContextBonus: 10,
            safetyBonus: 5,
          },
          priceSignal: {
            relativePricePct: 0,
            positionInRange: POSITION_BY_PRODUCT_ID[product.id] ?? 0.5,
            contextBand: 'TYPICAL',
            meta: {
              windowDays: 30,
              sampleCount: 10,
              asOf: '2026-01-04T00:00:00.000Z',
            },
          },
          badges: [],
          explanation: 'Matches your search criteria.',
        },
      }))
  }),
  applyFreeRanking: vi.fn().mockImplementation((products: any[]) => products),
}))

vi.mock('../../../lens', () => ({
  isLensEnabled: vi.fn().mockReturnValue(false),
  applyLensPipeline: vi.fn(),
  InvalidLensError: class extends Error {},
}))

vi.mock('../../cache', () => ({
  getCachedIntent: vi.fn().mockResolvedValue(null),
  cacheIntent: vi.fn().mockResolvedValue(undefined),
  getCachedEmbedding: vi.fn().mockResolvedValue(null),
  cacheEmbedding: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../outbound-url', () => ({
  generateOutUrl: vi.fn().mockReturnValue('https://example.com/out'),
}))

vi.mock('../../../../config/logger', () => ({
  loggers: {
    ai: {
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  },
  logger: {
    child: () => ({
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

import type { AISearchOptions, ExplicitFilters } from '../../search-service'
import { aiSearch } from '../../search-service'

interface OptionDimension<T extends keyof AISearchOptions> {
  key: T
  values: AISearchOptions[T][]
}

function generateOptionCombos(dimensions: Array<OptionDimension<any>>): AISearchOptions[] {
  const combos: AISearchOptions[] = []
  const current: AISearchOptions = {}

  function walk(index: number): void {
    if (index >= dimensions.length) {
      combos.push({ ...current })
      return
    }

    const dim = dimensions[index]
    for (const value of dim.values) {
      if (value === undefined) {
        delete (current as Record<string, unknown>)[dim.key]
      } else {
        ;(current as Record<string, unknown>)[dim.key] = value
      }
      walk(index + 1)
    }
  }

  walk(0)
  return combos
}

function getComparablePricePerRound(row: any): number {
  const prices = Array.isArray(row?.prices) ? row.prices : []
  if (prices.length === 0) return Infinity

  const inStock = prices.filter((price: any) => price?.inStock)
  const source = inStock.length > 0 ? inStock : prices

  const minTotal = Math.min(
    ...source.map((price: any) => {
      const parsed = parseFloat(String(price?.price))
      return Number.isFinite(parsed) ? parsed : Infinity
    })
  )

  const roundCount = Number(row?.roundCount)
  if (!Number.isFinite(roundCount) || roundCount <= 0) {
    return minTotal
  }

  return minTotal / roundCount
}

function isPriceSortedAsc(rows: any[]): boolean {
  for (let i = 1; i < rows.length; i++) {
    if (getComparablePricePerRound(rows[i - 1]) > getComparablePricePerRound(rows[i])) return false
  }
  return true
}

function isPriceSortedDesc(rows: any[]): boolean {
  for (let i = 1; i < rows.length; i++) {
    if (getComparablePricePerRound(rows[i - 1]) < getComparablePricePerRound(rows[i])) return false
  }
  return true
}

function isPositionSortedAsc(rows: any[]): boolean {
  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1].premium?.premiumRanking?.priceSignal?.positionInRange ?? 0.5
    const next = rows[i].premium?.premiumRanking?.priceSignal?.positionInRange ?? 0.5
    if (prev > next) return false
  }
  return true
}

function hasNoRecommendations(text: string): boolean {
  const lower = text.toLowerCase()
  return !(
    lower.includes('buy now') ||
    lower.includes('you should buy') ||
    lower.includes('guaranteed') ||
    lower.includes('deal score')
  )
}

const exhaustiveIt = process.env.RUN_EXHAUSTIVE_SEARCH_MATRIX === '1' ? it : it.skip

describe('Search Options Exhaustive Matrix (Nightly)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  exhaustiveIt('covers all configured option permutations and core invariants', async () => {
    const explicitFilterVariants: ExplicitFilters[] = [{}, { brand: 'Federal' }]
    const optionDimensions: Array<OptionDimension<any>> = [
      { key: 'sortBy', values: ['relevance', 'price_asc', 'price_desc', 'date_desc', 'date_asc', 'price_context'] },
      { key: 'useVectorSearch', values: [true, false] },
      { key: 'explicitFilters', values: explicitFilterVariants },
      { key: 'page', values: [1, 2] },
      { key: 'limit', values: [1, 3] },
      { key: 'lensId', values: [undefined, 'lens-nightly-test'] },
    ]

    const combos = generateOptionCombos(optionDimensions)
    expect(combos.length).toBe(192)

    for (const options of combos) {
      const result = await aiSearch('9mm range ammo', options)

      const hasExplicitFilters = Object.keys(options.explicitFilters ?? {}).length > 0
      const expectedVector = Boolean(options.useVectorSearch) && !hasExplicitFilters
      expect(result.searchMetadata.vectorSearchUsed).toBe(expectedVector)

      expect(result.pagination.page).toBe(options.page)
      expect(result.pagination.limit).toBe(options.limit)
      expect(result.products.length).toBeLessThanOrEqual(options.limit ?? 20)
      expect(result.searchMetadata.explicitFilters).toEqual(options.explicitFilters ?? {})
      expect(result.lens).toBeUndefined()

      if (options.sortBy === 'price_asc') {
        expect(isPriceSortedAsc(result.products)).toBe(true)
      }
      if (options.sortBy === 'price_desc') {
        expect(isPriceSortedDesc(result.products)).toBe(true)
      }
      if (options.sortBy === 'price_context') {
        expect(isPositionSortedAsc(result.products)).toBe(true)
      }

      for (const product of result.products) {
        const explanation = product.premium?.premiumRanking?.explanation
        if (typeof explanation === 'string' && explanation.length > 0) {
          expect(hasNoRecommendations(explanation)).toBe(true)
        }
      }
    }
  }, 900_000)
})
