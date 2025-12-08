#!/usr/bin/env node

/**
 * Harvester Worker
 * Starts all pipeline workers to process crawl jobs
 */

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

// Start dealer scheduler
startDealerScheduler()

// Graceful shutdown
const shutdown = async () => {
  console.log('\nShutting down workers...')

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
  
  // Stop dealer scheduler
  stopDealerScheduler()

  console.log('All workers shut down successfully')
  process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

// Keep the process running
console.log('\nWorkers are running. Press Ctrl+C to stop.\n')
