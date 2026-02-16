#!/usr/bin/env node

/**
 * Harvester Worker
 * Starts all pipeline workers to process ingestion jobs
 */

// Load environment variables first, before any other imports
import './env'

import {
  prisma,
  isHarvesterSchedulerEnabled,
  isAffiliateSchedulerEnabled,
  getHarvesterLogLevel,
  getHarvesterLogLevelOptional,
} from '@ironscout/db'
import { setLogLevel, type LogLevel, flushLogs } from '@ironscout/logger'
import { warmupRedis, closeSharedBullMQConnection } from './config/redis'
import { initQueueSettings } from './config/queues'
import { logger } from './config/logger'
import { refreshTraceSettings } from './config/trace'
import { alerterWorker, delayedNotificationWorker } from './alerter'

// Retailer Portal Workers
import { retailerFeedIngestWorker } from './merchant/feed-ingest'
// Note: sku-match, benchmark, insight workers removed for v1 (benchmark subsystem removed)
import { startRetailerScheduler, stopRetailerScheduler } from './merchant/scheduler'

// Affiliate Feed Workers
import { createAffiliateFeedWorker, createAffiliateFeedScheduler } from './affiliate'

// Product Resolver Worker (Spec v1.2)
import {
  startProductResolverWorker,
  stopProductResolverWorker,
  startProcessingSweeper,
  stopProcessingSweeper,
} from './resolver'

// Embedding Generation Worker
import {
  startEmbeddingWorker,
  stopEmbeddingWorker,
} from './embedding/worker'

// Quarantine Reprocess Worker
import {
  startQuarantineReprocessWorker,
  stopQuarantineReprocessWorker,
} from './quarantine/worker'

// Current Price Recompute Worker (ADR-015)
import {
  startCurrentPriceRecomputeWorker,
  stopCurrentPriceRecomputeWorker,
  startCurrentPriceScheduler,
  stopCurrentPriceScheduler,
} from './currentprice'

// Caliber Market Snapshot Worker (ADR-025)
import {
  startCaliberSnapshotWorker,
  stopCaliberSnapshotWorker,
  startCaliberSnapshotScheduler,
  stopCaliberSnapshotScheduler,
} from './calibersnapshot'

// Scrape URL Worker (scraper-framework-01 spec v0.5)
import {
  startScrapeWorker,
  stopScrapeWorker,
} from './scraper/worker'
import {
  startScrapeScheduler,
  stopScrapeScheduler,
} from './scraper/scheduler'
import { registerAllAdapters } from './scraper/adapters/index'
import { getAdapterRegistry } from './scraper/registry'

import type { Worker } from 'bullmq'

// Create affiliate workers (lazy initialization)
let affiliateFeedWorker: ReturnType<typeof createAffiliateFeedWorker> | null = null
let affiliateFeedScheduler: ReturnType<typeof createAffiliateFeedScheduler> | null = null

// Product resolver worker (lazy initialization)
let resolverWorker: Worker | null = null

// Embedding generation worker (lazy initialization)
let embeddingWorker: Worker | null = null

// Quarantine reprocess worker (lazy initialization)
let quarantineReprocessWorker: Worker | null = null

// Current price recompute worker (ADR-015, lazy initialization)
let currentPriceRecomputeWorker: Worker | null = null

// Scrape URL worker (scraper-framework-01, lazy initialization)
let scrapeWorker: Worker | null = null

// Caliber snapshot worker (ADR-025, lazy initialization)
let caliberSnapshotWorkerInstance: Worker | null = null

/**
 * Scheduler enabled flags (set during startup from database)
 *
 * IMPORTANT (ADR-001): Only ONE harvester instance should run schedulers.
 * Enable/disable via Admin Settings (Danger Zone) - database is single source of truth.
 * Emergency Stop in admin UI will disable scheduler and clear all queues.
 *
 * Running multiple schedulers causes duplicate ingestion and data corruption.
 */
let harvesterSchedulerEnabled = false
let affiliateSchedulerEnabled = false

const log = logger.worker
const dbLog = logger.database

