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
import { countExhaustiveFilterCombos, generateExhaustiveFilterCombos } from './exhaustive-generator'
import { EXHAUSTIVE_FILTER_DIMENSIONS } from './search-filter-catalog'
import {
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

function builderMask(filters: ExplicitFilters, isPremium: boolean): number {
  const where = buildWhereClause(EMPTY_INTENT, filters, isPremium)
  const priceConditions = buildPriceConditions(EMPTY_INTENT, filters)
  let mask = 0

  for (let i = 0; i < SYNTHETIC_PRODUCTS.length; i++) {
    const product = SYNTHETIC_PRODUCTS[i]
    if (matchesWhereClause(product, where) && matchesPriceConditions(product, priceConditions)) {
      mask |= (1 << i)
    }
  }

  return mask
}

function contractMask(filters: ExplicitFilters, isPremium: boolean): number {
  let mask = 0
  for (let i = 0; i < SYNTHETIC_PRODUCTS.length; i++) {
    if (matchesExplicitFilterContract(SYNTHETIC_PRODUCTS[i], filters, isPremium)) {
      mask |= (1 << i)
    }
  }
  return mask
}

const exhaustiveIt = process.env.RUN_EXHAUSTIVE_SEARCH_MATRIX === '1' ? it : it.skip

describe('Search Functional Exhaustive Matrix (Nightly)', () => {
  exhaustiveIt('checks every explicit-filter permutation for FREE and PREMIUM parity', () => {
    const expectedCount = countExhaustiveFilterCombos(EXHAUSTIVE_FILTER_DIMENSIONS)
    expect(expectedCount).toBe(1_572_864)

    let visited = 0
    for (const filters of generateExhaustiveFilterCombos(EXHAUSTIVE_FILTER_DIMENSIONS)) {
      visited++

      const premiumActual = builderMask(filters, true)
      const premiumExpected = contractMask(filters, true)
      if (premiumActual !== premiumExpected) {
        throw new Error(
          `Premium mismatch at combo #${visited}: ${JSON.stringify(filters)} actual=${premiumActual} expected=${premiumExpected}`
        )
      }

      const freeActual = builderMask(filters, false)
      const freeExpected = contractMask(filters, false)
      if (freeActual !== freeExpected) {
        throw new Error(
          `Free mismatch at combo #${visited}: ${JSON.stringify(filters)} actual=${freeActual} expected=${freeExpected}`
        )
      }
    }

    expect(visited).toBe(expectedCount)
  }, 900_000)
})
