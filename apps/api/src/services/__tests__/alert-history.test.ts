/**
 * Alert History Service Tests (alert-history-v1 spec §11)
 *
 * Tests for:
 * - User-scoped query (only returns authenticated user's events)
 * - Cursor-based pagination (hasMore, nextCursor)
 * - Retailer redaction when ineligible (ADR-005)
 * - Superseded product resolution (spec §10)
 * - Invalid cursor handling
 * - Empty result set
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.mock must use inline factory - cannot reference external variables
vi.mock('@ironscout/db', () => ({
  prisma: {
    $queryRaw: vi.fn(),
    retailers: {
      findMany: vi.fn(),
    },
    watchlist_items: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
  Prisma: {},
  AlertRuleType: {},
}))

vi.mock('@ironscout/db/visibility.js', () => ({
  visibleRetailerWhere: () => ({ visibilityStatus: 'ELIGIBLE' }),
}))

vi.mock('../../config/tiers', () => ({
  visiblePriceWhere: () => ({}),
}))

// Import the mocked prisma after vi.mock
import { prisma } from '@ironscout/db'
const mockPrisma = prisma as any

// Import after mocking
import { getAlertHistory, InvalidCursorError } from '../saved-items'

// Test helpers
function makeEventRow(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'evt_1',
    eventType: 'PRICE_DROP',
    triggeredAt: new Date('2026-02-08T18:00:00Z'),
    priceAtTrigger: '19.99',
    previousPrice: '24.99',
    currency: 'USD',
    retailerId: 'ret_1',
    eventProductId: 'prod_1',
    productName: 'Federal 9mm 115gr 100rd',
    supersededById: null,
    supersedingProductId: null,
    supersedingProductName: null,
    ...overrides,
  }
}

describe('alert-history-v1: getAlertHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: retailers are visible
    mockPrisma.retailers.findMany.mockResolvedValue([
      { id: 'ret_1', name: 'MidwayUSA' },
    ])
  })

  // =========================================================================
  // §11 API: Auth / user scoping
  // =========================================================================

  it('queries alert_events for the given userId', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([])

    await getAlertHistory('user_123', 50)

    // Verify the raw query was called (we can't inspect tagged template args easily,
    // but we verify it was called once)
    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1)
  })

  // =========================================================================
  // §11 API: Cursor pagination
  // =========================================================================

  it('returns hasMore=false and nextCursor=null when fewer than limit rows', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([makeEventRow()])

    const result = await getAlertHistory('user_1', 50)

    expect(result._meta.hasMore).toBe(false)
    expect(result._meta.nextCursor).toBeNull()
    expect(result._meta.schemaVersion).toBe(1)
    expect(result.history).toHaveLength(1)
  })

  it('returns hasMore=true and a nextCursor when more rows exist', async () => {
    // Simulate limit=2, fetch 3 (limit+1), only return 2
    const rows = [
      makeEventRow({ id: 'evt_1', triggeredAt: new Date('2026-02-08T18:00:00Z') }),
      makeEventRow({ id: 'evt_2', triggeredAt: new Date('2026-02-08T17:00:00Z') }),
      makeEventRow({ id: 'evt_3', triggeredAt: new Date('2026-02-08T16:00:00Z') }),
    ]
    mockPrisma.$queryRaw.mockResolvedValue(rows)

    const result = await getAlertHistory('user_1', 2)

    expect(result._meta.hasMore).toBe(true)
    expect(result._meta.nextCursor).toBeTruthy()
    expect(result.history).toHaveLength(2)
    // Cursor should be opaque base64
    expect(() => atob(result._meta.nextCursor!)).not.toThrow()
  })

  it('accepts a cursor for subsequent page requests', async () => {
    // First page
    const page1Rows = [
      makeEventRow({ id: 'evt_1', triggeredAt: new Date('2026-02-08T18:00:00Z') }),
      makeEventRow({ id: 'evt_2', triggeredAt: new Date('2026-02-08T17:00:00Z') }),
      makeEventRow({ id: 'evt_3', triggeredAt: new Date('2026-02-08T16:00:00Z') }),
    ]
    mockPrisma.$queryRaw.mockResolvedValue(page1Rows)
    const page1 = await getAlertHistory('user_1', 2)

    // Second page
    mockPrisma.$queryRaw.mockResolvedValue([
      makeEventRow({ id: 'evt_4', triggeredAt: new Date('2026-02-08T15:00:00Z') }),
    ])
    const page2 = await getAlertHistory('user_1', 2, page1._meta.nextCursor!)

    expect(page2.history).toHaveLength(1)
    expect(page2._meta.hasMore).toBe(false)
  })

  it('throws InvalidCursorError for malformed cursor', async () => {
    await expect(getAlertHistory('user_1', 50, 'not-valid-base64!@#'))
      .rejects.toThrow(InvalidCursorError)
  })

  it('throws InvalidCursorError for cursor with invalid date', async () => {
    const badCursor = Buffer.from('not-a-date|some-id').toString('base64')
    await expect(getAlertHistory('user_1', 50, badCursor))
      .rejects.toThrow(InvalidCursorError)
  })

  it('clamps limit to max 100', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([])

    const result = await getAlertHistory('user_1', 999)

    expect(result._meta.limit).toBe(100)
  })

  it('clamps limit to min 1', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([])

    const result = await getAlertHistory('user_1', 0)

    expect(result._meta.limit).toBe(1)
  })

  // =========================================================================
  // §11 ADR-005: Retailer redaction
  // =========================================================================

  it('includes retailer name when retailer is eligible (ADR-005)', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      makeEventRow({ retailerId: 'ret_1' }),
    ])
    // visibleRetailerWhere query returns this retailer as visible
    mockPrisma.retailers.findMany
      .mockResolvedValueOnce([{ id: 'ret_1', name: 'MidwayUSA' }]) // visible check
      .mockResolvedValueOnce([{ id: 'ret_1', name: 'MidwayUSA' }]) // name lookup

    const result = await getAlertHistory('user_1', 50)

    expect(result.history[0].metadata.retailer).toBe('MidwayUSA')
  })

  it('redacts retailer to null when ineligible (ADR-005)', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      makeEventRow({ retailerId: 'ret_ineligible' }),
    ])
    // visibleRetailerWhere query returns empty — retailer not visible
    mockPrisma.retailers.findMany
      .mockResolvedValueOnce([]) // visible check: not eligible
      .mockResolvedValueOnce([{ id: 'ret_ineligible', name: 'Shady Store' }]) // name lookup

    const result = await getAlertHistory('user_1', 50)

    // Redaction: retailer key is present but value is null
    expect(result.history[0].metadata).toHaveProperty('retailer')
    expect(result.history[0].metadata.retailer).toBeNull()
  })

  it('sets retailer to null when no retailerId on event', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      makeEventRow({ retailerId: null }),
    ])

    const result = await getAlertHistory('user_1', 50)

    expect(result.history[0].metadata.retailer).toBeNull()
  })

  // =========================================================================
  // §10: Superseded product resolution
  // =========================================================================

  it('resolves superseded products to current product (spec §10)', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      makeEventRow({
        eventProductId: 'prod_old',
        productName: 'Old Name',
        supersededById: 'prod_new',
        supersedingProductId: 'prod_new',
        supersedingProductName: 'New Name',
      }),
    ])

    const result = await getAlertHistory('user_1', 50)

    expect(result.history[0].productId).toBe('prod_new')
    expect(result.history[0].productName).toBe('New Name')
    expect(result.history[0].metadata.originalProductId).toBe('prod_old')
  })

  it('does not include originalProductId when product is not superseded', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([makeEventRow()])

    const result = await getAlertHistory('user_1', 50)

    expect(result.history[0].metadata.originalProductId).toBeUndefined()
  })

  // =========================================================================
  // Response shape
  // =========================================================================

  it('maps PRICE_DROP event with price details', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      makeEventRow({
        eventType: 'PRICE_DROP',
        priceAtTrigger: '19.99',
        previousPrice: '24.99',
      }),
    ])

    const result = await getAlertHistory('user_1', 50)

    const entry = result.history[0]
    expect(entry.type).toBe('PRICE_DROP')
    expect(entry.metadata.newPrice).toBe(19.99)
    expect(entry.metadata.oldPrice).toBe(24.99)
    expect(entry.metadata.currency).toBe('USD')
  })

  it('maps BACK_IN_STOCK event without oldPrice', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      makeEventRow({
        eventType: 'BACK_IN_STOCK',
        priceAtTrigger: '19.99',
        previousPrice: null,
      }),
    ])

    const result = await getAlertHistory('user_1', 50)

    const entry = result.history[0]
    expect(entry.type).toBe('BACK_IN_STOCK')
    expect(entry.metadata.newPrice).toBe(19.99)
    expect(entry.metadata.oldPrice).toBeUndefined()
  })

  it('handles missing product name gracefully', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      makeEventRow({ productName: null, eventProductId: null }),
    ])

    const result = await getAlertHistory('user_1', 50)

    expect(result.history[0].productName).toBe('Product unavailable')
  })

  it('returns empty history array when no events exist', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([])

    const result = await getAlertHistory('user_1', 50)

    expect(result.history).toEqual([])
    expect(result._meta.hasMore).toBe(false)
    expect(result._meta.nextCursor).toBeNull()
  })

  it('returns triggeredAt as ISO string', async () => {
    const ts = new Date('2026-02-08T18:45:12.000Z')
    mockPrisma.$queryRaw.mockResolvedValue([
      makeEventRow({ triggeredAt: ts }),
    ])

    const result = await getAlertHistory('user_1', 50)

    expect(result.history[0].triggeredAt).toBe('2026-02-08T18:45:12.000Z')
  })
})
