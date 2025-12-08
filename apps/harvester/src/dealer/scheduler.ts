/**
 * Dealer Portal Job Scheduler
 * 
 * Schedules recurring dealer portal jobs:
 * - Feed ingestion (hourly by default, per-feed schedule)
 * - Benchmark calculation (every 2 hours)
 * - Insight generation (after benchmarks)
 */

import { prisma } from '@ironscout/db'
import {
  dealerFeedIngestQueue,
  dealerBenchmarkQueue,
} from '../config/queues'

// ============================================================================
// FEED SCHEDULING
// ============================================================================

/**
 * Schedule feed ingestion for all active dealer feeds
 */
export async function scheduleDealerFeeds(): Promise<number> {
  // Get all active feeds that are due for refresh
  const feeds = await prisma.dealerFeed.findMany({
    where: {
      dealer: {
        status: 'ACTIVE',
      },
      status: { not: 'FAILED' }, // Don't auto-retry failed feeds
    },
    include: {
      dealer: {
        select: { id: true, status: true },
      },
    },
  })
  
  let scheduledCount = 0
  const now = new Date()
  
  for (const feed of feeds) {
    // Check if feed is due for refresh
    const lastRun = feed.lastSuccessAt || feed.createdAt
    const minutesSinceRun = (now.getTime() - lastRun.getTime()) / (1000 * 60)
    
    if (minutesSinceRun < feed.scheduleMinutes) {
      continue // Not due yet
    }
    
    // Create feed run record
    const feedRun = await prisma.dealerFeedRun.create({
      data: {
        dealerId: feed.dealerId,
        feedId: feed.id,
        status: 'RUNNING',
      },
    })
    
    // Queue the job
    await dealerFeedIngestQueue.add(
      'ingest',
      {
        dealerId: feed.dealerId,
        feedId: feed.id,
        feedRunId: feedRun.id,
        feedType: feed.feedType,
        url: feed.url || undefined,
        username: feed.username || undefined,
        password: feed.password || undefined,
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 30000 },
        jobId: `feed-${feed.id}-${now.getTime()}`,
      }
    )
    
    scheduledCount++
  }
  
  if (scheduledCount > 0) {
    console.log(`[Dealer Scheduler] Scheduled ${scheduledCount} feed ingestion jobs`)
  }
  
  return scheduledCount
}

/**
 * Schedule a single feed for immediate ingestion
 */
export async function scheduleImmediateFeedIngest(feedId: string): Promise<string> {
  const feed = await prisma.dealerFeed.findUnique({
    where: { id: feedId },
    include: {
      dealer: {
        select: { id: true, status: true },
      },
    },
  })
  
  if (!feed) {
    throw new Error('Feed not found')
  }
  
  if (feed.dealer.status !== 'ACTIVE') {
    throw new Error('Dealer account is not active')
  }
  
  // Create feed run record
  const feedRun = await prisma.dealerFeedRun.create({
    data: {
      dealerId: feed.dealerId,
      feedId: feed.id,
      status: 'RUNNING',
    },
  })
  
  // Queue the job with high priority
  await dealerFeedIngestQueue.add(
    'ingest-immediate',
    {
      dealerId: feed.dealerId,
      feedId: feed.id,
      feedRunId: feedRun.id,
      feedType: feed.feedType,
      url: feed.url || undefined,
      username: feed.username || undefined,
      password: feed.password || undefined,
    },
    {
      attempts: 3,
      backoff: { type: 'exponential', delay: 10000 },
      priority: 1, // High priority
    }
  )
  
  return feedRun.id
}

// ============================================================================
// BENCHMARK SCHEDULING
// ============================================================================

/**
 * Schedule benchmark recalculation for all canonical SKUs
 */
export async function scheduleBenchmarkRecalc(fullRecalc: boolean = false): Promise<void> {
  await dealerBenchmarkQueue.add(
    'recalc',
    { fullRecalc },
    {
      attempts: 3,
      backoff: { type: 'exponential', delay: 30000 },
      jobId: `benchmark-${fullRecalc ? 'full' : 'incremental'}-${Date.now()}`,
    }
  )
  
  console.log(`[Dealer Scheduler] Scheduled ${fullRecalc ? 'full' : 'incremental'} benchmark recalculation`)
}

// ============================================================================
// SCHEDULED RUNNER
// ============================================================================

let feedSchedulerInterval: NodeJS.Timeout | null = null
let benchmarkSchedulerInterval: NodeJS.Timeout | null = null

/**
 * Start the dealer job scheduler
 */
export function startDealerScheduler(): void {
  console.log('[Dealer Scheduler] Starting...')
  
  // Schedule feed ingestion every 5 minutes (jobs will check individual feed schedules)
  feedSchedulerInterval = setInterval(async () => {
    try {
      await scheduleDealerFeeds()
    } catch (error) {
      console.error('[Dealer Scheduler] Feed scheduling error:', error)
    }
  }, 5 * 60 * 1000) // 5 minutes
  
  // Schedule benchmark recalculation every 2 hours
  benchmarkSchedulerInterval = setInterval(async () => {
    try {
      await scheduleBenchmarkRecalc(false)
    } catch (error) {
      console.error('[Dealer Scheduler] Benchmark scheduling error:', error)
    }
  }, 2 * 60 * 60 * 1000) // 2 hours
  
  // Run initial scheduling
  setTimeout(async () => {
    try {
      await scheduleDealerFeeds()
      await scheduleBenchmarkRecalc(false)
    } catch (error) {
      console.error('[Dealer Scheduler] Initial scheduling error:', error)
    }
  }, 10000) // 10 seconds after startup
  
  console.log('[Dealer Scheduler] Started')
}

/**
 * Stop the dealer job scheduler
 */
export function stopDealerScheduler(): void {
  if (feedSchedulerInterval) {
    clearInterval(feedSchedulerInterval)
    feedSchedulerInterval = null
  }
  
  if (benchmarkSchedulerInterval) {
    clearInterval(benchmarkSchedulerInterval)
    benchmarkSchedulerInterval = null
  }
  
  console.log('[Dealer Scheduler] Stopped')
}
