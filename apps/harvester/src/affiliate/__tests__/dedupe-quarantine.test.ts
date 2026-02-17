import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@ironscout/db'
import { processProducts, filterNonAmmunition } from '../processor'
import {
  wouldSurviveQuarantine,
} from '../quarantine-predicates'
import type { FeedRunContext, ParsedFeedProduct } from '../types'

vi.mock('@ironscout/db', () => ({
  prisma: {
    sources: { findUnique: vi.fn() },
    source_product_identifiers: { findMany: vi.fn() },
    source_products: { findMany: vi.fn() },
    product_links: { findMany: vi.fn() },
    quarantined_records: { upsert: vi.fn() },
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
    $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn({})),
  },
  assertCuidFormat: vi.fn(),
  Prisma: { InputJsonValue: {} },
}))

vi.mock('../product-matcher', () => ({
  ProductMatcher: class {
    async batchMatchByUpc(items: Array<{ id: string }>) {
      return items.map((item) => ({
        sourceProductId: item.id,
        productId: null,
        linkWritten: false,
        needsResolver: false,
      }))
    }
    getStats() {
      return { cacheHits: 0, matchesFound: 0, cacheMisses: 0 }
    }
  },
}))

vi.mock('../../config/redis', () => ({
  redisConnection: {},
  getSharedBullMQConnection: vi.fn(() => ({})),
}))

