/**
 * Scrape Scheduler
 *
 * Per scraper-framework-01 spec v0.5 §10.2
 *
 * Queries due targets and enqueues SCRAPE_URL jobs.
 * Combined gate: sources.scrape_enabled AND sources.robots_compliant
 *
 * Singleton pattern - only one scheduler instance should run per deployment.
 * Use HARVESTER_SCHEDULER_ENABLED=true to enable.
 */

import { prisma } from '@ironscout/db'
import { loggers } from '../config/logger.js'
import { enqueueScrapeUrl, ScrapeUrlJobData } from '../config/queues.js'
import { getAdapterRegistry } from './registry.js'
import type { ScrapeRunTrigger } from '@ironscout/db/generated/prisma'

const log = loggers.scraper

/** Scheduler state */
let schedulerInterval: NodeJS.Timeout | null = null
let isSchedulerRunning = false

/**
 * Scheduler configuration.
 */
export interface SchedulerConfig {
  /** Interval between scheduler ticks in ms (default: 60000 = 1 minute) */
  tickIntervalMs?: number

  /** Maximum URLs to enqueue per tick (default: 100) */
  maxUrlsPerTick?: number

  /** Only schedule targets for enabled adapters */
  checkAdapterEnabled?: boolean
}

const DEFAULT_CONFIG: Required<SchedulerConfig> = {
  tickIntervalMs: 60000, // 1 minute
  maxUrlsPerTick: 100,
  checkAdapterEnabled: true,
}

/**
 * Query targets that are due for scraping.
 *
 * Combined gate (per spec §9.5):
 * - sources.scrape_enabled = TRUE (admin allowlist)
 * - sources.robots_compliant = TRUE (robots/legal compliance)
 * - scrape_targets.enabled = TRUE (target-level toggle)
 * - scrape_targets.status = 'ACTIVE' (not broken/paused/stale)
 * - Schedule is due based on cron and lastScrapedAt
 */
async function getDueTargets(limit: number): Promise<DueTarget[]> {
  // For now, use simple interval-based scheduling instead of cron parsing
  // Targets are due if:
  // - Never scraped (lastScrapedAt is null)
  // - Or last scraped more than 4 hours ago (default schedule)
  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000)

  const targets = await prisma.scrape_targets.findMany({
    where: {
      enabled: true,
      status: 'ACTIVE',
      sources: {
        scrapeEnabled: true,
        robotsCompliant: true,
      },
      OR: [
        { lastScrapedAt: null },
        { lastScrapedAt: { lt: fourHoursAgo } },
      ],
    },
    include: {
      sources: {
        select: {
          id: true,
          retailerId: true,
          adapterId: true,
        },
      },
    },
    orderBy: [
      { priority: 'desc' },
      { lastScrapedAt: 'asc' },
    ],
    take: limit,
  })

  return targets.map((t) => ({
    id: t.id,
    url: t.url,
    sourceId: t.sourceId,
    retailerId: t.sources.retailerId,
    adapterId: t.adapterId,
    priority: t.priority,
  }))
}

interface DueTarget {
  id: string
  url: string
  sourceId: string
  retailerId: string
  adapterId: string
  priority: number
}

/**
 * Create a scrape run record for tracking.
 */
async function createScrapeRun(
  adapterId: string,
  adapterVersion: string,
  sourceId: string,
  retailerId: string,
  trigger: ScrapeRunTrigger
): Promise<string> {
  const run = await prisma.scrape_runs.create({
    data: {
      adapterId,
      adapterVersion,
      sourceId,
      retailerId,
      trigger,
      status: 'RUNNING',
      startedAt: new Date(),
    },
    select: { id: true },
  })

  return run.id
}

/**
 * Execute one scheduler tick.
 */
