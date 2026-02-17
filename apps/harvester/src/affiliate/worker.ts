/**
 * Affiliate Feed Worker
 *
 * BullMQ worker that processes affiliate feed jobs.
 * Orchestrates: Lock → Download → Parse → Process → Circuit Breaker → Finalize
 *
 * Per spec Section 8: Two-phase processing with circuit breaker protection.
 */

import { Worker, Job } from 'bullmq'
import { randomUUID } from 'crypto'
import { createId } from '@paralleldrive/cuid2'
import { prisma, Prisma, isCircuitBreakerBypassed, assertCuidFormat } from '@ironscout/db'
import { getSharedBullMQConnection } from '../config/redis'
import {
  QUEUE_NAMES,
  AffiliateFeedJobData,
} from '../config/queues'
import { logger } from '../config/logger'
import { createWorkflowLogger } from '../config/structured-log'
import { createRunFileLogger, createDualLogger, type RunFileLogger } from '../config/run-file-logger'
import {
  createTraceContext,
  extendTraceContext,
  traceLogFields,
  withTrace,
  TRACE_REASON_CODES,
} from '../config/trace'
import {
  notifyAffiliateFeedRunFailed,
  notifyCircuitBreakerTriggered,
  notifyAffiliateFeedAutoDisabled,
  notifyAffiliateFeedRecovered,
  notifyDataQualityWarning,
} from '@ironscout/notifications'
import { acquireFeedLock, startLockRenewal, stopLockRenewal } from './lock'
import type { FeedLockHandle } from './lock'
import { downloadFeed } from './fetcher'
import { parseFeed } from './parser'
import { processProducts } from './processor'
import { evaluateCircuitBreaker, promoteProducts, copySeenFromPreviousRun } from './circuit-breaker'
import { AffiliateFeedError, FAILURE_KIND, ERROR_CODES } from './types'
import type { FeedRunContext, RunStatus, FailureKind, ErrorCode } from './types'

const baseLogger = logger.affiliate
const moduleLog = createWorkflowLogger(baseLogger, {
  workflow: 'affiliate',
  stage: 'worker',
  traceId: 'affiliate-worker',
  executionId: 'affiliate-worker',
  sourceId: 'unknown',
})

// Maximum consecutive failures before auto-disable
const MAX_CONSECUTIVE_FAILURES = 3

// Missing-brand threshold for data quality alerts (env-configurable)
const _mbRaw = Number(process.env.MISSING_BRAND_THRESHOLD_PERCENT ?? 10)
const MISSING_BRAND_THRESHOLD_PERCENT = Number.isFinite(_mbRaw) ? _mbRaw : 10
// Minimum products to consider for threshold alerting (avoid noise on small/partial runs)
const MIN_PRODUCTS_FOR_QUALITY_ALERT = 50

function isCuidFormat(value: string): boolean {
  try {
    assertCuidFormat(value, 'affiliateFeedRun.id')
    return true
  } catch {
    return false
  }
}

/**
 * Create and start the affiliate feed worker
 */
export function createAffiliateFeedWorker() {
  const worker = new Worker<AffiliateFeedJobData>(
    QUEUE_NAMES.AFFILIATE_FEED,
    async (job: Job<AffiliateFeedJobData>) => {
      return processAffiliateFeedJob(job)
    },
    {
      connection: getSharedBullMQConnection(),
      concurrency: 2, // Process up to 2 feeds concurrently (limited by SFTP server connection limit)
      limiter: {
        max: 10,
        duration: 60000, // 10 jobs per minute max
      },
    }
  )

  worker.on('completed', (job) => {
    moduleLog.info('Affiliate feed job completed', { jobId: job.id, feedId: job.data.feedId })
  })

  worker.on('failed', (job, error) => {
    moduleLog.error('Affiliate feed job failed', { jobId: job?.id, feedId: job?.data.feedId }, error)
  })

  moduleLog.info('Affiliate feed worker started')

  return worker
}

/**
 * Main job processor
 *
 * Per spec §6.4.1: Run Record Creation Invariant
 * On first attempt, these steps MUST complete atomically before any throwable I/O:
 * 1. Acquire feed lock
 * 2. Create run record
 * 3. Call job.updateData({ runId })
 *
 * On retry (runId in job.data): Reuse existing run record.
 */