// Settings polling interval handle (log level + trace settings)
let settingsPollInterval: NodeJS.Timeout | null = null
const SETTINGS_POLL_MS = 30_000 // Check every 30 seconds

/**
 * Resolve desired log level.
 * Precedence:
 *   1) LOG_LEVEL env (always wins)
 *   2) HARVESTER_LOG_LEVEL env / DB (if explicitly set)
 *   3) null (leave current logger level unchanged)
 */
async function resolveDesiredLogLevel(): Promise<{ level: LogLevel | null; source: string | null }> {
  const envLevel = process.env.LOG_LEVEL?.toLowerCase() as LogLevel | undefined
  if (envLevel) {
    return { level: envLevel, source: 'LOG_LEVEL env' }
  }

  const dbLevel = (await getHarvesterLogLevelOptional()) as LogLevel | null
  if (dbLevel) {
    return { level: dbLevel, source: 'HARVESTER_LOG_LEVEL setting' }
  }

  return { level: null, source: null }
}

/**
 * Poll for settings changes from admin DB.
 * Updates log level and trace config dynamically without restart.
 */
async function pollSettings(): Promise<void> {
  try {
    const { level, source } = await resolveDesiredLogLevel()
    if (level) {
      setLogLevel(level)
      log.info('Log level applied', { level, source })
    } else {
      log.info('Log level unchanged (no explicit setting found)')
    }
  } catch {
    // Silently ignore errors - we'll retry next poll
  }

  // Refresh trace debug settings (sample rate, firstN, raw excerpts)
  await refreshTraceSettings()
}

/**
 * Start settings polling (log level + trace config)
 */
async function startSettingsPolling(): Promise<void> {
  // Set initial values (await so we confirm once at startup)
  await pollSettings()

  // Poll periodically for changes
  settingsPollInterval = setInterval(pollSettings, SETTINGS_POLL_MS)
  log.info('Settings polling started', { intervalMs: SETTINGS_POLL_MS })
}

/**
 * Stop settings polling
 */
function stopSettingsPolling(): void {
  if (settingsPollInterval) {
    clearInterval(settingsPollInterval)
    settingsPollInterval = null
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
    'alerter',
    'resolver',
    'embedding',
    'quarantine-reprocess',
    'current-price-recompute',
    'scrape-url',
    'caliber-snapshot',
  ],
  retailerWorkers: [
    'feed-ingest',
  ],
  affiliateWorkers: [
    'affiliate-feed',
    'affiliate-feed-scheduler',
  ],
})

