/**
 * Market Deals Integration Tests
 *
 * Validates SCRAPE guardrails on market deals queries using real DB.
 *
 * Requires test containers running (pnpm test:up)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import request from 'supertest'
import type { Express } from 'express'
import type { PrismaClient } from '@ironscout/db'
import Redis from 'ioredis'
import { randomUUID } from 'crypto'

const TEST_DATABASE_URL = 'postgresql://ironscout_test:ironscout_test@localhost:5433/ironscout_test'
const TEST_REDIS_HOST = '127.0.0.1'
const TEST_REDIS_PORT = '6380'
const JWT_SECRET = 'test-jwt-secret-for-integration-tests'

let app: Express
let prisma: PrismaClient
let createTestClient: any
let disconnectTestClient: any
let cleanTables: any

describe('/api/dashboard/market-deals', () => {
  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    process.env.DATABASE_URL = TEST_DATABASE_URL
    process.env.NEXTAUTH_SECRET = JWT_SECRET
    process.env.REDIS_HOST = TEST_REDIS_HOST
    process.env.REDIS_PORT = TEST_REDIS_PORT

    const appModule = await import('../../app')
    app = appModule.app

    const testUtils = await import('@ironscout/db/test-utils')
    createTestClient = testUtils.createTestClient
    disconnectTestClient = testUtils.disconnectTestClient
    cleanTables = testUtils.cleanTables

    prisma = createTestClient()
    await prisma.$connect()
  })

  afterAll(async () => {
    await disconnectTestClient(prisma)
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

    const redis = new Redis({
      host: TEST_REDIS_HOST,
      port: parseInt(TEST_REDIS_PORT, 10),
      maxRetriesPerRequest: 1,
    })
    await redis.del('dashboard:market-deals')
    await redis.quit()
  })

  it('excludes non-compliant SCRAPE prices from current deals', async () => {
    const now = new Date()
    const day = (daysAgo: number) => new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000)

    const retailerId = randomUUID()
    const retailer = await prisma.retailers.create({
      data: {
        id: retailerId,
        name: 'Test Retailer',
        website: `https://retailer-${retailerId}.example.com`,
      },
    })

    const productId = randomUUID()
    await prisma.products.create({
      data: {
        id: productId,
        name: 'Test 9mm FMJ',
        category: 'HANDGUN',
        caliber: '9mm',
        roundCount: 50,
      },
    })

    const sourceOkId = randomUUID()
    const sourceBadId = randomUUID()
    const adapterOk = 'adapter-ok'
    const adapterBad = 'adapter-bad'

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

    const sourceProductOkId = randomUUID()
    const sourceProductBadId = randomUUID()

    await prisma.source_products.createMany({
      data: [
        {
          id: sourceProductOkId,
          sourceId: sourceOkId,
          title: 'Test 9mm FMJ (OK)',
          url: 'https://source-ok.example.com/p/1',
          brand: 'TestBrand',
          caliber: '9mm',
          roundCount: 50,
        },
        {
          id: sourceProductBadId,
          sourceId: sourceBadId,
          title: 'Test 9mm FMJ (BAD)',
          url: 'https://source-bad.example.com/p/1',
          brand: 'TestBrand',
          caliber: '9mm',
          roundCount: 50,
        },
      ],
    })

    await prisma.product_links.createMany({
      data: [
        {
          sourceProductId: sourceProductOkId,
          productId,
          matchType: 'FINGERPRINT',
          status: 'MATCHED',
          confidence: 1.0,
          resolverVersion: 'test',
          evidence: {},
        },
        {
          sourceProductId: sourceProductBadId,
          productId,
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
          productId,
          retailerId: retailer.id,
          sourceId: sourceOkId,
          sourceProductId: sourceProductOkId,
          price: 100,
          currency: 'USD',
          url: 'https://source-ok.example.com/p/1',
          inStock: true,
          observedAt: day(25),
          ingestionRunType: 'SCRAPE',
        },
        {
          id: randomUUID(),
          productId,
          retailerId: retailer.id,
          sourceId: sourceOkId,
          sourceProductId: sourceProductOkId,
          price: 100,
          currency: 'USD',
          url: 'https://source-ok.example.com/p/1',
          inStock: true,
          observedAt: day(20),
          ingestionRunType: 'SCRAPE',
        },
        {
          id: randomUUID(),
          productId,
          retailerId: retailer.id,
          sourceId: sourceOkId,
          sourceProductId: sourceProductOkId,
          price: 100,
          currency: 'USD',
          url: 'https://source-ok.example.com/p/1',
          inStock: true,
          observedAt: day(15),
          ingestionRunType: 'SCRAPE',
        },
        {
          id: randomUUID(),
          productId,
          retailerId: retailer.id,
          sourceId: sourceOkId,
          sourceProductId: sourceProductOkId,
          price: 100,
          currency: 'USD',
          url: 'https://source-ok.example.com/p/1',
          inStock: true,
          observedAt: day(10),
          ingestionRunType: 'SCRAPE',
        },
        {
          id: randomUUID(),
          productId,
          retailerId: retailer.id,
          sourceId: sourceOkId,
          sourceProductId: sourceProductOkId,
          price: 70,
          currency: 'USD',
          url: 'https://source-ok.example.com/p/1',
          inStock: true,
          observedAt: day(1),
          ingestionRunType: 'SCRAPE',
        },
        {
          id: randomUUID(),
          productId,
          retailerId: retailer.id,
          sourceId: sourceBadId,
          sourceProductId: sourceProductBadId,
          price: 50,
          currency: 'USD',
          url: 'https://source-bad.example.com/p/1',
          inStock: true,
          observedAt: day(1),
          ingestionRunType: 'SCRAPE',
        },
      ],
    })

    const res = await request(app).get('/api/dashboard/market-deals').expect(200)

    expect(res.body.hero).not.toBeNull()
    expect(res.body.hero.price).toBe(70)
    expect(res.body.hero.reason).toBe('PRICE_DROP')
  })
})