async function processAffiliateFeedJob(job: Job<AffiliateFeedJobData>): Promise<void> {
  const initialTrace = createTraceContext({
    executionId: job.data.runId ?? `job-${String(job.id ?? 'unknown')}`,
    runId: job.data.runId,
    sourceId: 'unknown',
    feedId: job.data.feedId,
    jobId: job.id ? String(job.id) : undefined,
    stage: 'affiliate.worker',
    step: 'job.start',
    attempt: job.attemptsMade + 1,
    retryCount: job.attemptsMade,
  })

  return withTrace(initialTrace, async () => {
    const { feedId, trigger, runId: existingRunId } = job.data
    const t0 = new Date()
    const jobStartedAt = t0.toISOString()
    let trace = initialTrace

    // Start with module logger, will be replaced with dual logger after run is created
    let log = moduleLog.child(traceLogFields(trace))

    log.info('AFFILIATE_JOB_START', {
      feedId,
      trigger,
      jobId: job.id,
      startedAt: jobStartedAt,
      attemptsMade: job.attemptsMade,
      isRetry: !!existingRunId,
      workerPid: process.pid,
    })

    log.debug('Job data received', {
      feedId,
      trigger,
      existingRunId: existingRunId || null,
      jobAttempts: job.attemptsMade,
      maxAttempts: job.opts?.attempts,
    })

    // Load feed configuration
    log.debug('Loading feed configuration', { feedId })
    const feedLoadStart = Date.now()
    const feed = await prisma.affiliate_feeds.findUnique({
      where: { id: feedId },
      include: { sources: { include: { retailers: true } } },
    })
    log.debug('Feed configuration loaded', {
      feedId,
      found: !!feed,
      loadTimeMs: Date.now() - feedLoadStart,
    })

    if (!feed) {
      log.error('Feed not found - aborting job', { feedId })
      throw new Error(`Feed not found: ${feedId}`)
    }

    trace = extendTraceContext(trace, {
      sourceId: feed.sourceId,
      feedId: feed.id,
      retailerId: feed.sources.retailerId,
      step: 'feed.loaded',
    })
    log = log.child(traceLogFields(trace))

    // Log feed configuration details
    log.debug('Feed configuration details', {
      feedId,
      sourceName: feed.sources.name,
      retailerName: feed.sources.retailers?.name,
      status: feed.status,
      transport: feed.transport,
      format: feed.format,
      network: feed.network,
      expiryHours: feed.expiryHours,
      scheduleFrequencyHours: feed.scheduleFrequencyHours,
      maxRowCount: feed.maxRowCount,
      consecutiveFailures: feed.consecutiveFailures,
      manualRunPending: feed.manualRunPending,
      lastRunAt: feed.lastRunAt?.toISOString(),
      lastContentHash: feed.lastContentHash?.slice(0, 16),
    })

    // Check eligibility
    if (feed.status === 'DRAFT') {
      log.warn('Skipping draft feed - not yet activated', {
        feedId,
        sourceName: feed.sources.name,
        retailerName: feed.sources.retailers?.name,
        decision: 'SKIP',
        reason: 'DRAFT_STATUS',
        reasonCode: TRACE_REASON_CODES.DRAFT_STATUS,
      })
      log.info('AFFILIATE_JOB_END', {
        feedId,
        trigger,
        jobId: job.id,
        startedAt: jobStartedAt,
        endedAt: new Date().toISOString(),
        durationMs: Date.now() - t0.getTime(),
        status: 'skipped',
        skipReason: 'DRAFT_STATUS',
      })
      return
    }

    if (feed.status === 'DISABLED' && trigger !== 'MANUAL' && trigger !== 'ADMIN_TEST') {
      log.warn('Skipping disabled feed - only manual/admin triggers allowed', {
        feedId,
        sourceName: feed.sources.name,
        retailerName: feed.sources.retailers?.name,
        trigger,
        decision: 'SKIP',
        reason: 'DISABLED_STATUS',
        reasonCode: TRACE_REASON_CODES.DISABLED_STATUS,
      })
      log.info('AFFILIATE_JOB_END', {
        feedId,
        trigger,
        jobId: job.id,
        startedAt: jobStartedAt,
        endedAt: new Date().toISOString(),
        durationMs: Date.now() - t0.getTime(),
        status: 'skipped',
        skipReason: 'DISABLED_STATUS',
      })
      return
    }

    log.debug('Feed eligibility check passed', {
      feedId,
      status: feed.status,
      trigger,
      decision: 'PROCEED',
    })

    // ═══════════════════════════════════════════════════════════════════════════
    // LOCK ACQUISITION + RUN RECORD CREATION
    // Per spec §6.4.1: These steps must be atomic with job.updateData()
    // ═══════════════════════════════════════════════════════════════════════════
    let run: Awaited<ReturnType<typeof prisma.affiliate_feed_runs.findUniqueOrThrow>> | null = null
    let feedLock: FeedLockHandle | null = null
    let runFileLogger: RunFileLogger | null = null

    try {
      if (existingRunId) {
      // ═══════════════════════════════════════════════════════════════════════
      // RETRY PATH: Reuse existing run record
      // Per spec §6.4.1: runId in job.data means we already created a run
      // ═══════════════════════════════════════════════════════════════════════
      log.debug('Retry: reusing existing run', { runId: existingRunId, feedId })

      run = await prisma.affiliate_feed_runs.findUniqueOrThrow({
        where: { id: existingRunId },
      })

      // Guard for orphaned/mismatched runs (invariant violation)
      if (run.status !== 'RUNNING') {
        log.error('RUN_STATUS_MISMATCH', {
          runId: existingRunId,
          expectedStatus: 'RUNNING',
          actualStatus: run.status,
          feedId,
          feedName: feed.sources.name,
          reasonCode: TRACE_REASON_CODES.RUN_STATUS_MISMATCH,
          message: 'Retry found run not in RUNNING status - potential duplicate or stale retry',
        })
        log.info('AFFILIATE_JOB_END', {
          feedId,
          trigger,
          jobId: job.id,
          runId: existingRunId,
          startedAt: jobStartedAt,
          endedAt: new Date().toISOString(),
          durationMs: Date.now() - t0.getTime(),
          status: 'skipped',
          skipReason: 'RUN_STATUS_MISMATCH',
        })
        return
      }

        // Re-acquire lock (may have expired on previous failure)
        feedLock = await acquireFeedLock(feedId)
        if (!feedLock) {
        log.warn('RETRY_LOCK_CONFLICT', {
          runId: existingRunId,
          feedId,
          feedName: feed.sources.name,
          reasonCode: TRACE_REASON_CODES.RETRY_LOCK_CONFLICT,
          message: 'Another run started - this retry is obsolete',
        })
        log.info('AFFILIATE_JOB_END', {
          feedId,
          trigger,
          jobId: job.id,
          runId: existingRunId,
          startedAt: jobStartedAt,
          endedAt: new Date().toISOString(),
          durationMs: Date.now() - t0.getTime(),
          status: 'skipped',
          skipReason: 'RETRY_LOCK_CONFLICT',
        })
          return
        }
        startLockRenewal(feedLock)
      } else {
      // ═══════════════════════════════════════════════════════════════════════
      // FIRST ATTEMPT: Atomic lock acquisition + run creation + updateData
      // Per spec §6.4.1: No throwable operations between these three steps
      // ═══════════════════════════════════════════════════════════════════════
        feedLock = await acquireFeedLock(feedId)

        if (!feedLock) {
          if (trigger === 'MANUAL' || trigger === 'MANUAL_PENDING') {
            log.debug('MANUAL_RUN_DEFERRED', {
              feedId,
              reasonCode: TRACE_REASON_CODES.LOCK_BUSY,
            })
          } else {
            log.debug('SKIPPED_LOCK_BUSY', {
              feedId,
              trigger,
              reasonCode: TRACE_REASON_CODES.LOCK_BUSY,
            })
          }
          log.info('AFFILIATE_JOB_END', {
            feedId,
            trigger,
            jobId: job.id,
            startedAt: jobStartedAt,
            endedAt: new Date().toISOString(),
            durationMs: Date.now() - t0.getTime(),
            status: 'skipped',
            skipReason: 'LOCK_BUSY',
          })
          return
        }
        startLockRenewal(feedLock)

        log.debug('FEED_LOCK_ACQUIRED', { feedId })

      const recentRunCutoff = new Date(t0.getTime() - 10 * 60 * 1000) // 10 minutes ago
      const orphanedRun = await prisma.affiliate_feed_runs.findFirst({
        where: {
          feedId,
          trigger,
          status: 'RUNNING',
          startedAt: { gte: recentRunCutoff },
        },
        orderBy: { startedAt: 'desc' },
      })

      if (orphanedRun && isCuidFormat(orphanedRun.id)) {
        log.warn('ORPHANED_RUN_RECOVERY', {
          feedId,
          trigger,
          orphanedRunId: orphanedRun.id,
          orphanedRunStartedAt: orphanedRun.startedAt.toISOString(),
          message: 'Found RUNNING run from recent failed attempt - reusing instead of creating duplicate',
        })
        run = orphanedRun
      } else {
        if (orphanedRun) {
          log.warn('ORPHANED_RUN_RECOVERY_SKIPPED_NON_CUID', {
            feedId,
            trigger,
            orphanedRunId: orphanedRun.id,
            orphanedRunStartedAt: orphanedRun.startedAt.toISOString(),
            message: 'Found RUNNING run with legacy non-cuid ID - creating a new run instead of reusing',
          })
        }

        run = await prisma.affiliate_feed_runs.create({
          data: {
            id: createId(),
            feedId,
            sourceId: feed.sourceId,
            trigger,
            status: 'RUNNING',
            startedAt: t0,
          },
        })
      }

        await job.updateData({
          ...job.data,
          runId: run.id,
        })

        // Clear pending intent once the manual run is fully established.
        // If this conditional update does not match, keep the flag true
        // and let the scheduler retry a follow-up enqueue safely.
        if (trigger === 'MANUAL' || trigger === 'MANUAL_PENDING') {
          try {
            const cleared = await prisma.affiliate_feeds.updateMany({
              where: {
                id: feedId,
                manualRunPending: true,
                updatedAt: feed.updatedAt,
              },
              data: { manualRunPending: false },
            })
            log.debug('MANUAL_RUN_PENDING_CLEARED', {
              feedId,
              trigger,
              runId: run.id,
              cleared: cleared.count > 0,
            })
          } catch (error) {
            log.warn('MANUAL_RUN_PENDING_CLEAR_FAILED', {
              feedId,
              trigger,
              runId: run.id,
              error: error instanceof Error ? error.message : String(error),
            }, error as Error)
          }
        }

        log.info('RUN_START', {
          runId: run.id,
          feedId,
          sourceName: feed.sources.name,
          retailerName: feed.sources.retailers?.name,
          trigger,
          workerPid: process.pid,
        })
      }

      if (!feedLock || !run) {
        throw new Error('Invariant violation: lock/run not initialized')
      }

    const retailerName = feed.sources.retailers?.name
    runFileLogger = createRunFileLogger({
      type: 'affiliate',
      retailerName: retailerName || feed.sources.name,
      runId: run.id,
      feedId: feed.id,
    })

    trace = extendTraceContext(trace, {
      runId: run.id,
      executionId: run.id,
      step: 'run.created',
      attempt: job.attemptsMade + 1,
      retryCount: job.attemptsMade,
    })

    log = createWorkflowLogger(createDualLogger(baseLogger, runFileLogger), {
      workflow: 'affiliate',
      stage: 'worker',
      runId: run.id,
      sourceId: feed.sourceId,
      retailerId: feed.sources.retailerId,
      feedId: feed.id,
      ...traceLogFields(trace),
    })
    log.debug('File logger created', { filePath: runFileLogger.filePath })

    const context: FeedRunContext = {
      feed,
      run,
      t0,
      runObservedAt: run.startedAt, // Stable across retries — used for prices.observedAt dedupe (#218)
      sourceId: feed.sourceId,
      retailerId: feed.sources.retailerId,
      trace,
    }

    try {
    // Phase 1: Download → Parse → Process
    log.debug('Starting Phase 1: Download → Parse → Process', {
      feedId: feed.id,
      runId: run.id,
      sourceName: feed.sources.name,
    })
    const phase1Start = Date.now()
    const result = await executePhase1(context, log)
    const phase1Duration = Date.now() - phase1Start

    log.info('PHASE1_OK', {
      feedId: feed.id,
      runId: run.id,
      durationMs: phase1Duration,
      skipped: result.skipped,
      skippedReason: result.skippedReason,
      metrics: result.skipped ? null : result.metrics,
    })

    if (result.skipped) {
      const shouldRefreshFromPreviousRun =
        result.skippedReason === 'UNCHANGED_HASH' || result.skippedReason === 'UNCHANGED_MTIME'
      if (shouldRefreshFromPreviousRun) {
        const previousRun = await prisma.affiliate_feed_runs.findFirst({
          where: {
            feedId: feed.id,
            status: 'SUCCEEDED',
            ignoredAt: null,
            id: { not: run.id },
          },
          orderBy: [{ finishedAt: 'desc' }, { startedAt: 'desc' }],
          select: {
            id: true,
            productsUpserted: true,
            productsRejected: true,
            duplicateKeyCount: true,
            urlHashFallbackCount: true,
          },
        })

        if (previousRun) {
          const copiedCount = await copySeenFromPreviousRun(previousRun.id, run.id, t0)
          if (copiedCount > 0) {
            log.info('AFFILIATE_REFRESH_FROM_PREVIOUS_RUN', {
              feedId: feed.id,
              runId: run.id,
              previousRunId: previousRun.id,
              copiedCount,
              skippedReason: result.skippedReason,
            })

            const refreshPhase1: Phase1Result = {
              skipped: false,
              metrics: {
                downloadBytes: 0,
                rowsRead: 0,
                rowsParsed: 0,
                productsUpserted: copiedCount,
                pricesWritten: 0,
                productsRejected: previousRun.productsRejected ?? 0,
                duplicateKeyCount: previousRun.duplicateKeyCount ?? 0,
                urlHashFallbackCount: previousRun.urlHashFallbackCount ?? 0,
                dedupeFallbackToValid: 0,
                errorCount: 0,
              },
            }

            const phase2Result = await executePhase2(context, refreshPhase1, log)

            await finalizeRun(context, 'SUCCEEDED', {
              ...refreshPhase1.metrics,
              productsPromoted: phase2Result.productsPromoted,
              skippedReason: 'REFRESHED_FROM_PREVIOUS',
            }, log)

            return
          }

          log.warn('AFFILIATE_REFRESH_NO_SEEN_ROWS', {
            feedId: feed.id,
            feedName: feed.sources.name,
            runId: run.id,
            previousRunId: previousRun.id,
            skippedReason: result.skippedReason,
          })
        } else {
          log.warn('AFFILIATE_REFRESH_NO_PREVIOUS_RUN', {
            feedId: feed.id,
            feedName: feed.sources.name,
            runId: run.id,
            skippedReason: result.skippedReason,
          })
        }
      }

      // Per spec Q8.2.3: Use SUCCEEDED + skippedReason, not separate SKIPPED status
      // FILE_NOT_FOUND gets WARN level for visibility; others get DEBUG
      if (result.skippedReason === 'FILE_NOT_FOUND') {
        log.warn('RUN_SKIPPED_FILE_NOT_FOUND', {
          feedId: feed.id,
          runId: run.id,
          feedName: feed.sources.name,
          network: feed.network,
          skippedReason: result.skippedReason,
          reasonCode: TRACE_REASON_CODES.FILE_NOT_FOUND,
          decision: 'File not found - expected condition, will retry next schedule',
        })
      } else {
        log.debug('Run skipped - finalizing with SUCCEEDED status', {
          feedId: feed.id,
          runId: run.id,
          skippedReason: result.skippedReason,
          reasonCode: result.skippedReason,
          decision: 'SKIP_UNCHANGED',
        })
      }
      await finalizeRun(context, 'SUCCEEDED', { skippedReason: result.skippedReason }, log)
    } else {
      // Phase 2: Circuit Breaker → Promote
      log.debug('Starting Phase 2: Circuit Breaker → Promote', {
        feedId: feed.id,
        runId: run.id,
        productsToEvaluate: result.metrics.productsUpserted,
      })
      const phase2Start = Date.now()
      const phase2Result = await executePhase2(context, result, log)
      const phase2Duration = Date.now() - phase2Start

      log.info('PHASE2_OK', {
        feedId: feed.id,
        runId: run.id,
        durationMs: phase2Duration,
        productsPromoted: phase2Result.productsPromoted,
        circuitBreakerBlocked: phase2Result.circuitBreakerBlocked,
      })

      // Check for processing failure
      const isProcessingFailure =
        result.metrics.rowsRead > 0 && result.metrics.productsUpserted === 0

      if (isProcessingFailure) {
        const failureReason =
          result.metrics.rowsParsed === 0
            ? `All ${result.metrics.rowsRead} rows failed validation (check CSV column names)`
            : `All ${result.metrics.rowsParsed} validated products failed to upsert`

        log.error('Processing failure detected - no products saved', {
          feedId: feed.id,
          feedName: feed.sources.name,
          runId: run.id,
          rowsRead: result.metrics.rowsRead,
          rowsParsed: result.metrics.rowsParsed,
          productsUpserted: result.metrics.productsUpserted,
          productsRejected: result.metrics.productsRejected,
          errorCount: result.metrics.errorCount,
          failureReason,
        })
        await finalizeRun(context, 'FAILED', {
          ...result.metrics,
          productsPromoted: phase2Result.productsPromoted,
          failureKind: 'PROCESSING_ERROR',
          failureCode: result.metrics.rowsParsed === 0 ? 'VALIDATION_FAILURE' : 'UPSERT_FAILURE',
          errorMessage: failureReason,
        }, log)
      } else {
        log.info('Run SUCCEEDED', {
          totalDurationMs: phase1Duration + phase2Duration,
          rowsRead: result.metrics.rowsRead,
          rowsParsed: result.metrics.rowsParsed,
          productsUpserted: result.metrics.productsUpserted,
          productsPromoted: phase2Result.productsPromoted,
          pricesWritten: result.metrics.pricesWritten,
        })
        await finalizeRun(context, 'SUCCEEDED', {
          ...result.metrics,
          productsPromoted: phase2Result.productsPromoted,
          changeDetection: result.changeDetection,
        }, log)
      }
    }
    } catch (error) {
      const correlationId = randomUUID()
      const feedError = classifyError(error)
      const attemptsConfigured =
        typeof job.opts?.attempts === 'number' && job.opts.attempts > 0 ? job.opts.attempts : 1
      const currentAttempt = job.attemptsMade + 1
      const willRetry = feedError.retryable && currentAttempt < attemptsConfigured

      log.error('Affiliate feed processing failed', {
        correlationId,
        feedId,
        feedName: feed?.sources?.name,
        runId: run.id,
        failureKind: feedError.kind,
        failureCode: feedError.code,
        retryable: feedError.retryable,
        errorMessage: feedError.message,
      }, error as Error)

      log.warn('RETRY_DECISION', {
        runId: run.id,
        feedId,
        currentAttempt,
        attemptsConfigured,
        retryable: feedError.retryable,
        willRetry,
        reasonCode: willRetry ? TRACE_REASON_CODES.RETRY_TRANSIENT : TRACE_REASON_CODES.RETRY_PERMANENT,
      })

      await finalizeRun(context, 'FAILED', {
        correlationId,
        errorMessage: feedError.message,
        failureKind: feedError.kind,
        failureCode: feedError.code,
      }, log)

      if (!feedError.retryable) {
        log.warn('Discarding non-retryable job', {
          correlationId,
          feedId,
          feedName: feed?.sources?.name,
          runId: run.id,
          failureKind: feedError.kind,
          failureCode: feedError.code,
        })
        await job.discard()
      }

      log.info('AFFILIATE_JOB_END', {
        feedId,
        trigger,
        jobId: job.id,
        runId: run.id,
        startedAt: jobStartedAt,
        endedAt: new Date().toISOString(),
        durationMs: Date.now() - t0.getTime(),
        status: 'failed',
        failureKind: feedError.kind,
        failureCode: feedError.code,
        retryable: feedError.retryable,
        correlationId,
      })

      throw error
    }

    moduleLog.info('AFFILIATE_JOB_END', {
      feedId,
      trigger,
      jobId: job.id,
      runId: run?.id,
      startedAt: jobStartedAt,
      endedAt: new Date().toISOString(),
      durationMs: Date.now() - t0.getTime(),
      status: 'completed',
      workerPid: process.pid,
      ...traceLogFields(trace),
    })
    } finally {
      if (feedLock) {
        stopLockRenewal(feedLock)
        await feedLock.release()
        log.debug('FEED_LOCK_RELEASED', { feedId, runId: run?.id })
      }

      if (runFileLogger) {
        await runFileLogger.close().catch((err) => {
          moduleLog.warn('Failed to close run file logger', { runId: run?.id }, err)
        })
      }
    }
  })
}

