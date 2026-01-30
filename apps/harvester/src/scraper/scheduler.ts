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

import CronParser from 'cron-parser'
import { prisma } from '@ironscout/db'
import { loggers } from '../config/logger.js'
import { enqueueScrapeUrl, ScrapeUrlJobData, scrapeUrlQueue } from '../config/queues.js'
import { getAdapterRegistry } from './registry.js'
import { checkAutoDisable } from './process/drift-detector.js'
import type { ScrapeRunTrigger, ScrapeRunStatus, ScrapeAdapterDisableReason } from '@ironscout/db/generated/prisma'
import type { ScrapeRunMetrics } from './types.js'

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

/** Default cron schedule: every 4 hours (0 0,4,8,12,16,20 * * *) */
const DEFAULT_CRON_SCHEDULE = '0 0,4,8,12,16,20 * * *'

/**
 * Check if a target is due for scraping based on its cron schedule.
 *
 * Per spec §10.2: Targets have cron schedules in UTC.
 * A target is due if:
 * 1. lastScrapedAt is null (never scraped)
 * 2. lastScrapedAt is before the most recent scheduled run time
 *
 * @param schedule - Cron expression (or null to use default)
 * @param lastScrapedAt - When the target was last scraped
 * @param now - Current time (for testing)
 * @returns True if target is due for scraping
 */
