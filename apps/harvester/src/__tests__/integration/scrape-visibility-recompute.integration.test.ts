/**
 * SCRAPE Guardrails Integration Tests (Derived Table)
 *
 * Verifies current_visible_prices excludes non-compliant SCRAPE data.
 *
 * To run: pnpm --filter harvester test:integration
 * Requires: TEST_DATABASE_URL environment variable
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient } from '@ironscout/db/generated/prisma'
import { randomUUID } from 'crypto'

// Skip if no test database configured
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL
const describeIntegration = TEST_DATABASE_URL ? describe : describe.skip

let prisma: PrismaClient
let recomputeCurrentPrices: any
let cleanTables: any

describeIntegration('SCRAPE guardrails - current_visible_prices', () => {
  beforeAll(async () => {
    if (!TEST_DATABASE_URL) {
      throw new Error('TEST_DATABASE_URL required for integration tests')
    }

    process.env.DATABASE_URL = TEST_DATABASE_URL

    const testUtils = await import('@ironscout/db/test-utils')
    cleanTables = testUtils.cleanTables

    const recomputeModule = await import('../../currentprice/recompute')
    recomputeCurrentPrices = recomputeModule.recomputeCurrentPrices

    prisma = new PrismaClient()
    await prisma.$connect()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    await cleanTables(prisma, [
      'current_visible_prices',
      'prices',
      'product_links',
      'source_products',
      'scrape_adapter_status',
      'sources',
      'merchant_retailers',
      'retailers',
      'products',
    ])
  })

  it('excludes SCRAPE prices that fail guardrails', async () => {
    const now = new Date()

    const retailer = await prisma.retailers.create({
      data: {
        id: randomUUID(),
        name: 'Test Retailer',
        website: `https://retailer-${Date.now()}.example.com`,
      },
    })

    const productOkId = randomUUID()
    const productBadId = randomUUID()

    await prisma.products.createMany({
      data: [
        { id: productOkId, name: 'Compliant Product', category: 'HANDGUN', caliber: '9mm' },
        { id: productBadId, name: 'Noncompliant Product', category: 'HANDGUN', caliber: '9mm' },
      ],
    })

    const adapterOk = 'adapter-ok'
    const adapterBad = 'adapter-bad'
    const sourceOkId = randomUUID()
    const sourceBadId = randomUUID()

    await prisma.sources.createMany({
      data: [
        {
          id: sourceOkId,
          name: 'Source OK',
          url: 'https://source-ok.example.com/feed',
          retailerId: retailer.id,
          adapterId: adapterOk,
          scrapeEnabled: true,
          robotsCompliant: true,
          tosReviewedAt: now,
          tosApprovedBy: 'admin-1',
        },
        {
          id: sourceBadId,
          name: 'Source Bad',
          url: 'https://source-bad.example.com/feed',
          retailerId: retailer.id,
          adapterId: adapterBad,
          scrapeEnabled: true,
          robotsCompliant: false,
          tosReviewedAt: now,
          tosApprovedBy: 'admin-1',
        },
      ],
    })

    await prisma.scrape_adapter_status.createMany({
      data: [
        { adapterId: adapterOk, enabled: true },
        { adapterId: adapterBad, enabled: true },
      ],
    })

    const spOkId = randomUUID()
    const spBadId = randomUUID()

    await prisma.source_products.createMany({
      data: [
        {
          id: spOkId,
          sourceId: sourceOkId,
          title: 'Compliant Source Product',
          url: 'https://source-ok.example.com/p/1',
          caliber: '9mm',
        },
        {
          id: spBadId,
          sourceId: sourceBadId,
          title: 'Noncompliant Source Product',
          url: 'https://source-bad.example.com/p/1',
          caliber: '9mm',
        },
      ],
    })

    await prisma.product_links.createMany({
      data: [
        {
          sourceProductId: spOkId,
          productId: productOkId,
          matchType: 'FINGERPRINT',
          status: 'MATCHED',
          confidence: 1.0,
          resolverVersion: 'test',
          evidence: {},
        },
        {
          sourceProductId: spBadId,
          productId: productBadId,
          matchType: 'FINGERPRINT',
          status: 'MATCHED',
          confidence: 1.0,
          resolverVersion: 'test',
          evidence: {},
        },
      ],
    })

    await prisma.prices.createMany({
      data: [
        {
          id: randomUUID(),
          productId: productOkId,
          retailerId: retailer.id,
          sourceId: sourceOkId,
          sourceProductId: spOkId,
          price: 20,
          currency: 'USD',
          url: 'https://source-ok.example.com/p/1',
          inStock: true,
          observedAt: now,
          ingestionRunType: 'SCRAPE',
        },
        {
          id: randomUUID(),
          productId: productBadId,
          retailerId: retailer.id,
          sourceId: sourceBadId,
          sourceProductId: spBadId,
          price: 10,
          currency: 'USD',
          url: 'https://source-bad.example.com/p/1',
          inStock: true,
          observedAt: now,
          ingestionRunType: 'SCRAPE',
        },
      ],
    })

    await recomputeCurrentPrices('FULL', undefined, 'test-recompute')

    const visible = await prisma.current_visible_prices.findMany({
      select: { productId: true, sourceId: true },
      orderBy: { productId: 'asc' },
    })

    expect(visible).toHaveLength(1)
    expect(visible[0].productId).toBe(productOkId)
    expect(visible[0].sourceId).toBe(sourceOkId)
  })

  it('keeps existing SCRAPE prices visible when source scraping is disabled', async () => {
    const now = new Date()

    const retailer = await prisma.retailers.create({
      data: {
        id: randomUUID(),
        name: 'Disabled Scrape Retailer',
        website: `https://retailer-${Date.now()}.example.com`,
      },
    })

    const productId = randomUUID()
    await prisma.products.create({
      data: {
        id: productId,
        name: 'Existing SCRAPE Product',
        category: 'HANDGUN',
        caliber: '9mm',
      },
    })

    const sourceId = randomUUID()
    const adapterId = 'adapter-disabled-source'

    await prisma.sources.create({
      data: {
        id: sourceId,
        name: 'Source Disabled For New Scrapes',
        url: 'https://source-disabled.example.com/feed',
        retailerId: retailer.id,
        adapterId,
        scrapeEnabled: false,
        robotsCompliant: true,
        tosReviewedAt: now,
        tosApprovedBy: 'admin-1',
      },
    })

    await prisma.scrape_adapter_status.create({
      data: { adapterId, enabled: true },
    })

    const sourceProductId = randomUUID()
    await prisma.source_products.create({
      data: {
        id: sourceProductId,
        sourceId,
        title: 'Existing SCRAPE Source Product',
        url: 'https://source-disabled.example.com/p/1',
        caliber: '9mm',
      },
    })

    await prisma.product_links.create({
      data: {
        sourceProductId,
        productId,
        matchType: 'FINGERPRINT',
        status: 'MATCHED',
        confidence: 1.0,
        resolverVersion: 'test',
        evidence: {},
      },
    })

    await prisma.prices.create({
      data: {
        id: randomUUID(),
        productId,
        retailerId: retailer.id,
        sourceId,
        sourceProductId,
        price: 12,
        currency: 'USD',
        url: 'https://source-disabled.example.com/p/1',
        inStock: true,
        observedAt: now,
        ingestionRunType: 'SCRAPE',
      },
    })

    await recomputeCurrentPrices('FULL', undefined, 'test-recompute-disabled-source')

    const visible = await prisma.current_visible_prices.findMany({
      where: { productId },
      select: { productId: true, sourceId: true },
    })

    expect(visible).toHaveLength(1)
    expect(visible[0].productId).toBe(productId)
    expect(visible[0].sourceId).toBe(sourceId)
  })
})
