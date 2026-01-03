import { prisma } from '@ironscout/db'
import { Worker, Job } from 'bullmq'
import { redisConnection } from '../config/redis'
import { logger } from '../config/logger'
import { alertQueue, WriteJobData, NormalizedProduct } from '../config/queues'

const log = logger.writer

// ============================================================================
// BATCH CONFIGURATION
// ============================================================================

const BATCH_SIZE = 100 // Items per batch transaction

// ============================================================================
// TYPES
// ============================================================================

interface BatchResult {
  upsertedCount: number
  priceChanges: Array<{ productId: string; oldPrice?: number; newPrice: number }>
  errors: Array<{ item: NormalizedProduct; error: string }>
}

// ============================================================================
// BATCH PROCESSING HELPERS
// ============================================================================

/**
 * Upsert products in batch using transaction
 */
async function batchUpsertProducts(
  items: NormalizedProduct[]
): Promise<Map<string, string>> {
  const productIdMap = new Map<string, string>()

  // Process in transaction
  await prisma.$transaction(async (tx) => {
    for (const item of items) {
      const product = await tx.products.upsert({
        where: { id: item.productId },
        create: {
          id: item.productId,
          name: item.name,
          description: item.description,
          category: item.category,
          brand: item.brand,
          imageUrl: item.imageUrl,
          upc: item.upc,
          caliber: item.caliber,
          grainWeight: item.grainWeight,
          caseMaterial: item.caseMaterial,
          purpose: item.purpose,
          roundCount: item.roundCount,
        },
        update: {
          description: item.description || undefined,
          imageUrl: item.imageUrl || undefined,
          brand: item.brand || undefined,
          upc: item.upc || undefined,
          caliber: item.caliber || undefined,
          grainWeight: item.grainWeight || undefined,
          caseMaterial: item.caseMaterial || undefined,
          purpose: item.purpose || undefined,
          roundCount: item.roundCount || undefined,
        },
      })
      productIdMap.set(item.productId, product.id)
    }
  })

  return productIdMap
}

/**
 * Batch process prices - check existing and create new where needed
 */
export async function batchProcessPrices(
  items: NormalizedProduct[],
  retailerId: string,
  sourceId: string,
  executionId: string
): Promise<{ upsertedCount: number; priceChanges: Array<{ productId: string; oldPrice?: number; newPrice: number }> }> {
  let upsertedCount = 0
  const priceChanges: Array<{ productId: string; oldPrice?: number; newPrice: number }> = []

  // Build lookup keys for existing prices
  const priceKeys = items.map((item) => ({
    productId: item.productId,
    retailerId,
  }))

  // Fetch all existing prices in one query
  const existingPrices = await prisma.prices.findMany({
    where: {
      OR: priceKeys.map((k) => ({
        productId: k.productId,
        retailerId: k.retailerId,
      })),
    },
    orderBy: { createdAt: 'desc' },
    distinct: ['productId', 'retailerId'],
  })

  // Create lookup map
  const existingPriceMap = new Map<string, { price: number; inStock: boolean }>()
  for (const ep of existingPrices) {
    const key = `${ep.productId}:${ep.retailerId}`
    existingPriceMap.set(key, {
      price: parseFloat(ep.price.toString()),
      inStock: ep.inStock,
    })
  }

  // ADR-015: Capture observation time for all prices in this batch
  // This is the canonical timestamp for correction matching and provenance
  const observedAt = new Date()

  // Collect prices to create
  const pricesToCreate: Array<{
    productId: string
    retailerId: string
    merchantId?: string
    sourceId: string
    ingestionRunType: 'SCRAPE' | 'AFFILIATE_FEED' | 'MERCHANT_FEED' | 'MANUAL'
    ingestionRunId: string
    observedAt: Date
    price: number
    currency: string
    url: string
    inStock: boolean
  }> = []

  for (const item of items) {
    const key = `${item.productId}:${retailerId}`
    const existing = existingPriceMap.get(key)
    const newPrice = parseFloat(item.price.toFixed(2))

    // Only create new price if different or doesn't exist
    if (!existing || existing.price !== newPrice || existing.inStock !== item.inStock) {
      pricesToCreate.push({
        productId: item.productId,
        retailerId,
        merchantId: undefined, // Derive later from merchant_retailers if needed
        sourceId,
        ingestionRunType: 'SCRAPE',
        ingestionRunId: executionId,
        observedAt,
        price: newPrice,
        currency: item.currency,
        url: item.url,
        inStock: item.inStock,
      })

      // Track price changes for alerts
      if (existing && existing.price !== newPrice) {
        priceChanges.push({
          productId: item.productId,
          oldPrice: existing.price,
          newPrice,
        })
      }
    }
  }

  // Batch create prices
  if (pricesToCreate.length > 0) {
    await prisma.prices.createMany({
      data: pricesToCreate,
    })
    upsertedCount = pricesToCreate.length
  }

  return { upsertedCount, priceChanges }
}

