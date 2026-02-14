import { describe, expect, it, vi } from 'vitest'

vi.mock('@ironscout/db', () => ({
  prisma: {
    products: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    $queryRawUnsafe: vi.fn().mockResolvedValue([]),
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
      originalQuery: 'test',
    }),
  }
})

vi.mock('../../embedding-service', () => ({
  generateEmbedding: vi.fn().mockResolvedValue(new Array(1536).fill(0)),
  buildProductText: vi.fn().mockReturnValue('test'),
}))

vi.mock('../../price-resolver', () => ({
  batchGetPricesViaProductLinks: vi.fn().mockResolvedValue(new Map()),
  batchGetPricesWithConfidence: vi.fn().mockResolvedValue({ confidenceMap: new Map() }),
}))

vi.mock('../../price-signal-index', () => ({
  batchCalculatePriceSignalIndex: vi.fn().mockResolvedValue(new Map()),
}))

vi.mock('../../premium-ranking', () => ({
  applyPremiumRanking: vi.fn().mockImplementation((products) => products),
  applyFreeRanking: vi.fn().mockImplementation((products) => products),
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

vi.mock('../../../config/logger', () => ({
  loggers: {
    ai: {
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  },
}))

import type { ExplicitFilters } from '../../search-service'
import { _testExports } from '../../search-service'
import { FUNCTIONAL_FILTER_DIMENSIONS } from './search-filter-catalog'
import { generatePairwiseFilterCombos } from './pairwise-generator'
import {
  assertReturnedProductsMatchFilters,
  matchesExplicitFilterContract,
  matchesPriceConditions,
  matchesWhereClause,
} from './search-functional-assertions'
import { SYNTHETIC_PRODUCTS } from './search-functional-fixtures'

const { buildWhereClause, buildPriceConditions } = _testExports

const EMPTY_INTENT = {
  originalQuery: '',
  confidence: 0.9,
} as any

const RICH_AI_INTENT = {
  originalQuery: '',
  confidence: 0.9,
  calibers: ['9mm'],
  purpose: 'Target',
  brands: ['Federal'],
  grainWeights: [115, 124],
  caseMaterials: ['Brass'],
} as any

function runBuilder(filters: ExplicitFilters, isPremium: boolean): string[] {
  const where = buildWhereClause(EMPTY_INTENT, filters, isPremium)
  const priceConditions = buildPriceConditions(EMPTY_INTENT, filters)

  return SYNTHETIC_PRODUCTS
    .filter(p => matchesWhereClause(p, where))
    .filter(p => matchesPriceConditions(p, priceConditions))
    .map(p => p.id)
    .sort()
}

function runContract(filters: ExplicitFilters, isPremium: boolean): string[] {
  return SYNTHETIC_PRODUCTS
    .filter(p => matchesExplicitFilterContract(p, filters, isPremium))
    .map(p => p.id)
    .sort()
}

describe('Search Functional Matrix', () => {
  const pairwiseCombos = generatePairwiseFilterCombos(FUNCTIONAL_FILTER_DIMENSIONS)

  it('covers pairwise permutations of explicit filters with contract-equal results', () => {
    expect(pairwiseCombos.length).toBeGreaterThan(0)

    for (const filters of pairwiseCombos) {
      const actual = runBuilder(filters, true)
      const expected = runContract(filters, true)
      expect(actual).toEqual(expected)

      const rows = SYNTHETIC_PRODUCTS.filter(p => actual.includes(p.id))
      assertReturnedProductsMatchFilters(rows, filters, true)
    }
  })

  it('treats premium-only filters as no-ops for FREE behavior', () => {
    const filters: ExplicitFilters = {
      bulletType: 'FMJ',
      pressureRating: 'STANDARD',
      isSubsonic: true,
      minVelocity: 900,
      maxVelocity: 1300,
    }

    const actualFree = runBuilder(filters, false)
    const expectedFree = runContract({}, false)
    expect(actualFree).toEqual(expectedFree)
  })

  it('applies isSubsonic=false as an explicit filter when premium', () => {
    const filters: ExplicitFilters = { isSubsonic: false }
    const actual = runBuilder(filters, true)
    const expected = runContract(filters, true)
    expect(actual).toEqual(expected)
  })

  it('treats inStock=false as no-op in price conditions (current behavior)', () => {
    const filters: ExplicitFilters = { inStock: false }
    const actual = runBuilder(filters, true)
    const expected = runContract({}, true)
    expect(actual).toEqual(expected)
  })

  it('does not hard-filter by AI-only purpose/brand/grain/case fields', () => {
    const where = buildWhereClause(RICH_AI_INTENT, {}, true)
    expect(where.purpose).toBeUndefined()
    expect(where.brand).toBeUndefined()
    expect(where.grainWeight).toBeUndefined()
    expect(where.caseMaterial).toBeUndefined()
  })

  it('adding an explicit filter yields subset-or-equal results', () => {
    const base: ExplicitFilters = { caliber: '9mm' }
    const tighter: ExplicitFilters = { caliber: '9mm', brand: 'Federal' }

    const baseIds = new Set(runBuilder(base, true))
    const tighterIds = runBuilder(tighter, true)

    for (const id of tighterIds) {
      expect(baseIds.has(id)).toBe(true)
    }
  })

  it('expands slash caliber filters into alternative caliber parts', () => {
    const filters: ExplicitFilters = { caliber: '.223/5.56' }

    const actual = runBuilder(filters, true)
    const expected = runContract(filters, true)

    expect(actual).toEqual(expected)
    expect(actual).toContain('p3-223-target-federal')
  })
})
