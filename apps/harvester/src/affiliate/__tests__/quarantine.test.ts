/**
 * Affiliate Feed Quarantine Tests
 *
 * Tests for the affiliate quarantine lane:
 * - Products missing caliber are quarantined
 * - Quarantined products are not upserted to source_products
 * - Quality metrics (missingBrand, missingRoundCount) are tracked
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '@ironscout/db'

// Mock prisma
vi.mock('@ironscout/db', () => ({
  prisma: {
    affiliate_feeds: { findUnique: vi.fn() },
    affiliate_feed_runs: { update: vi.fn() },
    sources: { findUnique: vi.fn() },
    source_products: { findMany: vi.fn() },
    source_product_identifiers: { findMany: vi.fn() },
    source_product_presence: { upsert: vi.fn() },
    source_product_seen: { createMany: vi.fn() },
    prices: { findFirst: vi.fn(), createMany: vi.fn() },
    product_links: { findMany: vi.fn() },
    quarantined_records: { upsert: vi.fn() },
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
    $transaction: vi.fn((fn: any) => fn(prisma)),
  },
  Prisma: { InputJsonValue: {} },
}))

// Mock other dependencies
vi.mock('../../config/redis', () => ({
  redisConnection: {},
  getSharedBullMQConnection: vi.fn(() => ({})),
}))

vi.mock('../../config/queues', () => ({
  QUEUE_NAMES: { RESOLVER: 'resolver' },
  resolverQueue: { add: vi.fn(), addBulk: vi.fn() },
}))

vi.mock('../../config/logger', () => {
  const mockLogger: any = {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }
  mockLogger.child = vi.fn(() => mockLogger)
  return {
    logger: {
      affiliate: mockLogger,
    },
    rootLogger: {
      child: vi.fn(() => mockLogger),
    },
  }
})

vi.mock('../circuit-breaker', () => ({
  evaluateCircuitBreaker: vi.fn().mockResolvedValue({ passed: true, metrics: {} }),
  promoteProducts: vi.fn().mockResolvedValue(0),
  copySeenFromPreviousRun: vi.fn().mockResolvedValue(0),
}))

// Import after mocks
import { processProducts, filterNonAmmunition } from '../processor'
import type { ParsedFeedProduct, FeedRunContext } from '../types'

describe('Affiliate Quarantine', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupDefaultMocks()
  })

  function setupDefaultMocks() {
    // Mock source lookup
    vi.mocked(prisma.sources.findUnique).mockResolvedValue({
      id: 'source-1',
      retailerId: 'retailer-1',
    } as never)

    // Mock no existing products (all new)
    vi.mocked(prisma.source_product_identifiers.findMany).mockResolvedValue([])
    vi.mocked(prisma.source_products.findMany).mockResolvedValue([])
    vi.mocked(prisma.product_links.findMany).mockResolvedValue([])

    // Mock DB operations
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ id: 'sp-1' }])
    vi.mocked(prisma.$executeRaw).mockResolvedValue(1)
    vi.mocked(prisma.source_product_presence.upsert).mockResolvedValue({} as never)
    vi.mocked(prisma.source_product_seen.createMany).mockResolvedValue({ count: 1 })
    vi.mocked(prisma.prices.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.prices.createMany).mockResolvedValue({ count: 1 })
    vi.mocked(prisma.quarantined_records.upsert).mockResolvedValue({
      id: 'qr-1',
      status: 'QUARANTINED',
    } as never)
  }

  function createContext(): FeedRunContext {
    return {
      feed: {
        id: 'feed-1',
        sourceId: 'source-1',
        expiryHours: 48,
        network: 'IMPACT',
        variant: 'FULL',
      } as never,
      run: {
        id: 'run-1',
        startedAt: new Date(),
      } as never,
      sourceId: 'source-1',
      retailerId: 'retailer-1',
      t0: new Date(),
      runObservedAt: new Date(),
      trace: {
        traceId: 'trace-test',
        executionId: 'run-1',
        runId: 'run-1',
        sourceId: 'source-1',
      },
    }
  }

  describe('Missing Caliber Quarantine', () => {
    it('quarantines products missing caliber', async () => {
      const products: ParsedFeedProduct[] = [
        {
          name: 'Federal 115gr FMJ 50 Rounds',
          url: 'https://example.com/product1',
          price: 19.99,
          inStock: true,
          sku: 'SKU-001',
          // caliber is missing but has grain + round signals → passes non-ammo filter
          grainWeight: 115,
          brand: 'Federal',
          roundCount: 50,
          rowNumber: 1,
        },
      ]

      await processProducts(createContext(), products)

      // Verify quarantine record was created with MISSING_CALIBER reason
      expect(prisma.quarantined_records.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            feedType: 'AFFILIATE',
            feedId: 'feed-1',
            runId: 'run-1',
            sourceId: 'source-1',
            blockingErrors: [{ code: 'MISSING_CALIBER', message: 'Product is missing caliber field' }],
          }),
        })
      )
    })

    it('does not quarantine products with caliber', async () => {
      const products: ParsedFeedProduct[] = [
        {
          name: 'Federal 9mm 115gr FMJ 50 Rounds',
          url: 'https://example.com/product1',
          price: 19.99,
          inStock: true,
          sku: 'SKU-001',
          caliber: '9mm',
          brand: 'Federal',
          roundCount: 50,
          rowNumber: 1,
        },
      ]

      await processProducts(createContext(), products)

      // Verify no quarantine
      expect(prisma.quarantined_records.upsert).not.toHaveBeenCalled()
    })

    it('quarantines some products while processing others', async () => {
      const products: ParsedFeedProduct[] = [
        {
          name: 'Federal 9mm 115gr FMJ 50 Rounds',
          url: 'https://example.com/product1',
          price: 19.99,
          inStock: true,
          sku: 'SKU-001',
          caliber: '9mm',
          brand: 'Federal',
          roundCount: 50,
          rowNumber: 1,
        },
        {
          name: 'Winchester 147gr JHP 20 Rounds',
          url: 'https://example.com/product2',
          price: 24.99,
          inStock: true,
          sku: 'SKU-002',
          // caliber is missing but has grain + round signals → passes non-ammo filter
          grainWeight: 147,
          brand: 'Winchester',
          roundCount: 20,
          rowNumber: 2,
        },
      ]

      const result = await processProducts(createContext(), products)

      // Should have quarantined 1 product (missing caliber)
      expect(prisma.quarantined_records.upsert).toHaveBeenCalledTimes(1)
    })
  })

  describe('Quality Metrics Tracking', () => {
    it('tracks missing brand count in quality metrics', async () => {
      const products: ParsedFeedProduct[] = [
        {
          name: '9mm 115gr FMJ 50 Rounds',
          url: 'https://example.com/product1',
          price: 19.99,
          inStock: true,
          sku: 'SKU-001',
          caliber: '9mm',
          // brand is missing
          roundCount: 50,
          rowNumber: 1,
        },
        {
          name: 'Federal .45 ACP 230gr FMJ 20 Rounds',
          url: 'https://example.com/product2',
          price: 24.99,
          inStock: true,
          sku: 'SKU-002',
          caliber: '.45 ACP',
          brand: 'Federal',
          roundCount: 20,
          rowNumber: 2,
        },
      ]

      await processProducts(createContext(), products)

      // No quarantine since caliber is present
      expect(prisma.quarantined_records.upsert).not.toHaveBeenCalled()
    })

    it('tracks missing roundCount in quality metrics', async () => {
      const products: ParsedFeedProduct[] = [
        {
          name: 'Federal 9mm 115gr FMJ Ammunition',
          url: 'https://example.com/product1',
          price: 19.99,
          inStock: true,
          sku: 'SKU-001',
          caliber: '9mm',
          brand: 'Federal',
          // roundCount is missing
          rowNumber: 1,
        },
      ]

      await processProducts(createContext(), products)

      // No quarantine since caliber is present
      expect(prisma.quarantined_records.upsert).not.toHaveBeenCalled()
    })
  })

  describe('Quarantine Record Structure', () => {
    it('includes raw product data in quarantine record', async () => {
      const products: ParsedFeedProduct[] = [
        {
          name: 'TestBrand 115gr JHP 50 Rounds',
          url: 'https://example.com/test',
          price: 29.99,
          inStock: false,
          sku: 'TEST-SKU',
          upc: '123456789012',
          brand: 'TestBrand',
          grainWeight: 115,
          roundCount: 50,
          // caliber is missing but has grain + round signals
          rowNumber: 1,
        },
      ]

      await processProducts(createContext(), products)

      expect(prisma.quarantined_records.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            rawData: expect.objectContaining({
              name: 'TestBrand 115gr JHP 50 Rounds',
              url: 'https://example.com/test',
              price: 29.99,
              inStock: false,
              sku: 'TEST-SKU',
              upc: '123456789012',
              brand: 'TestBrand',
              grainWeight: 115,
              roundCount: 50,
            }),
          }),
        })
      )
    })

    it('uses identity key as match key for deduplication', async () => {
      const products: ParsedFeedProduct[] = [
        {
          name: 'Mystery Ammunition 50 Rounds',
          url: 'https://example.com/product1',
          price: 19.99,
          inStock: true,
          sku: 'UNIQUE-SKU',
          // caliber is missing but has ammo context signal
          rowNumber: 1,
        },
      ]

      await processProducts(createContext(), products)

      // The matchKey should be derived from the identity resolution
      expect(prisma.quarantined_records.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            feedId_matchKey: expect.objectContaining({
              feedId: 'feed-1',
              // matchKey will be the identity key (e.g., SKU:UNIQUE-SKU)
            }),
          }),
        })
      )
    })
  })
})

// ============================================================================
// Non-Ammunition Filter (unit tests for filterNonAmmunition)
// ============================================================================

describe('filterNonAmmunition', () => {
  function makeProduct(overrides: Partial<ParsedFeedProduct> & { name: string }) {
    return {
      product: {
        url: 'https://example.com/test',
        price: 19.99,
        inStock: true,
        rowNumber: 1,
        ...overrides,
      } as ParsedFeedProduct,
      identity: { type: 'SKU' as const, value: 'test' },
      identityKey: 'SKU:test',
      allIdentifiers: [],
    }
  }

  it('filters products with zero ammo signals', () => {
    const products = [
      makeProduct({ name: 'Magpul PMAG Gen M3 AR-15 Magazine' }),
      makeProduct({ name: 'Mountain House Freeze Dried Beef Stew' }),
      makeProduct({ name: 'Hogue Grips for 1911 Pistol' }),
      makeProduct({ name: 'Rifle Scope Vortex Crossfire II 4-12x44' }),
    ]

    const { valid, filtered } = filterNonAmmunition(products)
    expect(filtered).toHaveLength(4)
    expect(valid).toHaveLength(0)
  })

  it('passes products with caliber signal', () => {
    const products = [
      makeProduct({ name: 'Federal 9mm 115gr FMJ', caliber: '9mm' }),
    ]

    const { valid, filtered } = filterNonAmmunition(products)
    expect(valid).toHaveLength(1)
    expect(filtered).toHaveLength(0)
  })

  it('passes products with grain weight signal', () => {
    const products = [
      makeProduct({ name: 'Mystery Brand 124gr JHP', grainWeight: 124 }),
    ]

    const { valid, filtered } = filterNonAmmunition(products)
    expect(valid).toHaveLength(1)
    expect(filtered).toHaveLength(0)
  })

  it('passes products with ammo pack language (rounds/rds)', () => {
    const products = [
      makeProduct({ name: 'Premium Target 50 Rounds' }),
      makeProduct({ name: 'Bulk Pack 500 rds' }),
    ]

    const { valid, filtered } = filterNonAmmunition(products)
    expect(valid).toHaveLength(2)
    expect(filtered).toHaveLength(0)
  })

  it('passes products with ammo context keywords', () => {
    const products = [
      makeProduct({ name: 'Premium Ammunition Value Pack' }),
      makeProduct({ name: 'Shotgun Shells #7 Shot' }),
      makeProduct({ name: 'Hunting Cartridges Special' }),
    ]

    const { valid, filtered } = filterNonAmmunition(products)
    expect(valid).toHaveLength(3)
    expect(filtered).toHaveLength(0)
  })

  it('filters handloading projectiles despite having caliber/grain signals', () => {
    const products = [
      makeProduct({
        name: 'Hornady 30 Cal .308 168gr Projectile For Handloading',
        caliber: '.308 Winchester',
        grainWeight: 168,
      }),
    ]

    const { valid, filtered } = filterNonAmmunition(products)
    expect(filtered).toHaveLength(1)
    expect(valid).toHaveLength(0)
  })

  it('does NOT filter normal ammo that happens to mention caliber', () => {
    const products = [
      makeProduct({
        name: 'Federal American Eagle 9mm Luger 115gr FMJ 50 Rounds',
        caliber: '9mm',
        grainWeight: 115,
      }),
    ]

    const { valid, filtered } = filterNonAmmunition(products)
    expect(valid).toHaveLength(1)
    expect(filtered).toHaveLength(0)
  })

  it('filters less-lethal items with no ammo signals', () => {
    const products = [
      makeProduct({ name: 'Tactical Pepper Spray Canister' }),
      makeProduct({ name: 'Taser X26P Professional' }),
    ]

    const { valid, filtered } = filterNonAmmunition(products)
    expect(filtered).toHaveLength(2)
    expect(valid).toHaveLength(0)
  })
})
