/**
 * A1 Visibility Predicate Integration Tests
 *
 * These tests verify that the alerter's visibility predicate correctly
 * implements A1 semantics by testing against a real database.
 *
 * A1 Semantics (per Merchant-and-Retailer-Reference):
 * - ELIGIBLE + no merchant_retailers → Visible (feed-only)
 * - ELIGIBLE + all SUSPENDED relationships → Visible (feed-only)
 * - ELIGIBLE + ACTIVE + UNLISTED → Hidden (delinquency)
 * - ELIGIBLE + ACTIVE + LISTED → Visible (merchant-managed)
 *
 * Source-scoped visibility (#219):
 * - current_visible_prices is scoped by sourceProductId after recompute
 * - An INELIGIBLE retailer's sourceProductId has no rows in the derived table
 * - An ELIGIBLE retailer's sourceProductId has rows
 *
 * Test cases:
 * 1. Retailer has 0 merchant_retailers → alert fires
 * 2. Retailer has only SUSPENDED relationships → alert fires
 * 3. Retailer has at least one ACTIVE+UNLISTED → alert does NOT fire
 * 4. Ineligible source's sourceProductId not in current_visible_prices after recompute
 *
 * To run: pnpm --filter harvester test:integration
 * Requires: TEST_DATABASE_URL environment variable
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { randomUUID } from 'crypto'
import { PrismaClient } from '@ironscout/db/generated/prisma'

// Skip if no test database configured
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL
const describeIntegration = TEST_DATABASE_URL ? describe : describe.skip

let prisma: PrismaClient

/**
 * Import the shared visibility predicate dynamically to avoid
 * triggering Prisma client creation when tests are skipped.
 */
let visibleRetailerPriceWhere: () => any
let recomputeCurrentPrices: any
let cleanTables: any