interface Phase1Result {
  skipped: boolean
  skippedReason?: string
  metrics: {
    downloadBytes: number
    rowsRead: number
    rowsParsed: number
    productsUpserted: number
    pricesWritten: number
    productsRejected: number
    duplicateKeyCount: number
    urlHashFallbackCount: number
    dedupeFallbackToValid: number
    errorCount: number
    dataQuality?: import('./types').DataQualityMetrics
  }
  changeDetection?: {
    mtime: Date | null
    size: bigint
    contentHash: string
  }
}

/**
 * Phase 1: Download → Parse → Process (update lastSeenAt)
 */
async function executePhase1(context: FeedRunContext, log: typeof moduleLog): Promise<Phase1Result> {
  const { feed, run, trace } = context

  log.info('Downloading feed', { feedId: feed.id, runId: run.id })
  const downloadResult = await downloadFeed(feed, {
    runId: run.id,
    executionId: trace.executionId,
    traceId: trace.traceId,
    sourceId: context.sourceId,
    retailerId: feed.sources.retailerId,
    jobId: trace.jobId,
    attempt: trace.attempt,
  })

  if (downloadResult.skipped) {
    return {
      skipped: true,
      skippedReason: downloadResult.skippedReason,
      metrics: {
        downloadBytes: 0, rowsRead: 0, rowsParsed: 0, productsUpserted: 0,
        pricesWritten: 0, productsRejected: 0, duplicateKeyCount: 0,
        urlHashFallbackCount: 0, dedupeFallbackToValid: 0, errorCount: 0,
      },
    }
  }

  log.info('Parsing feed', { feedId: feed.id, bytes: downloadResult.content.length })
  if (feed.format !== 'CSV') {
    throw new Error(`Unsupported format: ${feed.format}. Only CSV is supported in v1.`)
  }
  const parseResult = await parseFeed(
    downloadResult.content.toString('utf-8'),
    feed.format,
    feed.maxRowCount || 500000,
    feed.id,
    {
      runId: run.id,
      executionId: trace.executionId,
      traceId: trace.traceId,
      sourceId: feed.sourceId,
      retailerId: feed.sources.retailerId,
      jobId: trace.jobId,
      attempt: trace.attempt,
    }
  )
  log.debug('Parse complete', { rowsRead: parseResult.rowsRead, rowsParsed: parseResult.rowsParsed })

  if (parseResult.errors.length > 0) {
    log.debug('Recording parse errors', { count: parseResult.errors.length })
    await prisma.affiliate_feed_run_errors.createMany({
      data: parseResult.errors.slice(0, 100).map((err) => ({
        id: randomUUID(),
        runId: run.id,
        code: err.code,
        message: err.message,
        rowNumber: err.rowNumber,
        sample: err.sample as Prisma.InputJsonValue,
      })),
    })
  }

  log.info('Processing products', { feedId: feed.id, count: parseResult.products.length })
  const processResult = await processProducts(context, parseResult.products)

  log.info('PHASE1_PROCESS_OK', {
    feedId: feed.id,
    productsUpserted: processResult.productsUpserted,
    pricesWritten: processResult.pricesWritten,
    productsRejected: processResult.productsRejected,
    errorCount: parseResult.errors.length + processResult.errors.length,
    dedupeFallbackToValid: processResult.dedupeFallbackToValid ?? 0,
  })

  if (processResult.errors.length > 0) {
    await prisma.affiliate_feed_run_errors.createMany({
      data: processResult.errors.slice(0, 100).map((err) => ({
        id: randomUUID(),
        runId: run.id,
        code: err.code,
        message: err.message,
        rowNumber: err.rowNumber,
        sample: err.sample as Prisma.InputJsonValue,
      })),
    })
  }

  return {
    skipped: false,
    metrics: {
      downloadBytes: downloadResult.content.length,
      rowsRead: parseResult.rowsRead,
      rowsParsed: parseResult.rowsParsed,
      productsUpserted: processResult.productsUpserted,
      pricesWritten: processResult.pricesWritten,
      productsRejected: processResult.productsRejected,
      duplicateKeyCount: processResult.duplicateKeyCount,
      urlHashFallbackCount: processResult.urlHashFallbackCount,
      dedupeFallbackToValid: processResult.dedupeFallbackToValid ?? 0,
      errorCount: parseResult.errors.length + processResult.errors.length,
      dataQuality: processResult.qualityMetrics,
    },
    changeDetection: {
      mtime: downloadResult.mtime,
      size: downloadResult.size,
      contentHash: downloadResult.contentHash,
    },
  }
}

