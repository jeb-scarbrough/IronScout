/**
 * Scrape URL Worker
 *
 * Per scraper-framework-01 spec v0.5 §10.2
 *
 * Processes SCRAPE_URL jobs from the queue.
 * Job flow:
 * 1. Acquire rate limit
 * 2. Check robots.txt (fail-closed)
 * 3. Fetch HTML
 * 4. Extract offer via adapter
 * 5. Validate and write to database
 * 6. Update tracking and metrics
 */

import { Worker, Job } from 'bullmq'
import { prisma } from '@ironscout/db'
import { loggers } from '../config/logger.js'
import { redisConnection } from '../config/redis.js'
import { QUEUE_NAMES, ScrapeUrlJobData, enqueueProductResolve } from '../config/queues.js'
import { RESOLVER_VERSION } from '../resolver/index.js'
import { getAdapterRegistry } from './registry.js'
import { registerAllAdapters } from './adapters/index.js'
import { HttpFetcher } from './fetch/http-fetcher.js'
import { RobotsPolicyImpl } from './fetch/robots.js'
import { RedisRateLimiter } from './fetch/rate-limiter.js'
import { validateOffer, createDropFromExtractFailure, shouldCountTowardDrift } from './process/validator.js'
import { writeScrapeOffer, updateTargetTracking, markTargetBroken, finalizeRun } from './process/writer.js'
import { shouldMarkUrlBroken, checkAutoDisable } from './process/drift-detector.js'
import { recordZeroPriceQuarantine } from './metrics.js'
import { checkAndAddIdentityKey, closeDedupeClient } from './process/run-dedupe.js'
import type { ScrapeRunMetrics, ScrapeAdapterContext } from './types.js'

const log = loggers.scraper

// Singleton instances
let fetcher: HttpFetcher | null = null
let rateLimiter: RedisRateLimiter | null = null
let robotsPolicy: RobotsPolicyImpl | null = null
let adaptersRegistered = false

/**
 * Initialize shared infrastructure.
 */
function initInfrastructure(): void {
  // Register all adapters (idempotent)
  if (!adaptersRegistered) {
    registerAllAdapters()
    adaptersRegistered = true
    log.info('Registered scrape adapters', { count: getAdapterRegistry().size() })
  }

  if (!robotsPolicy) {
    robotsPolicy = new RobotsPolicyImpl()
  }

  if (!rateLimiter) {
    rateLimiter = new RedisRateLimiter()
  }

  if (!fetcher) {
    fetcher = new HttpFetcher({ robotsPolicy })
  }
}

/**
 * Process a single scrape URL job.
 */
