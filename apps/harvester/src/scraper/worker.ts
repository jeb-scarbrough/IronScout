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
import { QUEUE_NAMES, ScrapeUrlJobData } from '../config/queues.js'
import { getAdapterRegistry } from './registry.js'
import { HttpFetcher } from './fetch/http-fetcher.js'
import { RobotsPolicyImpl } from './fetch/robots.js'
import { RedisRateLimiter } from './fetch/rate-limiter.js'
import { validateOffer, createDropFromExtractFailure, shouldCountTowardDrift } from './process/validator.js'
import { writeScrapeOffer, updateTargetTracking, markTargetBroken, finalizeRun } from './process/writer.js'
import { shouldMarkUrlBroken, checkAutoDisable } from './process/drift-detector.js'
import type { ScrapeRunMetrics, ScrapeAdapterContext } from './types.js'

const log = loggers.scraper

// Singleton instances
let fetcher: HttpFetcher | null = null
let rateLimiter: RedisRateLimiter | null = null
let robotsPolicy: RobotsPolicyImpl | null = null

/**
 * Initialize shared infrastructure.
 */
function initInfrastructure(): void {
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
      error: fetchResult.error,
      durationMs: fetchResult.durationMs,
    })

    await updateTargetTracking(targetId, false)

    // Check if URL should be marked broken
    if (shouldMarkUrlBroken(target.consecutiveFailures + 1)) {
      jobLogger.warn('Marking URL as BROKEN after consecutive failures')
      await markTargetBroken(targetId)
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

    // TODO: Write to quarantine table
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

  robotsPolicy = null
  fetcher = null
}

/**
 * Get worker instance (for testing).
 */
export function getScrapeWorker(): Worker<ScrapeUrlJobData> | null {
  return worker
}
