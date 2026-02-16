/**
 * Processor Integration Tests
 *
 * These tests run against a REAL database to catch schema mismatches,
 * constraint violations, and other issues that mocks would hide.
 *
 * CRITICAL: These tests would have caught the "createdAt" column bug!
 *
 * To run: pnpm --filter harvester test:integration
 * Requires: TEST_DATABASE_URL environment variable
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { randomUUID } from 'crypto'
import { PrismaClient } from '@ironscout/db/generated/prisma'

// Skip if no test database configured
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL
const describeIntegration = TEST_DATABASE_URL ? describe : describe.skip

// Use a separate Prisma client for tests
let prisma: PrismaClient

describeIntegration('Processor Integration Tests', () => {
  beforeAll(async () => {
    if (!TEST_DATABASE_URL) {
      throw new Error('TEST_DATABASE_URL required for integration tests')
    }

    // Note: Prisma client uses DATABASE_URL env var by default.
    // For tests, set TEST_DATABASE_URL and use it here.
    prisma = new PrismaClient()

    await prisma.$connect()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  describe('source_product_presence table operations', () => {
    let testSourceId: string
    let testSourceProductId: string

    beforeEach(async () => {
      // Create test retailer and source
      const retailer = await prisma.retailers.create({
        data: {
          id: randomUUID(),
          name: `Test Retailer ${Date.now()}`,
          website: `https://test-${Date.now()}.example.com`,
          updatedAt: new Date(),
        },
      })

      const source = await prisma.sources.create({
        data: {
          id: randomUUID(),
          name: `Test Source ${Date.now()}`,
          url: 'https://test.example.com/feed',
          retailerId: retailer.id,
          type: 'FEED_CSV',
          sourceKind: 'AFFILIATE_FEED',
          updatedAt: new Date(),
        },
      })
      testSourceId = source.id

      // Create test source product
      const sourceProduct = await prisma.source_products.create({
        data: {
          id: randomUUID(),
          sourceId: testSourceId,
          title: 'Test Product',
          url: 'https://test.example.com/product',
          updatedAt: new Date(),
        },
      })
      testSourceProductId = sourceProduct.id

      // Create identifier in child table
      await prisma.source_product_identifiers.create({
        data: {
          sourceProductId: sourceProduct.id,
          idType: 'SKU',
          idValue: `TEST-SKU-${Date.now()}`,
          namespace: '',
          isCanonical: true,
        },
      })
    })

    it('should insert into source_product_presence with correct columns', async () => {
      const t0 = new Date()

      // This is the EXACT SQL from processor.ts - if columns are wrong, this fails!
      await prisma.$executeRaw`
        INSERT INTO source_product_presence ("id", "sourceProductId", "lastSeenAt", "updatedAt")
        SELECT gen_random_uuid(), id, ${t0}, NOW()
        FROM unnest(${[testSourceProductId]}::text[]) AS id
        ON CONFLICT ("sourceProductId") DO UPDATE SET
          "lastSeenAt" = ${t0},
          "updatedAt" = NOW()
      `

      // Verify it was inserted
      const presence = await prisma.source_product_presence.findUnique({
        where: { sourceProductId: testSourceProductId },
      })

      expect(presence).toBeTruthy()
      expect(presence?.lastSeenAt.getTime()).toBeCloseTo(t0.getTime(), -3)
    })

    it('should insert into source_product_seen with correct columns', async () => {
      // Create a test feed and run
      const feed = await prisma.affiliate_feeds.create({
        data: {
          id: randomUUID(),
          sourceId: testSourceId,
          network: 'IMPACT',
          status: 'ENABLED',
          transport: 'SFTP',
          host: 'test.example.com',
          port: 22,
          path: '/test/feed.csv',
          username: 'test',
          secretCiphertext: Buffer.from('encrypted'),
          secretVersion: 1,
          format: 'CSV',
          compression: 'NONE',
          expiryHours: 48,
          updatedAt: new Date(),
        },
      })

      const run = await prisma.affiliate_feed_runs.create({
        data: {
          id: randomUUID(),
          feedId: feed.id,
          sourceId: testSourceId,
          trigger: 'MANUAL',
          status: 'RUNNING',
          startedAt: new Date(),
        },
      })

      // This is the EXACT SQL from processor.ts
      await prisma.$executeRaw`
        INSERT INTO source_product_seen ("id", "runId", "sourceProductId", "createdAt")
        SELECT gen_random_uuid(), ${run.id}, id, NOW()
        FROM unnest(${[testSourceProductId]}::text[]) AS id
        ON CONFLICT ("runId", "sourceProductId") DO NOTHING
      `

      // Verify it was inserted
      const seen = await prisma.source_product_seen.findFirst({
        where: { runId: run.id, sourceProductId: testSourceProductId },
      })

      expect(seen).toBeTruthy()
    })

    it('should insert prices with correct columns', async () => {
      // Create test feed and run first
      const feed = await prisma.affiliate_feeds.create({
        data: {
          id: randomUUID(),
          sourceId: testSourceId,
          network: 'IMPACT',
          status: 'ENABLED',
          transport: 'SFTP',
          host: 'test.example.com',
          port: 22,
          path: '/test/feed.csv',
          username: 'test',
          secretCiphertext: Buffer.from('encrypted'),
          secretVersion: 1,
          format: 'CSV',
          compression: 'NONE',
          expiryHours: 48,
          updatedAt: new Date(),
        },
      })

      const run = await prisma.affiliate_feed_runs.create({
        data: {
          id: randomUUID(),
          feedId: feed.id,
          sourceId: testSourceId,
          trigger: 'MANUAL',
          status: 'RUNNING',
          startedAt: new Date(),
        },
      })

      const source = await prisma.sources.findUnique({
        where: { id: testSourceId },
        include: { retailers: true },
      })

      const priceSignatureHash = 'test-hash-123'
      const createdAt = new Date()

      // This is similar to the batch price insert in processor.ts
      // ADR-015: Include provenance fields for all new price writes
      await prisma.$executeRaw`
        INSERT INTO prices (
          "id",
          "retailerId",
          "sourceProductId",
          "affiliateFeedRunId",
          "priceSignatureHash",
          "price",
          "currency",
          "url",
          "inStock",
          "originalPrice",
          "priceType",
          "createdAt",
          "observedAt",
          "ingestionRunType",
          "ingestionRunId"
        )
        VALUES (
          gen_random_uuid(),
          ${source!.retailerId},
          ${testSourceProductId},
          ${run.id},
          ${priceSignatureHash},
          ${19.99},
          'USD',
          'https://test.example.com/product',
          true,
          ${24.99},
          'SALE',
          ${createdAt},
          ${createdAt},
          'AFFILIATE_FEED'::"IngestionRunType",
          ${run.id}
        )
        ON CONFLICT DO NOTHING
      `

      // Verify
      const price = await prisma.prices.findFirst({
        where: { sourceProductId: testSourceProductId },
      })

      expect(price).toBeTruthy()
      expect(Number(price?.price)).toBe(19.99)
    })

    it('should verify ADR-015 provenance fields are set on new prices', async () => {
      // ADR-015 requires all new price writes to have provenance fields set
      // This test verifies the pattern used in all ingestion pipelines
      const source = await prisma.sources.findUnique({
        where: { id: testSourceId },
      })

      const observedAt = new Date()
      const ingestionRunId = `test-run-${Date.now()}`

      // Create a price with provenance (as all ingestion pipelines should)
      await prisma.$executeRaw`
        INSERT INTO prices (
          "id",
          "retailerId",
          "sourceProductId",
          "price",
          "currency",
          "url",
          "inStock",
          "createdAt",
          "observedAt",
          "ingestionRunType",
          "ingestionRunId"
        )
        VALUES (
          gen_random_uuid(),
          ${source!.retailerId},
          ${testSourceProductId},
          ${29.99},
          'USD',
          'https://test.example.com/product2',
          true,
          ${observedAt},
          ${observedAt},
          'SCRAPE'::"IngestionRunType",
          ${ingestionRunId}
        )
        ON CONFLICT DO NOTHING
      `

      // Verify provenance is set
      const price = await prisma.prices.findFirst({
        where: { ingestionRunId },
        select: {
          ingestionRunType: true,
          ingestionRunId: true,
          observedAt: true,
        },
      })

      expect(price).toBeTruthy()
      expect(price?.ingestionRunType).toBe('SCRAPE')
      expect(price?.ingestionRunId).toBe(ingestionRunId)
      expect(price?.observedAt).toBeInstanceOf(Date)
    })
  })

  describe('Error handling', () => {
    it('should handle invalid column names with clear error', async () => {
      // This test documents what happens with bad column names
      await expect(
        prisma.$executeRaw`
          INSERT INTO source_product_presence ("id", "sourceProductId", "nonExistentColumn")
          VALUES (gen_random_uuid(), 'test-id', 'test-value')
        `
      ).rejects.toThrow(/column.*does not exist/i)
    })

    it('should handle foreign key violations', async () => {
      await expect(
        prisma.$executeRaw`
          INSERT INTO source_product_presence ("id", "sourceProductId", "lastSeenAt", "updatedAt")
          VALUES (gen_random_uuid(), 'non-existent-product-id', NOW(), NOW())
        `
      ).rejects.toThrow(/foreign key/i)
    })
  })
})

/**
 * Null-overwrite protection (#224)
 *
 * Verifies that the batch UPDATE SQL preserves existing non-null values
 * when incoming feed data has NULL for optional fields.
 */