vi.mock('../../config/queues', () => ({
  QUEUE_NAMES: { RESOLVER: 'resolver' },
  enqueueProductResolve: vi.fn().mockResolvedValue(undefined),
  alertQueue: { addBulk: vi.fn().mockResolvedValue(undefined) },
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

function createContext(): FeedRunContext {
  return {
    feed: {
      id: 'feed-1',
      sourceId: 'source-1',
      expiryHours: 48,
      network: 'IMPACT',
      variant: 'FULL',
      maxRowCount: 500_000,
    } as never,
    run: {
      id: 'run-cjld2cjxh0000qzrmn831i7rn',
      startedAt: new Date('2026-02-17T00:00:00.000Z'),
    } as never,
    sourceId: 'source-1',
    retailerId: 'retailer-1',
    t0: new Date('2026-02-17T00:00:00.000Z'),
    runObservedAt: new Date('2026-02-17T00:00:00.000Z'),
    trace: {
      traceId: 'trace-test',
      executionId: 'run-1',
      runId: 'run-cjld2cjxh0000qzrmn831i7rn',
      sourceId: 'source-1',
    },
  }
}

function makeProduct(
  rowNumber: number,
  overrides: Partial<ParsedFeedProduct> & { name: string; sku?: string }
): ParsedFeedProduct {
  return {
    name: overrides.name,
    url: overrides.url ?? `https://example.com/p/${rowNumber}`,
    price: overrides.price ?? 19.99,
    inStock: overrides.inStock ?? true,
    sku: overrides.sku,
    impactItemId: overrides.impactItemId,
    upc: overrides.upc,
    imageUrl: overrides.imageUrl,
    description: overrides.description,
    brand: overrides.brand,
    category: overrides.category,
    originalPrice: overrides.originalPrice,
    currency: overrides.currency ?? 'USD',
    caliber: overrides.caliber,
    grainWeight: overrides.grainWeight,
    roundCount: overrides.roundCount,
    rowNumber,
  }
}

describe('dedupe-quarantine interaction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.$queryRaw).mockResolvedValue([])
    vi.mocked(prisma.$executeRaw).mockResolvedValue(1)
    vi.mocked(prisma.quarantined_records.upsert).mockResolvedValue({
      id: 'qr-1',
      status: 'QUARANTINED',
    } as never)
  })

  it('uses earlier valid row when last duplicate is missing caliber', async () => {
    const products: ParsedFeedProduct[] = [
      makeProduct(1, {
        name: 'Federal 9mm 115gr FMJ 50 Rounds',
        sku: 'DUP-1',
        caliber: '9mm',
        grainWeight: 115,
        roundCount: 50,
      }),
      makeProduct(2, {
        name: 'Federal 115gr FMJ 50 Rounds',
        sku: 'DUP-1',
        grainWeight: 115,
        roundCount: 50,
      }),
    ]

    const result = await processProducts(createContext(), products)

    expect(result.dedupeFallbackToValid).toBe(1)
    expect(prisma.quarantined_records.upsert).not.toHaveBeenCalled()
  })

  it('uses earlier valid row when last duplicate has zero ammo signals', async () => {
    const products: ParsedFeedProduct[] = [
      makeProduct(1, {
        name: 'Federal 9mm 115gr FMJ 50 Rounds',
        sku: 'DUP-2',
        caliber: '9mm',
        grainWeight: 115,
        roundCount: 50,
      }),
      makeProduct(2, {
        name: 'Magpul PMAG Gen M3 AR-15 Magazine',
        sku: 'DUP-2',
      }),
    ]

    const result = await processProducts(createContext(), products)

    expect(result.dedupeFallbackToValid).toBe(1)
    expect(prisma.quarantined_records.upsert).not.toHaveBeenCalled()
  })

  it('uses earlier valid row when last duplicate is handloading projectile', async () => {
    const products: ParsedFeedProduct[] = [
      makeProduct(1, {
        name: 'Federal American Eagle 9mm 115gr FMJ 50 Rounds',
        sku: 'DUP-3',
        caliber: '9mm',
        grainWeight: 115,
        roundCount: 50,
      }),
      makeProduct(2, {
        name: 'Hornady 30 Cal .308 168gr Projectile For Handloading',
        sku: 'DUP-3',
        caliber: '.308 Winchester',
        grainWeight: 168,
      }),
    ]

    const result = await processProducts(createContext(), products)

    expect(result.dedupeFallbackToValid).toBe(1)
    expect(prisma.quarantined_records.upsert).not.toHaveBeenCalled()
  })

  it('preserves existing behavior when all duplicates are invalid (last row quarantined)', async () => {
    const products: ParsedFeedProduct[] = [
      makeProduct(1, {
        name: 'Winchester 147gr JHP 20 Rounds',
        sku: 'DUP-4',
        grainWeight: 147,
        roundCount: 20,
      }),
      makeProduct(2, {
        name: 'Winchester 124gr JHP 20 Rounds',
        sku: 'DUP-4',
        grainWeight: 124,
        roundCount: 20,
      }),
    ]

    const result = await processProducts(createContext(), products)

    expect(result.dedupeFallbackToValid).toBe(0)
    expect(prisma.quarantined_records.upsert).toHaveBeenCalledTimes(1)
    expect(prisma.quarantined_records.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          blockingErrors: [{ code: 'MISSING_CALIBER', message: 'Product is missing caliber field' }],
        }),
      })
    )
  })

  it('leaves no-duplicate behavior unchanged with zero fallback count', async () => {
    const products: ParsedFeedProduct[] = [
      makeProduct(1, {
        name: 'Federal 9mm 115gr FMJ 50 Rounds',
        sku: 'UNIQUE-1',
        caliber: '9mm',
      }),
      makeProduct(2, {
        name: 'Winchester 147gr JHP 20 Rounds',
        sku: 'UNIQUE-2',
        grainWeight: 147,
        roundCount: 20,
      }),
    ]

    const result = await processProducts(createContext(), products)

    expect(result.dedupeFallbackToValid).toBe(0)
    expect(prisma.quarantined_records.upsert).toHaveBeenCalledTimes(1)
  })

  it('reports accurate fallback count across multiple identities', async () => {
    const products: ParsedFeedProduct[] = [
      makeProduct(1, { name: 'A valid 9mm 50 rounds', sku: 'A', caliber: '9mm', roundCount: 50 }),
      makeProduct(2, { name: 'A invalid 115gr 50 rounds', sku: 'A', grainWeight: 115, roundCount: 50 }),
      makeProduct(3, { name: 'B valid .45 ACP 50 rounds', sku: 'B', caliber: '.45 ACP', roundCount: 50 }),
      makeProduct(4, { name: 'B invalid 230gr 50 rounds', sku: 'B', grainWeight: 230, roundCount: 50 }),
      makeProduct(5, { name: 'C valid .223 Rem 20 rounds', sku: 'C', caliber: '.223 Remington', roundCount: 20 }),
      makeProduct(6, { name: 'C newer valid .223 Rem 20 rounds', sku: 'C', caliber: '.223 Remington', roundCount: 20 }),
    ]

    const result = await processProducts(createContext(), products)

    expect(result.dedupeFallbackToValid).toBe(2)
    expect(prisma.quarantined_records.upsert).not.toHaveBeenCalled()
  })

  it('supports cross-chunk fallback when earlier valid row is in chunk 1 and last invalid row is in chunk 2', async () => {
    const products: ParsedFeedProduct[] = []
    products.push(
      makeProduct(1, {
        name: 'Cross Chunk 9mm 115gr FMJ 50 Rounds',
        sku: 'CROSS-1',
        caliber: '9mm',
        grainWeight: 115,
        roundCount: 50,
      })
    )
    for (let i = 2; i <= 1000; i++) {
      products.push(
        makeProduct(i, {
          name: `Cross Chunk Duplicate ${i} 50 Rounds`,
          sku: 'CROSS-1',
          grainWeight: 115,
          roundCount: 50,
        })
      )
    }
    products.push(
      makeProduct(1001, {
        name: 'Cross Chunk Final Duplicate 50 Rounds',
        sku: 'CROSS-1',
        grainWeight: 124,
        roundCount: 50,
      })
    )

    const result = await processProducts(createContext(), products)

    expect(result.dedupeFallbackToValid).toBe(1)
    expect(prisma.quarantined_records.upsert).not.toHaveBeenCalled()
  })

  it('does not quarantine invalid duplicate row when fallback selects earlier valid row', async () => {
    const products: ParsedFeedProduct[] = [
      makeProduct(1, {
        name: 'Speer Gold Dot 9mm 124gr 20 Rounds',
        sku: 'DUP-5',
        caliber: '9mm',
        grainWeight: 124,
        roundCount: 20,
      }),
      makeProduct(2, {
        name: 'Speer Gold Dot 124gr 20 Rounds',
        sku: 'DUP-5',
        grainWeight: 124,
        roundCount: 20,
      }),
    ]

    const result = await processProducts(createContext(), products)

    expect(result.dedupeFallbackToValid).toBe(1)
    expect(prisma.quarantined_records.upsert).not.toHaveBeenCalled()
  })
})

