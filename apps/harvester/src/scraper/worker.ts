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
import { QUEUE_NAMES, ScrapeUrlJobData, enqueueProductResolve, decrementAdapterPending } from '../config/queues.js'
import { RESOLVER_VERSION } from '../resolver/index.js'
import { getAdapterRegistry } from './registry.js'
import { HttpFetcher } from './fetch/http-fetcher.js'
import { RobotsPolicyImpl } from './fetch/robots.js'
import { RedisRateLimiter } from './fetch/rate-limiter.js'
import { validateOffer, createDropFromExtractFailure, shouldCountTowardDrift } from './process/validator.js'
import { writeScrapeOffer, updateTargetTracking, markTargetBroken, finalizeRun } from './process/writer.js'
import { shouldMarkUrlBroken, checkAutoDisable } from './process/drift-detector.js'
import { recordZeroPriceQuarantine } from './metrics.js'
import { checkAndAddIdentityKey, closeDedupeClient } from './process/run-dedupe.js'
import type { ScrapeRunMetrics, ScrapeAdapterContext, RateLimitConfig } from './types.js'
import { parseScrapeConfig, DEFAULT_RATE_LIMIT } from './types.js'

const log = loggers.scraper

// Singleton instances
let fetcher: HttpFetcher | null = null
let rateLimiter: RedisRateLimiter | null = null
let robotsPolicy: RobotsPolicyImpl | null = null

/**
 * Initialize shared infrastructure.
 * Note: Adapters are registered once at harvester startup (in main worker.ts)
 * before the scrape worker starts.
 */
function initInfrastructure(): void {
  if (!robotsPolicy) {
    robotsPolicy = new RobotsPolicyImpl()
  }

  if (!rateLimiter) {
    // Per spec §6.2: Pass robotsPolicy to enforce crawl-delay from robots.txt
    rateLimiter = new RedisRateLimiter({ robotsPolicy: robotsPolicy! })
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
    // Target was deleted after job was queued - gracefully skip
    jobLogger.info('Scrape target no longer exists, skipping', { targetId })
    return
  }

  // Check URL-level robots block
  // Per spec: admin-blocked URLs should be skipped without counting as failure
  if (target.robotsPathBlocked) {
    jobLogger.info('URL blocked by admin override, skipping without failure', { targetId })
    // Don't call updateTargetTracking - this is intentional, not a failure
    return
  }

  // Per spec §10.2: Re-check source gate before processing
  // Source may have been disabled after job was queued
  const source = await prisma.sources.findUnique({
    where: { id: sourceId },
    select: {
      scrapeEnabled: true,
      robotsCompliant: true,
      scrapeConfig: true, // Per spec §9.5: Per-source scrape config
    },
  })

  if (!source) {
    jobLogger.error('Source not found', { sourceId })
    throw new Error(`Source '${sourceId}' not found`)
  }

  if (!source.scrapeEnabled) {
    jobLogger.info('Source scraping disabled since job queued, skipping', { sourceId })
    return
  }

  if (!source.robotsCompliant) {
    jobLogger.info('Source marked robots non-compliant since job queued, skipping', { sourceId })
    return
  }

  // Per spec §9.5: Parse and apply per-source scrape config
  const scrapeConfig = parseScrapeConfig(source.scrapeConfig)

  // Apply per-source rate limit if configured
  if (scrapeConfig?.rateLimit) {
    const customRateLimit: RateLimitConfig = {
      requestsPerSecond: scrapeConfig.rateLimit.requestsPerSecond ?? DEFAULT_RATE_LIMIT.requestsPerSecond,
      minDelayMs: scrapeConfig.rateLimit.minDelayMs ?? DEFAULT_RATE_LIMIT.minDelayMs,
      maxConcurrent: scrapeConfig.rateLimit.maxConcurrent ?? DEFAULT_RATE_LIMIT.maxConcurrent,
    }
    rateLimiter!.setConfig(adapter.domain, customRateLimit)
    jobLogger.debug('Applied per-source rate limit', {
      domain: adapter.domain,
      requestsPerSecond: customRateLimit.requestsPerSecond,
    })
  }

  // Acquire rate limit
  jobLogger.debug('Acquiring rate limit', { domain: adapter.domain })
  await rateLimiter!.acquire(adapter.domain)

  // Fetch HTML with optional custom headers
  jobLogger.debug('Fetching URL')
  const fetchOptions = scrapeConfig?.customHeaders
    ? { headers: scrapeConfig.customHeaders }
    : undefined
  const fetchResult = await fetcher!.fetch(url, fetchOptions)

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

    // Track as OOS_NO_PRICE if that's the reason (neutral - neither success nor failure)
    // Per spec: OOS_NO_PRICE doesn't affect failureRate or yieldRate
    if (extractResult.reason === 'OOS_NO_PRICE') {
      await incrementRunMetric(runId, 'oosNoPriceCount')
      // No urlsSucceeded++ or urlsFailed++ - it's a neutral outcome
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
    // Per spec §7: Drift-counting drops also affect adapter-level failureRate
    if (shouldCountTowardDrift(normalizeResult.reason)) {
      await incrementRunMetric(runId, 'urlsFailed') // Affects adapter failureRate
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
      // Per spec §7.2: Track zero-price count for auto-disable check
      await incrementRunMetric(runId, 'zeroPriceCount')
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
    | 'zeroPriceCount'
): Promise<void> {
  try {
    await prisma.scrape_runs.update({
      where: { id: runId },
      data: { [field]: { increment: 1 } },
    })
  } catch (error) {
    // Warn instead of error - run may have been aborted by emergency stop
    // or finalized before job completed. This is expected in some cases.
    log.warn('Failed to increment run metric (run may be aborted)', { runId, field })
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
      try {
        await processScrapeJob(job)
      } catch (err) {
        // Ensure we always throw a proper Error with a message
        // This helps diagnose issues where non-Error values are thrown
        if (err instanceof Error) {
          throw err
        }
        // Wrap non-Error values
        const message = err === undefined
          ? 'Job failed with undefined error'
          : err === null
            ? 'Job failed with null error'
            : typeof err === 'string'
              ? err
              : `Job failed with non-Error: ${JSON.stringify(err)}`
        throw new Error(message)
      }
    },
    {
      connection: redisConnection,
      concurrency,
    }
  )

  worker.on('completed', (job) => {
    log.debug('Job completed', { jobId: job.id, targetId: job.data.targetId })
    // Decrement per-adapter pending count
    decrementAdapterPending(job.data.adapterId).catch((err) => {
      log.warn('Failed to decrement adapter pending', { error: err.message })
    })
  })

  worker.on('failed', (job, error) => {
    log.error('Job failed', {
      jobId: job?.id,
      targetId: job?.data?.targetId,
    }, error)
    // Decrement per-adapter pending count even on failure
    if (job?.data?.adapterId) {
      decrementAdapterPending(job.data.adapterId).catch((err) => {
        log.warn('Failed to decrement adapter pending', { error: err.message })
      })
    }
  })

  worker.on('error', (error) => {
    log.error('Worker error', {}, error)
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
