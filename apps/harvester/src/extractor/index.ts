import { Worker, Job } from 'bullmq'
import { prisma } from '@ironscout/db'
import * as cheerio from 'cheerio'
import { redisConnection } from '../config/redis'
import { logger } from '../config/logger'
import { normalizeQueue, ExtractJobData } from '../config/queues'

const log = logger.extractor

// ============================================================================
// PAYLOAD LIMITS - Prevent Redis/BullMQ overflow
// ============================================================================

/** Maximum items per normalize job to prevent Redis payload overflow */
const NORMALIZE_CHUNK_SIZE = 1000

/** Maximum payload size in bytes for a single BullMQ job (5MB safety margin) */
const MAX_JOB_PAYLOAD_BYTES = 5 * 1024 * 1024

/**
 * Estimate payload size in bytes (accurate for UTF-8)
 */
function estimatePayloadBytes(items: unknown[]): number {
  // Use Buffer.byteLength for accurate UTF-8 byte count
  const sample = JSON.stringify(items.slice(0, 10))
  const avgItemBytes = Buffer.byteLength(sample, 'utf8') / Math.min(items.length, 10)
  return Math.ceil(avgItemBytes * items.length)
}

// Extractor worker - parses content and extracts product data
export const extractorWorker = new Worker<ExtractJobData>(
  'extract',
  async (job: Job<ExtractJobData>) => {
    const { executionId, sourceId, content, sourceType, contentHash } = job.data
    const stageStart = Date.now()
    // Use Buffer.byteLength for accurate UTF-8 byte counting
    const contentStr = typeof content === 'string' ? content : JSON.stringify(content)
    const contentBytes = Buffer.byteLength(contentStr, 'utf8')

    log.debug('EXTRACT_JOB_RECEIVED', {
      jobId: job.id,
      executionId,
      sourceId,
      sourceType,
      contentBytes,
      contentHashPrefix: contentHash?.slice(0, 16),
      attemptsMade: job.attemptsMade,
    })

    try {
      // Get source name for logging context
      log.debug('EXTRACT_LOADING_SOURCE', { sourceId, executionId })
      const sourceLoadStart = Date.now()
      const source = await prisma.sources.findUnique({
        where: { id: sourceId },
        select: { name: true, retailers: { select: { name: true } } },
      })
      const sourceName = source?.name
      const retailerName = source?.retailers?.name

      log.debug('EXTRACT_SOURCE_LOADED', {
        sourceId,
        sourceName,
        retailerName,
        executionId,
        loadDurationMs: Date.now() - sourceLoadStart,
      })

      log.info('EXTRACT_START', { executionId, sourceId, sourceName, retailerName, sourceType, contentBytes })

      await prisma.execution_logs.create({
        data: {
          executionId,
          level: 'INFO',
          event: 'EXTRACT_START',
          message: `Starting extraction for ${sourceType} content`,
          metadata: {
            sourceId,
            sourceType,
            contentBytes,
          },
        },
      })

      let rawItems: any[] = []

      switch (sourceType) {
        case 'RSS':
          rawItems = await extractFromRSS(content)
          break
        case 'JSON':
          rawItems = await extractFromJSON(content)
          break
        case 'HTML':
        case 'JS_RENDERED':
          rawItems = await extractFromHTML(content, sourceId)
          break
        default:
          throw new Error(`Unsupported source type: ${sourceType}`)
      }

      const extractDurationMs = Date.now() - stageStart

      await prisma.execution_logs.create({
        data: {
          executionId,
          level: 'INFO',
          event: 'EXTRACT_OK',
          message: `Extracted ${rawItems.length} items from ${sourceType}`,
          metadata: {
            // Timing
            durationMs: extractDurationMs,
            // Counters
            itemsExtracted: rawItems.length,
            contentBytes,
            // Context
            sourceId,
            sourceType,
          },
        },
      })

      // Update execution with items found
      await prisma.executions.update({
        where: { id: executionId },
        data: { itemsFound: rawItems.length },
      })

      // Check payload size and chunk if needed to prevent Redis overflow
      const estimatedBytes = estimatePayloadBytes(rawItems)
      const needsChunking = rawItems.length > NORMALIZE_CHUNK_SIZE || estimatedBytes > MAX_JOB_PAYLOAD_BYTES

      if (needsChunking) {
        // Chunk into smaller jobs
        const chunkCount = Math.ceil(rawItems.length / NORMALIZE_CHUNK_SIZE)
        log.info('Chunking normalize jobs', {
          executionId,
          totalItems: rawItems.length,
          estimatedBytes,
          chunkCount,
          chunkSize: NORMALIZE_CHUNK_SIZE,
        })

        for (let i = 0; i < rawItems.length; i += NORMALIZE_CHUNK_SIZE) {
          const chunkIndex = Math.floor(i / NORMALIZE_CHUNK_SIZE)
          const chunk = rawItems.slice(i, i + NORMALIZE_CHUNK_SIZE)
          const isLastChunk = chunkIndex === chunkCount - 1

          await normalizeQueue.add('normalize', {
            executionId,
            sourceId,
            rawItems: chunk,
            // Only pass contentHash on last chunk to update after all chunks processed
            contentHash: isLastChunk ? contentHash : undefined,
            chunkInfo: { index: chunkIndex, total: chunkCount, isLast: isLastChunk },
          }, {
            jobId: `normalize--${executionId}--${chunkIndex}`, // Unique per chunk
          })
        }

        await prisma.execution_logs.create({
          data: {
            executionId,
            level: 'INFO',
            event: 'NORMALIZE_QUEUED',
            message: `Queued ${chunkCount} normalize chunks for ${rawItems.length} items`,
            metadata: { chunkCount, totalItems: rawItems.length, estimatedBytes },
          },
        })
      } else {
        // Single job for small payloads
        await normalizeQueue.add('normalize', {
          executionId,
          sourceId,
          rawItems,
          contentHash, // Pass hash to be stored after successful write
        }, {
          jobId: `normalize--${executionId}`, // Idempotent: one normalize per execution
        })

        await prisma.execution_logs.create({
          data: {
            executionId,
            level: 'INFO',
            event: 'NORMALIZE_QUEUED',
            message: 'Normalize job queued',
          },
        })
      }

      return { success: true, itemCount: rawItems.length }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      await prisma.execution_logs.create({
        data: {
          executionId,
          level: 'ERROR',
          event: 'EXTRACT_FAIL',
          message: `Extraction failed: ${errorMessage}`,
        },
      })

      await prisma.executions.update({
        where: { id: executionId },
        data: {
          status: 'FAILED',
          errorMessage: `Extract failed: ${errorMessage}`,
          completedAt: new Date(),
        },
      })

      throw error
    }
  },
  {
    connection: redisConnection,
    concurrency: 3,
  }
)