async function processScrapeJob(job: Job<ScrapeUrlJobData>): Promise<void> {
  const { targetId, url, sourceId, retailerId, adapterId, runId, trigger } = job.data

  const startTime = Date.now()
  const jobLogger = log.child({ jobId: job.id, targetId, url, runId })

  jobLogger.info('Processing scrape job', { trigger, adapterId })

  // Initialize infrastructure if needed
  initInfrastructure()

  // Get adapter
  const registry = getAdapterRegistry()
  const adapter = registry.get(adapterId)

  if (!adapter) {
    jobLogger.error('Adapter not found', { adapterId })
    throw new Error(`Adapter '${adapterId}' not found`)
  }

  // Get target info
  const target = await prisma.scrape_targets.findUnique({
    where: { id: targetId },
    select: {
      id: true,
      sourceProductId: true,
      consecutiveFailures: true,
      robotsPathBlocked: true,
    },
  })

  if (!target) {
    jobLogger.error('Scrape target not found', { targetId })
    throw new Error(`Target '${targetId}' not found`)
  }

  // Check URL-level robots block
  if (target.robotsPathBlocked) {
    jobLogger.info('URL blocked by admin override', { targetId })
    await updateTargetTracking(targetId, false)
    return
  }

  // Acquire rate limit
  jobLogger.debug('Acquiring rate limit', { domain: adapter.domain })
  await rateLimiter!.acquire(adapter.domain)

  // Fetch HTML
  jobLogger.debug('Fetching URL')
  const fetchResult = await fetcher!.fetch(url)

  if (fetchResult.status !== 'ok') {
    jobLogger.warn('Fetch failed', {
      status: fetchResult.status,
      statusCode: fetchResult.statusCode,
      error: fetchResult.error,
      durationMs: fetchResult.durationMs,
    })

    await updateTargetTracking(targetId, false)

    // Check if URL should be marked broken
    if (shouldMarkUrlBroken(target.consecutiveFailures + 1)) {
      jobLogger.warn('Marking URL as BROKEN after consecutive failures')
      await markTargetBroken(targetId)
    }

    // Handle persistent robot blocks - auto-update robotsCompliant
    // Per scraper-framework-01 spec: 3 consecutive blocks → robotsCompliant=false
    // Includes: 403/429/503 blocks, captcha detection, AND robots.txt disallow
    if (fetchResult.status === 'blocked' || fetchResult.status === 'robots_blocked' || fetchResult.statusCode === 429) {
      await handlePersistentBlock(sourceId, jobLogger)
    }

    // Track failure in run metrics
    await incrementRunMetric(runId, 'urlsFailed')

    return
  }

  // Extract offer
  jobLogger.debug('Extracting offer')
  const ctx: ScrapeAdapterContext = {
    sourceId,
    retailerId,
    runId,
    targetId,
    now: new Date(),
    logger: jobLogger,
  }

  const extractResult = adapter.extract(fetchResult.html!, url, ctx)

  if (!extractResult.ok) {
    jobLogger.info('Extraction failed', {
      reason: extractResult.reason,
      details: extractResult.details,
    })

    // Track as OOS_NO_PRICE if that's the reason (expected, not failure)
    if (extractResult.reason === 'OOS_NO_PRICE') {
      await incrementRunMetric(runId, 'oosNoPriceCount')
      await incrementRunMetric(runId, 'urlsSucceeded') // Technically succeeded
    } else {
      await incrementRunMetric(runId, 'urlsFailed')
    }

    await updateTargetTracking(targetId, extractResult.reason === 'OOS_NO_PRICE')
    return
  }

  await incrementRunMetric(runId, 'offersExtracted')

  // Normalize and validate
  const normalizeResult = adapter.normalize(extractResult.offer, ctx)

  if (normalizeResult.status === 'drop') {
    jobLogger.info('Offer dropped', { reason: normalizeResult.reason })
    await incrementRunMetric(runId, 'offersDropped')

    // Track as failure if it counts toward drift
    if (shouldCountTowardDrift(normalizeResult.reason)) {
      await updateTargetTracking(targetId, false)
    } else {
      await updateTargetTracking(targetId, true)
    }

    return
  }

  if (normalizeResult.status === 'quarantine') {
    jobLogger.warn('Offer quarantined', { reason: normalizeResult.reason })
    await incrementRunMetric(runId, 'offersQuarantined')
    await updateTargetTracking(targetId, false)

    if (normalizeResult.reason === 'ZERO_PRICE_EXTRACTED') {
      recordZeroPriceQuarantine({
        adapterId,
        sourceId,
        runId,
        targetId,
        url,
      })
    }

    // Write to quarantine table for admin review
    // Per scraper-framework-01 spec: quarantined offers must be persisted
    try {
      await prisma.quarantined_records.upsert({
        where: {
          feedId_matchKey: {
            feedId: sourceId,
            matchKey: normalizeResult.offer.identityKey,
          },
        },
        create: {
          feedType: 'AFFILIATE', // Scrapers use same model as affiliate feeds
          feedId: sourceId,
          runId,
          sourceId,
          retailerId,
          matchKey: normalizeResult.offer.identityKey,
          rawData: normalizeResult.offer as any,
          blockingErrors: [normalizeResult.reason] as any,
          status: 'QUARANTINED',
        },
        update: {
          runId,
          rawData: normalizeResult.offer as any,
          blockingErrors: [normalizeResult.reason] as any,
          updatedAt: new Date(),
        },
      })
      jobLogger.debug('Wrote quarantine record', {
        identityKey: normalizeResult.offer.identityKey,
        reason: normalizeResult.reason,
      })
    } catch (quarantineError) {
      jobLogger.error('Failed to write quarantine record', {
        error: (quarantineError as Error).message,
      })
    }
    return
  }

  // Per spec §5.1: Run-level deduplication using Redis
  // Check if identityKey already seen in this run (across all workers)
  const isDuplicate = await checkAndAddIdentityKey(runId, normalizeResult.offer.identityKey)
  if (isDuplicate) {
    jobLogger.info('Offer dropped - duplicate within run', {
      identityKey: normalizeResult.offer.identityKey,
    })
    await incrementRunMetric(runId, 'offersDropped')
    await updateTargetTracking(targetId, true) // Not a failure, just dedupe
    return
  }

  // Write to database
  jobLogger.debug('Writing offer to database')
  const writeResult = await writeScrapeOffer(
    normalizeResult.offer,
    { id: targetId, sourceProductId: target.sourceProductId },
    runId,
    jobLogger
  )

  if (!writeResult.success) {
    jobLogger.error('Failed to write offer', { error: writeResult.error })
    await incrementRunMetric(runId, 'urlsFailed')
    await updateTargetTracking(targetId, false)
    return
  }

  // Success!
  await incrementRunMetric(runId, 'urlsSucceeded')
  await incrementRunMetric(runId, 'offersValid')
  await updateTargetTracking(targetId, true)

  // Enqueue resolver to link source_product to canonical product
  // Per scraper-framework-01 spec §10.2: unified ingestion pattern
  if (writeResult.sourceProductId) {
    await enqueueProductResolve(
      writeResult.sourceProductId,
      'INGEST',
      RESOLVER_VERSION,
      {
        sourceId,
        identityKey: normalizeResult.offer.identityKey,
      }
    )
    jobLogger.debug('Enqueued resolver job', {
      sourceProductId: writeResult.sourceProductId,
    })
  }

  jobLogger.info('Scrape completed successfully', {
    sourceProductId: writeResult.sourceProductId,
    priceId: writeResult.priceId,
    durationMs: Date.now() - startTime,
  })
}

