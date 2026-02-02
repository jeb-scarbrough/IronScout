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
import { enqueueScrapeUrl, ScrapeUrlJobData, scrapeUrlQueue, getScrapeQueueStats, decrementAdapterPending } from '../config/queues.js'
import { getAdapterRegistry } from './registry.js'
import { checkAutoDisable, checkZeroPriceDisable, updateBaseline, computeDerivedMetrics } from './process/drift-detector.js'
import { recordAdapterDisabled, recordQueueRejection, recordRunCompleted, recordStaleTargetsAlert } from './metrics.js'
import type { ScrapeRunTrigger, ScrapeRunStatus, ScrapeAdapterDisableReason } from '@ironscout/db/generated/prisma'
import type { ScrapeRunMetrics } from './types.js'

const log = loggers.scraper

/** Scheduler state */
let schedulerInterval: NodeJS.Timeout | null = null
let isSchedulerRunning = false
let lastMaintenanceRun: Date | null = null

/**
 * Per-adapter backoff tracking.
 * Maps adapterId to { backoffUntil, consecutiveRejections }.
 * Per spec §8.3: Scheduler backs off with exponential increase on consecutive rejections.
 */
const adapterBackoffState = new Map<string, { backoffUntil: number; consecutiveRejections: number }>()

/** Global scheduler pause state */
let globalPauseUntil: number | null = null
let globalConsecutiveRejections = 0
const GLOBAL_PAUSE_BASE_MS = 60000 // 1 minute base pause
const GLOBAL_PAUSE_MAX_MS = 60 * 60 * 1000 // 1 hour max pause per spec §8.3
const GLOBAL_PAUSE_ALERT_THRESHOLD_MS = 30 * 60 * 1000 // Alert if backoff > 30 min per spec §8.3

/**
 * Check if scheduler is globally paused.
 */
function isGloballyPaused(): boolean {
  if (!globalPauseUntil) return false
  if (Date.now() >= globalPauseUntil) {
    globalPauseUntil = null
    log.info('Global scheduler pause ended')
    return false
  }
  return true
}

/**
 * Trigger global pause when backpressure is severe.
 * Per spec §8.3: Uses exponential backoff across consecutive rejection cycles.
 * Max backoff is 1 hour. Alert if backoff exceeds 30 minutes.
 */
function triggerGlobalPause(retryAfterMs?: number): void {
  globalConsecutiveRejections++

  // Exponential backoff: base * 2^(consecutive-1), capped at 1 hour
  // With 1min base: 1, 2, 4, 8, 16, 32, 60 (capped) minutes
  const baseMs = retryAfterMs ?? GLOBAL_PAUSE_BASE_MS
  const multiplier = Math.pow(2, globalConsecutiveRejections - 1)
  const pauseDurationMs = Math.min(baseMs * multiplier, GLOBAL_PAUSE_MAX_MS)

  globalPauseUntil = Date.now() + pauseDurationMs

  // Per spec §8.3: Alert if backoff exceeds 30 minutes (persistent capacity issue)
  if (pauseDurationMs >= GLOBAL_PAUSE_ALERT_THRESHOLD_MS) {
    log.error('ALERT: Scheduler backoff exceeds 30 minutes - persistent capacity issue', {
      pauseUntil: new Date(globalPauseUntil),
      durationMs: pauseDurationMs,
      durationMinutes: Math.round(pauseDurationMs / 60000),
      consecutiveRejections: globalConsecutiveRejections,
    })
  } else {
    log.warn('Triggering global scheduler pause due to high rejection rate', {
      pauseUntil: new Date(globalPauseUntil),
      durationMs: pauseDurationMs,
      consecutiveRejections: globalConsecutiveRejections,
    })
  }
}

/**
 * Clear global pause state on successful tick.
 */
function clearGlobalBackoff(): void {
  if (globalConsecutiveRejections > 0) {
    log.debug('Cleared global backoff', { previousConsecutive: globalConsecutiveRejections })
    globalConsecutiveRejections = 0
  }
}

