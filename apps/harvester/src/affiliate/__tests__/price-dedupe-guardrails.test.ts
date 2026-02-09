/**
 * Price Deduplication Guardrail Tests (#218)
 *
 * These tests enforce that:
 * 1. bulkInsertPrices receives a separate observedAt parameter (not createdAt)
 * 2. observedAt is sourced from runObservedAt (= run.startedAt), not t0
 * 3. FeedRunContext carries runObservedAt as a stable-per-run timestamp
 *
 * Why this matters:
 * - The dedupe index is ON (sourceProductId, observedAt)
 * - t0 is set per attempt (new Date() in worker), so retries get a different t0
 * - If observedAt = t0, retry inserts bypass the dedupe index → duplicate prices
 * - runObservedAt = run.startedAt is stable across retries → deduplication works
 */

import { describe, it, expect, beforeAll } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

const PROCESSOR_PATH = path.resolve(__dirname, '../processor.ts').replace(/\\/g, '/')
const TYPES_PATH = path.resolve(__dirname, '../types.ts').replace(/\\/g, '/')
const WORKER_PATH = path.resolve(__dirname, '../worker.ts').replace(/\\/g, '/')

describe('Price Deduplication Guardrails (#218)', () => {
  let processorSource: string
  let typesSource: string
  let workerSource: string

  beforeAll(() => {
    processorSource = fs.readFileSync(PROCESSOR_PATH, 'utf-8')
    typesSource = fs.readFileSync(TYPES_PATH, 'utf-8')
    workerSource = fs.readFileSync(WORKER_PATH, 'utf-8')
  })

  /**
   * CRITICAL: bulkInsertPrices must accept a separate observedAt parameter.
   * If it only takes createdAt and uses it for both columns, retries will
   * bypass the dedupe index because createdAt = t0 changes per attempt.
   */
  it('bulkInsertPrices_accepts_separate_observedAt_parameter', () => {
    // Function signature must include observedAt as a distinct parameter
    expect(processorSource).toMatch(/function bulkInsertPrices\([^)]*observedAt/)
  })

  /**
   * CRITICAL: The SQL must use the observedAt parameter, not createdAt, for
   * the observedAt column. This ensures the dedupe index (sourceProductId, observedAt)
   * sees the same value on retry.
   */
  it('bulkInsertPrices_uses_observedAt_param_in_SQL', () => {
    // The SQL should use ${observedAt} for the observedAt column value,
    // not ${createdAt} for both. Look for the pattern after ${createdAt}:
    // ${createdAt},\n      ${observedAt},
    expect(processorSource).toMatch(/\$\{createdAt\},\s*\$\{observedAt\},/)
  })

  /**
   * CRITICAL: The call site must pass runObservedAt (not t0) as the
   * observedAt argument to bulkInsertPrices.
   */
  it('bulkInsertPrices_called_with_runObservedAt', () => {
    expect(processorSource).toMatch(/bulkInsertPrices\(.*runObservedAt\)/)
  })

  /**
   * FeedRunContext must carry runObservedAt for stable-per-run timestamps.
   */
  it('FeedRunContext_has_runObservedAt_field', () => {
    expect(typesSource).toContain('runObservedAt: Date')
  })

  /**
   * Worker must set runObservedAt from run.startedAt (stable across retries).
   */
  it('worker_sets_runObservedAt_from_run_startedAt', () => {
    expect(workerSource).toMatch(/runObservedAt:\s*run\.startedAt/)
  })
})
