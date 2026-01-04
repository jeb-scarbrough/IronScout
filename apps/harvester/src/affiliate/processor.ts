/**
 * Affiliate Feed Processor
 *
 * Phase 1: Ingest products and update lastSeenAt.
 * - Resolve identity (IMPACT_ITEM_ID > SKU > URL_HASH per spec)
 * - Upsert SourceProduct records (batched)
 * - Update SourceProductPresence.lastSeenAt (batched)
 * - Write Price records (append-only, batched)
 * - Record SourceProductSeen for circuit breaker (batched)
 *
 * Per spec Section 4.2.1 and 8.3: Batched processing with run-local cache.
 *
 * CRITICAL: Per spec §4.2.1, per-row DB reads are forbidden.
 * This implementation uses:
 * - Batch-fetch last prices using DISTINCT ON
 * - Run-local lastPriceCache maintained across chunks
 * - Bulk insert with ON CONFLICT DO NOTHING (partial unique index)
 * - Memory guard to prevent OOM on high-density feeds
 * - Actual row count from DB for accurate metrics
 */

import { prisma } from '@ironscout/db'
import { createHash } from 'crypto'
import { logger } from '../config/logger'
import { computeUrlHash, normalizeUrl } from './parser'
import type {
  FeedRunContext,
  ParsedFeedProduct,
  ProcessorResult,
  ParseError,
  IdentityType,
} from './types'
import { ERROR_CODES, AffiliateFeedError } from './types'

const log = logger.affiliate

// Batch sizes for database operations
// Per spec §7.3: 500-5000 rows per batch (using 1000 as default)
const BATCH_SIZE = Number(process.env.AFFILIATE_BATCH_SIZE ?? 1000)

// Default limits per spec §7.3.1
const DEFAULT_MAX_ROW_COUNT = 500_000

// Heartbeat interval: write price even if unchanged after this duration
// Ensures price history shows "still at this price" confirmations
const HEARTBEAT_HOURS = Number(process.env.PRICE_HEARTBEAT_HOURS ?? 24)
const HEARTBEAT_MS = HEARTBEAT_HOURS * 60 * 60 * 1000

// ============================================================================
// TYPES
// ============================================================================

/** Cached last price entry for a sourceProduct */
interface LastPriceEntry {
  sourceProductId: string
  priceSignatureHash: string
  createdAt: Date
}

/** New price record to insert */
interface NewPriceRecord {
  retailerId: string
  sourceProductId: string
  affiliateFeedRunId: string
  priceSignatureHash: string
  price: number
  currency: string
  url: string
  inStock: boolean
  originalPrice: number | null
  priceType: 'REGULAR' | 'SALE'
}

/** Resolved identity for a product */
interface ResolvedIdentity {
  type: IdentityType
  value: string
}

/** Product with resolved identity for batch processing */
interface ProductWithIdentity {
  product: ParsedFeedProduct
  identity: ResolvedIdentity
  identityKey: string
}

/** Result of upserting source products */
interface UpsertedSourceProduct {
  id: string
  identityKey: string
}

/**
 * Process parsed products in Phase 1
 *
 * Per spec §4.2.1: Uses batched processing with run-local cache
 * - Batch-fetch last prices (no per-row queries)
 * - Run-local lastPriceCache maintained across chunks
 * - Bulk insert with ON CONFLICT DO NOTHING
 * - Memory guard on unique products
 * - Actual row count from DB for accurate metrics
 *
 * Per spec §4.2.2: "Last row wins" deduplication
 * - Pre-scan to identify last occurrence of each identity
 * - Only process rows that are "winners" for their identity
 */
