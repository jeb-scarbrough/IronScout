/**
 * Scraper Metrics (Minimal v1)
 *
 * Per scraper-framework-01 spec v0.5 §11
 *
 * Prometheus is not in use for v1.
 * This module emits structured log events only.
 */

import { loggers } from '../config/logger.js'
import type { ScrapeRunStatus } from '@ironscout/db/generated/prisma'

const log = loggers.scraper

const FAILURE_RATE_ALERT_THRESHOLD = 0.5
const MIN_URLS_FOR_ALERT = 20
const STALE_TARGETS_ALERT_THRESHOLD = 100

export interface RunCompletedPayload {
  runId: string
  adapterId: string
  sourceId: string
  status: ScrapeRunStatus
  urlsAttempted: number
  urlsSucceeded: number
  urlsFailed: number
  offersExtracted: number
  offersValid: number
  offersDropped: number
  offersQuarantined: number
  oosNoPriceCount: number
  failureRate: number
  yieldRate: number
  dropRate: number
  durationMs: number
}

export function recordRunCompleted(payload: RunCompletedPayload): void {
  log.info('SCRAPER_RUN_COMPLETED', {
    event_name: 'SCRAPER_RUN_COMPLETED',
    ...payload,
  })

  if (payload.urlsAttempted >= MIN_URLS_FOR_ALERT && payload.failureRate > FAILURE_RATE_ALERT_THRESHOLD) {
    log.warn('SCRAPER_ALERT_HIGH_FAILURE_RATE', {
      event_name: 'SCRAPER_ALERT_HIGH_FAILURE_RATE',
      runId: payload.runId,
      adapterId: payload.adapterId,
      sourceId: payload.sourceId,
      failureRate: payload.failureRate,
      urlsAttempted: payload.urlsAttempted,
    })
  }
}

export function recordQueueRejection(payload: {
  reason: string
  targetId: string
  runId: string
  adapterId: string
  sourceId: string
  retryAfterMs?: number
}): void {
  log.warn('SCRAPER_QUEUE_REJECTED', {
    event_name: 'SCRAPER_QUEUE_REJECTED',
    ...payload,
  })
}

export function recordAdapterDisabled(payload: {
  adapterId: string
  reason: string
  consecutiveFailedBatches: number
}): void {
  log.warn('SCRAPER_ADAPTER_DISABLED', {
    event_name: 'SCRAPER_ADAPTER_DISABLED',
    ...payload,
  })
}

export function recordStaleTargetsAlert(payload: { markedStale: number }): void {
  if (payload.markedStale >= STALE_TARGETS_ALERT_THRESHOLD) {
    log.warn('SCRAPER_ALERT_STALE_TARGETS', {
      event_name: 'SCRAPER_ALERT_STALE_TARGETS',
      markedStale: payload.markedStale,
      threshold: STALE_TARGETS_ALERT_THRESHOLD,
    })
  }
}

export function recordZeroPriceQuarantine(payload: {
  adapterId: string
  sourceId: string
  runId: string
  targetId: string
  url: string
}): void {
  log.warn('SCRAPER_ALERT_ZERO_PRICE', {
    event_name: 'SCRAPER_ALERT_ZERO_PRICE',
    ...payload,
  })
}
