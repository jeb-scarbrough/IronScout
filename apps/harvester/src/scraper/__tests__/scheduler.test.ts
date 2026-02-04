import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockTargetCount: vi.fn(),
  mockRunFindMany: vi.fn(),
  mockRunFindFirst: vi.fn(),
  mockRunCreate: vi.fn(),
  mockRunUpdate: vi.fn(),
  mockAdapterStatusFind: vi.fn(),
  mockAdapterStatusFindMany: vi.fn(),
  mockAdapterStatusCreate: vi.fn(),
  mockAdapterStatusUpdate: vi.fn(),
  mockCycleCreate: vi.fn(),
  mockCycleFindUnique: vi.fn(),
  mockCycleUpdate: vi.fn(),
  mockEnqueueScrapeUrl: vi.fn(),
  mockQueueGetJobs: vi.fn(),
  mockGetScrapeQueueStats: vi.fn(),
  registry: {
    get: vi.fn(),
  },
}))

const metricsMocks = vi.hoisted(() => ({
  recordRunCompleted: vi.fn(),
  recordQueueRejection: vi.fn(),
  recordAdapterDisabled: vi.fn(),
  recordStaleTargetsAlert: vi.fn(),
  recordZeroPriceQuarantine: vi.fn(),
}))

vi.mock('@ironscout/db', () => ({
  prisma: {
    scrape_targets: {
      findMany: mocks.mockFindMany,
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      count: mocks.mockTargetCount,
    },
    scrape_runs: {
      findMany: mocks.mockRunFindMany,
      findFirst: mocks.mockRunFindFirst,
      create: mocks.mockRunCreate,
      update: mocks.mockRunUpdate,
    },
    scrape_adapter_status: {
      findUnique: mocks.mockAdapterStatusFind,
      findMany: mocks.mockAdapterStatusFindMany,
      create: mocks.mockAdapterStatusCreate,
      update: mocks.mockAdapterStatusUpdate,
    },
    scrape_cycles: {
      create: mocks.mockCycleCreate,
      findUnique: mocks.mockCycleFindUnique,
      update: mocks.mockCycleUpdate,
    },
    sources: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('../registry.js', () => ({
  getAdapterRegistry: () => mocks.registry,
}))

vi.mock('../metrics.js', () => metricsMocks)

vi.mock('../../config/queues.js', () => ({
  enqueueScrapeUrl: mocks.mockEnqueueScrapeUrl,
  scrapeUrlQueue: {
    getJobs: mocks.mockQueueGetJobs,
  },
  getScrapeQueueStats: mocks.mockGetScrapeQueueStats,
  decrementAdapterPending: vi.fn(),
}))

vi.mock('../../config/logger.js', () => ({
  loggers: {
    scraper: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
  },
}))

import { triggerScrapeSchedulerTick, isTargetDue } from '../scheduler.js'

const createTarget = (overrides: Partial<any> = {}) => ({
  id: 'target-1',
  url: 'https://example.com/product',
  sourceId: 'source-1',
  adapterId: 'adapter-1',
  priority: 5,
  schedule: null,
  lastScrapedAt: null,
  sources: {
    id: 'source-1',
    retailerId: 'retailer-1',
    adapterId: 'adapter-1',
  },
  ...overrides,
})

const createDueAdapter = (overrides: Partial<any> = {}) => ({
  adapterId: 'adapter-1',
  schedule: null,
  lastCycleStartedAt: null,
  currentCycleId: null,
  cycleTimeoutMinutes: 180,
  enabled: true,
  ingestionPaused: false,
  ...overrides,
})

const createCycle = (overrides: Partial<any> = {}) => ({
  id: 'cycle-1',
  adapterId: 'adapter-1',
  status: 'RUNNING',
  trigger: 'SCHEDULED',
  startedAt: new Date('2025-01-01T00:00:00Z'),
  completedAt: null,
  durationMs: null,
  totalTargets: 2,
  targetsCompleted: 0,
  targetsFailed: 0,
  targetsSkipped: 0,
  lastProcessedTargetId: null,
  offersExtracted: 0,
  offersValid: 0,
  ...overrides,
})

describe('Scrape Scheduler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: no stale runs to finalize
    mocks.mockRunFindMany.mockResolvedValue([])
    mocks.mockRunFindFirst.mockResolvedValue(null)
    mocks.mockQueueGetJobs.mockResolvedValue([])
    // Default queue stats: low utilization, no backpressure
    mocks.mockGetScrapeQueueStats.mockResolvedValue({
      waiting: 0,
      active: 0,
      delayed: 0,
      total: 0,
      capacity: 10000,
      utilizationPercent: 0,
    })
    // Default enqueue result: accepted
    mocks.mockEnqueueScrapeUrl.mockResolvedValue({ status: 'accepted', jobId: 'job-1' })
    // Default: no due adapters (getDueAdapters)
    mocks.mockAdapterStatusFindMany.mockResolvedValue([])
    // Default: 0 target count
    mocks.mockTargetCount.mockResolvedValue(0)
    // Default cycle mocks
    mocks.mockCycleUpdate.mockResolvedValue({})
    mocks.mockCycleFindUnique.mockResolvedValue(null)
    // Default: findMany always returns [] (maintenance, manual runs, getCycleTargetBatch)
    mocks.mockFindMany.mockResolvedValue([])
  })

  it('creates runs and enqueues jobs per adapter', async () => {
    const adapter = { id: 'adapter-1', version: '1.2.3', domain: 'example.com' }
    mocks.registry.get.mockReturnValue(adapter)

    // getDueAdapters returns one adapter due for scheduling
    mocks.mockAdapterStatusFindMany.mockResolvedValue([createDueAdapter()])

    // startNewCycle: count targets
    mocks.mockTargetCount.mockResolvedValue(2)

    // startNewCycle: create cycle
    const cycle = createCycle()
    mocks.mockCycleCreate.mockResolvedValue(cycle)

    // getCycleTargetBatch: return targets on first call, empty on hasMore check
    // Note: earlier findMany calls (maintenance recheckBrokenUrls, processManualRuns)
    // return [] from default. The first mockResolvedValueOnce overrides for getCycleTargetBatch.
    mocks.mockFindMany
      .mockResolvedValueOnce([]) // recheckBrokenUrls (maintenance, runs on first test)
      .mockResolvedValueOnce([]) // processManualRuns
      .mockResolvedValueOnce([
        createTarget({ id: 'target-1' }),
        createTarget({ id: 'target-2', url: 'https://example.com/other' }),
      ]) // getCycleTargetBatch (batch)
      // subsequent calls fall back to [] (getCycleTargetBatch hasMore check)

    // processCycleBatch: create run for source
    mocks.mockRunCreate.mockResolvedValue({ id: 'run-1' })

    // finalizeCycle: getCurrentCycle returns cycle data
    mocks.mockCycleFindUnique.mockResolvedValue({
      ...cycle,
      adapterId: 'adapter-1',
      startedAt: new Date('2025-01-01T00:00:00Z'),
      targetsCompleted: 2,
      targetsFailed: 0,
    })

    await triggerScrapeSchedulerTick({ maxUrlsPerTick: 10 })

    expect(mocks.mockRunCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          adapterId: 'adapter-1',
          adapterVersion: '1.2.3',
          sourceId: 'source-1',
          retailerId: 'retailer-1',
          trigger: 'SCHEDULED',
        }),
      })
    )

    expect(mocks.mockEnqueueScrapeUrl).toHaveBeenCalledTimes(2)
    expect(mocks.mockEnqueueScrapeUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        targetId: 'target-1',
        priority: 5,
        runId: 'run-1',
      })
    )

    expect(mocks.mockRunUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'run-1' },
        data: { urlsAttempted: { increment: 2 } },
      })
    )
  })

  it('skips targets when adapter is not registered', async () => {
    mocks.registry.get.mockReturnValue(undefined)
    // getDueAdapters returns one adapter, but registry doesn't have it
    mocks.mockAdapterStatusFindMany.mockResolvedValue([createDueAdapter()])

    await triggerScrapeSchedulerTick({ maxUrlsPerTick: 10 })

    expect(mocks.mockRunCreate).not.toHaveBeenCalled()
    expect(mocks.mockEnqueueScrapeUrl).not.toHaveBeenCalled()
  })

  it('skips targets when adapter is disabled', async () => {
    const adapter = { id: 'adapter-1', version: '1.0.0', domain: 'example.com' }
    mocks.registry.get.mockReturnValue(adapter)
    // getDueAdapters filters by enabled=true, so disabled adapter won't appear
    mocks.mockAdapterStatusFindMany.mockResolvedValue([])

    await triggerScrapeSchedulerTick({ maxUrlsPerTick: 10 })

    expect(mocks.mockRunCreate).not.toHaveBeenCalled()
    expect(mocks.mockEnqueueScrapeUrl).not.toHaveBeenCalled()
  })

  it('records run completion metrics for finalized runs', async () => {
    const adapter = { id: 'adapter-1', version: '1.2.3', domain: 'example.com' }
    mocks.registry.get.mockReturnValue(adapter)

    mocks.mockRunFindMany.mockResolvedValueOnce([
      {
        id: 'run-1',
        adapterId: 'adapter-1',
        sourceId: 'source-1',
        startedAt: new Date('2025-01-01T00:00:00Z'),
        urlsAttempted: 10,
        urlsSucceeded: 8,
        urlsFailed: 2,
        offersExtracted: 8,
        offersValid: 8,
        offersDropped: 0,
        offersQuarantined: 0,
        oosNoPriceCount: 0,
        zeroPriceCount: 0,
      },
    ])
    mocks.mockQueueGetJobs.mockResolvedValue([])

    await triggerScrapeSchedulerTick({ maxUrlsPerTick: 0 })

    expect(metricsMocks.recordRunCompleted).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'run-1',
        adapterId: 'adapter-1',
        sourceId: 'source-1',
        urlsAttempted: 10,
        urlsSucceeded: 8,
        urlsFailed: 2,
      })
    )
  })

  it('records queue rejections during scheduling', async () => {
    const adapter = { id: 'adapter-1', version: '1.2.3', domain: 'example.com' }
    mocks.registry.get.mockReturnValue(adapter)
    mocks.mockAdapterStatusFind.mockResolvedValue({ enabled: true })

    // Set up findMany for manual run path:
    // processManualRuns finds PENDING_MANUAL target (maintenance skipped after first test)
    mocks.mockFindMany.mockReset()
    mocks.mockFindMany.mockResolvedValue([]) // default fallback
    mocks.mockFindMany.mockResolvedValueOnce([createTarget({ id: 'target-1' })]) // processManualRuns

    mocks.mockRunCreate.mockResolvedValue({ id: 'run-1' })
    mocks.mockEnqueueScrapeUrl.mockResolvedValue({
      status: 'rejected',
      jobId: 'job-1',
      reason: 'queue_full',
      retryAfterMs: 60000,
    })

    await triggerScrapeSchedulerTick({ maxUrlsPerTick: 10 })

    expect(metricsMocks.recordQueueRejection).toHaveBeenCalledWith(
      expect.objectContaining({
        targetId: 'target-1',
        runId: 'run-1',
        adapterId: 'adapter-1',
        sourceId: 'source-1',
        reason: 'queue_full',
      })
    )
  })
})

