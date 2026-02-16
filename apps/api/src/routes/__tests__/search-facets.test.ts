import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGroupBy } = vi.hoisted(() => ({ mockGroupBy: vi.fn() }))

vi.mock('@ironscout/db', () => ({
  prisma: {
    products: {
      groupBy: mockGroupBy,
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    prices: { findMany: vi.fn().mockResolvedValue([]) },
  },
}))
vi.mock('../../config/tiers', () => ({
  hasPriceHistoryAccess: vi.fn(),
  getPriceHistoryDays: vi.fn(),
  shapePriceHistory: vi.fn(),
  visibleHistoricalPriceWhere: vi.fn(),
}))
vi.mock('../../middleware/auth', () => ({ getUserTier: vi.fn().mockReturnValue('free') }))
vi.mock('../../config/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  loggers: { products: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } },
}))
vi.mock('../../services/ai-search/price-resolver', () => ({
  batchGetPricesViaProductLinks: vi.fn(),
  getPricesViaProductLinks: vi.fn(),
}))
vi.mock('../../services/upc-lookup', () => ({ lookupByUpc: vi.fn() }))
vi.mock('../../services/outbound-url', () => ({ generateOutUrl: vi.fn() }))

import express from 'express'
import request from 'supertest'
import { productsRouter as router } from '../products'

function buildApp() {
  const app = express()
  app.use(express.json())
  // Fake auth middleware so getUserTier doesn't blow up
  app.use((req: any, _res, next) => {
    req.user = { id: 'test', tier: 'free' }
    next()
  })
  app.use('/api/products', router)
  return app
}

describe('GET /api/products/search facets', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('always returns all 6 facet keys even when groupBy results are empty', async () => {
    // groupBy called 6 times (once per facet field), all return empty
    mockGroupBy.mockResolvedValue([])

    const app = buildApp()
    const res = await request(app).get('/api/products/search?q=test')

    expect(res.status).toBe(200)
    const { facets } = res.body
    expect(facets).toBeDefined()
    expect(facets.calibers).toEqual({})
    expect(facets.grainWeights).toEqual({})
    expect(facets.caseMaterials).toEqual({})
    expect(facets.purposes).toEqual({})
    expect(facets.brands).toEqual({})
    expect(facets.categories).toEqual({})
  })

  it('filters out null values from groupBy results', async () => {
    mockGroupBy.mockImplementation(({ by }: { by: string[] }) => {
      const field = by[0]
      if (field === 'caliber') {
        return Promise.resolve([
          { caliber: '9mm', _count: { caliber: 5 } },
          { caliber: null, _count: { caliber: 2 } },
        ])
      }
      return Promise.resolve([])
    })

    const app = buildApp()
    const res = await request(app).get('/api/products/search?q=test')

    expect(res.status).toBe(200)
    const { facets } = res.body
    expect(facets.calibers).toEqual({ '9mm': 5 })
    expect(facets.calibers).not.toHaveProperty('null')
  })

  it('maps counts correctly from _count structure', async () => {
    mockGroupBy.mockImplementation(({ by }: { by: string[] }) => {
      const field = by[0]
      if (field === 'brand') {
        return Promise.resolve([
          { brand: 'Federal', _count: { brand: 10 } },
          { brand: 'Hornady', _count: { brand: 7 } },
          { brand: 'Winchester', _count: { brand: 3 } },
        ])
      }
      if (field === 'grainWeight') {
        return Promise.resolve([
          { grainWeight: '115', _count: { grainWeight: 8 } },
          { grainWeight: '124', _count: { grainWeight: 4 } },
        ])
      }
      return Promise.resolve([])
    })

    const app = buildApp()
    const res = await request(app).get('/api/products/search?q=test')

    expect(res.status).toBe(200)
    const { facets } = res.body
    expect(facets.brands).toEqual({ Federal: 10, Hornady: 7, Winchester: 3 })
    expect(facets.grainWeights).toEqual({ '115': 8, '124': 4 })
  })

  it('issues 6 parallel groupBy calls', async () => {
    mockGroupBy.mockResolvedValue([])

    const app = buildApp()
    await request(app).get('/api/products/search?q=test')

    expect(mockGroupBy).toHaveBeenCalledTimes(6)
    const byFields = mockGroupBy.mock.calls.map((call: any[]) => call[0].by[0])
    expect(byFields).toEqual([
      'caliber',
      'grainWeight',
      'caseMaterial',
      'purpose',
      'brand',
      'category',
    ])
  })
})
