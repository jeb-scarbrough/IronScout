import { describe, it, expect } from 'vitest'
import { dedupeLatestByRetailer } from '../products'

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