describe('isTargetDue (cron scheduling)', () => {
  it('returns true when never scraped', () => {
    const now = new Date('2025-01-15T12:00:00Z')
    expect(isTargetDue(null, null, now)).toBe(true)
    expect(isTargetDue('0 * * * *', null, now)).toBe(true)
  })

  it('returns true when last scraped before previous scheduled time', () => {
    // Cron: every hour at minute 0
    const schedule = '0 * * * *'
    const now = new Date('2025-01-15T12:30:00Z') // 12:30
    const lastScrapedAt = new Date('2025-01-15T11:00:00Z') // 11:00 - before 12:00

    expect(isTargetDue(schedule, lastScrapedAt, now)).toBe(true)
  })

  it('returns false when last scraped after previous scheduled time', () => {
    // Cron: every hour at minute 0
    const schedule = '0 * * * *'
    const now = new Date('2025-01-15T12:30:00Z') // 12:30
    const lastScrapedAt = new Date('2025-01-15T12:15:00Z') // 12:15 - after 12:00

    expect(isTargetDue(schedule, lastScrapedAt, now)).toBe(false)
  })

  it('uses default 4-hour schedule when schedule is null', () => {
    // Default: 0 0,4,8,12,16,20 * * *
    const now = new Date('2025-01-15T14:00:00Z') // 14:00

    // Last scraped at 12:30 - after 12:00 scheduled time
    const recent = new Date('2025-01-15T12:30:00Z')
    expect(isTargetDue(null, recent, now)).toBe(false)

    // Last scraped at 11:30 - before 12:00 scheduled time
    const old = new Date('2025-01-15T11:30:00Z')
    expect(isTargetDue(null, old, now)).toBe(true)
  })

  it('handles invalid cron by using fallback 4-hour window', () => {
    const now = new Date('2025-01-15T12:00:00Z')
    const invalidCron = 'not-a-valid-cron'

    // Last scraped 5 hours ago = due
    const fiveHoursAgo = new Date(now.getTime() - 5 * 60 * 60 * 1000)
    expect(isTargetDue(invalidCron, fiveHoursAgo, now)).toBe(true)

    // Last scraped 1 hour ago = not due
    const oneHourAgo = new Date(now.getTime() - 1 * 60 * 60 * 1000)
    expect(isTargetDue(invalidCron, oneHourAgo, now)).toBe(false)
  })
})