interface Phase2Result {
  productsPromoted: number
  circuitBreakerBlocked: boolean
}

/**
 * Phase 2: Circuit Breaker → Promote (update lastSeenSuccessAt)
 */
async function executePhase2(
  context: FeedRunContext,
  phase1Result: Phase1Result,
  log: typeof moduleLog
): Promise<Phase2Result> {
  const { feed, run, t0 } = context

  const bypassCircuitBreaker = await isCircuitBreakerBypassed()
  if (bypassCircuitBreaker) {
    log.warn('Circuit breaker BYPASSED globally', { feedId: feed.id, feedName: feed.sources.name, runId: run.id })
  }

  log.info('Evaluating circuit breaker', { feedId: feed.id, runId: run.id })
  const cbResult = bypassCircuitBreaker
    ? { passed: true, metrics: { activeCountBefore: 0, seenSuccessCount: 0, wouldExpireCount: 0, urlHashFallbackCount: phase1Result.metrics.urlHashFallbackCount, expiryPercentage: 0 } }
    : await evaluateCircuitBreaker(
        run.id, feed.id, feed.expiryHours, t0,
        phase1Result.metrics.urlHashFallbackCount,
        phase1Result.metrics.productsUpserted
      )

  await prisma.affiliate_feed_runs.update({
    where: { id: run.id },
    data: {
      activeCountBefore: cbResult.metrics.activeCountBefore,
      seenSuccessCount: cbResult.metrics.seenSuccessCount,
      wouldExpireCount: cbResult.metrics.wouldExpireCount,
      urlHashFallbackCount: cbResult.metrics.urlHashFallbackCount,
    },
  })

  if (!cbResult.passed) {
    log.warn('Circuit breaker triggered', {
      feedId: feed.id, feedName: feed.sources.name, runId: run.id, reason: cbResult.reason, metrics: cbResult.metrics,
    })
    await prisma.affiliate_feed_runs.update({
      where: { id: run.id },
      data: { expiryBlocked: true, expiryBlockedReason: cbResult.reason },
    })
    notifyCircuitBreakerTriggered(
      { feedId: feed.id, feedName: feed.sources.name, sourceId: feed.sourceId,
        sourceName: feed.sources.name, retailerName: feed.sources.retailers?.name,
        network: feed.network, runId: run.id },
      cbResult.reason!, cbResult.metrics
    ).catch((err) => moduleLog.error('Failed to send circuit breaker notification', {}, err))
    return { productsPromoted: 0, circuitBreakerBlocked: true }
  }

  log.info('Promoting products', { feedId: feed.id, runId: run.id })
  const productsPromoted = await promoteProducts(run.id, t0)
  log.info('Promotion complete', { feedId: feed.id, productsPromoted })

  return { productsPromoted, circuitBreakerBlocked: false }
}

