import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Prisma } from '../generated/prisma/client.js'
import { getCaliberAliases } from '../calibers.js'
import {
  CALIBER_SNAPSHOT_COMPUTATION_VERSION,
  buildCaliberPriceCheckStatsQuery,
  buildCaliberSnapshotStatsQuery,
  buildProductMedianPriceQuery,
} from '../market-observations.js'
import { createTestDb, disconnectTestClient, resetDb } from '../test-utils.js'

const toNumber = (value: Prisma.Decimal | number | string | null): number | null => {
  if (value === null) {
    return null
  }
  return Number(value)
}

describe('market observation SQL parity (ADR-024/025)', () => {
  const prisma = createTestDb()

  beforeAll(async () => {
    await resetDb(prisma)
  })

  afterAll(async () => {
    await disconnectTestClient(prisma)
  })

  it('keeps snapshot, market-deals median, and price-check median aligned with computationVersion pin', async () => {
    const windowEnd = new Date('2026-02-16T18:00:00.000Z')
    const windowStart = new Date('2026-01-17T18:00:00.000Z')
    const observedDays = [29, 24, 19, 14, 9].map(
      (daysAgo) => new Date(windowEnd.getTime() - daysAgo * 24 * 60 * 60 * 1000)
    )

    const retailerId = 'retailer-parity-9mm'
    const sourceId = 'source-parity-9mm'
    const sourceProductId = 'source-product-parity-9mm'
    const productId = 'product-parity-9mm'
    const roundCount = 50

    await prisma.retailers.create({
      data: {
        id: retailerId,
        name: 'Parity Retailer',
        website: 'https://parity-retailer.example.com',
      },
    })

    await prisma.sources.create({
      data: {
        id: sourceId,
        name: 'Parity Source',
        url: 'https://parity-source.example.com/feed',
        retailerId,
      },
    })

    await prisma.products.create({
      data: {
        id: productId,
        name: 'Parity 9mm FMJ 50rd',
        category: 'HANDGUN',
        brand: 'Parity',
        caliber: '9mm',
        roundCount,
      },
    })

    await prisma.source_products.create({
      data: {
        id: sourceProductId,
        sourceId,
        title: 'Parity 9mm FMJ 50rd',
        url: 'https://parity-source.example.com/p/9mm-fmj-50',
      },
    })

    await prisma.product_links.create({
      data: {
        sourceProductId,
        productId,
        matchType: 'FINGERPRINT',
        status: 'MATCHED',
        confidence: new Prisma.Decimal(1),
        resolverVersion: 'test',
        evidence: {},
      },
    })

    const boxPrices = [10, 11, 12, 13, 14]
    await prisma.prices.createMany({
      data: boxPrices.map((price, index) => ({
        id: `price-parity-9mm-${index + 1}`,
        productId,
        retailerId,
        sourceId,
        sourceProductId,
        price: new Prisma.Decimal(price),
        currency: 'USD',
        url: 'https://parity-source.example.com/p/9mm-fmj-50',
        inStock: true,
        observedAt: observedDays[index],
      })),
    })

    const snapshotRows = await prisma.$queryRaw<
      Array<{
        median: Prisma.Decimal | null
        p25: Prisma.Decimal | null
        p75: Prisma.Decimal | null
        min: Prisma.Decimal | null
        max: Prisma.Decimal | null
        sampleCount: number
        daysWithData: number
        productCount: number
        retailerCount: number
      }>
    >(
      buildCaliberSnapshotStatsQuery({
        caliberAliases: getCaliberAliases('9mm'),
        windowStart,
        windowEnd,
      })
    )

    const marketDealRows = await prisma.$queryRaw<
      Array<{ productId: string; medianPrice: Prisma.Decimal | null; priceCount: number }>
    >(
      buildProductMedianPriceQuery({
        productIds: [productId],
        windowStart,
        windowEnd,
        inStockOnly: true,
      })
    )

    const priceCheckRows = await prisma.$queryRaw<
      Array<{
        medianPrice: Prisma.Decimal | null
        p25: Prisma.Decimal | null
        p75: Prisma.Decimal | null
        pricePointCount: number
        daysWithData: number
      }>
    >(
      buildCaliberPriceCheckStatsQuery({
        caliberAliases: getCaliberAliases('9mm'),
        windowStart,
        windowEnd,
      })
    )

    const snapshot = snapshotRows[0]
    const marketDeal = marketDealRows[0]
    const priceCheck = priceCheckRows[0]

    expect(snapshot).toBeDefined()
    expect(marketDeal).toBeDefined()
    expect(priceCheck).toBeDefined()

    expect(snapshot.sampleCount).toBe(5)
    expect(snapshot.daysWithData).toBe(5)
    expect(snapshot.productCount).toBe(1)
    expect(snapshot.retailerCount).toBe(1)
    expect(marketDeal.priceCount).toBe(5)
    expect(priceCheck.pricePointCount).toBe(5)
    expect(priceCheck.daysWithData).toBe(5)

    await prisma.caliber_market_snapshots.create({
      data: {
        id: 'snapshot-parity-9mm',
        caliber: '9mm',
        windowDays: 30,
        windowStart,
        windowEnd,
        median: snapshot.median,
        p25: snapshot.p25,
        p75: snapshot.p75,
        min: snapshot.min,
        max: snapshot.max,
        sampleCount: snapshot.sampleCount,
        daysWithData: snapshot.daysWithData,
        productCount: snapshot.productCount,
        retailerCount: snapshot.retailerCount,
        computedAt: windowEnd,
        computationVersion: CALIBER_SNAPSHOT_COMPUTATION_VERSION,
        computationDurationMs: 1,
        status: 'CURRENT',
      },
    })

    const persistedSnapshot = await prisma.caliber_market_snapshots.findFirst({
      where: {
        caliber: '9mm',
        windowDays: 30,
        status: 'CURRENT',
      },
    })

    expect(persistedSnapshot).toBeDefined()
    expect(persistedSnapshot?.computationVersion).toBe(CALIBER_SNAPSHOT_COMPUTATION_VERSION)
    expect(persistedSnapshot?.windowStart.toISOString()).toBe(windowStart.toISOString())
    expect(persistedSnapshot?.windowEnd.toISOString()).toBe(windowEnd.toISOString())

    const snapshotMedian = toNumber(snapshot.median)
    const snapshotP25 = toNumber(snapshot.p25)
    const snapshotP75 = toNumber(snapshot.p75)
    const persistedSnapshotMedian = toNumber(persistedSnapshot?.median ?? null)
    const persistedSnapshotP25 = toNumber(persistedSnapshot?.p25 ?? null)
    const persistedSnapshotP75 = toNumber(persistedSnapshot?.p75 ?? null)
    const marketMedianPerRound = toNumber(marketDeal.medianPrice)! / roundCount
    const priceCheckMedian = toNumber(priceCheck.medianPrice)
    const priceCheckP25 = toNumber(priceCheck.p25)
    const priceCheckP75 = toNumber(priceCheck.p75)

    expect(snapshotMedian).not.toBeNull()
    expect(snapshotP25).not.toBeNull()
    expect(snapshotP75).not.toBeNull()
    expect(priceCheckMedian).not.toBeNull()
    expect(priceCheckP25).not.toBeNull()
    expect(priceCheckP75).not.toBeNull()

    expect(snapshotMedian).toBeCloseTo(0.24, 6)
    expect(persistedSnapshotMedian).toBeCloseTo(snapshotMedian as number, 6)
    expect(persistedSnapshotP25).toBeCloseTo(snapshotP25 as number, 6)
    expect(persistedSnapshotP75).toBeCloseTo(snapshotP75 as number, 6)
    expect(marketMedianPerRound).toBeCloseTo(snapshotMedian as number, 6)
    expect(priceCheckMedian).toBeCloseTo(snapshotMedian as number, 6)
    expect(priceCheckP25).toBeCloseTo(snapshotP25 as number, 6)
    expect(priceCheckP75).toBeCloseTo(snapshotP75 as number, 6)
  })
})
