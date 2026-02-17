import { describe, it, expect, vi } from 'vitest'
import { createWorkflowLogger } from '../structured-log'
import { createTraceContext, traceLogFields, buildItemKey } from '../trace'

describe('trace logging', () => {
  it('keeps traceId while redacting sensitive workflow identifiers', () => {
    const base = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      fatal: vi.fn(),
    }
    const trace = createTraceContext({
      traceId: 'trace-123',
      executionId: 'exec-123',
      runId: 'run-123',
      sourceId: 'source-123',
      feedId: 'feed-123',
    })

    const log = createWorkflowLogger(base, {
      workflow: 'affiliate',
      stage: 'worker',
      ...traceLogFields(trace),
    })

    log.info('RUN_START', { itemKey: 'sp:abc' })

    expect(base.info).toHaveBeenCalledTimes(1)
    const [, payload] = base.info.mock.calls[0]
    expect(payload).toMatchObject({
      traceId: 'trace-123',
      executionId: '[REDACTED]',
      runId: '[REDACTED]',
      sourceId: '[REDACTED]',
      itemKey: 'sp:abc',
      event_name: 'RUN_START',
    })
  })

  it('sanitizes sensitive metadata fields before logging', () => {
    const base = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      fatal: vi.fn(),
    }

    const log = createWorkflowLogger(base, {
      workflow: 'affiliate',
      stage: 'worker',
      traceId: 'trace-1',
      executionId: 'exec-1',
      sourceId: 'source-1',
    })

    log.info('FETCH_START', {
      authorization: 'Bearer secret-token',
      nested: { password: 'hunter2' },
      apiKey: 'abc123',
      sourceId: 'source-raw',
      sourceProductId: 'sp-raw',
      retailerId: 'retailer-raw',
      runId: 'run-raw',
      jobId: 'job-raw',
      executionId: 'exec-raw',
      feedId: 'feed-raw',
      adapterId: 'adapter-raw',
      safe: 'ok',
    })

    const [, payload] = base.info.mock.calls[0]
    expect(payload.authorization).toBe('[REDACTED]')
    expect(payload.apiKey).toBe('[REDACTED]')
    expect(payload.nested).toMatchObject({ password: '[REDACTED]' })
    expect(payload.sourceId).toBe('[REDACTED]')
    expect(payload.sourceProductId).toBe('[REDACTED]')
    expect(payload.retailerId).toBe('[REDACTED]')
    expect(payload.runId).toBe('[REDACTED]')
    expect(payload.jobId).toBe('[REDACTED]')
    expect(payload.executionId).toBe('[REDACTED]')
    expect(payload.feedId).toBe('[REDACTED]')
    expect(payload.adapterId).toBe('[REDACTED]')
    expect(payload.safe).toBe('ok')
  })

  it('builds stable item keys from strongest identifiers', () => {
    expect(buildItemKey({ sourceProductId: 'sp-1', sku: 'SKU-1' })).toBe('sp:sp-1')
    expect(buildItemKey({ sku: 'SKU-1' })).toBe('sku:SKU-1')
    expect(buildItemKey({ upc: '123' })).toBe('upc:123')
    expect(buildItemKey({ url: 'https://example.com/item' })).toMatch(/^url:/)
  })
})
