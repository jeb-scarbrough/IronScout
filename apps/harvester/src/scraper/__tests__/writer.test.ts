import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ScrapedOffer } from '../types.js'

const mocks = vi.hoisted(() => ({
  mockSourceProducts: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  mockIdentifiers: {
    upsert: vi.fn(),
  },
  mockPrices: {
    create: vi.fn(),
  },
  mockScrapeTargets: {
    update: vi.fn(),
  },
  mockScrapeRuns: {
    update: vi.fn(),
  },
}))

vi.mock('@ironscout/db', () => ({
  prisma: {
    source_products: mocks.mockSourceProducts,
    source_product_identifiers: mocks.mockIdentifiers,
    prices: mocks.mockPrices,
    scrape_targets: mocks.mockScrapeTargets,
    scrape_runs: mocks.mockScrapeRuns,
  },
}))

import { writeScrapeOffer, updateTargetTracking, markTargetBroken, finalizeRun } from '../process/writer.js'

const createOffer = (overrides: Partial<ScrapedOffer> = {}): ScrapedOffer => ({
  sourceId: 'source-1',
  retailerId: 'retailer-1',
  url: 'https://example.com/product',
  title: 'Test Product',
  priceCents: 1999,
  currency: 'USD',
  availability: 'IN_STOCK',
  observedAt: new Date('2025-01-01T00:00:00Z'),
  identityKey: 'SKU:ABC123',
  adapterVersion: '1.0.0',
  upc: '012345678905',
  retailerSku: 'SKU-123',
  ...overrides,
})

const createLogger = () => ({
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
})

describe('writeScrapeOffer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('upserts source_product and writes price with SCRAPE provenance', async () => {
    mocks.mockSourceProducts.upsert.mockResolvedValue({ id: 'sp-1' })
    mocks.mockPrices.create.mockResolvedValue({ id: 'price-1' })
    mocks.mockIdentifiers.upsert.mockResolvedValue({})

    const offer = createOffer()
    const logger = createLogger()

    const result = await writeScrapeOffer(
      offer,
      { id: 'target-1', sourceProductId: null },
      'run-1',
      logger
    )

    expect(result.success).toBe(true)
    expect(result.sourceProductId).toBe('sp-1')
    expect(result.priceId).toBe('price-1')

    expect(mocks.mockSourceProducts.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          sourceId_identityKey: {
            sourceId: offer.sourceId,
            identityKey: offer.identityKey,
          },
        },
      })
    )

    expect(mocks.mockPrices.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ingestionRunType: 'SCRAPE',
          ingestionRunId: 'run-1',
          price: 19.99,
          inStock: true,
        }),
      })
    )

    expect(mocks.mockIdentifiers.upsert).toHaveBeenCalledTimes(2)
  })

  it('uses linked source_product_id when present', async () => {
    mocks.mockSourceProducts.findUnique.mockResolvedValue({ id: 'sp-99', identityKey: 'SKU:ABC123' })
    mocks.mockPrices.create.mockResolvedValue({ id: 'price-99' })
    mocks.mockIdentifiers.upsert.mockResolvedValue({})

    const offer = createOffer()
    const logger = createLogger()

    const result = await writeScrapeOffer(
      offer,
      { id: 'target-1', sourceProductId: 'sp-99' },
      'run-1',
      logger
    )

    expect(result.success).toBe(true)
    expect(result.sourceProductId).toBe('sp-99')
    expect(mocks.mockSourceProducts.upsert).not.toHaveBeenCalled()
  })

  it('returns failure on write errors', async () => {
    mocks.mockSourceProducts.upsert.mockRejectedValue(new Error('db error'))

    const offer = createOffer()
    const logger = createLogger()

    const result = await writeScrapeOffer(
      offer,
      { id: 'target-1', sourceProductId: null },
      'run-1',
      logger
    )

    expect(result.success).toBe(false)
    expect(result.error).toBe('db error')
  })
})

describe('target tracking helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('updates target tracking on success', async () => {
    await updateTargetTracking('target-1', true)

    expect(mocks.mockScrapeTargets.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'target-1' },
        data: expect.objectContaining({
          lastStatus: 'SUCCESS',
          consecutiveFailures: 0,
        }),
      })
    )
  })

  it('updates target tracking on failure', async () => {
    await updateTargetTracking('target-1', false)

    expect(mocks.mockScrapeTargets.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'target-1' },
        data: expect.objectContaining({
          lastStatus: 'FAILED',
          consecutiveFailures: { increment: 1 },
        }),
      })
    )
  })

  it('marks target as BROKEN', async () => {
    await markTargetBroken('target-1')

    expect(mocks.mockScrapeTargets.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'target-1' },
        data: expect.objectContaining({ status: 'BROKEN' }),
      })
    )
  })
})

describe('finalizeRun', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('updates run metrics and status', async () => {
    await finalizeRun(
      'run-1',
      {
        urlsAttempted: 10,
        urlsSucceeded: 8,
        urlsFailed: 2,
        offersExtracted: 8,
        offersValid: 7,
        offersDropped: 1,
        offersQuarantined: 0,
        oosNoPriceCount: 1,
      },
      'SUCCESS'
    )

    expect(mocks.mockScrapeRuns.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'run-1' },
        data: expect.objectContaining({
          status: 'SUCCESS',
          urlsAttempted: 10,
          urlsSucceeded: 8,
          urlsFailed: 2,
          offersValid: 7,
          failureRate: 0.1,
          yieldRate: 0.7,
        }),
      })
    )
  })
})