/**
 * Check if an adapter is in backoff period.
 */
function isAdapterInBackoff(adapterId: string): boolean {
  const state = adapterBackoffState.get(adapterId)
  if (!state) return false
  if (Date.now() >= state.backoffUntil) {
    adapterBackoffState.delete(adapterId)
    return false
  }
  return true
}

/**
 * Set adapter backoff with exponential increase.
 * Per spec §8.3: Consecutive rejections increase backoff exponentially.
 */
function setAdapterBackoff(adapterId: string, baseRetryAfterMs: number): void {
  const existingState = adapterBackoffState.get(adapterId)
  const consecutiveRejections = (existingState?.consecutiveRejections ?? 0) + 1

  // Exponential backoff: base * 2^(consecutive-1), capped at 5 minutes
  const multiplier = Math.pow(2, Math.min(consecutiveRejections - 1, 4))
  const backoffMs = Math.min(baseRetryAfterMs * multiplier, 5 * 60 * 1000)
  const backoffUntil = Date.now() + backoffMs

  adapterBackoffState.set(adapterId, { backoffUntil, consecutiveRejections })
  log.debug('Adapter in exponential backoff', {
    adapterId,
    baseRetryAfterMs,
    consecutiveRejections,
    actualBackoffMs: backoffMs,
    backoffUntil: new Date(backoffUntil),
  })
}

/**
 * Clear adapter backoff on successful enqueue.
 */