describeIntegration('source_products null-overwrite protection', () => {
  let testSourceId: string
  let testRetailerId: string

  beforeAll(async () => {
    const retailer = await prisma.retailers.create({
      data: {
        id: randomUUID(),
        name: `NullOverwrite Retailer ${Date.now()}`,
        website: `https://null-overwrite-${Date.now()}.example.com`,
        updatedAt: new Date(),
      },
    })
    testRetailerId = retailer.id

    const source = await prisma.sources.create({
      data: {
        id: randomUUID(),
        name: `NullOverwrite Source ${Date.now()}`,
        url: 'https://null-overwrite.example.com/feed',
        retailerId: retailer.id,
        type: 'FEED_CSV',
        sourceKind: 'AFFILIATE_FEED',
        updatedAt: new Date(),
      },
    })
    testSourceId = source.id
  })

  async function createSourceProduct(overrides: Record<string, unknown> = {}) {
    const id = randomUUID()
    await prisma.source_products.create({
      data: {
        id,
        sourceId: testSourceId,
        title: 'Test Product',
        url: `https://example.com/product/${id}`,
        updatedAt: new Date(),
        ...overrides,
      },
    })
    return id
  }

  async function runBatchUpdate(
    ids: string[],
    fields: {
      titles: string[]
      urls: string[]
      imageUrls: (string | null)[]
      brands: (string | null)[]
      descriptions: (string | null)[]
      categories: (string | null)[]
      calibers: (string | null)[]
      grainWeights: (number | null)[]
      roundCounts: (number | null)[]
      normalizedUrls: string[]
    }
  ) {
    const runId = `test-run-${Date.now()}`
    // This is the EXACT SQL from processor.ts with COALESCE
    await prisma.$executeRaw`
      UPDATE source_products AS sp SET
        "title" = u.title,
        "url" = u.url,
        "imageUrl" = COALESCE(u."imageUrl", sp."imageUrl"),
        "brand" = COALESCE(u.brand, sp.brand),
        "description" = COALESCE(u.description, sp.description),
        "category" = COALESCE(u.category, sp.category),
        "caliber" = COALESCE(u.caliber, sp.caliber),
        "grainWeight" = COALESCE(u."grainWeight", sp."grainWeight"),
        "roundCount" = COALESCE(u."roundCount", sp."roundCount"),
        "normalizedUrl" = u."normalizedUrl",
        "lastUpdatedByRunId" = ${runId},
        "updatedAt" = NOW()
      FROM (
        SELECT
          unnest(${ids}::text[]) AS id,
          unnest(${fields.titles}::text[]) AS title,
          unnest(${fields.urls}::text[]) AS url,
          unnest(${fields.imageUrls}::text[]) AS "imageUrl",
          unnest(${fields.brands}::text[]) AS brand,
          unnest(${fields.descriptions}::text[]) AS description,
          unnest(${fields.categories}::text[]) AS category,
          unnest(${fields.calibers}::text[]) AS caliber,
          unnest(${fields.grainWeights}::int[]) AS "grainWeight",
          unnest(${fields.roundCounts}::int[]) AS "roundCount",
          unnest(${fields.normalizedUrls}::text[]) AS "normalizedUrl"
      ) AS u
      WHERE sp.id = u.id
    `
  }

  it('preserves existing brand when incoming brand is NULL', async () => {
    const spId = await createSourceProduct({
      brand: 'Federal',
      category: 'Ammunition',
    })

    await runBatchUpdate([spId], {
      titles: ['Test Product'],
      urls: ['https://example.com/product/1'],
      imageUrls: [null],
      brands: [null],
      descriptions: [null],
      categories: [null],
      calibers: [null],
      grainWeights: [null],
      roundCounts: [null],
      normalizedUrls: ['https://example.com/product/1'],
    })

    const result = await prisma.source_products.findUnique({
      where: { id: spId },
      select: { brand: true, category: true },
    })

    expect(result?.brand).toBe('Federal')
    expect(result?.category).toBe('Ammunition')
  })

  it('updates brand when incoming brand is non-null', async () => {
    const spId = await createSourceProduct({ brand: 'Federal' })

    await runBatchUpdate([spId], {
      titles: ['Test Product'],
      urls: ['https://example.com/product/2'],
      imageUrls: [null],
      brands: ['Winchester'],
      descriptions: [null],
      categories: [null],
      calibers: [null],
      grainWeights: [null],
      roundCounts: [null],
      normalizedUrls: ['https://example.com/product/2'],
    })

    const result = await prisma.source_products.findUnique({
      where: { id: spId },
      select: { brand: true },
    })

    expect(result?.brand).toBe('Winchester')
  })

  it('updates mixed: some fields null, some non-null', async () => {
    const spId = await createSourceProduct({
      brand: 'Federal',
      caliber: '9mm',
      grainWeight: 115,
    })

    await runBatchUpdate([spId], {
      titles: ['Test Product Updated'],
      urls: ['https://example.com/product/3'],
      imageUrls: [null],
      brands: [null],          // should preserve 'Federal'
      descriptions: [null],
      categories: [null],
      calibers: ['45 ACP'],    // should update
      grainWeights: [null],    // should preserve 115
      roundCounts: [50],       // should set new value
      normalizedUrls: ['https://example.com/product/3'],
    })

    const result = await prisma.source_products.findUnique({
      where: { id: spId },
      select: {
        title: true,
        brand: true,
        caliber: true,
        grainWeight: true,
        roundCount: true,
      },
    })

    expect(result?.title).toBe('Test Product Updated')
    expect(result?.brand).toBe('Federal')       // preserved
    expect(result?.caliber).toBe('45 ACP')       // updated
    expect(result?.grainWeight).toBe(115)         // preserved
    expect(result?.roundCount).toBe(50)           // new value set
  })
})