/**
 * Increment a metric counter on a scrape run.
 */
async function incrementRunMetric(
  runId: string,
  field:
    | 'urlsAttempted'
    | 'urlsSucceeded'
    | 'urlsFailed'
    | 'offersExtracted'
    | 'offersValid'
    | 'offersDropped'
    | 'offersQuarantined'
    | 'oosNoPriceCount'
): Promise<void> {
  try {
    await prisma.scrape_runs.update({
      where: { id: runId },
      data: { [field]: { increment: 1 } },
    })
  } catch (error) {
    log.error('Failed to increment run metric', { runId, field, error })
  }
}

/** Threshold for auto-disabling source due to persistent blocks */
const PERSISTENT_BLOCK_THRESHOLD = 3

/** In-memory tracking of recent blocks per source (cleared on worker restart) */
const sourceBlockCounts = new Map<string, { count: number; firstBlockAt: number }>()

/** Time window for counting blocks (5 minutes) */
const BLOCK_WINDOW_MS = 5 * 60 * 1000

/**
 * Handle persistent robot blocks for a source.
 *
 * Per scraper-framework-01 spec: If a source persistently returns 403/429 blocks,
 * automatically mark sources.robotsCompliant = false to prevent further scraping
 * until an admin reviews and re-enables.
 */
async function handlePersistentBlock(
  sourceId: string,
  jobLogger: typeof log
): Promise<void> {
  const now = Date.now()

  // Get or initialize block tracking for this source
  let tracking = sourceBlockCounts.get(sourceId)
  if (!tracking || now - tracking.firstBlockAt > BLOCK_WINDOW_MS) {
    // Start fresh window
    tracking = { count: 1, firstBlockAt: now }
  } else {
    tracking.count++
  }
  sourceBlockCounts.set(sourceId, tracking)

  jobLogger.debug('Robot block detected', {
    sourceId,
    blockCount: tracking.count,
    threshold: PERSISTENT_BLOCK_THRESHOLD,
  })

  // Check if threshold reached
  if (tracking.count >= PERSISTENT_BLOCK_THRESHOLD) {
    // Mark source as non-robots-compliant
    try {
      const source = await prisma.sources.findUnique({
        where: { id: sourceId },
        select: { name: true, robotsCompliant: true },
      })

      if (source && source.robotsCompliant) {
        await prisma.sources.update({
          where: { id: sourceId },
          data: { robotsCompliant: false },
        })

        jobLogger.warn('Auto-disabled source scraping due to persistent blocks', {
          sourceId,
          sourceName: source.name,
          blockCount: tracking.count,
          reason: 'persistent_robot_block',
        })

        // Clear tracking after disabling
        sourceBlockCounts.delete(sourceId)
      }
    } catch (error) {
      jobLogger.error('Failed to auto-disable source', {
        sourceId,
        error: (error as Error).message,
      })
    }
  }
}

// Worker instance
let worker: Worker<ScrapeUrlJobData> | null = null

/**
 * Start the scrape URL worker.
 */
export async function startScrapeWorker(options?: { concurrency?: number }): Promise<Worker<ScrapeUrlJobData>> {
  const concurrency = options?.concurrency ?? 1

  log.info('Starting scrape URL worker', { concurrency })

  worker = new Worker<ScrapeUrlJobData>(
    QUEUE_NAMES.SCRAPE_URL,
    async (job) => {
      await processScrapeJob(job)
    },
    {
      connection: redisConnection,
      concurrency,
    }
  )

  worker.on('completed', (job) => {
    log.debug('Job completed', { jobId: job.id, targetId: job.data.targetId })
  })

  worker.on('failed', (job, error) => {
    log.error('Job failed', {
      jobId: job?.id,
      targetId: job?.data?.targetId,
      error: error.message,
    })
  })

  worker.on('error', (error) => {
    log.error('Worker error', { error: error.message })
  })

  return worker
}

/**
 * Stop the scrape URL worker.
 */
export async function stopScrapeWorker(): Promise<void> {
  if (worker) {
    log.info('Stopping scrape URL worker')
    await worker.close()
    worker = null
  }

  if (rateLimiter) {
    await rateLimiter.close()
    rateLimiter = null
  }

  // Close dedupe Redis client
  await closeDedupeClient()

  robotsPolicy = null
  fetcher = null
}

/**
 * Get worker instance (for testing).
 */
export function getScrapeWorker(): Worker<ScrapeUrlJobData> | null {
  return worker
}