function clearAdapterBackoff(adapterId: string): void {
  if (adapterBackoffState.has(adapterId)) {
    adapterBackoffState.delete(adapterId)
    log.debug('Cleared adapter backoff', { adapterId })
  }
}

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
 * - scrape_targets.robotsPathBlocked != TRUE (not admin-blocked)
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
      robotsPathBlocked: { not: true }, // Exclude admin-blocked URLs from scheduling
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
      sourceId: true,
      startedAt: true,
      urlsAttempted: true,
      urlsSucceeded: true,
      urlsFailed: true,
      offersExtracted: true,
      offersValid: true,
      offersDropped: true,
      offersQuarantined: true,
      oosNoPriceCount: true,
      zeroPriceCount: true,
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
      // OOS_NO_PRICE is already excluded from urlsFailed (neutral outcome)
      const failureRate = run.urlsAttempted > 0
        ? run.urlsFailed / run.urlsAttempted
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

      recordRunCompleted({
        runId: run.id,
        adapterId: run.adapterId,
        sourceId: run.sourceId,
        status,
        urlsAttempted: run.urlsAttempted,
        urlsSucceeded: run.urlsSucceeded,
        urlsFailed: run.urlsFailed,
        offersExtracted: run.offersExtracted,
        offersValid: run.offersValid,
        offersDropped: run.offersDropped,
        offersQuarantined: run.offersQuarantined,
        oosNoPriceCount: run.oosNoPriceCount,
        failureRate,
        yieldRate,
        dropRate,
        durationMs,
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
        zeroPriceCount: run.zeroPriceCount,
      }

      // Get or create adapter status record
      let adapterStatus = await prisma.scrape_adapter_status.findUnique({
        where: { adapterId: run.adapterId },
        select: { consecutiveFailedBatches: true, enabled: true, lastRunHadZeroPrice: true },
      })

      if (!adapterStatus) {
        // Create status record if doesn't exist
        adapterStatus = await prisma.scrape_adapter_status.create({
          data: {
            adapterId: run.adapterId,
            enabled: true,
            consecutiveFailedBatches: 0,
          },
          select: { consecutiveFailedBatches: true, enabled: true, lastRunHadZeroPrice: true },
        })
      }

      // Check auto-disable decision
      const disableDecision = checkAutoDisable(metrics, adapterStatus.consecutiveFailedBatches)

      // Per spec §7.2: Check zero-price auto-disable (2 consecutive runs with zero prices)
      const zeroPriceDecision = checkZeroPriceDisable(metrics, adapterStatus.lastRunHadZeroPrice)

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

          recordAdapterDisabled({
            adapterId: run.adapterId,
            reason: disableDecision.reason ?? 'DRIFT_DETECTED',
            consecutiveFailedBatches: disableDecision.consecutiveFailedBatches,
          })

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

      // Handle zero-price auto-disable (per spec §7.2)
      if (zeroPriceDecision?.shouldDisable && adapterStatus.enabled) {
        await prisma.scrape_adapter_status.update({
          where: { adapterId: run.adapterId },
          data: {
            enabled: false,
            disabledAt: new Date(),
            disabledReason: 'DRIFT_DETECTED',
            lastRunHadZeroPrice: true,
          },
        })

        recordAdapterDisabled({
          adapterId: run.adapterId,
          reason: 'DRIFT_DETECTED',
          consecutiveFailedBatches: 2, // Two consecutive zero-price runs
        })

        log.warn('Auto-disabling adapter due to consecutive zero-price runs', {
          adapterId: run.adapterId,
          message: zeroPriceDecision.message,
        })
      } else {
        // Update lastRunHadZeroPrice for next run's check
        // Per spec §7.2: Only count runs with >= 20 URLs toward zero-price auto-disable
        // Small manual tests shouldn't set this flag
        if (run.urlsAttempted >= 20) {
          const currentRunHasZeroPrice = run.zeroPriceCount > 0
          await prisma.scrape_adapter_status.update({
            where: { adapterId: run.adapterId },
            data: { lastRunHadZeroPrice: currentRunHasZeroPrice },
          })
        }
      }

      // Update baseline for successful runs (per spec §7.3)
      if (status === 'SUCCESS') {
        try {
          // Query recent successful runs for rolling baseline calculation
          // Per spec §7.3: Exclude small runs (<20 URLs) from baseline
          const recentRuns = await prisma.scrape_runs.findMany({
            where: {
              adapterId: run.adapterId,
              status: 'SUCCESS',
              completedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // 7 days
              urlsAttempted: { gte: 20 }, // Per spec: exclude small runs
            },
            orderBy: { completedAt: 'desc' },
            take: 20,
            select: {
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

          // Convert to derived metrics for baseline calculation
          const recentDerivedMetrics = recentRuns.map((r) =>
            computeDerivedMetrics({
              urlsAttempted: r.urlsAttempted,
              urlsSucceeded: r.urlsSucceeded,
              urlsFailed: r.urlsFailed,
              offersExtracted: r.offersExtracted,
              offersValid: r.offersValid,
              offersDropped: r.offersDropped,
              offersQuarantined: r.offersQuarantined,
              oosNoPriceCount: r.oosNoPriceCount,
              zeroPriceCount: 0, // Not tracked at run level - schema change needed
            })
          )

          // Calculate new baseline
          const newBaseline = updateBaseline(null, metrics, recentDerivedMetrics)

          // Update adapter status with new baseline
          await prisma.scrape_adapter_status.update({
            where: { adapterId: run.adapterId },
            data: {
              baselineFailureRate: newBaseline.medianFailureRate,
              baselineYieldRate: newBaseline.medianYieldRate,
              baselineSampleSize: newBaseline.sampleSize,
              baselineUpdatedAt: new Date(),
            },
          })

          log.debug('Updated adapter baseline', {
            adapterId: run.adapterId,
            sampleSize: newBaseline.sampleSize,
            isEstablished: newBaseline.isEstablished,
          })
        } catch (baselineError) {
          log.error('Failed to update baseline', {
            adapterId: run.adapterId,
            error: (baselineError as Error).message,
          })
        }
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

/** Max age for queue entries before cleanup (24 hours per spec §8.1) */
const QUEUE_ENTRY_MAX_AGE_MS = 24 * 60 * 60 * 1000

/**
 * Clean up stale queue entries that have been waiting too long.
 * Per spec §8.3: Prevents queue from accumulating old jobs.
 */
async function cleanupStaleQueueEntries(): Promise<number> {
  try {
    const cutoffTime = Date.now() - QUEUE_ENTRY_MAX_AGE_MS
    const waitingJobs = await scrapeUrlQueue.getJobs(['waiting', 'delayed'])
    let removedCount = 0

    for (const job of waitingJobs) {
      // Check job age (timestamp is job creation time in ms)
      if (job.timestamp && job.timestamp < cutoffTime) {
        try {
          const adapterId = job.data?.adapterId
          await job.remove()
          removedCount++

          // Decrement per-adapter pending count to avoid adapter_full stuck state
          if (adapterId) {
            await decrementAdapterPending(adapterId).catch((err) => {
              log.warn('Failed to decrement adapter pending for stale job', {
                adapterId,
                error: err.message,
              })
            })
          }

          log.debug('Removed stale queue entry', {
            jobId: job.id,
            targetId: job.data?.targetId,
            adapterId,
            ageMs: Date.now() - job.timestamp,
          })
        } catch (removeErr) {
          // Job may have been processed or removed already
          log.debug('Could not remove stale job', { jobId: job.id })
        }
      }
    }

    if (removedCount > 0) {
      log.info('Cleaned up stale queue entries', { removedCount, maxAgeMs: QUEUE_ENTRY_MAX_AGE_MS })
    }

    return removedCount
  } catch (error) {
    log.error('Failed to cleanup stale queue entries', { error: (error as Error).message })
    return 0
  }
}

/**
 * Run hourly maintenance tasks if due.
 * Per spec: stale URL cleanup runs hourly.
 */
async function runDailyMaintenance(): Promise<void> {
  const now = new Date()
  const MAINTENANCE_INTERVAL_MS = 60 * 60 * 1000 // 1 hour (per spec)

  // Check if maintenance is due
  if (lastMaintenanceRun && now.getTime() - lastMaintenanceRun.getTime() < MAINTENANCE_INTERVAL_MS) {
    return
  }

  log.info('Running hourly maintenance')
  lastMaintenanceRun = now

  try {
    // Clean up stale and broken URLs
    const cleanupResult = await cleanupStaleUrls()

    // Recheck broken URLs weekly
    const recheckResult = await recheckBrokenUrls()

    // Clean up stale queue entries (per spec §8.3)
    const staleQueueRemoved = await cleanupStaleQueueEntries()

    // Per spec: Alert based on TOTAL stale targets, not just newly marked
    const totalStale = await prisma.scrape_targets.count({
      where: { status: 'STALE' },
    })
    recordStaleTargetsAlert({ totalStale, markedStale: cleanupResult.markedStale })

    log.info('Hourly maintenance completed', {
      totalStale,
      markedStale: cleanupResult.markedStale,
      deletedBroken: cleanupResult.deletedBroken,
      brokenRechecked: recheckResult.rechecked,
      brokenReactivated: recheckResult.reactivated,
      staleQueueRemoved,
    })
  } catch (error) {
    log.error('Hourly maintenance failed', { error: (error as Error).message })
  }
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
    take: 10, // Per spec: cap manual runs at 10 per tick
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

      const enqueueResult = await enqueueScrapeUrl(jobData)

      // Update status based on enqueue result (respect backpressure)
      if (enqueueResult.status === 'accepted') {
        await prisma.scrape_targets.update({
          where: { id: target.id },
          data: { lastStatus: 'ENQUEUED' },
        })
        log.info('Enqueued manual scrape', {
          targetId: target.id,
          runId: run.id,
        })
      } else if (enqueueResult.status === 'rejected') {
        // Queue full or other rejection - leave as PENDING_MANUAL to retry next tick
        recordQueueRejection({
          reason: enqueueResult.reason ?? 'queue_full',
          targetId: target.id,
          runId: run.id,
          adapterId: target.adapterId,
          sourceId: target.sourceId,
          retryAfterMs: enqueueResult.retryAfterMs,
        })
        log.warn('Manual enqueue rejected - backpressure', {
          targetId: target.id,
          reason: enqueueResult.reason,
          retryAfterMs: enqueueResult.retryAfterMs,
        })
      } else {
        // Deduplicated - job already exists
        await prisma.scrape_targets.update({
          where: { id: target.id },
          data: { lastStatus: 'ENQUEUED' },
        })
        log.debug('Manual scrape deduplicated', { targetId: target.id })
      }
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

  // Per spec §8.3: Check global pause before starting tick
  if (isGloballyPaused()) {
    log.debug('Scheduler tick skipped - global pause active')
    return
  }

  isSchedulerRunning = true
  const tickStart = Date.now()

  try {
    log.debug('Scheduler tick starting')

    // Check queue capacity before doing work (backpressure)
    const queueStats = await getScrapeQueueStats()
    if (queueStats.utilizationPercent >= 90) {
      log.warn('Scheduler tick skipped - queue at high utilization', {
        utilization: queueStats.utilizationPercent,
        total: queueStats.total,
        capacity: queueStats.capacity,
      })
      return
    }

    // Finalize any stale runs before starting new ones
    await finalizeStaleRuns()

    // Run daily maintenance (cleanup stale URLs, broken URL recheck)
    await runDailyMaintenance()

    // Process any pending manual runs first (high priority)
    await processManualRuns()

    // Reduce batch size if queue is getting full
    const adjustedLimit = queueStats.utilizationPercent >= 50
      ? Math.floor(config.maxUrlsPerTick / 2)
      : config.maxUrlsPerTick

    // Get due targets for scheduled runs
    const targets = await getDueTargets(adjustedLimit)

    if (targets.length === 0) {
      log.debug('No targets due for scraping')
      return
    }

    log.info('Found due targets', { count: targets.length })

    const registry = getAdapterRegistry()

    // Group targets by adapter+source to create runs per source
    // Key format: "adapterId|sourceId"
    const targetsByAdapterSource = new Map<string, DueTarget[]>()
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

      // Group by adapter+source combination (runs track metrics per source)
      const key = `${target.adapterId}|${target.sourceId}`
      const existing = targetsByAdapterSource.get(key) ?? []
      existing.push(target)
      targetsByAdapterSource.set(key, existing)
    }

    // Process each adapter+source group
    let enqueuedCount = 0
    let rejectedCount = 0
    let maxRetryAfterMs = 0 // Track max retryAfterMs for global pause
    for (const [key, sourceTargets] of targetsByAdapterSource) {
      const [adapterId, sourceId] = key.split('|')
      const adapter = registry.get(adapterId)
      if (!adapter) continue

      // Per spec §8.3: Check adapter backoff before scheduling
      if (isAdapterInBackoff(adapterId)) {
        log.debug('Skipping adapter - in backoff period', { adapterId })
        continue
      }

      // Check if there's already a RUNNING run for this source to prevent overlap
      const existingRun = await prisma.scrape_runs.findFirst({
        where: {
          sourceId,
          status: 'RUNNING',
        },
        select: { id: true, startedAt: true },
      })

      if (existingRun) {
        log.debug('Skipping source - run already in progress', {
          sourceId,
          adapterId,
          existingRunId: existingRun.id,
          runningForMs: Date.now() - existingRun.startedAt.getTime(),
        })
        continue
      }

      // Create a run for this source batch
      const firstTarget = sourceTargets[0]
      const runId = await createScrapeRun(
        adapterId,
        adapter.version,
        sourceId,
        firstTarget.retailerId,
        'SCHEDULED'
      )

      log.info('Created scrape run', {
        runId,
        adapterId,
        sourceId,
        targetCount: sourceTargets.length,
      })

      // Enqueue jobs for each target with backpressure tracking
      let acceptedInRun = 0
      let rejectedInRun = 0

      for (const target of sourceTargets) {
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

        const result = await enqueueScrapeUrl(jobData)

        if (result.status === 'accepted') {
          enqueuedCount++
          acceptedInRun++
          // Per spec §8.3: Clear backoff on successful enqueue
          clearAdapterBackoff(target.adapterId)
        } else if (result.status === 'rejected') {
          rejectedCount++
          rejectedInRun++
          recordQueueRejection({
            reason: result.reason ?? 'queue_full',
            targetId: target.id,
            runId,
            adapterId: target.adapterId,
            sourceId: target.sourceId,
            retryAfterMs: result.retryAfterMs,
          })

          // Track max retryAfterMs for global pause calculation
          if (result.retryAfterMs && result.retryAfterMs > maxRetryAfterMs) {
            maxRetryAfterMs = result.retryAfterMs
          }

          // Per spec §8.3: Set adapter backoff based on retryAfterMs
          if (result.retryAfterMs && (result.reason === 'adapter_full' || result.reason === 'rate_limited')) {
            setAdapterBackoff(target.adapterId, result.retryAfterMs)
          }

          // If >50% rejections in this run, stop enqueueing
          if (rejectedInRun > acceptedInRun && acceptedInRun > 0) {
            log.warn('Stopping enqueue for run - high rejection rate', {
              runId,
              accepted: acceptedInRun,
              rejected: rejectedInRun,
              reason: result.reason,
            })
            break
          }
        }
        // deduplicated doesn't count as either
      }

      // Update run with actual enqueued count
      await prisma.scrape_runs.update({
        where: { id: runId },
        data: { urlsAttempted: acceptedInRun },
      })
    }

    // Per spec §8.3: Trigger global pause if >50% of tick was rejected
    const totalAttempted = enqueuedCount + rejectedCount
    if (totalAttempted > 0 && rejectedCount > enqueuedCount) {
      log.warn('High rejection rate in tick - triggering global pause', {
        enqueuedCount,
        rejectedCount,
        rejectionRate: (rejectedCount / totalAttempted * 100).toFixed(1) + '%',
        maxRetryAfterMs,
      })
      triggerGlobalPause(maxRetryAfterMs > 0 ? maxRetryAfterMs : undefined)
    } else {
      // Successful tick without high rejection - clear global backoff
      clearGlobalBackoff()
    }

    log.info('Scheduler tick completed', {
      enqueuedCount,
      rejectedCount,
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

  // Note: Adapters are registered once at harvester startup (in main worker.ts)
  // before either the scrape worker or scheduler starts

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

// =============================================================================
// Maintenance Jobs
// =============================================================================

/** Hours after which a PENDING target is marked STALE (per spec: 24h) */
const STALE_PENDING_HOURS = 24

/** Days after which a BROKEN target is deleted */
const DELETE_BROKEN_AFTER_DAYS = 90

/**
 * Clean up stale and broken URLs.
 *
 * Per scraper-framework-01 spec:
 * - Mark targets with PENDING status for >24h as STALE
 * - Delete targets that have been BROKEN for > 90 days
 *
 * This runs hourly as part of scheduler maintenance.
 */
export async function cleanupStaleUrls(): Promise<{
  markedStale: number
  deletedBroken: number
}> {
  const now = new Date()
  const pendingStaleThreshold = new Date(now.getTime() - STALE_PENDING_HOURS * 60 * 60 * 1000)
  const deleteThreshold = new Date(now.getTime() - DELETE_BROKEN_AFTER_DAYS * 24 * 60 * 60 * 1000)

  let markedStale = 0
  let deletedBroken = 0

  try {
    // Per spec: Mark targets stuck in PENDING status for >24h as STALE
    // This catches targets that were enqueued but never completed
    const staleResult = await prisma.scrape_targets.updateMany({
      where: {
        status: 'ACTIVE',
        lastStatus: { startsWith: 'PENDING' }, // PENDING_MANUAL, PENDING, etc.
        updatedAt: { lt: pendingStaleThreshold },
      },
      data: {
        status: 'STALE',
        lastStatus: 'STALE_TIMEOUT',
        updatedAt: now,
      },
    })
    markedStale = staleResult.count

    if (markedStale > 0) {
      log.info('Marked stale pending targets', { count: markedStale, thresholdHours: STALE_PENDING_HOURS })
    }

    // Delete BROKEN targets older than DELETE_BROKEN_AFTER_DAYS
    const deletedResult = await prisma.scrape_targets.deleteMany({
      where: {
        status: 'BROKEN',
        updatedAt: { lt: deleteThreshold },
      },
    })
    deletedBroken = deletedResult.count

    if (deletedBroken > 0) {
      log.info('Deleted old broken targets', { count: deletedBroken, thresholdDays: DELETE_BROKEN_AFTER_DAYS })
    }
  } catch (error) {
    log.error('Failed to cleanup stale URLs', { error: (error as Error).message })
  }

  return { markedStale, deletedBroken }
}

/** Days between broken URL rechecks */
const RECHECK_BROKEN_AFTER_DAYS = 7

/** Maximum broken URLs to recheck per day */
const MAX_BROKEN_RECHECK_PER_DAY = 50

/**
 * Recheck BROKEN URLs weekly to see if they've recovered.
 *
 * Per scraper-framework-01 spec:
 * - BROKEN URLs should be rechecked weekly in case the issue was temporary
 * - If a recheck succeeds, mark the target as ACTIVE again
 * - Recheck is low priority and limited to avoid overloading
 */
export async function recheckBrokenUrls(): Promise<{
  rechecked: number
  reactivated: number
}> {
  const now = new Date()
  const recheckThreshold = new Date(now.getTime() - RECHECK_BROKEN_AFTER_DAYS * 24 * 60 * 60 * 1000)

  let rechecked = 0
  let reactivated = 0

  try {
    // Find BROKEN targets that haven't been checked in a week
    const brokenTargets = await prisma.scrape_targets.findMany({
      where: {
        status: 'BROKEN',
        updatedAt: { lt: recheckThreshold },
        sources: {
          scrapeEnabled: true,
          robotsCompliant: true,
        },
      },
      select: {
        id: true,
        consecutiveFailures: true,
      },
      orderBy: { updatedAt: 'asc' },
      take: MAX_BROKEN_RECHECK_PER_DAY,
    })

    if (brokenTargets.length === 0) {
      return { rechecked: 0, reactivated: 0 }
    }

    log.info('Rechecking broken targets', { count: brokenTargets.length })

    // Reset BROKEN targets to ACTIVE with reset failure count
    // They'll be picked up by the scheduler and re-tested
    // If they fail again, they'll be marked BROKEN again
    for (const target of brokenTargets) {
      await prisma.scrape_targets.update({
        where: { id: target.id },
        data: {
          status: 'ACTIVE',
          consecutiveFailures: Math.floor(target.consecutiveFailures / 2), // Give partial credit
          lastStatus: 'RECHECK_PENDING',
          updatedAt: now,
        },
      })
      rechecked++
    }

    reactivated = rechecked // All rechecked targets are set to ACTIVE
    log.info('Reactivated broken targets for recheck', { count: reactivated })
  } catch (error) {
    log.error('Failed to recheck broken URLs', { error: (error as Error).message })
  }

  return { rechecked, reactivated }
}

/**
 * Manually trigger a scheduler tick (for testing/admin use).
 */
export async function triggerScrapeSchedulerTick(config?: SchedulerConfig): Promise<void> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config }
  await tick(mergedConfig)
}
