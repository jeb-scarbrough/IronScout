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

import { prisma } from '@ironscout/db'
import { schedulerWorker } from './scheduler'
import { fetcherWorker } from './fetcher'
import { extractorWorker } from './extractor'
import { normalizerWorker } from './normalizer'
import { writerWorker } from './writer'
import { alerterWorker } from './alerter'

// Dealer Portal Workers
import { dealerFeedIngestWorker } from './dealer/feed-ingest'
import { dealerSkuMatchWorker } from './dealer/sku-match'
import { dealerBenchmarkWorker } from './dealer/benchmark'
import { dealerInsightWorker } from './dealer/insight'
import { startDealerScheduler, stopDealerScheduler } from './dealer/scheduler'

/**
 * Warm up database connection with retries
 */
async function warmupDatabase(maxAttempts = 5): Promise<boolean> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`[Database] Connection attempt ${attempt}/${maxAttempts}...`)
      await prisma.$queryRaw`SELECT 1`
      console.log('[Database] Connection established successfully')
      return true
    } catch (error) {
      const err = error as Error
      console.error(`[Database] Connection failed: ${err.message}`)

      if (attempt < maxAttempts) {
        const delayMs = Math.min(2000 * Math.pow(2, attempt - 1), 30000)
        console.log(`[Database] Retrying in ${delayMs / 1000}s...`)
        await new Promise(resolve => setTimeout(resolve, delayMs))
      }
    }
  }

  console.error('[Database] Failed to establish connection after all attempts')
  return false
}

console.log('Starting IronScout.ai Harvester Workers...')
console.log('---')
console.log('Active Workers:')
console.log('  - Scheduler (crawl jobs)')
console.log('  - Fetcher (HTTP requests)')
console.log('  - Extractor (content parsing)')
console.log('  - Normalizer (data standardization)')
console.log('  - Writer (database upserts)')
console.log('  - Alerter (notification triggers)')
console.log('')
console.log('Dealer Portal Workers:')
console.log('  - DealerFeedIngest (feed downloads & parsing)')
console.log('  - DealerSkuMatch (SKU → canonical matching)')
console.log('  - DealerBenchmark (price benchmarks)')
console.log('  - DealerInsight (insight generation)')
console.log('---')

// Warm up database connection before starting scheduler
warmupDatabase().then((connected) => {
  if (connected) {
    // Start dealer scheduler only after database is ready
    startDealerScheduler()
  } else {
    console.error('[Worker] Starting scheduler anyway, but expect database errors...')
    startDealerScheduler()
  }
})

// Track if shutdown is in progress to prevent double-shutdown
let isShuttingDown = false

// Graceful shutdown
const shutdown = async (signal: string) => {
  if (isShuttingDown) {
    console.log('[Shutdown] Already in progress, please wait...')
    return
  }
  isShuttingDown = true

  console.log(`\n[Shutdown] Received ${signal}, starting graceful shutdown...`)
  const shutdownStart = Date.now()

  try {
    // 1. Stop scheduling new jobs
    console.log('[Shutdown] Stopping scheduler...')
    stopDealerScheduler()

    // 2. Close workers (waits for current jobs to complete)
    console.log('[Shutdown] Waiting for workers to finish current jobs...')
    await Promise.all([
      schedulerWorker.close(),
      fetcherWorker.close(),
      extractorWorker.close(),
      normalizerWorker.close(),
      writerWorker.close(),
      alerterWorker.close(),
      // Dealer workers
      dealerFeedIngestWorker.close(),
      dealerSkuMatchWorker.close(),
      dealerBenchmarkWorker.close(),
      dealerInsightWorker.close(),
    ])
    console.log('[Shutdown] All workers closed')

    // 3. Disconnect from database
    console.log('[Shutdown] Disconnecting from database...')
    await prisma.$disconnect()
    console.log('[Shutdown] Database disconnected')

    const duration = ((Date.now() - shutdownStart) / 1000).toFixed(1)
    console.log(`[Shutdown] Graceful shutdown complete in ${duration}s`)
    process.exit(0)
  } catch (error) {
    console.error('[Shutdown] Error during shutdown:', error)
    process.exit(1)
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

// Keep the process running
console.log('\nWorkers are running. Press Ctrl+C to stop.\n')
