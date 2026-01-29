/**
 * Drift Detection and Auto-Disable
 *
 * Per scraper-framework-01 spec v0.5 §7
 *
 * Drift Thresholds and Actions:
 * - Adapter-level: 50% failure rate in 2 consecutive batches (≥20 URLs) → auto-disable
 * - URL-level: 5 consecutive failures → mark BROKEN
 * - Zero price: 2 consecutive runs (≥20 URLs) → auto-disable
 *
 * OOS_NO_PRICE drops are tracked but excluded from drift calculations.
 */

import type {
  ScrapeRunMetrics,
  DerivedMetrics,
  DriftBaseline,
} from '../types.js'

/** Minimum URLs per batch for drift detection to apply */
const MIN_URLS_FOR_DRIFT = 20

/** Failure rate threshold for alerting */
const FAILURE_RATE_ALERT_THRESHOLD = 0.5 // 50%

/** Consecutive failed batches threshold for auto-disable */
const CONSECUTIVE_FAILURES_FOR_DISABLE = 2

/** Consecutive URL failures before marking BROKEN */
const URL_FAILURES_FOR_BROKEN = 5

/** Minimum runs required for baseline to be established */
const MIN_RUNS_FOR_BASELINE = 3

/**
 * Compute derived metrics from raw run metrics.
 */
export function computeDerivedMetrics(metrics: ScrapeRunMetrics): DerivedMetrics {
  // Adjust failure count to exclude OOS_NO_PRICE (expected behavior)
  const adjustedFailed = metrics.urlsFailed - metrics.oosNoPriceCount

  const failureRate =
    metrics.urlsAttempted > 0
      ? Math.max(0, adjustedFailed) / metrics.urlsAttempted
      : 0

  const dropRate =
    metrics.offersExtracted > 0
      ? metrics.offersDropped / metrics.offersExtracted
      : 0

  const yieldRate =
    metrics.urlsAttempted > 0
      ? metrics.offersValid / metrics.urlsAttempted
      : 0

  return {
    failureRate,
    dropRate,
    yieldRate,
  }
}

/**
 * Check if a batch should trigger a drift alert.
 *
 * @returns Object with alert details, or null if no alert needed
 */
export function checkDriftAlert(
  metrics: ScrapeRunMetrics,
  _baseline?: DriftBaseline
): DriftAlertResult | null {
  // Don't check small batches
  if (metrics.urlsAttempted < MIN_URLS_FOR_DRIFT) {
    return null
  }

  const derived = computeDerivedMetrics(metrics)

  // Check for high failure rate
  if (derived.failureRate > FAILURE_RATE_ALERT_THRESHOLD) {
    return {
      type: 'HIGH_FAILURE_RATE',
      severity: 'ALERT',
      message: `Failure rate ${(derived.failureRate * 100).toFixed(1)}% exceeds threshold ${FAILURE_RATE_ALERT_THRESHOLD * 100}%`,
      metrics: derived,
    }
  }

  // Check for zero offers (complete extraction failure)
  if (metrics.offersExtracted === 0 && metrics.urlsAttempted > 0) {
    return {
      type: 'ZERO_OFFERS',
      severity: 'ALERT',
      message: 'No offers extracted from any URL',
      metrics: derived,
    }
  }

  return null
}

/**
 * Check if adapter should be auto-disabled.
 *
 * @param currentMetrics - Metrics from current batch
 * @param consecutiveFailedBatches - Count of consecutive failed batches
 * @returns Decision with reason, or null if no action needed
 */
export function checkAutoDisable(
  currentMetrics: ScrapeRunMetrics,
  consecutiveFailedBatches: number
): AutoDisableDecision | null {
  // Don't check small batches
  if (currentMetrics.urlsAttempted < MIN_URLS_FOR_DRIFT) {
    return null
  }

  const derived = computeDerivedMetrics(currentMetrics)

  // Check failure rate
  const isBatchFailed = derived.failureRate > FAILURE_RATE_ALERT_THRESHOLD

  if (isBatchFailed) {
    // This batch failed, check if we've hit the threshold
    const newConsecutiveCount = consecutiveFailedBatches + 1

    if (newConsecutiveCount >= CONSECUTIVE_FAILURES_FOR_DISABLE) {
      return {
        shouldDisable: true,
        reason: 'DRIFT_DETECTED',
        message: `${newConsecutiveCount} consecutive batches with failure rate > ${FAILURE_RATE_ALERT_THRESHOLD * 100}%`,
        consecutiveFailedBatches: newConsecutiveCount,
      }
    }

    // Not enough consecutive failures yet
    return {
      shouldDisable: false,
      reason: null,
      message: `Batch failed (${newConsecutiveCount}/${CONSECUTIVE_FAILURES_FOR_DISABLE} consecutive)`,
      consecutiveFailedBatches: newConsecutiveCount,
    }
  }

  // This batch succeeded, reset counter
  return {
    shouldDisable: false,
    reason: null,
    message: 'Batch succeeded, resetting consecutive failure count',
    consecutiveFailedBatches: 0,
  }
}

