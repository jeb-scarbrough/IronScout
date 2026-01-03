#!/usr/bin/env node

/**
 * Harvester Worker
 * Starts all pipeline workers to process crawl jobs
 *
 * TODO: Improve database resilience for maintenance windows
 * - Add infinite retry with longer backoff for scheduler during extended outages
 * - Consider health check endpoint that reports DB connectivity status
 * - Evaluate graceful degradation (queue jobs locally, replay when DB returns)
 * See: https://github.com/your-org/ironscout/issues/XXX (create ticket when ready)
 */

// Load environment variables first, before any other imports
import 'dotenv/config'

import { prisma, isHarvesterSchedulerEnabled, isAffiliateSchedulerEnabled, getHarvesterLogLevel } from '@ironscout/db'
import { setLogLevel, type LogLevel } from '@ironscout/logger'
import { warmupRedis } from './config/redis'
import { initQueueSettings } from './config/queues'
import { logger } from './config/logger'
import { schedulerWorker } from './scheduler'
import { fetcherWorker } from './fetcher'
import { extractorWorker } from './extractor'
import { normalizerWorker } from './normalizer'
import { writerWorker } from './writer'
import { alerterWorker, delayedNotificationWorker } from './alerter'

// Merchant Portal Workers
import { merchantFeedIngestWorker } from './merchant/feed-ingest'
import { merchantSkuMatchWorker } from './merchant/sku-match'
import { merchantBenchmarkWorker } from './merchant/benchmark'
import { merchantInsightWorker } from './merchant/insight'
import { startMerchantScheduler, stopMerchantScheduler } from './merchant/scheduler'

// Affiliate Feed Workers
import { createAffiliateFeedWorker, createAffiliateFeedScheduler } from './affiliate'

// Create affiliate workers (lazy initialization)
let affiliateFeedWorker: ReturnType<typeof createAffiliateFeedWorker> | null = null
let affiliateFeedScheduler: ReturnType<typeof createAffiliateFeedScheduler> | null = null

/**
 * Scheduler enabled flags (set during startup from database/env)
 *
 * IMPORTANT (ADR-001): Only ONE harvester instance should run schedulers.
 * Enable via admin settings or HARVESTER_SCHEDULER_ENABLED env var on exactly one instance.
 * All other instances should leave disabled or omit the variable.
 *
 * Running multiple schedulers causes duplicate ingestion and data corruption.
 */
let harvesterSchedulerEnabled = false
let affiliateSchedulerEnabled = false

// Log level polling interval handle
let logLevelPollInterval: NodeJS.Timeout | null = null
const LOG_LEVEL_POLL_MS = 30_000 // Check every 30 seconds

const log = logger.worker
const dbLog = logger.database

/**
 * Poll for log level changes from admin settings
 * Updates the logger dynamically without restart
 */
async function pollLogLevel(): Promise<void> {
  try {
    const level = await getHarvesterLogLevel() as LogLevel
    setLogLevel(level)
    log.debug('Log level refreshed', { level })
  } catch (error) {
    // Silently ignore errors - we'll retry next poll
    // Don't log errors here to avoid spam if DB is temporarily unavailable
  }
}

/**
 * Start log level polling
 */
function startLogLevelPolling(): void {
  // Set initial level
  pollLogLevel()

  // Poll periodically for changes
  logLevelPollInterval = setInterval(pollLogLevel, LOG_LEVEL_POLL_MS)
  log.info('Log level polling started', { intervalMs: LOG_LEVEL_POLL_MS })
}

/**
 * Stop log level polling
 */
function stopLogLevelPolling(): void {
  if (logLevelPollInterval) {
    clearInterval(logLevelPollInterval)
    logLevelPollInterval = null
  }
}

/**
 * Warm up database connection with retries
 */
async function warmupDatabase(maxAttempts = 5): Promise<boolean> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      dbLog.info('Connection attempt', { attempt, maxAttempts })
      await prisma.$queryRaw`SELECT 1`
      dbLog.info('Connection established successfully')
      return true
    } catch (error) {
      const err = error as Error
      dbLog.error('Connection failed', { error: err.message })

      if (attempt < maxAttempts) {
        const delayMs = Math.min(2000 * Math.pow(2, attempt - 1), 30000)
        dbLog.info('Retrying', { delayMs })
        await new Promise(resolve => setTimeout(resolve, delayMs))
      }
    }
  }

  dbLog.error('Failed to establish connection after all attempts', { maxAttempts })
  return false
}