async function tick(config: Required<SchedulerConfig>): Promise<void> {
  if (isSchedulerRunning) {
    log.debug('Scheduler tick skipped - previous tick still running')
    return
  }

  isSchedulerRunning = true
  const tickStart = Date.now()

  try {
    log.debug('Scheduler tick starting')

    // Get due targets
    const targets = await getDueTargets(config.maxUrlsPerTick)

    if (targets.length === 0) {
      log.debug('No targets due for scraping')
      return
    }

    log.info('Found due targets', { count: targets.length })

    const registry = getAdapterRegistry()

    // Group targets by adapter to create runs efficiently
    const targetsByAdapter = new Map<string, DueTarget[]>()
    for (const target of targets) {
      // Check adapter exists and is enabled
      if (config.checkAdapterEnabled) {
        const adapter = registry.get(target.adapterId)
        if (!adapter) {
          log.warn('Skipping target - adapter not registered', {
            targetId: target.id,
            adapterId: target.adapterId,
          })
          continue
        }

        // Check adapter status in database
        const adapterStatus = await prisma.scrape_adapter_status.findUnique({
          where: { adapterId: target.adapterId },
          select: { enabled: true },
        })

        if (adapterStatus && !adapterStatus.enabled) {
          log.debug('Skipping target - adapter disabled', {
            targetId: target.id,
            adapterId: target.adapterId,
          })
          continue
        }
      }

      const existing = targetsByAdapter.get(target.adapterId) ?? []
      existing.push(target)
      targetsByAdapter.set(target.adapterId, existing)
    }

    // Process each adapter group
    let enqueuedCount = 0
    for (const [adapterId, adapterTargets] of targetsByAdapter) {
      const adapter = registry.get(adapterId)
      if (!adapter) continue

      // Create a run for this batch
      // Use the first target's source/retailer for the run record
      const firstTarget = adapterTargets[0]
      const runId = await createScrapeRun(
        adapterId,
        adapter.version,
        firstTarget.sourceId,
        firstTarget.retailerId,
        'SCHEDULED'
      )

      log.info('Created scrape run', {
        runId,
        adapterId,
        targetCount: adapterTargets.length,
      })

      // Enqueue jobs for each target
      for (const target of adapterTargets) {
        const jobData: ScrapeUrlJobData = {
          targetId: target.id,
          url: target.url,
          sourceId: target.sourceId,
          retailerId: target.retailerId,
          adapterId: target.adapterId,
          runId,
          priority: target.priority,
          trigger: 'SCHEDULED',
        }

        await enqueueScrapeUrl(jobData)
        enqueuedCount++
      }

      // Update run with URL count
      await prisma.scrape_runs.update({
        where: { id: runId },
        data: { urlsAttempted: adapterTargets.length },
      })
    }

    log.info('Scheduler tick completed', {
      enqueuedCount,
      durationMs: Date.now() - tickStart,
    })
  } catch (error) {
    log.error('Scheduler tick failed', {
      error: (error as Error).message,
      durationMs: Date.now() - tickStart,
    })
  } finally {
    isSchedulerRunning = false
  }
}

/**
 * Start the scrape scheduler.
 *
 * Singleton - only one scheduler should run.
 * Check HARVESTER_SCHEDULER_ENABLED before calling.
 */
export function startScrapeScheduler(config?: SchedulerConfig): void {
  if (schedulerInterval) {
    log.warn('Scheduler already running')
    return
  }

  const mergedConfig = { ...DEFAULT_CONFIG, ...config }

  log.info('Starting scrape scheduler', {
    tickIntervalMs: mergedConfig.tickIntervalMs,
    maxUrlsPerTick: mergedConfig.maxUrlsPerTick,
  })

  // Run immediately on start
  tick(mergedConfig).catch((err) => {
    log.error('Initial scheduler tick failed', { error: (err as Error).message })
  })

  // Then run on interval
  schedulerInterval = setInterval(() => {
    tick(mergedConfig).catch((err) => {
      log.error('Scheduler tick failed', { error: (err as Error).message })
    })
  }, mergedConfig.tickIntervalMs)
}

/**
 * Stop the scrape scheduler.
 */
export function stopScrapeScheduler(): void {
  if (schedulerInterval) {
    log.info('Stopping scrape scheduler')
    clearInterval(schedulerInterval)
    schedulerInterval = null
  }
}

/**
 * Check if scheduler is running.
 */
export function isScrapeSchedulerRunning(): boolean {
  return schedulerInterval !== null
}

/**
 * Manually trigger a scheduler tick (for testing/admin use).
 */
export async function triggerScrapeSchedulerTick(config?: SchedulerConfig): Promise<void> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config }
  await tick(mergedConfig)
}
