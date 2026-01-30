import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockRunFindMany: vi.fn(),
  mockRunCreate: vi.fn(),
  mockRunUpdate: vi.fn(),
  mockAdapterStatusFind: vi.fn(),
  mockAdapterStatusCreate: vi.fn(),
  mockAdapterStatusUpdate: vi.fn(),
  mockEnqueueScrapeUrl: vi.fn(),
  mockQueueGetJobs: vi.fn(),
  mockGetScrapeQueueStats: vi.fn(),
  registry: {
    get: vi.fn(),
  },
}))

vi.mock('@ironscout/db', () => ({
  prisma: {
    scrape_targets: {
      findMany: mocks.mockFindMany,
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    scrape_runs: {
      findMany: mocks.mockRunFindMany,
      findFirst: vi.fn(),
      create: mocks.mockRunCreate,
      update: mocks.mockRunUpdate,
    },
    scrape_adapter_status: {
      findUnique: mocks.mockAdapterStatusFind,
      create: mocks.mockAdapterStatusCreate,
      update: mocks.mockAdapterStatusUpdate,
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

vi.mock('../../config/queues.js', () => ({
  enqueueScrapeUrl: mocks.mockEnqueueScrapeUrl,
  scrapeUrlQueue: {
    getJobs: mocks.mockQueueGetJobs,
  },
  getScrapeQueueStats: mocks.mockGetScrapeQueueStats,
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
  schedule: null, // Use default cron schedule
  lastScrapedAt: null, // Never scraped = always due
  sources: {
    id: 'source-1',
    retailerId: 'retailer-1',
    adapterId: 'adapter-1',
  },
  ...overrides,
})

describe('Scrape Scheduler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: no stale runs to finalize
    mocks.mockRunFindMany.mockResolvedValue([])
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
    // Default findMany order:
    // 1. recheckBrokenUrls() - find BROKEN targets
    // 2. processManualRuns() - find PENDING_MANUAL targets
    // 3. getDueTargets() - find ACTIVE targets
    mocks.mockFindMany.mockResolvedValueOnce([]) // recheckBrokenUrls - no broken targets
    mocks.mockFindMany.mockResolvedValueOnce([]) // processManualRuns - no pending manual
  })

  it('creates runs and enqueues jobs per adapter', async () => {
    const adapter = { id: 'adapter-1', version: '1.2.3', domain: 'example.com' }
    mocks.registry.get.mockReturnValue(adapter)
    mocks.mockAdapterStatusFind.mockResolvedValue({ enabled: true })

    // Third findMany call returns scheduled targets (first two are maintenance - set in beforeEach)
    mocks.mockFindMany.mockResolvedValueOnce([
      createTarget({ id: 'target-1' }),
      createTarget({ id: 'target-2', url: 'https://example.com/other' }),
    ])

    mocks.mockRunCreate.mockResolvedValue({ id: 'run-1' })

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
        data: { urlsAttempted: 2 },
      })
    )
  })

  it('skips targets when adapter is not registered', async () => {
    mocks.registry.get.mockReturnValue(undefined)
    // Third findMany call returns scheduled targets (first two are maintenance - set in beforeEach)
    mocks.mockFindMany.mockResolvedValueOnce([createTarget()])

    await triggerScrapeSchedulerTick({ maxUrlsPerTick: 10 })

    expect(mocks.mockRunCreate).not.toHaveBeenCalled()
    expect(mocks.mockEnqueueScrapeUrl).not.toHaveBeenCalled()
  })

  it('skips targets when adapter is disabled', async () => {
    const adapter = { id: 'adapter-1', version: '1.0.0', domain: 'example.com' }
    mocks.registry.get.mockReturnValue(adapter)
    mocks.mockAdapterStatusFind.mockResolvedValue({ enabled: false })
    // Third findMany call returns scheduled targets (first two are maintenance - set in beforeEach)
    mocks.mockFindMany.mockResolvedValueOnce([createTarget()])

    await triggerScrapeSchedulerTick({ maxUrlsPerTick: 10 })

    expect(mocks.mockRunCreate).not.toHaveBeenCalled()
    expect(mocks.mockEnqueueScrapeUrl).not.toHaveBeenCalled()
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