export async function processProducts(
  context: FeedRunContext,
  products: ParsedFeedProduct[]
): Promise<ProcessorResult> {
  const { feed, run, sourceId, retailerId, t0 } = context
  const maxRowCount = feed.maxRowCount ?? DEFAULT_MAX_ROW_COUNT

  log.debug('Starting product processing', {
    runId: run.id,
    feedId: feed.id,
    sourceId,
    retailerId,
    productCount: products.length,
    maxRowCount,
    batchSize: BATCH_SIZE,
    expectedBatches: Math.ceil(products.length / BATCH_SIZE),
    heartbeatHours: HEARTBEAT_HOURS,
  })

  let productsUpserted = 0
  let pricesWritten = 0
  let productsRejected = 0
  let duplicateKeyCount = 0
  let urlHashFallbackCount = 0
  const errors: ParseError[] = []

  // Run-local price cache - maintained across all chunks
  // Per spec §4.2.1: This prevents cross-chunk staleness
  const lastPriceCache = new Map<string, LastPriceEntry>()

  // ═══════════════════════════════════════════════════════════════════════════
  // PRE-SCAN: Identify "winning" row for each identity
  // Per spec §4.2.2: "Last row wins" - only process the last occurrence
  // This avoids processing duplicates across chunks and ensures consistency.
  // ═══════════════════════════════════════════════════════════════════════════
  log.debug('Starting identity pre-scan', { runId: run.id, productCount: products.length })
  const prescanStart = Date.now()
  const { winningRows, totalDuplicates, totalUrlHashFallbacks } = prescanIdentities(products)
  duplicateKeyCount = totalDuplicates
  urlHashFallbackCount = totalUrlHashFallbacks

  log.debug('Identity pre-scan complete', {
    runId: run.id,
    prescanDurationMs: Date.now() - prescanStart,
    totalRows: products.length,
    uniqueIdentities: winningRows.size,
    duplicatesSkipped: totalDuplicates,
    duplicatePercentage: products.length > 0 ? ((totalDuplicates / products.length) * 100).toFixed(2) : 0,
    urlHashFallbacks: totalUrlHashFallbacks,
    urlHashPercentage: products.length > 0 ? ((totalUrlHashFallbacks / products.length) * 100).toFixed(2) : 0,
  })

  // Process in chunks
  const totalChunks = Math.ceil(products.length / BATCH_SIZE)
  log.debug('Starting chunk processing', {
    runId: run.id,
    totalChunks,
    batchSize: BATCH_SIZE,
  })

  for (let chunkStart = 0; chunkStart < products.length; chunkStart += BATCH_SIZE) {
    const chunk = products.slice(chunkStart, chunkStart + BATCH_SIZE)
    const chunkNum = Math.floor(chunkStart / BATCH_SIZE) + 1
    const chunkStartTime = Date.now()

    log.debug('Processing chunk', {
      runId: run.id,
      chunkNum,
      totalChunks,
      chunkSize: chunk.length,
      chunkStartIndex: chunkStart,
    })

    try {
      // Step 1: Filter chunk to only include winning rows
      // Per spec §4.2.2: "Last row wins" - skip non-winning rows (duplicates)
      const deduped = filterToWinningRows(chunk, chunkStart, winningRows)

      log.debug('Chunk deduplication complete', {
        runId: run.id,
        chunkNum,
        originalSize: chunk.length,
        dedupedSize: deduped.length,
        duplicatesRemoved: chunk.length - deduped.length,
      })

      if (deduped.length === 0) {
        log.debug('Chunk skipped - all duplicates', { runId: run.id, chunkNum })
        continue
      }

      // Step 2: Batch upsert SourceProducts
      log.debug('Upserting source products', { runId: run.id, chunkNum, count: deduped.length })
      const upsertStart = Date.now()
      const upsertedProducts = await batchUpsertSourceProducts(
        sourceId,
        deduped,
        run.id
      )
      log.debug('Source products upserted', {
        runId: run.id,
        chunkNum,
        count: upsertedProducts.length,
        durationMs: Date.now() - upsertStart,
      })

      const sourceProductIds = upsertedProducts.map((sp) => sp.id)

      // Step 3: Batch update presence and seen records
      log.debug('Updating presence and seen records', { runId: run.id, chunkNum, count: sourceProductIds.length })
      const presenceStart = Date.now()
      await Promise.all([
        batchUpdatePresence(sourceProductIds, t0),
        batchRecordSeen(run.id, sourceProductIds),
      ])
      log.debug('Presence and seen records updated', {
        runId: run.id,
        chunkNum,
        durationMs: Date.now() - presenceStart,
      })

      // Step 4: Batch-fetch last prices for uncached IDs
      // Per spec §4.2.1: Only fetch for IDs not already in cache
      const uncachedIds = sourceProductIds.filter((id) => !lastPriceCache.has(id))
      if (uncachedIds.length > 0) {
        log.debug('Fetching last prices for uncached products', {
          runId: run.id,
          chunkNum,
          uncachedCount: uncachedIds.length,
          cachedCount: sourceProductIds.length - uncachedIds.length,
        })
        const fetchStart = Date.now()
        const fetchedPrices = await batchFetchLastPrices(uncachedIds)
        for (const lp of fetchedPrices) {
          lastPriceCache.set(lp.sourceProductId, lp)
        }
        log.debug('Last prices fetched', {
          runId: run.id,
          chunkNum,
          fetchedCount: fetchedPrices.length,
          durationMs: Date.now() - fetchStart,
        })
      } else {
        log.debug('All products in cache - skipping price fetch', { runId: run.id, chunkNum })
      }

      // ═══════════════════════════════════════════════════════════════════════
      // MEMORY GUARD: Abort if cache exceeds maxRowCount
      // Per spec §4.2.1: Prevents OOM from feeds with more unique products
      // than expected. The cache grows with unique products, not rows.
      // ═══════════════════════════════════════════════════════════════════════
      if (lastPriceCache.size > maxRowCount) {
        log.error('Memory guard triggered - unique product limit exceeded', {
          runId: run.id,
          chunkNum,
          cacheSize: lastPriceCache.size,
          maxRowCount,
        })
        throw AffiliateFeedError.permanentError(
          `Unique product limit exceeded: ${lastPriceCache.size} > ${maxRowCount}`,
          ERROR_CODES.TOO_MANY_ROWS,
          { cacheSize: lastPriceCache.size, maxRowCount }
        )
      }

      // Step 5: Decide writes in-memory and collect prices to insert
      // Per spec §4.2.1: No per-row DB reads - all decisions use cache
      log.debug('Deciding price writes', { runId: run.id, chunkNum, productCount: deduped.length })
      const pricesToWrite = decidePriceWrites(
        deduped,
        upsertedProducts,
        retailerId,
        run.id,
        t0,
        lastPriceCache
      )
      log.debug('Price write decisions made', {
        runId: run.id,
        chunkNum,
        pricesToWrite: pricesToWrite.length,
        skipped: deduped.length - pricesToWrite.length,
      })

      // Step 6: Bulk insert prices with ON CONFLICT DO NOTHING
      // Per spec §4.2.1: Use raw SQL with partial unique index for idempotency
      let actualInserted = 0
      if (pricesToWrite.length > 0) {
        log.debug('Inserting prices', { runId: run.id, chunkNum, count: pricesToWrite.length })
        const insertStart = Date.now()
        actualInserted = await bulkInsertPrices(pricesToWrite, t0)
        log.debug('Prices inserted', {
          runId: run.id,
          chunkNum,
          requested: pricesToWrite.length,
          actualInserted,
          duplicatesRejected: pricesToWrite.length - actualInserted,
          durationMs: Date.now() - insertStart,
        })

        // Update cache so later chunks see these writes
        // Per spec §4.2.1: Cache updated after each batch insert
        for (const price of pricesToWrite) {
          lastPriceCache.set(price.sourceProductId, {
            sourceProductId: price.sourceProductId,
            priceSignatureHash: price.priceSignatureHash,
            createdAt: t0,
          })
        }
      }

      productsUpserted += upsertedProducts.length
      pricesWritten += actualInserted

      const chunkDuration = Date.now() - chunkStartTime
      // Log batch progress (every 5 batches or on large feeds or if slow)
      if (chunkNum % 5 === 0 || products.length > 10000 || chunkDuration > 5000) {
        log.debug('Chunk progress', {
          runId: run.id,
          chunkNum,
          totalChunks,
          chunkDurationMs: chunkDuration,
          productsUpserted,
          pricesWritten,
          cacheSize: lastPriceCache.size,
          percentComplete: ((chunkNum / totalChunks) * 100).toFixed(1),
        })
      }
    } catch (err) {
      // Chunk failed - log error and continue with next chunk
      // Per spec §7.4: Partial failures keep successful data
      if (err instanceof AffiliateFeedError && err.code === ERROR_CODES.TOO_MANY_ROWS) {
        // Memory guard triggered - rethrow to abort entire run
        throw err
      }

      productsRejected += chunk.length
      const message = err instanceof Error ? err.message : 'Chunk processing error'
      errors.push({
        code: ERROR_CODES.DATABASE_ERROR,
        message: `Chunk ${chunkNum} failed: ${message}`,
        rowNumber: chunk[0]?.rowNumber,
        sample: { chunkSize: chunk.length },
      })

      log.error('Chunk processing failed', {
        runId: run.id,
        chunkNum,
        error: message,
      })
    }
  }

  // Log final progress
  log.info('Processing complete', {
    runId: run.id,
    productsUpserted,
    pricesWritten,
    duplicateKeyCount,
    urlHashFallbackCount,
    errors: errors.length,
    uniqueProductsSeen: lastPriceCache.size,
  })

  return {
    productsUpserted,
    pricesWritten,
    productsRejected,
    duplicateKeyCount,
    urlHashFallbackCount,
    errors,
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Resolve identity for a product
 * Priority per spec: IMPACT_ITEM_ID > SKU > URL_HASH
 * Note: UPC is not used for identity in v1 (stored on SourceProduct for reference only)
 */
function resolveIdentity(product: ParsedFeedProduct): ResolvedIdentity {
  // IMPACT_ITEM_ID has highest priority
  if (product.impactItemId && product.impactItemId.trim()) {
    return { type: 'IMPACT_ITEM_ID', value: product.impactItemId.trim() }
  }

  // SKU is next
  if (product.sku && product.sku.trim()) {
    return { type: 'SKU', value: product.sku.trim() }
  }

  // Fallback to URL_HASH (UPC not used for identity in v1 per spec)
  const urlHash = computeUrlHash(product.url)
  return { type: 'URL_HASH', value: urlHash }
}

/**
 * Compute price signature hash for deduplication
 */
function computePriceSignature(product: ParsedFeedProduct): string {
  const signatureData = JSON.stringify({
    price: product.price,
    currency: product.currency || 'USD',
    originalPrice: product.originalPrice,
  })
  return createHash('sha256').update(signatureData).digest('hex')
}

/**
 * Pre-scan all products to identify the "winning" row for each identity
 *
 * Per spec §4.2.2: "Last row wins" - when duplicate identities appear in a feed,
 * only the last occurrence should be processed. This pre-scan identifies which
 * row index wins for each identity, enabling efficient cross-batch deduplication.
 *
 * @returns Map of array index -> ProductWithIdentity for winning rows only
 */
function prescanIdentities(products: ParsedFeedProduct[]): {
  winningRows: Map<number, ProductWithIdentity>
  totalDuplicates: number
  totalUrlHashFallbacks: number
} {
  // Track last occurrence of each identity (identityKey -> array index)
  const lastOccurrence = new Map<string, number>()
  // Track identity info for each index
  const identityByIndex = new Map<number, { product: ParsedFeedProduct; identity: ResolvedIdentity; identityKey: string }>()
  let totalUrlHashFallbacks = 0

  // First pass: identify last occurrence of each identity
  for (let i = 0; i < products.length; i++) {
    const product = products[i]
    const identity = resolveIdentity(product)
    const identityKey = `${identity.type}:${identity.value}`

    if (identity.type === 'URL_HASH') {
      totalUrlHashFallbacks++
    }

    // Always update - "last row wins"
    lastOccurrence.set(identityKey, i)
    identityByIndex.set(i, { product, identity, identityKey })
  }

  // Second pass: build winning rows map (only indices that are the last occurrence)
  const winningRows = new Map<number, ProductWithIdentity>()
  const winningIdentities = new Set<string>()

  for (const [identityKey, winningIndex] of lastOccurrence) {
    const info = identityByIndex.get(winningIndex)!
    winningRows.set(winningIndex, {
      product: info.product,
      identity: info.identity,
      identityKey: info.identityKey,
    })
    winningIdentities.add(identityKey)
  }

  // Count duplicates: total rows - unique identities
  const totalDuplicates = products.length - winningIdentities.size

  return { winningRows, totalDuplicates, totalUrlHashFallbacks }
}

/**
 * Filter a chunk to only include winning rows
 *
 * Per spec §4.2.2: "Last row wins" - only process rows that are the last
 * occurrence of their identity across the entire feed.
 *
 * @param chunk - Products in this chunk
 * @param chunkStart - Starting index of this chunk in the full products array
 * @param winningRows - Map of array index -> ProductWithIdentity from prescan
 */
function filterToWinningRows(
  chunk: ParsedFeedProduct[],
  chunkStart: number,
  winningRows: Map<number, ProductWithIdentity>
): ProductWithIdentity[] {
  const result: ProductWithIdentity[] = []

  for (let i = 0; i < chunk.length; i++) {
    const globalIndex = chunkStart + i
    const winning = winningRows.get(globalIndex)

    if (winning) {
      result.push(winning)
    }
    // Non-winning rows are silently skipped (they're duplicates)
  }

  return result
}

/**
 * Batch upsert SourceProducts
 * Uses raw SQL with unnest() for efficient bulk upsert with ON CONFLICT
 */
async function batchUpsertSourceProducts(
  sourceId: string,
  products: ProductWithIdentity[],
  runId: string
): Promise<UpsertedSourceProduct[]> {
  if (products.length === 0) return []

  // Extract arrays for unnest - parallel arrays for each field
  const identityTypes = products.map((p) => p.identity.type)
  const identityValues = products.map((p) => p.identity.value)
  const titles = products.map((p) => p.product.name)
  const urls = products.map((p) => p.product.url)
  const imageUrls = products.map((p) => p.product.imageUrl ?? null)
  const skus = products.map((p) => p.product.sku ?? null)
  const upcs = products.map((p) => p.product.upc ?? null)
  const urlHashes = products.map((p) => computeUrlHash(p.product.url))
  const normalizedUrls = products.map((p) => normalizeUrl(p.product.url))
  const impactItemIds = products.map((p) => p.product.impactItemId ?? null)

  // Bulk upsert with ON CONFLICT DO UPDATE
  // Returns id and constructed identityKey for mapping back to products
  const results = await prisma.$queryRaw<UpsertedSourceProduct[]>`
    INSERT INTO source_products (
      "id", "sourceId", "identityType", "identityValue", "title", "url",
      "imageUrl", "sku", "upc", "urlHash", "normalizedUrl", "impactItemId",
      "createdByRunId", "lastUpdatedByRunId", "createdAt", "updatedAt"
    )
    SELECT
      gen_random_uuid(),
      ${sourceId},
      unnest(${identityTypes}::text[])::"SourceProductIdentityType",
      unnest(${identityValues}::text[]),
      unnest(${titles}::text[]),
      unnest(${urls}::text[]),
      unnest(${imageUrls}::text[]),
      unnest(${skus}::text[]),
      unnest(${upcs}::text[]),
      unnest(${urlHashes}::text[]),
      unnest(${normalizedUrls}::text[]),
      unnest(${impactItemIds}::text[]),
      ${runId},
      ${runId},
      NOW(),
      NOW()
    ON CONFLICT ("sourceId", "identityType", "identityValue") DO UPDATE SET
      "title" = EXCLUDED."title",
      "url" = EXCLUDED."url",
      "imageUrl" = EXCLUDED."imageUrl",
      "sku" = EXCLUDED."sku",
      "upc" = EXCLUDED."upc",
      "urlHash" = EXCLUDED."urlHash",
      "normalizedUrl" = EXCLUDED."normalizedUrl",
      "impactItemId" = EXCLUDED."impactItemId",
      "lastUpdatedByRunId" = EXCLUDED."lastUpdatedByRunId",
      "updatedAt" = NOW()
    RETURNING "id", "identityType" || ':' || "identityValue" AS "identityKey"
  `

  return results
}

/**
 * Batch update SourceProductPresence.lastSeenAt
 * Uses raw SQL for efficient bulk upsert
 */
async function batchUpdatePresence(
  sourceProductIds: string[],
  t0: Date
): Promise<void> {
  if (sourceProductIds.length === 0) return

  // Use raw SQL for efficient bulk upsert with ON CONFLICT
  // Per spec: Phase 1 only updates lastSeenAt, NOT lastSeenSuccessAt
  // Table name: source_product_presence (per Prisma @@map)
  // Schema: id, sourceProductId, lastSeenAt, lastSeenSuccessAt, updatedAt (no createdAt)
  await prisma.$executeRaw`
    INSERT INTO source_product_presence ("id", "sourceProductId", "lastSeenAt", "updatedAt")
    SELECT gen_random_uuid(), id, ${t0}, NOW()
    FROM unnest(${sourceProductIds}::text[]) AS id
    ON CONFLICT ("sourceProductId") DO UPDATE SET
      "lastSeenAt" = ${t0},
      "updatedAt" = NOW()
  `
}

/**
 * Batch record SourceProductSeen for circuit breaker
 * Uses raw SQL for efficient bulk insert
 */
async function batchRecordSeen(
  runId: string,
  sourceProductIds: string[]
): Promise<void> {
  if (sourceProductIds.length === 0) return

  // Use raw SQL for efficient bulk insert with ON CONFLICT DO NOTHING
  // Table name: source_product_seen (per Prisma @@map)
  await prisma.$executeRaw`
    INSERT INTO source_product_seen ("id", "runId", "sourceProductId", "createdAt")
    SELECT gen_random_uuid(), ${runId}, id, NOW()
    FROM unnest(${sourceProductIds}::text[]) AS id
    ON CONFLICT ("runId", "sourceProductId") DO NOTHING
  `
}

/**
 * Batch fetch last prices for source products
 * Per spec §4.2.1: Uses DISTINCT ON for efficient single-query fetch
 */
async function batchFetchLastPrices(
  sourceProductIds: string[]
): Promise<LastPriceEntry[]> {
  if (sourceProductIds.length === 0) return []

  // Per spec: Use DISTINCT ON to get latest price per sourceProductId
  // Table name: prices (per Prisma @@map)
  const results = await prisma.$queryRaw<LastPriceEntry[]>`
    SELECT DISTINCT ON ("sourceProductId")
      "sourceProductId",
      "priceSignatureHash",
      "createdAt"
    FROM prices
    WHERE "sourceProductId" = ANY(${sourceProductIds}::text[])
    ORDER BY "sourceProductId", "createdAt" DESC
  `

  return results
}

/**
 * Decide which prices to write based on cache
 * Per spec §4.2.1: All decisions use run-local cache, no per-row DB reads
 */
function decidePriceWrites(
  products: ProductWithIdentity[],
  upsertedProducts: UpsertedSourceProduct[],
  retailerId: string,
  runId: string,
  t0: Date,
  lastPriceCache: Map<string, LastPriceEntry>
): NewPriceRecord[] {
  const pricesToWrite: NewPriceRecord[] = []

  // Build lookup from identityKey to sourceProductId
  const idLookup = new Map<string, string>()
  for (const sp of upsertedProducts) {
    idLookup.set(sp.identityKey, sp.id)
  }

  for (const { product, identityKey } of products) {
    const sourceProductId = idLookup.get(identityKey)
    if (!sourceProductId) continue

    const priceSignatureHash = computePriceSignature(product)
    const lastPrice = lastPriceCache.get(sourceProductId)

    // Determine if we should write
    const isNew = !lastPrice
    const signatureChanged = lastPrice && lastPrice.priceSignatureHash !== priceSignatureHash
    const heartbeatDue =
      lastPrice && t0.getTime() - lastPrice.createdAt.getTime() >= HEARTBEAT_MS

    if (!isNew && !signatureChanged && !heartbeatDue) {
      // Skip write - signature unchanged and heartbeat not due
      continue
    }

    pricesToWrite.push({
      retailerId,
      sourceProductId,
      affiliateFeedRunId: runId,
      priceSignatureHash,
      price: product.price,
      currency: product.currency || 'USD',
      url: product.url,
      inStock: product.inStock,
      originalPrice: product.originalPrice ?? null,
      priceType:
        product.originalPrice && product.price < product.originalPrice
          ? 'SALE'
          : 'REGULAR',
    })
  }

  return pricesToWrite
}

/**
 * Bulk insert prices using raw SQL with ON CONFLICT DO NOTHING
 *
 * Per spec §4.2.1 and Section 2.6:
 * - Uses ON CONFLICT DO NOTHING (no target) for retry-safe idempotency
 * - Partial unique index `prices_affiliate_dedupe` handles deduplication
 * - Returns actual inserted count from DB, not array length
 *
 * CRITICAL: The `prices` table must have NO other unique constraints.
 * This is enforced via migration test (Section 18.1.1).
 */
async function bulkInsertPrices(
  pricesToWrite: NewPriceRecord[],
  createdAt: Date
): Promise<number> {
  if (pricesToWrite.length === 0) return 0

  // Extract arrays for unnest - per spec pattern
  const sourceProductIds = pricesToWrite.map((p) => p.sourceProductId)
  const retailerIds = pricesToWrite.map((p) => p.retailerId)
  const prices = pricesToWrite.map((p) => p.price)
  const currencies = pricesToWrite.map((p) => p.currency)
  const urls = pricesToWrite.map((p) => p.url)
  const inStocks = pricesToWrite.map((p) => p.inStock)
  const originalPrices = pricesToWrite.map((p) => p.originalPrice)
  const priceTypes = pricesToWrite.map((p) => p.priceType)
  const runIds = pricesToWrite.map((p) => p.affiliateFeedRunId)
  const signatureHashes = pricesToWrite.map((p) => p.priceSignatureHash)

  // Bulk insert with ON CONFLICT DO NOTHING
  // Per spec: Returns actual row count, which may be less than array length
  // if duplicates were suppressed by prices_affiliate_dedupe index
  // Table name: prices (per Prisma @@map)
  const insertedCount = await prisma.$executeRaw`
    INSERT INTO prices (
      "id",
      "sourceProductId",
      "retailerId",
      "price",
      "currency",
      "url",
      "inStock",
      "originalPrice",
      "priceType",
      "affiliateFeedRunId",
      "priceSignatureHash",
      "createdAt",
      "observedAt",
      "ingestionRunType",
      "ingestionRunId"
    )
    SELECT
      gen_random_uuid(),
      unnest(${sourceProductIds}::text[]),
      unnest(${retailerIds}::text[]),
      unnest(${prices}::numeric[]),
      unnest(${currencies}::text[]),
      unnest(${urls}::text[]),
      unnest(${inStocks}::boolean[]),
      unnest(${originalPrices}::numeric[]),
      unnest(${priceTypes}::text[])::"PriceType",
      unnest(${runIds}::text[]),
      unnest(${signatureHashes}::text[]),
      ${createdAt},
      ${createdAt},
      'AFFILIATE_FEED'::"IngestionRunType",
      unnest(${runIds}::text[])
    ON CONFLICT DO NOTHING
  `

  return insertedCount
}
