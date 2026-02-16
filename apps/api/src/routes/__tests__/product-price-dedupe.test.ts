import { describe, it, expect, vi } from 'vitest'

vi.mock('@ironscout/db', () => ({ prisma: {} }))
vi.mock('../../config/tiers', () => ({ hasPriceHistoryAccess: vi.fn(), getPriceHistoryDays: vi.fn(), shapePriceHistory: vi.fn(), visibleHistoricalPriceWhere: vi.fn() }))
vi.mock('../../middleware/auth', () => ({ getUserTier: vi.fn() }))
vi.mock('../../config/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }, loggers: { products: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } } }))
vi.mock('../../services/ai-search/price-resolver', () => ({ batchGetPricesViaProductLinks: vi.fn(), getPricesViaProductLinks: vi.fn() }))
vi.mock('../../services/upc-lookup', () => ({ lookupByUpc: vi.fn() }))

import { dedupeLatestByRetailer, getProductSortPricePerRound } from '../products'

describe('dedupeLatestByRetailer', () => {
  it('keeps the latest observedAt entry per retailer', () => {
    const prices = [
      { id: 'p1', observedAt: '2026-02-01T10:00:00Z', price: 20, retailers: { id: 'r1' } },
      { id: 'p2', observedAt: '2026-02-02T10:00:00Z', price: 22, retailers: { id: 'r1' } },
      { id: 'p3', observedAt: '2026-02-02T09:00:00Z', price: 18, retailers: { id: 'r2' } },
    ]

    const result = dedupeLatestByRetailer(prices)

    expect(result).toHaveLength(2)
    expect(result.find((p) => p.retailers.id === 'r1')?.id).toBe('p2')
    expect(result.find((p) => p.retailers.id === 'r2')?.id).toBe('p3')
  })

  it('breaks ties by lower price when observedAt is the same', () => {
    const prices = [
      { id: 'p1', observedAt: '2026-02-02T10:00:00Z', price: '10.00', retailers: { id: 'r1' } },
      { id: 'p2', observedAt: '2026-02-02T10:00:00Z', price: '9.00', retailers: { id: 'r1' } },
    ]

    const result = dedupeLatestByRetailer(prices)

    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe('p2')
  })

  it('preserves entries without retailer ids', () => {
    const prices = [
      { id: 'p1', observedAt: '2026-02-02T10:00:00Z', price: 10, retailers: { id: 'r1' } },
      { id: 'p2', observedAt: '2026-02-02T10:00:00Z', price: 11 },
      { id: 'p3', observedAt: '2026-02-02T10:00:00Z', price: 12 },
    ]

    const result = dedupeLatestByRetailer(prices)

    expect(result.find((p) => p.retailers?.id === 'r1')?.id).toBe('p1')
    expect(result.filter((p) => !p.retailers?.id)).toHaveLength(2)
  })
})

describe('getProductSortPricePerRound', () => {
  it('prefers in-stock prices and divides by round count', () => {
    const value = getProductSortPricePerRound({
      roundCount: 20,
      prices: [
        { price: 40, inStock: false },
        { price: 22, inStock: true },
        { price: 30, inStock: true },
      ],
    })

    expect(value).toBe(1.1)
  })

  it('falls back to total price when round count is missing', () => {
    const value = getProductSortPricePerRound({
      prices: [{ price: 18, inStock: true }],
    })

    expect(value).toBe(18)
  })

  it('returns infinity when no prices exist', () => {
    const value = getProductSortPricePerRound({
      roundCount: 1000,
      prices: [],
    })

    expect(value).toBe(Number.POSITIVE_INFINITY)
  })
})