log.info('Starting IronScout.ai Harvester Workers', {
  workers: [
    'scheduler',
    'fetcher',
    'extractor',
    'normalizer',
    'writer',
    'alerter',
  ],
  merchantWorkers: [
    'feed-ingest',
    'sku-match',
    'benchmark',
    'insight',
  ],
  affiliateWorkers: [
    'affiliate-feed',
    'affiliate-feed-scheduler',
  ],
})

// Warm up Redis and database connections before starting workers
async function startup() {
  // Redis must be available for BullMQ workers to function
  const redisConnected = await warmupRedis()
  if (!redisConnected) {
    log.error('Redis not available - cannot start workers')
    process.exit(1)
  }

  // Database is required to check scheduler settings
  const dbConnected = await warmupDatabase()
  if (!dbConnected) {
    log.error('Database not ready - scheduler settings cannot be checked')
    log.info('This instance will only process jobs, not create them')
    return
  }

  // Initialize queue history settings from database
  await initQueueSettings()

  // Check scheduler settings from database (with env var fallback)
  harvesterSchedulerEnabled = await isHarvesterSchedulerEnabled()
  affiliateSchedulerEnabled = await isAffiliateSchedulerEnabled()

  log.info('Scheduler settings loaded', {
    harvesterSchedulerEnabled,
    affiliateSchedulerEnabled,
  })

  // Start log level polling for dynamic updates
  startLogLevelPolling()

  // Always start affiliate feed worker to process jobs (including manual ones)
  // The worker must run regardless of scheduler state to process manually-triggered jobs
  log.info('Starting affiliate feed worker')
  affiliateFeedWorker = createAffiliateFeedWorker()

  // Start harvester/merchant scheduler if enabled
  if (harvesterSchedulerEnabled) {
    log.info('Starting merchant scheduler')
    await startMerchantScheduler()
  }

  // Start affiliate feed scheduler only if enabled
  // The scheduler creates repeatable jobs that enqueue work
  if (affiliateSchedulerEnabled) {
    log.info('Starting affiliate feed scheduler')
    affiliateFeedScheduler = createAffiliateFeedScheduler()
  } else {
    log.info('Affiliate feed scheduler disabled - worker will only process manually-triggered jobs')
  }
}

startup()

// Track if shutdown is in progress to prevent double-shutdown
let isShuttingDown = false

// Graceful shutdown
const shutdown = async (signal: string) => {
  if (isShuttingDown) {
    log.warn('Shutdown already in progress')
    return
  }
  isShuttingDown = true

  const shutdownStart = Date.now()
  log.info('Starting graceful shutdown', { signal })

  try {
    // 0. Stop log level polling
    stopLogLevelPolling()

    // 1. Stop scheduling new jobs (if scheduler was enabled)
    if (harvesterSchedulerEnabled) {
      log.info('Stopping merchant scheduler')
      stopMerchantScheduler()
    }

    // 2. Close workers (waits for current jobs to complete)
    log.info('Waiting for workers to finish current jobs')
    await Promise.all([
      schedulerWorker.close(),
      fetcherWorker.close(),
      extractorWorker.close(),
      normalizerWorker.close(),
      writerWorker.close(),
      alerterWorker.close(),
      delayedNotificationWorker.close(),
      // Merchant workers
      merchantFeedIngestWorker.close(),
      merchantSkuMatchWorker.close(),
      merchantBenchmarkWorker.close(),
      merchantInsightWorker.close(),
      // Affiliate workers (if started)
      affiliateFeedWorker?.close(),
      affiliateFeedScheduler?.close(),
    ])
    log.info('All workers closed')

    // 3. Disconnect from database
    log.info('Disconnecting from database')
    await prisma.$disconnect()

    const durationMs = Date.now() - shutdownStart
    log.info('Graceful shutdown complete', { durationMs })
    process.exit(0)
  } catch (error) {
    const err = error as Error
    log.error('Error during shutdown', { error: err.message })
    process.exit(1)
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

log.info('Workers are running')