/**
 * Process a batch of items
 */
async function processBatch(
  items: NormalizedProduct[],
  executionId: string,
  retailerId: string,
  sourceId: string
): Promise<BatchResult> {
  const errors: Array<{ item: NormalizedProduct; error: string }> = []

  try {
    // Step 1: Batch upsert products
    await batchUpsertProducts(items)

    // Step 2: Batch process prices
    const { upsertedCount, priceChanges } = await batchProcessPrices(items, retailerId, sourceId, executionId)

    return { upsertedCount, priceChanges, errors }
  } catch (error) {
    // If batch fails, try item-by-item to identify failures
    log.warn('Batch failed, falling back to item-by-item processing')

    let upsertedCount = 0
    const priceChanges: Array<{ productId: string; oldPrice?: number; newPrice: number }> = []

    // ADR-015: Capture observation time for fallback processing
    const observedAt = new Date()

    for (const item of items) {
      try {
        // Upsert product
        await prisma.products.upsert({
          where: { id: item.productId },
          create: {
            id: item.productId,
            name: item.name,
            description: item.description,
            category: item.category,
            brand: item.brand,
            imageUrl: item.imageUrl,
            upc: item.upc,
            caliber: item.caliber,
            grainWeight: item.grainWeight,
            caseMaterial: item.caseMaterial,
            purpose: item.purpose,
            roundCount: item.roundCount,
          },
          update: {
            description: item.description || undefined,
            imageUrl: item.imageUrl || undefined,
            brand: item.brand || undefined,
          },
        })

        // Check existing price
        const existingPrice = await prisma.prices.findFirst({
          where: { productId: item.productId, retailerId },
          orderBy: { createdAt: 'desc' },
        })

        const newPrice = parseFloat(item.price.toFixed(2))
        const oldPrice = existingPrice ? parseFloat(existingPrice.price.toString()) : undefined

        if (!existingPrice || oldPrice !== newPrice || existingPrice.inStock !== item.inStock) {
          await prisma.prices.create({
            data: {
              productId: item.productId,
              retailerId,
              sourceId,
              ingestionRunType: 'SCRAPE',
              ingestionRunId: executionId,
              observedAt,
              price: newPrice,
              currency: item.currency,
              url: item.url,
              inStock: item.inStock,
            },
          })

          if (oldPrice && oldPrice !== newPrice) {
            priceChanges.push({ productId: item.productId, oldPrice, newPrice })
          }
          upsertedCount++
        }
      } catch (itemError) {
        errors.push({
          item,
          error: itemError instanceof Error ? itemError.message : 'Unknown error',
        })
      }
    }

    return { upsertedCount, priceChanges, errors }
  }
}

// ============================================================================
// WRITER WORKER
// ============================================================================

