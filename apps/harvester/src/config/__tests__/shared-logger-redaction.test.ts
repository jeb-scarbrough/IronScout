import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLogger, setLogLevel, setRedactionEnabled } from '@ironscout/logger'

describe('shared logger redaction', () => {
  const originalLogFormat = process.env.LOG_FORMAT

  afterEach(() => {
    vi.restoreAllMocks()
    setRedactionEnabled(false)
    process.env.LOG_FORMAT = originalLogFormat
  })

  it('redacts sensitive workflow identifiers in JSON logs', () => {
    process.env.LOG_FORMAT = 'json'
    setLogLevel('info')
    setRedactionEnabled(true)

    const logger = createLogger('harvester')
    const consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => {})

    logger.info('test redaction', {
      sourceId: 'source-raw',
      sourceProductId: 'sp-raw',
      retailerId: 'retailer-raw',
      runId: 'run-raw',
      jobId: 'job-raw',
      executionId: 'exec-raw',
      feedId: 'feed-raw',
      adapterId: 'adapter-raw',
      workflow: 'scraper',
    })

    expect(consoleInfo).toHaveBeenCalledTimes(1)
    const [line] = consoleInfo.mock.calls[0]
    const payload = JSON.parse(String(line)) as Record<string, unknown>

    expect(payload.sourceId).toBe('[REDACTED]')
    expect(payload.sourceProductId).toBe('[REDACTED]')
    expect(payload.retailerId).toBe('[REDACTED]')
    expect(payload.runId).toBe('[REDACTED]')
    expect(payload.jobId).toBe('[REDACTED]')
    expect(payload.executionId).toBe('[REDACTED]')
    expect(payload.feedId).toBe('[REDACTED]')
    expect(payload.adapterId).toBe('[REDACTED]')
    expect(payload.workflow).toBe('scraper')
  })
})