describe('quarantine predicate parity', () => {
  function wrapProduct(product: ParsedFeedProduct): any {
    return {
      product,
      identity: { type: 'SKU', value: product.sku ?? 'test' },
      identityKey: `SKU:${product.sku ?? 'test'}`,
      allIdentifiers: [],
    }
  }

  it('matches filterNonAmmunition + caliber gate classification', () => {
    const products: ParsedFeedProduct[] = [
      makeProduct(1, { name: 'Federal 9mm 115gr FMJ 50 Rounds', sku: 'P1', caliber: '9mm', grainWeight: 115 }),
      makeProduct(2, { name: 'Mystery 124gr 50 Rounds', sku: 'P2', grainWeight: 124 }),
      makeProduct(3, { name: 'Hornady 30 Cal .308 168gr Projectile For Handloading', sku: 'P3', caliber: '.308 Winchester', grainWeight: 168 }),
      makeProduct(4, { name: 'Magpul PMAG Gen M3 AR-15 Magazine', sku: 'P4' }),
      makeProduct(5, { name: 'Caliber only listing', sku: 'P5', caliber: '5.56 NATO' }),
    ]

    for (const product of products) {
      const { valid } = filterNonAmmunition([wrapProduct(product)])
      const survivesRuntimePipeline = valid.length > 0 && Boolean(valid[0].product.caliber)
      expect(wouldSurviveQuarantine(product)).toBe(survivesRuntimePipeline)
    }
  })
})