/**
 * Finalize run and update feed status
 */
async function finalizeRun(
  context: FeedRunContext,
  status: RunStatus,
  metrics: Record<string, unknown>,
  log: typeof moduleLog
): Promise<void> {
  const { feed, run, t0 } = context
  const finishedAt = new Date()
  const durationMs = finishedAt.getTime() - t0.getTime()

  await prisma.affiliate_feed_runs.update({
    where: { id: run.id },
    data: {
      status, finishedAt, durationMs,
      downloadBytes: metrics.downloadBytes as bigint | undefined,
      rowsRead: metrics.rowsRead as number | undefined,
      rowsParsed: metrics.rowsParsed as number | undefined,
      productsUpserted: metrics.productsUpserted as number | undefined,
      pricesWritten: metrics.pricesWritten as number | undefined,
      productsPromoted: metrics.productsPromoted as number | undefined,
      productsRejected: metrics.productsRejected as number | undefined,
      duplicateKeyCount: metrics.duplicateKeyCount as number | undefined,
      urlHashFallbackCount: metrics.urlHashFallbackCount as number | undefined,
      errorCount: metrics.errorCount as number | undefined,
      skippedReason: metrics.skippedReason as string | undefined,
      failureKind: metrics.failureKind as string | undefined,
      failureCode: metrics.failureCode as string | undefined,
      failureMessage: metrics.errorMessage as string | undefined,
      correlationId: metrics.correlationId as string | undefined,
      isPartial: (metrics.errorCount as number) > 0 && (metrics.productsUpserted as number) > 0,
      dataQuality: metrics.dataQuality
        ? (metrics.dataQuality as unknown as Prisma.InputJsonValue)
        : Prisma.DbNull,
    },
  })

  const updateData: Record<string, unknown> = { lastRunAt: finishedAt }

  if (status === 'SUCCEEDED') {
    const wasRecovery = feed.consecutiveFailures > 0 && !metrics.skippedReason
    updateData.consecutiveFailures = 0
    // Note: nextRunAt is managed by the scheduler when claiming the feed.
    // We don't update it here to preserve the configured schedule offset.
    // This ensures feeds run at consistent times (e.g., every 6h at X:30).
    const changeDetection = metrics.changeDetection as { mtime: Date | null; size: bigint; contentHash: string } | undefined
    if (changeDetection) {
      updateData.lastRemoteMtime = changeDetection.mtime
      updateData.lastRemoteSize = changeDetection.size
      updateData.lastContentHash = changeDetection.contentHash
    }
    if (wasRecovery) {
      notifyAffiliateFeedRecovered(
        { feedId: feed.id, feedName: feed.sources.name, sourceId: feed.sourceId,
          sourceName: feed.sources.name, retailerName: feed.sources.retailers?.name,
          network: feed.network, runId: run.id },
        { productsProcessed: (metrics.productsUpserted as number) || 0,
          productsPromoted: (metrics.productsPromoted as number) || 0,
          pricesWritten: (metrics.pricesWritten as number) || 0, durationMs }
      ).catch((err) => moduleLog.error('Failed to send recovery notification', {}, err))
    }

    // Data quality alert: crossing-threshold for missing brand rate
    const dq = metrics.dataQuality as import('./types').DataQualityMetrics | undefined
    const upserted = metrics.productsUpserted as number | undefined
    if (dq && upserted && upserted >= MIN_PRODUCTS_FOR_QUALITY_ALERT) {
      const currentRate = (dq.missingBrand / upserted) * 100
      if (currentRate >= MISSING_BRAND_THRESHOLD_PERCENT) {
        // Query previous successful run to check crossing-threshold
        const prevRun = await prisma.affiliate_feed_runs.findFirst({
          where: {
            feedId: feed.id,
            id: { not: run.id },
            status: 'SUCCEEDED',
          },
          orderBy: { startedAt: 'desc' },
          select: { dataQuality: true, productsUpserted: true },
        })

        // Alert if: no previous run, or previous run has no quality data, or previous rate was below threshold
        let shouldAlert = true
        if (prevRun?.dataQuality && prevRun.productsUpserted && prevRun.productsUpserted > 0) {
          const prevDq = prevRun.dataQuality as { missingBrand?: number }
          if (typeof prevDq.missingBrand === 'number') {
            const prevRate = (prevDq.missingBrand / prevRun.productsUpserted) * 100
            shouldAlert = prevRate < MISSING_BRAND_THRESHOLD_PERCENT
          }
        }

        if (shouldAlert) {
          notifyDataQualityWarning(
            { feedId: feed.id, feedName: feed.sources.name, sourceId: feed.sourceId,
              sourceName: feed.sources.name, retailerName: feed.sources.retailers?.name,
              network: feed.network, runId: run.id },
            { missingBrandCount: dq.missingBrand, missingBrandRate: currentRate.toFixed(1),
              thresholdPercent: MISSING_BRAND_THRESHOLD_PERCENT, productsUpserted: upserted }
          ).catch((err) => moduleLog.error('Failed to send data quality warning', {}, err))
        }
      }
    }
  } else if (status === 'FAILED') {
    const newFailureCount = feed.consecutiveFailures + 1
    updateData.consecutiveFailures = newFailureCount
    notifyAffiliateFeedRunFailed(
      { feedId: feed.id, feedName: feed.sources.name, sourceId: feed.sourceId,
        sourceName: feed.sources.name, retailerName: feed.sources.retailers?.name,
        network: feed.network, runId: run.id, correlationId: metrics.correlationId as string | undefined },
      (metrics.errorMessage as string) || 'Unknown error', newFailureCount
    ).catch((err) => moduleLog.error('Failed to send run failure notification', {}, err))

    if (newFailureCount >= MAX_CONSECUTIVE_FAILURES) {
      log.error('Auto-disabling feed after consecutive failures', {
        feedId: feed.id, feedName: feed.sources.name, runId: run.id, failures: newFailureCount,
      })
      updateData.status = 'DISABLED'
      updateData.nextRunAt = null
      notifyAffiliateFeedAutoDisabled(
        { feedId: feed.id, feedName: feed.sources.name, sourceId: feed.sourceId,
          sourceName: feed.sources.name, retailerName: feed.sources.retailers?.name,
          network: feed.network, runId: run.id, correlationId: metrics.correlationId as string | undefined },
        newFailureCount, (metrics.errorMessage as string) || 'Unknown error'
      ).catch((err) => moduleLog.error('Failed to send auto-disable notification', {}, err))
    }
    // Note: For non-auto-disabled failures, nextRunAt is already set by the scheduler.
    // We don't update it here to preserve the configured schedule offset.
  }

  await prisma.affiliate_feeds.update({ where: { id: feed.id }, data: updateData })

  log.info('RUN_COMPLETE', {
    feedId: feed.id, runId: run.id, status, durationMs,
    productsUpserted: metrics.productsUpserted, productsPromoted: metrics.productsPromoted,
    pricesWritten: metrics.pricesWritten, errorCount: metrics.errorCount,
  })
}

