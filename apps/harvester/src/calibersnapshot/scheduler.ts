/**
 * Caliber Market Snapshot Scheduler (ADR-025)
 *
 * Maintains freshness of caliber_market_snapshots via periodic computation
 * using BullMQ repeatable jobs. Default: every 6 hours.
 *
 * Per ADR-001: Only one scheduler instance should run.
 */

import {
  QUEUE_NAMES,
  CaliberSnapshotJobData,
  caliberSnapshotQueue,
  enqueueCaliberSnapshot,
} from '../config/queues'
import { logger } from '../config/logger'

const log = logger.calibersnapshot

// Schedule: every 6 hours (env override available)
const CALIBER_SNAPSHOT_CRON = process.env.CALIBER_SNAPSHOT_CRON || '0 */6 * * *'

let isEnabled = false

/**
 * Start the Caliber Snapshot scheduler
 *
 * IMPORTANT (ADR-001): Only one scheduler instance should run.
 * Enable/disable via Admin Settings — database is single source of truth.
 */
export function startCaliberSnapshotScheduler(): void {
  if (isEnabled) {
    log.warn('CALIBER_SNAPSHOT_SCHEDULER_ALREADY_RUNNING', {
      event_name: 'CALIBER_SNAPSHOT_SCHEDULER_ALREADY_RUNNING',
    })
    return
  }

  log.info('CALIBER_SNAPSHOT_SCHEDULER_START', {
    event_name: 'CALIBER_SNAPSHOT_SCHEDULER_START',
    cronPattern: CALIBER_SNAPSHOT_CRON,
  })

  setupRepeatableJob()
  isEnabled = true
}

/**
 * Set up the repeatable scheduler job
 */
async function setupRepeatableJob(): Promise<void> {
  try {
    // Remove any existing repeatable jobs first
    await removeScheduledSnapshotJobs()

    // Add scheduled snapshot job
    await caliberSnapshotQueue.add(
      'SCHEDULED_CALIBER_SNAPSHOT',
      {
        trigger: 'SCHEDULED',
        triggeredBy: 'scheduler',
        correlationId: 'scheduled',
        windowDays: 30,
      } satisfies CaliberSnapshotJobData,
      {
        repeat: {
          pattern: CALIBER_SNAPSHOT_CRON,
        },
        jobId: 'caliber-snapshot-scheduled',
      }
    )

    log.info('CALIBER_SNAPSHOT_SCHEDULER_REPEATABLE_JOB_CONFIGURED', {
      event_name: 'CALIBER_SNAPSHOT_SCHEDULER_REPEATABLE_JOB_CONFIGURED',
      cronPattern: CALIBER_SNAPSHOT_CRON,
    })
  } catch (error) {
    log.error(
      'CALIBER_SNAPSHOT_SCHEDULER_SETUP_FAILED',
      {
        event_name: 'CALIBER_SNAPSHOT_SCHEDULER_SETUP_FAILED',
        errorMessage: error instanceof Error ? error.message : String(error),
      },
      error instanceof Error ? error : new Error(String(error))
    )
  }
}

async function removeScheduledSnapshotJobs(): Promise<number> {
  const repeatableJobs = await caliberSnapshotQueue.getRepeatableJobs()
  let removedCount = 0

  for (const job of repeatableJobs) {
    if (job.name === 'SCHEDULED_CALIBER_SNAPSHOT') {
      await caliberSnapshotQueue.removeRepeatableByKey(job.key)
      removedCount += 1
    }
  }

  return removedCount
}

/**
 * Stop the Caliber Snapshot scheduler
 */
export async function stopCaliberSnapshotScheduler(): Promise<void> {
  if (!isEnabled) return

  log.info('CALIBER_SNAPSHOT_SCHEDULER_STOP', {
    event_name: 'CALIBER_SNAPSHOT_SCHEDULER_STOP',
  })

  try {
    const removedRepeatableJobs = await removeScheduledSnapshotJobs()
    log.info('CALIBER_SNAPSHOT_SCHEDULER_REPEATABLE_JOBS_REMOVED', {
      event_name: 'CALIBER_SNAPSHOT_SCHEDULER_REPEATABLE_JOBS_REMOVED',
      removedRepeatableJobs,
    })
  } catch (error) {
    log.error(
      'CALIBER_SNAPSHOT_SCHEDULER_STOP_FAILED',
      {
        event_name: 'CALIBER_SNAPSHOT_SCHEDULER_STOP_FAILED',
        errorMessage: error instanceof Error ? error.message : String(error),
      },
      error instanceof Error ? error : new Error(String(error))
    )
  } finally {
    isEnabled = false
  }
}

/**
 * Check if scheduler is running
 */
export function isCaliberSnapshotSchedulerRunning(): boolean {
  return isEnabled
}

/**
 * Get scheduler status
 */
export async function getCaliberSnapshotSchedulerStatus(): Promise<{
  enabled: boolean
  cronPattern: string
  nextRunAt: Date | null
  queuedJobs: number
}> {
  const queueCounts = await caliberSnapshotQueue.getJobCounts()

  let nextRunAt: Date | null = null
  if (isEnabled) {
    const repeatableJobs = await caliberSnapshotQueue.getRepeatableJobs()
    const scheduledJob = repeatableJobs.find((j) => j.name === 'SCHEDULED_CALIBER_SNAPSHOT')
    if (scheduledJob?.next != null) {
      nextRunAt = new Date(scheduledJob.next)
    }
  }

  return {
    enabled: isEnabled,
    cronPattern: CALIBER_SNAPSHOT_CRON,
    nextRunAt,
    queuedJobs: queueCounts.waiting + queueCounts.active,
  }
}

/**
 * Manually trigger a caliber snapshot computation (for admin/testing)
 */
export async function triggerCaliberSnapshotManual(triggeredBy?: string): Promise<string> {
  return enqueueCaliberSnapshot('MANUAL', triggeredBy ?? 'manual', 30)
}