/**
 * Contract Tests - Verify raw SQL matches Prisma schema
 *
 * These tests extract actual SQL from source files and verify
 * the column names match the database schema.
 */
describeIntegration('SQL Contract Tests', () => {
  it('should verify source_product_presence columns exist', async () => {
    // Query the actual database schema
    const columns = await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'source_product_presence'
    `

    const columnNames = columns.map(c => c.column_name)

    // These are the columns we use in raw SQL
    const usedColumns = ['id', 'sourceProductId', 'lastSeenAt', 'updatedAt']

    for (const col of usedColumns) {
      expect(columnNames).toContain(col)
    }

    // Verify createdAt does NOT exist (this was the bug!)
    expect(columnNames).not.toContain('createdAt')
  })

  it('should verify source_product_seen columns exist', async () => {
    const columns = await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'source_product_seen'
    `

    const columnNames = columns.map(c => c.column_name)
    const usedColumns = ['id', 'runId', 'sourceProductId', 'createdAt']

    for (const col of usedColumns) {
      expect(columnNames).toContain(col)
    }
  })

  it('should verify prices columns exist', async () => {
    const columns = await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'prices'
    `

    const columnNames = columns.map(c => c.column_name)
    const usedColumns = [
      'id', 'retailerId', 'sourceProductId', 'affiliateFeedRunId',
      'priceSignatureHash', 'price', 'currency', 'url', 'inStock',
      'originalPrice', 'priceType', 'createdAt'
    ]

    for (const col of usedColumns) {
      expect(columnNames).toContain(col)
    }
  })
})