// Warm up Redis and database connections before starting workers
async function startup() {
  // Log brand/URL configuration prominently for debugging
  const wwwUrl = process.env.NEXT_PUBLIC_WWW_URL || '(not set - using production default)'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || '(not set - using production default)'
  console.log('\n' + '='.repeat(60))
  console.log('  HARVESTER - BRAND CONFIG')
  console.log('='.repeat(60))
  console.log(`  APP_URL: ${appUrl}`)
  console.log(`  WWW_URL: ${wwwUrl}`)
  console.log('='.repeat(60) + '\n')

  // Redis must be available for BullMQ workers to function
  const redisConnected = await warmupRedis()
  if (!redisConnected) {
    log.error('Redis not available - cannot start workers')
    await flushLogs()
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
  await startSettingsPolling()

  // Always start affiliate feed worker to process jobs (including manual ones)
  // The worker must run regardless of scheduler state to process manually-triggered jobs
  log.info('Starting affiliate feed worker')
  affiliateFeedWorker = createAffiliateFeedWorker()

  // Start product resolver worker (always on - processes RESOLVE jobs from ingestion pipelines)
  log.info('Starting product resolver worker')
  resolverWorker = await startProductResolverWorker({ concurrency: 5 })

  // Start embedding generation worker (always on - processes embedding jobs from resolver)
  // Lower concurrency due to OpenAI API rate limits
  log.info('Starting embedding generation worker')
  embeddingWorker = await startEmbeddingWorker({ concurrency: 3 })

  // Start quarantine reprocess worker (always on - processes admin-triggered reprocessing)
  log.info('Starting quarantine reprocess worker')
  quarantineReprocessWorker = await startQuarantineReprocessWorker({ concurrency: 10 })

  // Start current price recompute worker (ADR-015 - always on)
  log.info('Starting current price recompute worker')
  currentPriceRecomputeWorker = await startCurrentPriceRecomputeWorker({ concurrency: 5 })

  // Register scrape adapters before starting worker/scheduler
  // This ensures the registry is populated for all components
  registerAllAdapters()
  log.info('Registered scrape adapters', { count: getAdapterRegistry().size() })

  // Start scrape URL worker (scraper-framework-01 - always on)
  // Worker processes jobs regardless of scheduler state (supports manual triggers)
  log.info('Starting scrape URL worker')
  scrapeWorker = await startScrapeWorker({ concurrency: 3 })

  // Start caliber snapshot worker (ADR-025 - always on, concurrency: 1)
  // Worker processes jobs regardless of scheduler state (supports manual triggers)
  log.info('Starting caliber snapshot worker')
  caliberSnapshotWorkerInstance = await startCaliberSnapshotWorker({ concurrency: 1 })

  // Start stuck PROCESSING sweeper (recovers jobs that crash mid-processing)
  log.info('Starting product resolver sweeper')
  startProcessingSweeper()

  // Start harvester/retailer scheduler if enabled
  if (harvesterSchedulerEnabled) {
    log.info('Starting retailer scheduler')
    await startRetailerScheduler()

    // Start current price recompute scheduler (ADR-015)
    // Per ADR-001: Only one scheduler instance should run
    log.info('Starting current price recompute scheduler')
    startCurrentPriceScheduler()

    // Start scrape URL scheduler (scraper-framework-01)
    // Per ADR-001: Only one scheduler instance should run
    log.info('Starting scrape URL scheduler')
    startScrapeScheduler()

    // Start caliber snapshot scheduler (ADR-025)
    // Per ADR-001: Only one scheduler instance should run
    log.info('Starting caliber snapshot scheduler')
    startCaliberSnapshotScheduler()
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
    stopSettingsPolling()

    // 1. Stop scheduling new jobs (if scheduler was enabled)
    if (harvesterSchedulerEnabled) {
      log.info('Stopping retailer scheduler')
      stopRetailerScheduler()

      log.info('Stopping current price recompute scheduler')
      stopCurrentPriceScheduler()

      log.info('Stopping scrape URL scheduler')
      stopScrapeScheduler()

      log.info('Stopping caliber snapshot scheduler')
      await stopCaliberSnapshotScheduler()
    }

    // 2. Close workers (waits for current jobs to complete)
    log.info('Waiting for workers to finish current jobs')
    await Promise.all([
      alerterWorker.close(),
      delayedNotificationWorker.close(),
      // Retailer Portal workers
      retailerFeedIngestWorker.close(),
      // Affiliate workers (if started)
      affiliateFeedWorker?.close(),
      affiliateFeedScheduler?.close(),
      // Product resolver: stop sweeper first, then worker
      (async () => {
        stopProcessingSweeper()
        await stopProductResolverWorker()
      })(),
      // Embedding generation worker
      stopEmbeddingWorker(),
      // Quarantine reprocess worker
      stopQuarantineReprocessWorker(),
      // Current price recompute worker (ADR-015)
      stopCurrentPriceRecomputeWorker(),
      // Scrape URL worker (scraper-framework-01)
      stopScrapeWorker(),
      // Caliber snapshot worker (ADR-025)
      stopCaliberSnapshotWorker(),
    ])
    log.info('All workers closed')

    // 3. Close shared Redis connection (after all workers)
    log.info('Closing shared Redis connection')
    await closeSharedBullMQConnection()

    // 4. Disconnect from database
    log.info('Disconnecting from database')
    await prisma.$disconnect()

    const durationMs = Date.now() - shutdownStart
    log.info('Graceful shutdown complete', { durationMs })
    await flushLogs()
    process.exit(0)
  } catch (error) {
    const err = error as Error
    log.error('Error during shutdown', { error: err.message })
    await flushLogs()
    process.exit(1)
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

log.info('Workers are running')
