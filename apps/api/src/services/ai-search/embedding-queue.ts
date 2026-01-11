/**
 * Embedding Queue Client for API
 *
 * Allows the API to enqueue embedding jobs to the harvester's embedding-generate queue.
 * This enables admin backfill operations to use the same queue path as automatic generation.
 */

import { Queue } from 'bullmq'
import { redisConnection } from '../../config/redis'
import { loggers } from '../../config/logger'

const log = loggers.ai

// Queue name must match harvester's QUEUE_NAMES.EMBEDDING_GENERATE
const EMBEDDING_QUEUE_NAME = 'embedding-generate'

// Job data interface (must match harvester's EmbeddingGenerateJobData)
interface EmbeddingGenerateJobData {
  productId: string
  trigger: 'RESOLVE' | 'MANUAL' | 'BACKFILL'
  resolverVersion?: string
  affiliateFeedRunId?: string
}

// Lazy-initialized queue
let embeddingQueue: Queue<EmbeddingGenerateJobData> | null = null

function getQueue(): Queue<EmbeddingGenerateJobData> {
  if (!embeddingQueue) {
    embeddingQueue = new Queue<EmbeddingGenerateJobData>(EMBEDDING_QUEUE_NAME, {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    })
  }
  return embeddingQueue
}

/**
 * Enqueue a single embedding generation job
 *
 * @param productId - Product ID to generate embedding for
 * @param trigger - What triggered this (MANUAL for admin actions, BACKFILL for bulk)
 * @returns true if enqueued successfully
 */
export async function enqueueEmbeddingJob(
  productId: string,
  trigger: 'MANUAL' | 'BACKFILL' = 'MANUAL'
): Promise<boolean> {
  try {
    const queue = getQueue()
    const jobId = `EMBED_${productId}`

    await queue.add(
      'GENERATE_EMBEDDING',
      { productId, trigger },
      {
        jobId,
        delay: 1000, // Small delay for batching
      }
    )

    return true
  } catch (err: any) {
    // Job with same ID already exists - not an error
    if (err?.message?.includes('Job already exists')) {
      return false
    }
    log.error('Failed to enqueue embedding job', { productId, error: err.message })
    return false
  }
}

/**
 * Enqueue embedding jobs for multiple products (bulk operation)
 *
 * @param productIds - Array of product IDs to generate embeddings for
 * @returns Object with counts of enqueued and skipped jobs
 */
export async function enqueueEmbeddingBatch(
  productIds: string[]
): Promise<{ enqueued: number; skipped: number }> {
  const queue = getQueue()
  let enqueued = 0
  let skipped = 0

  // Process in batches to avoid overwhelming Redis
  const batchSize = 100
  for (let i = 0; i < productIds.length; i += batchSize) {
    const batch = productIds.slice(i, i + batchSize)

    const jobs = batch.map((productId) => ({
      name: 'GENERATE_EMBEDDING',
      data: { productId, trigger: 'BACKFILL' as const },
      opts: {
        jobId: `EMBED_${productId}`,
        delay: 1000 + Math.floor(i / batchSize) * 500, // Stagger batches
      },
    }))

    try {
      await queue.addBulk(jobs)
      enqueued += batch.length
    } catch (err: any) {
      // Some jobs may have failed due to dedup, count them
      log.warn('Batch enqueue partial failure', { batchStart: i, error: err.message })
      skipped += batch.length
    }
  }

  return { enqueued, skipped }
}

/**
 * Get queue stats
 */
export async function getEmbeddingQueueStats(): Promise<{
  waiting: number
  active: number
  completed: number
  failed: number
}> {
  const queue = getQueue()
  const [waiting, active, completed, failed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
  ])
  return { waiting, active, completed, failed }
}

/**
 * Close the queue connection (for graceful shutdown)
 */
export async function closeEmbeddingQueue(): Promise<void> {
  if (embeddingQueue) {
    await embeddingQueue.close()
    embeddingQueue = null
  }
}
