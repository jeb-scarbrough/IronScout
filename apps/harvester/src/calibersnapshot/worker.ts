/**
 * Caliber Market Snapshot BullMQ Worker (ADR-025)
 *
 * Processes COMPUTE_CALIBER_SNAPSHOTS jobs to precompute caliber-level
 * market statistics. Concurrency: 1 (one job covers all 26 calibers).
 */

import { Worker, Job } from 'bullmq'
import { getSharedBullMQConnection } from '../config/redis'
import { QUEUE_NAMES, CaliberSnapshotJobData } from '../config/queues'
import { logger } from '../config/logger'
import { computeCaliberSnapshots } from './compute'

const log = logger.calibersnapshot

// Metrics
let processedCount = 0
let errorCount = 0
let lastProcessedAt: Date | null = null

/**
 * Caliber Snapshot Worker instance
 * Created lazily by startCaliberSnapshotWorker()
 */
export let caliberSnapshotWorker: Worker<CaliberSnapshotJobData> | null = null

/**
 * Process a single caliber snapshot job
 */
async function processCaliberSnapshotJob(job: Job<CaliberSnapshotJobData>): Promise<void> {
  const { trigger, triggeredBy, correlationId, windowDays } = job.data

  log.info('CALIBER_SNAPSHOT_WORKER_JOB_RECEIVED', {
    event_name: 'CALIBER_SNAPSHOT_WORKER_JOB_RECEIVED',
    jobId: job.id,
    trigger,
    triggeredBy,
    correlationId,
    windowDays,
  })

  try {
    const result = await computeCaliberSnapshots(windowDays, 'v1')

    log.info('CALIBER_SNAPSHOT_WORKER_JOB_DONE', {
      event_name: 'CALIBER_SNAPSHOT_WORKER_JOB_DONE',
      jobId: job.id,
      correlationId,
      calibersProcessed: result.calibersProcessed,
      calibersWithData: result.calibersWithData,
      calibersInsufficient: result.calibersInsufficient,
      totalDurationMs: result.totalDurationMs,
    })
  } catch (error) {
    log.error(
      'CALIBER_SNAPSHOT_JOB_ERROR',
      {
        event_name: 'CALIBER_SNAPSHOT_JOB_ERROR',
        jobId: job.id,
        correlationId,
        trigger,
        errorMessage: error instanceof Error ? error.message : String(error),
      },
      error instanceof Error ? error : new Error(String(error))
    )
    throw error // Re-throw for BullMQ retry
  }
}

/**
 * Start the Caliber Snapshot worker
 */
export async function startCaliberSnapshotWorker(options?: {
  concurrency?: number
}): Promise<Worker<CaliberSnapshotJobData>> {
  const concurrency = options?.concurrency ?? 1

  log.info('CALIBER_SNAPSHOT_WORKER_START', {
    event_name: 'CALIBER_SNAPSHOT_WORKER_START',
    concurrency,
    queueName: QUEUE_NAMES.CALIBER_SNAPSHOT,
  })

  caliberSnapshotWorker = new Worker<CaliberSnapshotJobData>(
    QUEUE_NAMES.CALIBER_SNAPSHOT,
    async (job: Job<CaliberSnapshotJobData>) => {
      return processCaliberSnapshotJob(job)
    },
    {
      connection: getSharedBullMQConnection(),
      concurrency,
    }
  )

  // Event handlers for observability
  caliberSnapshotWorker.on('completed', (job: Job<CaliberSnapshotJobData>) => {
    processedCount++
    lastProcessedAt = new Date()
  })

  caliberSnapshotWorker.on(
    'failed',
    (job: Job<CaliberSnapshotJobData> | undefined, error: Error) => {
      errorCount++
      log.error(
        'CALIBER_SNAPSHOT_WORKER_JOB_FAILED',
        {
          event_name: 'CALIBER_SNAPSHOT_WORKER_JOB_FAILED',
          jobId: job?.id,
          trigger: job?.data?.trigger,
          correlationId: job?.data?.correlationId,
          errorMessage: error.message,
          errorCount,
        },
        error
      )
    }
  )

  caliberSnapshotWorker.on('error', (error: Error) => {
    log.warn('CALIBER_SNAPSHOT_WORKER_ERROR', {
      event_name: 'CALIBER_SNAPSHOT_WORKER_ERROR',
      errorMessage: error.message,
    })
  })

  return caliberSnapshotWorker
}

/**
 * Stop the Caliber Snapshot worker gracefully
 */
export async function stopCaliberSnapshotWorker(): Promise<void> {
  if (caliberSnapshotWorker) {
    log.info('CALIBER_SNAPSHOT_WORKER_STOPPING', {
      event_name: 'CALIBER_SNAPSHOT_WORKER_STOPPING',
      processedCount,
      errorCount,
    })
    await caliberSnapshotWorker.close()
    caliberSnapshotWorker = null
  }
}

/**
 * Get worker metrics
 */
export function getCaliberSnapshotWorkerMetrics() {
  return {
    processedCount,
    errorCount,
    lastProcessedAt,
  }
}