describeIntegration('A1 Visibility Predicate Integration', () => {
  // Track created entities for cleanup
  let createdRetailerIds: string[] = []
  let createdMerchantIds: string[] = []
  let createdProductIds: string[] = []
  let createdPriceIds: string[] = []

  beforeAll(async () => {
    if (!TEST_DATABASE_URL) {
      throw new Error('TEST_DATABASE_URL required for integration tests')
    }

    process.env.DATABASE_URL = TEST_DATABASE_URL

    prisma = new PrismaClient()
    await prisma.$connect()

    // Dynamically import the shared visibility predicate
    // This avoids triggering Prisma client creation when DATABASE_URL is not set
    const db = await import('@ironscout/db')
    visibleRetailerPriceWhere = db.visibleRetailerPriceWhere

    const testUtils = await import('@ironscout/db/test-utils')
    cleanTables = testUtils.cleanTables

    const recomputeModule = await import('../../currentprice/recompute')
    recomputeCurrentPrices = recomputeModule.recomputeCurrentPrices
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  afterEach(async () => {
    // Clean up in reverse order of dependencies
    if (createdPriceIds.length > 0) {
      await prisma.prices.deleteMany({ where: { id: { in: createdPriceIds } } })
      createdPriceIds = []
    }
    // Delete merchant_retailers (implicit via cascade, but explicit is safer)
    if (createdMerchantIds.length > 0 && createdRetailerIds.length > 0) {
      await prisma.merchant_retailers.deleteMany({
        where: {
          merchantId: { in: createdMerchantIds },
          retailerId: { in: createdRetailerIds },
        },
      })
    }
    if (createdRetailerIds.length > 0) {
      await prisma.retailers.deleteMany({ where: { id: { in: createdRetailerIds } } })
      createdRetailerIds = []
    }
    if (createdMerchantIds.length > 0) {
      await prisma.merchants.deleteMany({ where: { id: { in: createdMerchantIds } } })
      createdMerchantIds = []
    }
    if (createdProductIds.length > 0) {
      await prisma.products.deleteMany({ where: { id: { in: createdProductIds } } })
      createdProductIds = []
    }
  })

  /**
   * Helper: Create a test retailer with ELIGIBLE visibility status
   */
  async function createEligibleRetailer(suffix: string) {
    const retailer = await prisma.retailers.create({
      data: {
        id: randomUUID(),
        name: `Test Retailer A1 ${suffix} ${Date.now()}`,
        website: `https://test-a1-${suffix}-${Date.now()}.example.com`,
        visibilityStatus: 'ELIGIBLE',
        updatedAt: new Date(),
      },
    })
    createdRetailerIds.push(retailer.id)
    return retailer
  }

  /**
   * Helper: Create a test merchant
   */
  async function createMerchant(suffix: string) {
    const merchant = await prisma.merchants.create({
      data: {
        id: randomUUID(),
        businessName: `Test Merchant A1 ${suffix}`,
        websiteUrl: `https://test-a1-${suffix}.example.com`,
        contactFirstName: 'Test',
        contactLastName: 'User',
        subscriptionStatus: 'ACTIVE',
        updatedAt: new Date(),
      },
    })
    createdMerchantIds.push(merchant.id)
    return merchant
  }

  /**
   * Helper: Create a test product
   */
  async function createProduct(suffix: string) {
    const product = await prisma.products.create({
      data: {
        id: randomUUID(),
        name: `Test Product A1 ${suffix} ${Date.now()}`,
        category: 'ammunition',
        updatedAt: new Date(),
      },
    })
    createdProductIds.push(product.id)
    return product
  }

  /**
   * Helper: Create a price linking product to retailer
   */
  async function createPrice(productId: string, retailerId: string) {
    const price = await prisma.prices.create({
      data: {
        id: randomUUID(),
        productId,
        retailerId,
        price: 19.99,
        currency: 'USD',
        url: `https://test.example.com/product-${Date.now()}`,
        inStock: true,
      },
    })
    createdPriceIds.push(price.id)
    return price
  }

  /**
   * Helper: Query for visible prices using the shared A1 predicate
   */
  async function hasVisiblePrice(productId: string): Promise<boolean> {
    const price = await prisma.prices.findFirst({
      where: {
        productId,
        ...visibleRetailerPriceWhere(),
      },
      select: { id: true },
    })
    return price !== null
  }

  // ============================================================================
  // TEST CASE 1: Retailer has 0 merchant_retailers rows → alert fires
  // ============================================================================
  it('alert_fires_when_retailer_has_zero_merchant_retailers', async () => {
    // Setup: ELIGIBLE retailer with NO merchant_retailers
    const retailer = await createEligibleRetailer('zero-mr')
    const product = await createProduct('zero-mr')
    await createPrice(product.id, retailer.id)

    // Verify: no merchant_retailers exist
    const mrCount = await prisma.merchant_retailers.count({
      where: { retailerId: retailer.id },
    })
    expect(mrCount).toBe(0)

    // Assert: price IS visible (alert should fire)
    const isVisible = await hasVisiblePrice(product.id)
    expect(isVisible).toBe(true)
  })

  // ============================================================================
  // TEST CASE 2: Retailer has only SUSPENDED relationships → alert fires
  // ============================================================================
  it('alert_fires_when_retailer_has_only_suspended_relationships', async () => {
    // Setup: ELIGIBLE retailer with ONLY SUSPENDED merchant_retailers
    const retailer = await createEligibleRetailer('suspended')
    const merchant = await createMerchant('suspended')
    const product = await createProduct('suspended')
    await createPrice(product.id, retailer.id)

    // Create SUSPENDED relationship
    await prisma.merchant_retailers.create({
      data: {
        id: randomUUID(),
        merchantId: merchant.id,
        retailerId: retailer.id,
        status: 'SUSPENDED',
        listingStatus: 'LISTED', // Doesn't matter when SUSPENDED
        updatedAt: new Date(),
      },
    })

    // Verify: relationship exists and is SUSPENDED
    const mr = await prisma.merchant_retailers.findFirst({
      where: { retailerId: retailer.id },
    })
    expect(mr).toBeTruthy()
    expect(mr?.status).toBe('SUSPENDED')

    // Assert: price IS visible (alert should fire)
    // Per A1: "no ACTIVE relationships" means feed-only visible
    const isVisible = await hasVisiblePrice(product.id)
    expect(isVisible).toBe(true)
  })

  // ============================================================================
  // TEST CASE 3: Retailer has ACTIVE+UNLISTED relationship → alert does NOT fire
  // ============================================================================
  it('alert_does_not_fire_when_retailer_has_active_unlisted_relationship', async () => {
    // Setup: ELIGIBLE retailer with ACTIVE but UNLISTED merchant_retailers
    const retailer = await createEligibleRetailer('active-unlisted')
    const merchant = await createMerchant('active-unlisted')
    const product = await createProduct('active-unlisted')
    await createPrice(product.id, retailer.id)

    // Create ACTIVE + UNLISTED relationship (delinquency case)
    await prisma.merchant_retailers.create({
      data: {
        id: randomUUID(),
        merchantId: merchant.id,
        retailerId: retailer.id,
        status: 'ACTIVE',
        listingStatus: 'UNLISTED',
        updatedAt: new Date(),
      },
    })

    // Verify: relationship exists and is ACTIVE + UNLISTED
    const mr = await prisma.merchant_retailers.findFirst({
      where: { retailerId: retailer.id },
    })
    expect(mr).toBeTruthy()
    expect(mr?.status).toBe('ACTIVE')
    expect(mr?.listingStatus).toBe('UNLISTED')

    // Assert: price is NOT visible (alert should NOT fire)
    // Per A1:
    // - `{ none: { status: 'ACTIVE' } }` is FALSE (ACTIVE exists)
    // - `{ some: { status: 'ACTIVE', listingStatus: 'LISTED' } }` is FALSE (not LISTED)
    // - Both OR conditions fail → hidden
    const isVisible = await hasVisiblePrice(product.id)
    expect(isVisible).toBe(false)
  })

  // ============================================================================
  // BONUS: Verify ACTIVE+LISTED makes retailer visible
  // ============================================================================
  it('alert_fires_when_retailer_has_active_listed_relationship', async () => {
    // Setup: ELIGIBLE retailer with ACTIVE + LISTED merchant_retailers
    const retailer = await createEligibleRetailer('active-listed')
    const merchant = await createMerchant('active-listed')
    const product = await createProduct('active-listed')
    await createPrice(product.id, retailer.id)

    // Create ACTIVE + LISTED relationship (normal merchant-managed case)
    await prisma.merchant_retailers.create({
      data: {
        id: randomUUID(),
        merchantId: merchant.id,
        retailerId: retailer.id,
        status: 'ACTIVE',
        listingStatus: 'LISTED',
        updatedAt: new Date(),
      },
    })

    // Verify: relationship exists and is ACTIVE + LISTED
    const mr = await prisma.merchant_retailers.findFirst({
      where: { retailerId: retailer.id },
    })
    expect(mr).toBeTruthy()
    expect(mr?.status).toBe('ACTIVE')
    expect(mr?.listingStatus).toBe('LISTED')

    // Assert: price IS visible (alert should fire)
    const isVisible = await hasVisiblePrice(product.id)
    expect(isVisible).toBe(true)
  })

  // ============================================================================
  // BONUS: Verify INELIGIBLE retailer is always hidden
  // ============================================================================
  it('alert_does_not_fire_when_retailer_is_ineligible', async () => {
    // Setup: INELIGIBLE retailer (should never be visible regardless of relationships)
    const retailer = await prisma.retailers.create({
      data: {
        id: randomUUID(),
        name: `Test Retailer A1 ineligible ${Date.now()}`,
        website: `https://test-a1-ineligible-${Date.now()}.example.com`,
        visibilityStatus: 'INELIGIBLE',
        updatedAt: new Date(),
      },
    })
    createdRetailerIds.push(retailer.id)

    const product = await createProduct('ineligible')
    await createPrice(product.id, retailer.id)

    // Assert: price is NOT visible (alert should NOT fire)
    const isVisible = await hasVisiblePrice(product.id)
    expect(isVisible).toBe(false)
  })

  // ============================================================================
  // #219: Source-scoped visibility — ineligible retailer's sourceProductId
  // is not in current_visible_prices after recompute
  // ============================================================================
  it('alert_does_not_fire_for_ineligible_source_same_product', async () => {
    // Clean derived table to avoid stale data from other tests
    await cleanTables(prisma, [
      'current_visible_prices',
      'prices',
      'product_links',
      'source_products',
      'sources',
      'merchant_retailers',
      'retailers',
      'products',
    ])

    const now = new Date()

    // Create one product, two retailers (ELIGIBLE and INELIGIBLE)
    const eligibleRetailer = await prisma.retailers.create({
      data: {
        id: randomUUID(),
        name: `Eligible Retailer ${Date.now()}`,
        website: `https://eligible-${Date.now()}.example.com`,
        visibilityStatus: 'ELIGIBLE',
        updatedAt: now,
      },
    })
    createdRetailerIds.push(eligibleRetailer.id)

    const ineligibleRetailer = await prisma.retailers.create({
      data: {
        id: randomUUID(),
        name: `Ineligible Retailer ${Date.now()}`,
        website: `https://ineligible-${Date.now()}.example.com`,
        visibilityStatus: 'INELIGIBLE',
        updatedAt: now,
      },
    })
    createdRetailerIds.push(ineligibleRetailer.id)

    const product = await prisma.products.create({
      data: {
        id: randomUUID(),
        name: `Shared Product ${Date.now()}`,
        category: 'ammunition',
        caliber: '9mm',
        updatedAt: now,
      },
    })
    createdProductIds.push(product.id)

    // Create sources for each retailer
    const eligibleSourceId = randomUUID()
    const ineligibleSourceId = randomUUID()

    await prisma.sources.createMany({
      data: [
        {
          id: eligibleSourceId,
          name: 'Eligible Source',
          url: `https://eligible-source-${Date.now()}.example.com/feed`,
          retailerId: eligibleRetailer.id,
        },
        {
          id: ineligibleSourceId,
          name: 'Ineligible Source',
          url: `https://ineligible-source-${Date.now()}.example.com/feed`,
          retailerId: ineligibleRetailer.id,
        },
      ],
    })

    // Create source_products for each
    const eligibleSpId = randomUUID()
    const ineligibleSpId = randomUUID()

    await prisma.source_products.createMany({
      data: [
        {
          id: eligibleSpId,
          sourceId: eligibleSourceId,
          title: 'Product at Eligible Retailer',
          url: `https://eligible-source-${Date.now()}.example.com/p/1`,
          caliber: '9mm',
        },
        {
          id: ineligibleSpId,
          sourceId: ineligibleSourceId,
          title: 'Product at Ineligible Retailer',
          url: `https://ineligible-source-${Date.now()}.example.com/p/1`,
          caliber: '9mm',
        },
      ],
    })

    // Link both source_products to the same canonical product
    await prisma.product_links.createMany({
      data: [
        {
          sourceProductId: eligibleSpId,
          productId: product.id,
          matchType: 'FINGERPRINT',
          status: 'MATCHED',
          confidence: 1.0,
          resolverVersion: 'test',
          evidence: {},
        },
        {
          sourceProductId: ineligibleSpId,
          productId: product.id,
          matchType: 'FINGERPRINT',
          status: 'MATCHED',
          confidence: 1.0,
          resolverVersion: 'test',
          evidence: {},
        },
      ],
    })

    // Create prices from each retailer for the same product
    const eligiblePriceId = randomUUID()
    const ineligiblePriceId = randomUUID()

    await prisma.prices.createMany({
      data: [
        {
          id: eligiblePriceId,
          productId: product.id,
          retailerId: eligibleRetailer.id,
          sourceId: eligibleSourceId,
          sourceProductId: eligibleSpId,
          price: 19.99,
          currency: 'USD',
          url: `https://eligible-source-${Date.now()}.example.com/p/1`,
          inStock: true,
          observedAt: now,
        },
        {
          id: ineligiblePriceId,
          productId: product.id,
          retailerId: ineligibleRetailer.id,
          sourceId: ineligibleSourceId,
          sourceProductId: ineligibleSpId,
          price: 17.99,
          currency: 'USD',
          url: `https://ineligible-source-${Date.now()}.example.com/p/1`,
          inStock: true,
          observedAt: now,
        },
      ],
    })
    createdPriceIds.push(eligiblePriceId, ineligiblePriceId)

    // Run recompute to populate current_visible_prices
    await recomputeCurrentPrices('FULL', undefined, 'test-recompute-source-scoped')

    // Assert: eligible retailer's sourceProductId has a visible row
    const eligibleVisible = await prisma.current_visible_prices.findFirst({
      where: { productId: product.id, sourceProductId: eligibleSpId },
      select: { id: true },
    })
    expect(eligibleVisible).not.toBeNull()

    // Assert: ineligible retailer's sourceProductId has NO visible row
    const ineligibleVisible = await prisma.current_visible_prices.findFirst({
      where: { productId: product.id, sourceProductId: ineligibleSpId },
      select: { id: true },
    })
    expect(ineligibleVisible).toBeNull()
  })
})