// Extract from RSS feed
async function extractFromRSS(content: string): Promise<any[]> {
  const $ = cheerio.load(content, { xmlMode: true })
  const items: any[] = []

  $('item').each((_, element) => {
    const $item = $(element)
    items.push({
      title: $item.find('title').text().trim(),
      description: $item.find('description').text().trim(),
      link: $item.find('link').text().trim(),
      pubDate: $item.find('pubDate').text().trim(),
    })
  })

  return items
}

// Extract from JSON response
async function extractFromJSON(content: string | any): Promise<any[]> {
  try {
    // Handle case where axios already parsed the JSON
    const data = typeof content === 'string' ? JSON.parse(content) : content
    // Assume the JSON has a products array
    return Array.isArray(data) ? data : data.products || [data]
  } catch (error) {
    throw new Error('Invalid JSON content')
  }
}

// Extract from HTML - Site-specific adapters
async function extractFromHTML(content: string, sourceId: string): Promise<any[]> {
  const $ = cheerio.load(content)
  const items: any[] = []

  // This is a generic extractor - in production, you'd have site-specific adapters
  // For now, we'll look for common product patterns

  // Example: Look for product cards with common class names
  $('.product, .product-card, [data-product]').each((_, element) => {
    const $el = $(element)

    const name = $el.find('.product-name, .title, h2, h3').first().text().trim()
    const priceText = $el.find('.price, .product-price, [data-price]').first().text().trim()
    const image = $el.find('img').first().attr('src')
    const link = $el.find('a').first().attr('href')

    if (name && priceText) {
      items.push({
        name,
        priceText,
        imageUrl: image,
        url: link,
      })
    }
  })

  return items
}

extractorWorker.on('completed', (job) => {
  log.info('Job completed', { jobId: job.id })
})

extractorWorker.on('failed', (job, err) => {
  log.error('Job failed', { jobId: job?.id, error: err.message })
})