export function isTargetDue(
  schedule: string | null,
  lastScrapedAt: Date | null,
  now: Date = new Date()
): boolean {
  // Never scraped = always due
  if (!lastScrapedAt) return true

  const cronExpr = schedule || DEFAULT_CRON_SCHEDULE

  try {
    // Parse cron with UTC timezone
    const interval = CronParser.parse(cronExpr, {
      currentDate: now,
      tz: 'UTC',
    })

    // Get the previous scheduled time
    const prevScheduled = interval.prev().toDate()

    // Target is due if it was last scraped before the previous scheduled time
    return lastScrapedAt < prevScheduled
  } catch (error) {
    // If cron parsing fails, log and use fallback (4 hours ago)
    log.warn('Invalid cron schedule, using fallback', {
      schedule: cronExpr,
      error: (error as Error).message,
    })
    const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000)
    return lastScrapedAt < fourHoursAgo
  }
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
  const now = new Date()

  // Query all eligible targets (cron-based filtering done in-memory)
  // Fetch more than needed to account for cron filtering
  const fetchLimit = limit * 3

  const targets = await prisma.scrape_targets.findMany({
    where: {
      enabled: true,
      status: 'ACTIVE',
      sources: {
        scrapeEnabled: true,
        robotsCompliant: true,
      },
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
    take: fetchLimit,
  })

  // Filter by cron schedule
  const dueTargets: DueTarget[] = []
  for (const t of targets) {
    if (dueTargets.length >= limit) break

    if (isTargetDue(t.schedule, t.lastScrapedAt, now)) {
      dueTargets.push({
        id: t.id,
        url: t.url,
        sourceId: t.sourceId,
        retailerId: t.sources.retailerId,
        adapterId: t.adapterId,
        priority: t.priority,
      })
    }
  }

  return dueTargets
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
 * Finalize stale runs that have been RUNNING for too long.
 *
 * Per spec: Runs should be finalized when all jobs complete.
 * Since we can't easily detect job completion across workers,
 * we finalize runs that:
 * 1. Have been RUNNING for > 30 minutes (likely stale)
 * 2. Have no pending jobs in the queue for that runId
 *
 * The metrics are read from the run record (updated incrementally by workers).
 */
async function finalizeStaleRuns(): Promise<void> {
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000)

  // Find runs that have been RUNNING for too long
  const staleRuns = await prisma.scrape_runs.findMany({
    where: {
      status: 'RUNNING',
      startedAt: { lt: thirtyMinutesAgo },
    },
    select: {
      id: true,
      adapterId: true,
      startedAt: true,
      urlsAttempted: true,
      urlsSucceeded: true,
      urlsFailed: true,
      offersExtracted: true,
      offersValid: true,
      offersDropped: true,
      offersQuarantined: true,
      oosNoPriceCount: true,
    },
  })

  for (const run of staleRuns) {
    try {
      // Check if there are still pending jobs for this run
      const pendingJobs = await scrapeUrlQueue.getJobs(['waiting', 'active', 'delayed'])
      const runPendingJobs = pendingJobs.filter((job) => job.data?.runId === run.id)

      if (runPendingJobs.length > 0) {
        log.debug('Skipping run finalization - jobs still pending', {
          runId: run.id,
          pendingCount: runPendingJobs.length,
        })
        continue
      }

      // Calculate final status based on metrics
      const failureRate = run.urlsAttempted > 0
        ? (run.urlsFailed - run.oosNoPriceCount) / run.urlsAttempted
        : 0
      const yieldRate = run.urlsAttempted > 0
        ? run.offersValid / run.urlsAttempted
        : 0
      const dropRate = run.offersExtracted > 0
        ? run.offersDropped / run.offersExtracted
        : 0

      // Determine status
      let status: ScrapeRunStatus = 'SUCCESS'
      if (run.offersQuarantined > 0 && run.offersQuarantined >= run.offersValid) {
        status = 'QUARANTINED'
      } else if (failureRate > 0.5) {
        status = 'FAILED'
      }

      const completedAt = new Date()
      const durationMs = completedAt.getTime() - run.startedAt.getTime()

      await prisma.scrape_runs.update({
        where: { id: run.id },
        data: {
          status,
          completedAt,
          durationMs,
          failureRate,
          yieldRate,
          dropRate,
        },
      })

      log.info('Finalized stale run', {
        runId: run.id,
        adapterId: run.adapterId,
        status,
        durationMs,
        failureRate: failureRate.toFixed(2),
        yieldRate: yieldRate.toFixed(2),
      })

      // Check drift detection for auto-disable (per spec §7)
      const metrics: ScrapeRunMetrics = {
        urlsAttempted: run.urlsAttempted,
        urlsSucceeded: run.urlsSucceeded,
        urlsFailed: run.urlsFailed,
        offersExtracted: run.offersExtracted,
        offersValid: run.offersValid,
        offersDropped: run.offersDropped,
        offersQuarantined: run.offersQuarantined,
        oosNoPriceCount: run.oosNoPriceCount,
        zeroPriceCount: 0, // Not tracked at run level currently
      }

      // Get or create adapter status record
      let adapterStatus = await prisma.scrape_adapter_status.findUnique({
        where: { adapterId: run.adapterId },
        select: { consecutiveFailedBatches: true, enabled: true },
      })

      if (!adapterStatus) {
        // Create status record if doesn't exist
        adapterStatus = await prisma.scrape_adapter_status.create({
          data: {
            adapterId: run.adapterId,
            enabled: true,
            consecutiveFailedBatches: 0,
          },
          select: { consecutiveFailedBatches: true, enabled: true },
        })
      }

      // Check auto-disable decision
      const disableDecision = checkAutoDisable(metrics, adapterStatus.consecutiveFailedBatches)

      if (disableDecision) {
        // Update adapter status with new consecutive failed batches count
        const updateData: {
          consecutiveFailedBatches: number
          enabled?: boolean
          disabledAt?: Date
          disabledReason?: ScrapeAdapterDisableReason
        } = {
          consecutiveFailedBatches: disableDecision.consecutiveFailedBatches,
        }

        if (disableDecision.shouldDisable && adapterStatus.enabled) {
          updateData.enabled = false
          updateData.disabledAt = new Date()
          updateData.disabledReason = (disableDecision.reason ?? 'DRIFT_DETECTED') as ScrapeAdapterDisableReason

          log.warn('Auto-disabling adapter due to drift', {
            adapterId: run.adapterId,
            reason: disableDecision.reason,
            message: disableDecision.message,
            consecutiveFailedBatches: disableDecision.consecutiveFailedBatches,
          })
        } else {
          log.debug('Drift check result', {
            adapterId: run.adapterId,
            message: disableDecision.message,
            consecutiveFailedBatches: disableDecision.consecutiveFailedBatches,
          })
        }

        await prisma.scrape_adapter_status.update({
          where: { adapterId: run.adapterId },
          data: updateData,
        })
      }
    } catch (error) {
      log.error('Failed to finalize stale run', {
        runId: run.id,
        error: (error as Error).message,
      })
    }
  }
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
 * Process pending manual scrape requests.
 *
 * Per spec §8.2: Manual triggers are picked up by the scheduler and processed
 * with priority. Targets are marked with lastStatus = 'PENDING_MANUAL' by the admin app.
 */
async function processManualRuns(): Promise<void> {
  // Find targets with pending manual runs
  const pendingTargets = await prisma.scrape_targets.findMany({
    where: {
      lastStatus: 'PENDING_MANUAL',
      enabled: true,
      status: 'ACTIVE',
      sources: {
        scrapeEnabled: true,
        robotsCompliant: true,
      },
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
    orderBy: { updatedAt: 'asc' },
    take: 50, // Process up to 50 manual requests per tick
  })

  if (pendingTargets.length === 0) {
    return
  }

  log.info('Processing pending manual runs', { count: pendingTargets.length })

  const registry = getAdapterRegistry()

  for (const target of pendingTargets) {
    try {
      // Check adapter is registered and enabled
      const adapter = registry.get(target.adapterId)
      if (!adapter) {
        log.warn('Skipping manual run - adapter not registered', {
          targetId: target.id,
          adapterId: target.adapterId,
        })
        // Clear the pending status
        await prisma.scrape_targets.update({
          where: { id: target.id },
          data: { lastStatus: 'SKIPPED_NO_ADAPTER' },
        })
        continue
      }

      const adapterStatus = await prisma.scrape_adapter_status.findUnique({
        where: { adapterId: target.adapterId },
        select: { enabled: true },
      })

      if (adapterStatus && !adapterStatus.enabled) {
        log.warn('Skipping manual run - adapter disabled', {
          targetId: target.id,
          adapterId: target.adapterId,
        })
        await prisma.scrape_targets.update({
          where: { id: target.id },
          data: { lastStatus: 'SKIPPED_ADAPTER_DISABLED' },
        })
        continue
      }

      // Find or create the manual run record
      let run = await prisma.scrape_runs.findFirst({
        where: {
          sourceId: target.sourceId,
          trigger: 'MANUAL',
          status: 'RUNNING',
          urlsAttempted: { lte: 1 }, // Not yet fully started
        },
        orderBy: { createdAt: 'desc' },
      })

      if (!run) {
        // Create a new run for this manual request
        run = await prisma.scrape_runs.create({
          data: {
            adapterId: target.adapterId,
            adapterVersion: adapter.version,
            sourceId: target.sourceId,
            retailerId: target.sources.retailerId,
            trigger: 'MANUAL',
            status: 'RUNNING',
            startedAt: new Date(),
            urlsAttempted: 1,
          },
        })
      }

      // Enqueue the job
      const jobData: ScrapeUrlJobData = {
        targetId: target.id,
        url: target.url,
        sourceId: target.sourceId,
        retailerId: target.sources.retailerId,
        adapterId: target.adapterId,
        runId: run.id,
        priority: 100, // High priority for manual runs
        trigger: 'MANUAL',
      }

      await enqueueScrapeUrl(jobData)

      // Clear the pending status
      await prisma.scrape_targets.update({
        where: { id: target.id },
        data: { lastStatus: 'ENQUEUED' },
      })

      log.info('Enqueued manual scrape', {
        targetId: target.id,
        runId: run.id,
      })
    } catch (error) {
      log.error('Failed to process manual run', {
        targetId: target.id,
        error: (error as Error).message,
      })
      // Clear the pending status to prevent retry loop
      await prisma.scrape_targets.update({
        where: { id: target.id },
        data: { lastStatus: 'FAILED_TO_ENQUEUE' },
      })
    }
  }
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

    // Finalize any stale runs before starting new ones
    await finalizeStaleRuns()

    // Process any pending manual runs first (high priority)
    await processManualRuns()

    // Get due targets for scheduled runs
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
