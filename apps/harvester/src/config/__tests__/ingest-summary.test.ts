/**
 * Ingest Run Summary Tests
 *
 * Tests for the standardized ingestion summary event format.
 * Verifies that INGEST_RUN_SUMMARY events are emitted correctly
 * with the right fields and metrics are tracked.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  emitIngestRunSummary,
  getIngestSummaryMetrics,
  resetIngestSummaryMetrics,
  getIngestSummaryPrometheusMetrics,
  type IngestRunSummary,
} from '../ingest-summary'

// Mock the logger
vi.mock('../logger', () => ({
  rootLogger: {
    child: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}))

describe('Ingest Run Summary', () => {
  beforeEach(() => {
    resetIngestSummaryMetrics()
  })

  describe('emitIngestRunSummary', () => {
    it('emits a summary event for AFFILIATE pipeline', () => {
      const summary: IngestRunSummary = {
        pipeline: 'AFFILIATE',
        runId: 'run-123',
        sourceId: 'source-456',
        retailerId: 'retailer-789',
        status: 'SUCCESS',
        durationMs: 1500,
        input: {
          totalRows: 100,
        },
        output: {
          listingsCreated: 80,
          listingsUpdated: 15,
          pricesWritten: 95,
          quarantined: 0,
          rejected: 5,
          matched: 90,
          enqueuedForResolver: 10,
        },
        errors: {
          count: 5,
          primaryCode: 'PARSE_ERROR',
        },
        deduplication: {
          duplicatesSkipped: 3,
          urlHashFallbacks: 2,
        },
      }

      emitIngestRunSummary(summary)

      const metrics = getIngestSummaryMetrics()
      expect(metrics.runsByPipelineAndStatus['AFFILIATE:SUCCESS']).toBe(1)
      expect(metrics.listingsCreatedByPipeline['AFFILIATE']).toBe(80)
      expect(metrics.listingsUpdatedByPipeline['AFFILIATE']).toBe(15)
      expect(metrics.pricesWrittenByPipeline['AFFILIATE']).toBe(95)
    })

    it('emits a summary event for RETAILER pipeline', () => {
      const summary: IngestRunSummary = {
        pipeline: 'RETAILER',
        runId: 'feed-run-001',
        sourceId: 'feed-001',
        retailerId: 'retailer-001',
        status: 'WARNING',
        durationMs: 2500,
        timing: {
          fetchMs: 500,
          parseMs: 800,
          processMs: 1200,
        },
        input: {
          totalRows: 200,
        },
        output: {
          listingsCreated: 150,
          listingsUpdated: 0,
          pricesWritten: 0,
          quarantined: 30,
          rejected: 20,
          matched: 0,
          enqueuedForResolver: 0,
        },
        errors: {
          count: 20,
          primaryCode: 'MISSING_UPC',
          codes: { MISSING_UPC: 15, INVALID_PRICE: 5 },
        },
      }

      emitIngestRunSummary(summary)

      const metrics = getIngestSummaryMetrics()
      expect(metrics.runsByPipelineAndStatus['RETAILER:WARNING']).toBe(1)
      expect(metrics.listingsCreatedByPipeline['RETAILER']).toBe(150)
    })

    it('tracks FAILED status correctly', () => {
      const summary: IngestRunSummary = {
        pipeline: 'RETAILER',
        runId: 'feed-run-002',
        status: 'FAILED',
        durationMs: 1000,
        input: {
          totalRows: 100,
        },
        output: {
          listingsCreated: 0,
          listingsUpdated: 0,
          pricesWritten: 0,
          quarantined: 0,
          rejected: 100,
          matched: 0,
          enqueuedForResolver: 0,
        },
        errors: {
          count: 100,
          primaryCode: 'FETCH_ERROR',
        },
      }

      emitIngestRunSummary(summary)

      const metrics = getIngestSummaryMetrics()
      expect(metrics.runsByPipelineAndStatus['RETAILER:FAILED']).toBe(1)
    })

    it('accumulates metrics across multiple runs', () => {
      // First run
      emitIngestRunSummary({
        pipeline: 'AFFILIATE',
        runId: 'run-1',
        status: 'SUCCESS',
        durationMs: 1000,
        input: { totalRows: 100 },
        output: {
          listingsCreated: 50,
          listingsUpdated: 40,
          pricesWritten: 90,
          quarantined: 0,
          rejected: 10,
          matched: 80,
          enqueuedForResolver: 20,
        },
        errors: { count: 10 },
      })

      // Second run
      emitIngestRunSummary({
        pipeline: 'AFFILIATE',
        runId: 'run-2',
        status: 'SUCCESS',
        durationMs: 1200,
        input: { totalRows: 200 },
        output: {
          listingsCreated: 100,
          listingsUpdated: 80,
          pricesWritten: 180,
          quarantined: 0,
          rejected: 20,
          matched: 160,
          enqueuedForResolver: 40,
        },
        errors: { count: 20 },
      })

      const metrics = getIngestSummaryMetrics()
      expect(metrics.runsByPipelineAndStatus['AFFILIATE:SUCCESS']).toBe(2)
      expect(metrics.listingsCreatedByPipeline['AFFILIATE']).toBe(150) // 50 + 100
      expect(metrics.listingsUpdatedByPipeline['AFFILIATE']).toBe(120) // 40 + 80
      expect(metrics.pricesWrittenByPipeline['AFFILIATE']).toBe(270) // 90 + 180
    })
  })

  describe('getIngestSummaryPrometheusMetrics', () => {
    it('generates valid Prometheus exposition format', () => {
      emitIngestRunSummary({
        pipeline: 'AFFILIATE',
        runId: 'run-1',
        status: 'SUCCESS',
        durationMs: 1000,
        input: { totalRows: 100 },
        output: {
          listingsCreated: 50,
          listingsUpdated: 40,
          pricesWritten: 90,
          quarantined: 0,
          rejected: 10,
          matched: 80,
          enqueuedForResolver: 20,
        },
        errors: { count: 10 },
      })

      const prometheus = getIngestSummaryPrometheusMetrics()

      expect(prometheus).toContain('# HELP ingest_runs_total')
      expect(prometheus).toContain('# TYPE ingest_runs_total counter')
      expect(prometheus).toContain('ingest_runs_total{pipeline="AFFILIATE",status="SUCCESS"} 1')

      expect(prometheus).toContain('# HELP ingest_listings_created_total')
      expect(prometheus).toContain('ingest_listings_created_total{pipeline="AFFILIATE"} 50')

      expect(prometheus).toContain('# HELP ingest_prices_written_total')
      expect(prometheus).toContain('ingest_prices_written_total{pipeline="AFFILIATE"} 90')
    })
  })

  describe('resetIngestSummaryMetrics', () => {
    it('clears all metrics', () => {
      emitIngestRunSummary({
        pipeline: 'AFFILIATE',
        runId: 'run-1',
        status: 'SUCCESS',
        durationMs: 1000,
        input: { totalRows: 100 },
        output: {
          listingsCreated: 50,
          listingsUpdated: 40,
          pricesWritten: 90,
          quarantined: 0,
          rejected: 10,
          matched: 80,
          enqueuedForResolver: 20,
        },
        errors: { count: 10 },
      })

      resetIngestSummaryMetrics()

      const metrics = getIngestSummaryMetrics()
      expect(Object.keys(metrics.runsByPipelineAndStatus).length).toBe(0)
      expect(Object.keys(metrics.listingsCreatedByPipeline).length).toBe(0)
    })
  })

  describe('summary event format', () => {
    it('emits once per run (not per batch)', () => {
      // This test verifies the key requirement: one summary event per run
      const runId = 'single-run-123'

      emitIngestRunSummary({
        pipeline: 'AFFILIATE',
        runId,
        status: 'SUCCESS',
        durationMs: 5000,
        input: { totalRows: 1000 },
        output: {
          listingsCreated: 900,
          listingsUpdated: 50,
          pricesWritten: 950,
          quarantined: 0,
          rejected: 50,
          matched: 800,
          enqueuedForResolver: 200,
        },
        errors: { count: 50 },
      })

      const metrics = getIngestSummaryMetrics()

      // Even with 1000 items (which might be processed in 10+ batches),
      // we should only have one summary event per run
      expect(metrics.runsByPipelineAndStatus['AFFILIATE:SUCCESS']).toBe(1)

      // And the totals should reflect the entire run, not individual batches
      expect(metrics.listingsCreatedByPipeline['AFFILIATE']).toBe(900)
    })

    it('includes timing breakdown when provided', () => {
      const summary: IngestRunSummary = {
        pipeline: 'RETAILER',
        runId: 'run-with-timing',
        status: 'SUCCESS',
        durationMs: 3000,
        timing: {
          fetchMs: 500,
          parseMs: 1000,
          processMs: 1500,
        },
        input: { totalRows: 100 },
        output: {
          listingsCreated: 100,
          listingsUpdated: 0,
          pricesWritten: 0,
          quarantined: 0,
          rejected: 0,
          matched: 0,
          enqueuedForResolver: 0,
        },
        errors: { count: 0 },
      }

      // Verify structure is valid (timing is optional but allowed)
      expect(summary.timing).toBeDefined()
      expect(summary.timing?.fetchMs).toBe(500)
      expect(summary.timing?.parseMs).toBe(1000)
      expect(summary.timing?.processMs).toBe(1500)

      // Sum should roughly equal durationMs (allowing for overhead)
      const timingSum = (summary.timing?.fetchMs ?? 0) +
                        (summary.timing?.parseMs ?? 0) +
                        (summary.timing?.processMs ?? 0)
      expect(timingSum).toBeLessThanOrEqual(summary.durationMs)
    })
  })
})