// Writer worker - upserts products, retailers, and prices to database
// Uses batched operations to reduce DB round trips from O(N) to O(batches)
export const writerWorker = new Worker<WriteJobData>(
  'write',
  async (job: Job<WriteJobData>) => {
    const { executionId, sourceId, normalizedItems, contentHash } = job.data
    const stageStart = Date.now()
    const totalItems = normalizedItems.length
    const batchCount = Math.ceil(totalItems / BATCH_SIZE)

    log.debug('WRITE_JOB_RECEIVED', {
      jobId: job.id,
      executionId,
      sourceId,
      totalItems,
      batchCount,
      batchSize: BATCH_SIZE,
      contentHashPrefix: contentHash?.slice(0, 16),
      attemptsMade: job.attemptsMade,
    })

    let totalUpserted = 0
    const allPriceChanges: Array<{ productId: string; oldPrice?: number; newPrice: number }> = []
    const allErrors: Array<{ item: NormalizedProduct; error: string }> = []

    try {
      // Get source for retailer context
      log.debug('WRITE_LOADING_SOURCE', { sourceId, executionId })
      const sourceLoadStart = Date.now()
      const source = await prisma.sources.findUnique({
        where: { id: sourceId },
        select: { id: true, name: true, retailerId: true, retailers: { select: { name: true } } },
      })

      if (!source || !source.retailerId) {
        throw new Error('Source missing retailerId; cannot write without explicit retailer mapping')
      }

      const retailerId = source.retailerId

      log.debug('WRITE_SOURCE_LOADED', {
        sourceId,
        sourceName: source?.name,
        retailerName: source?.retailers?.name,
        retailerId,
        executionId,
        loadDurationMs: Date.now() - sourceLoadStart,
      })

      log.info('WRITE_START', { executionId, sourceId, sourceName: source?.name, retailerName: source?.retailers?.name, totalItems, batchCount })
      // Log start (summary only)
      await prisma.execution_logs.create({
        data: {
          executionId,
          level: 'INFO',
          event: 'WRITE_START',
          message: `Starting batched write: ${totalItems} items in ${batchCount} batches`,
          metadata: { totalItems, batchCount, batchSize: BATCH_SIZE, retailerId },
        },
      })

      // Process in batches
      for (let i = 0; i < totalItems; i += BATCH_SIZE) {
        const batchNum = Math.floor(i / BATCH_SIZE) + 1
        const batch = normalizedItems.slice(i, i + BATCH_SIZE)

        const result = await processBatch(batch, executionId, retailerId, sourceId)

        totalUpserted += result.upsertedCount
        allPriceChanges.push(...result.priceChanges)
        allErrors.push(...result.errors)

        // Log batch progress (only every 5 batches or on last batch to reduce logs)
        if (batchCount > 5 && (batchNum % 5 === 0 || batchNum === batchCount)) {
          log.debug('Batch progress', { batchNum, batchCount, upsertedSoFar: totalUpserted })
        }
      }

      // Log errors (item-level logging only for failures)
      if (allErrors.length > 0) {
        await prisma.execution_logs.create({
          data: {
            executionId,
            level: 'WARN',
            event: 'WRITE_ERRORS',
            message: `${allErrors.length} items failed to write`,
            metadata: {
              errorCount: allErrors.length,
              errors: allErrors.slice(0, 10).map((e) => ({
                productId: e.item.productId,
                name: e.item.name,
                error: e.error,
              })),
              truncated: allErrors.length > 10,
            },
          },
        })
      }

      // Update execution status
      const duration = Date.now() - new Date(job.timestamp).getTime()
      await prisma.executions.update({
        where: { id: executionId },
        data: {
          status: 'SUCCESS',
          itemsUpserted: totalUpserted,
          completedAt: new Date(),
          duration,
        },
      })

      // Update feed hash if provided
      if (contentHash) {
        await prisma.sources.update({
          where: { id: sourceId },
          data: { feedHash: contentHash },
        })
      }

      // Summary log (single entry for entire write operation)
      const writeDurationMs = Date.now() - stageStart

      await prisma.execution_logs.create({
        data: {
          executionId,
          level: 'INFO',
          event: 'WRITE_OK',
          message: `Write complete: ${totalUpserted} prices updated, ${allPriceChanges.length} price changes`,
          metadata: {
            // Timing
            durationMs: writeDurationMs,
            // Counters
            itemsInput: totalItems,
            itemsUpserted: totalUpserted,
            priceChanges: allPriceChanges.length,
            errors: allErrors.length,
            batchCount,
            // Context
            sourceId,
            retailerId,
            contentHashUpdated: !!contentHash,
          },
        },
      })

      // Queue alert jobs for price changes (batched)
      if (allPriceChanges.length > 0) {
        // Bulk add alerts to queue
        const alertJobs = allPriceChanges.map((change) => ({
          name: 'alert',
          data: {
            executionId,
            productId: change.productId,
            oldPrice: change.oldPrice,
            newPrice: change.newPrice,
          },
        }))
        await alertQueue.addBulk(alertJobs)

        await prisma.execution_logs.create({
          data: {
            executionId,
            level: 'INFO',
            event: 'ALERT_QUEUED',
            message: `Queued ${allPriceChanges.length} alert evaluations`,
            metadata: { retailerId },
          },
        })
      }

      return { success: true, upsertedCount: totalUpserted, priceChanges: allPriceChanges.length }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      await prisma.execution_logs.create({
        data: {
          executionId,
          level: 'ERROR',
          event: 'WRITE_FAIL',
          message: `Write failed: ${errorMessage}`,
          metadata: { processedSoFar: totalUpserted, totalItems },
        },
      })

      await prisma.executions.update({
        where: { id: executionId },
        data: {
          status: 'FAILED',
          errorMessage: `Write failed: ${errorMessage}`,
          completedAt: new Date(),
          itemsUpserted: totalUpserted,
        },
      })

      throw error
    }
  },
  {
    connection: redisConnection,
    concurrency: 2,
  }
)

writerWorker.on('completed', (job) => {
  log.info('Job completed', { jobId: job.id })
})

writerWorker.on('failed', (job, err) => {
  log.error('Job failed', { jobId: job?.id, error: err.message })
})