/**
 * Check if zero prices should trigger auto-disable.
 *
 * @param currentMetrics - Metrics from current batch
 * @param previousZeroPriceRun - Whether previous run had zero prices
 * @returns Decision with reason, or null if no action needed
 */
export function checkZeroPriceDisable(
  currentMetrics: ScrapeRunMetrics,
  previousZeroPriceRun: boolean
): AutoDisableDecision | null {
  // Don't check small batches
  if (currentMetrics.urlsAttempted < MIN_URLS_FOR_DRIFT) {
    return null
  }

  // Check if current run has zero prices
  const hasZeroPrices = currentMetrics.zeroPriceCount > 0

  if (hasZeroPrices && previousZeroPriceRun) {
    // Two consecutive runs with zero prices
    return {
      shouldDisable: true,
      reason: 'DRIFT_DETECTED',
      message: `Zero price detected in 2 consecutive runs (≥${MIN_URLS_FOR_DRIFT} URLs)`,
      consecutiveFailedBatches: 2,
    }
  }

  return null
}

/**
 * Check if a URL should be marked as BROKEN.
 *
 * @param consecutiveFailures - Number of consecutive failures for this URL
 * @returns True if URL should be marked BROKEN
 */
export function shouldMarkUrlBroken(consecutiveFailures: number): boolean {
  return consecutiveFailures >= URL_FAILURES_FOR_BROKEN
}

/**
 * Update baseline metrics with a new successful run.
 * Uses 7-day rolling median.
 *
 * @param currentBaseline - Current baseline (may be empty)
 * @param newRunMetrics - Metrics from the new run
 * @param recentRuns - Recent runs for rolling calculation
 * @returns Updated baseline
 */
export function updateBaseline(
  currentBaseline: DriftBaseline | null,
  newRunMetrics: ScrapeRunMetrics,
  recentRuns: DerivedMetrics[]
): DriftBaseline {
  // Include new run in calculations
  const newDerived = computeDerivedMetrics(newRunMetrics)
  const allMetrics = [...recentRuns, newDerived]

  // Calculate medians
  const failureRates = allMetrics.map(m => m.failureRate).sort((a, b) => a - b)
  const yieldRates = allMetrics.map(m => m.yieldRate).sort((a, b) => a - b)

  const medianFailureRate = median(failureRates)
  const medianYieldRate = median(yieldRates)

  const sampleSize = allMetrics.length
  const isEstablished = sampleSize >= MIN_RUNS_FOR_BASELINE

  return {
    medianFailureRate,
    medianYieldRate,
    sampleSize,
    isEstablished,
  }
}

/**
 * Calculate median of an array of numbers.
 * Array must be sorted.
 */
function median(sortedValues: number[]): number {
  if (sortedValues.length === 0) return 0

  const mid = Math.floor(sortedValues.length / 2)

  if (sortedValues.length % 2 === 0) {
    return (sortedValues[mid - 1] + sortedValues[mid]) / 2
  }

  return sortedValues[mid]
}

/**
 * Result of drift alert check.
 */
export interface DriftAlertResult {
  type: 'HIGH_FAILURE_RATE' | 'ZERO_OFFERS' | 'BASELINE_DEVIATION'
  severity: 'ALERT' | 'WARNING'
  message: string
  metrics: DerivedMetrics
}

/**
 * Decision on whether to auto-disable an adapter.
 */
export interface AutoDisableDecision {
  shouldDisable: boolean
  reason: 'DRIFT_DETECTED' | 'TOS_VIOLATION' | null
  message: string
  consecutiveFailedBatches: number
}