/**
 * Classify an error for retry decisions
 */
function classifyError(error: unknown): AffiliateFeedError {
  if (error instanceof AffiliateFeedError) return error

  if (error instanceof Error) {
    const err = error as Error & { code?: string; statusCode?: number }
    if (err.code) return AffiliateFeedError.fromNetworkError(err.code, err.message)
    if (err.statusCode) return AffiliateFeedError.fromHttpStatus(err.statusCode, err.message)

    const msg = err.message.toLowerCase()
    if (msg.includes('authentication') || msg.includes('login') || msg.includes('permission denied'))
      return AffiliateFeedError.configError(err.message, ERROR_CODES.AUTH_FAILED)
    if (msg.includes('no such file') || msg.includes('not found') || msg.includes('does not exist'))
      return AffiliateFeedError.permanentError(err.message, ERROR_CODES.FILE_NOT_FOUND)
    if (msg.includes('timeout') || msg.includes('timed out'))
      return AffiliateFeedError.transientError(err.message, ERROR_CODES.CONNECTION_TIMEOUT)
    if (msg.includes('econnreset') || msg.includes('econnrefused') || msg.includes('connection'))
      return AffiliateFeedError.transientError(err.message, ERROR_CODES.CONNECTION_FAILED)
    if (msg.includes('parse') || msg.includes('invalid') || msg.includes('format'))
      return AffiliateFeedError.permanentError(err.message, ERROR_CODES.PARSE_FAILED)
    return AffiliateFeedError.transientError(err.message, ERROR_CODES.UNKNOWN_ERROR)
  }

  return AffiliateFeedError.transientError(String(error), ERROR_CODES.UNKNOWN_ERROR)
}
