import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockRunFindMany: vi.fn(),
  mockRunFindFirst: vi.fn(),
  mockRunCreate: vi.fn(),
  mockRunUpdate: vi.fn(),
  mockScrapeTargetsCount: vi.fn(),
  mockScrapeTargetsFindUnique: vi.fn(),
  mockAdapterStatusFind: vi.fn(),
  mockAdapterStatusFindMany: vi.fn(),
  mockAdapterStatusCreate: vi.fn(),
  mockAdapterStatusUpdate: vi.fn(),
  mockScrapeCyclesCreate: vi.fn(),
  mockScrapeCyclesFindUnique: vi.fn(),
  mockScrapeCyclesUpdate: vi.fn(),
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
      findUnique: mocks.mockScrapeTargetsFindUnique,
      count: mocks.mockScrapeTargetsCount,
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    scrape_runs: {
      findMany: mocks.mockRunFindMany,
      findFirst: mocks.mockRunFindFirst,
      create: mocks.mockRunCreate,
      update: mocks.mockRunUpdate,
    },
    scrape_cycles: {
      create: mocks.mockScrapeCyclesCreate,
      findUnique: mocks.mockScrapeCyclesFindUnique,
      update: mocks.mockScrapeCyclesUpdate,
    },
    scrape_adapter_status: {
      findMany: mocks.mockAdapterStatusFindMany,
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

vi.mock('../metrics.js', () => metricsMocks)

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

const createCycle = (overrides: Partial<any> = {}) => ({
  id: 'cycle-1',
  adapterId: 'adapter-1',
  status: 'RUNNING',
  trigger: 'SCHEDULED',
  startedAt: new Date('2025-02-03T12:00:00Z'),
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
  let cycleTargets: ReturnType<typeof createTarget>[] = []
  let cycleHasMore = false
  let manualTargets: ReturnType<typeof createTarget>[] = []
  let brokenTargets: ReturnType<typeof createTarget>[] = []

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
    cycleTargets = []
    cycleHasMore = false
    manualTargets = []
    brokenTargets = []

    mocks.mockFindMany.mockImplementation(async (args?: any) => {
      const where = args?.where ?? {}
      if (where.status === 'BROKEN') {
        return brokenTargets
      }
      if (where.lastStatus === 'PENDING_MANUAL') {
        return manualTargets
      }
      if (where.adapterId) {
        if (args?.take === 1) {
          return cycleHasMore ? cycleTargets.slice(0, 1) : []
        }
        return cycleTargets.slice(0, args?.take ?? cycleTargets.length)
      }
      return []
    })

    mocks.mockAdapterStatusFindMany.mockResolvedValue([
      {
        adapterId: 'adapter-1',
        schedule: null,
        lastCycleStartedAt: null,
        currentCycleId: null,
        cycleTimeoutMinutes: 60,
        enabled: true,
        ingestionPaused: false,
      },
    ])
    mocks.mockAdapterStatusFind.mockResolvedValue({ enabled: true, ingestionPaused: false })
    mocks.mockScrapeTargetsCount.mockResolvedValue(2)
    mocks.mockScrapeTargetsFindUnique.mockResolvedValue({ priority: 5 })
    mocks.mockScrapeCyclesCreate.mockResolvedValue(createCycle())
    mocks.mockScrapeCyclesFindUnique.mockResolvedValue(createCycle())
    mocks.mockScrapeCyclesUpdate.mockResolvedValue(createCycle())
    mocks.mockRunFindFirst.mockResolvedValue(null)
  })

  it('creates runs and enqueues jobs per adapter', async () => {
    const adapter = { id: 'adapter-1', version: '1.2.3', domain: 'example.com' }
    mocks.registry.get.mockReturnValue(adapter)

    cycleTargets = [
      createTarget({ id: 'target-1' }),
      createTarget({ id: 'target-2', url: 'https://example.com/other' }),
    ]
    cycleHasMore = false

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
        data: { urlsAttempted: { increment: 2 } },
      })
    )
  })

  it('skips targets when adapter is not registered', async () => {
    mocks.registry.get.mockReturnValue(undefined)
    cycleTargets = [createTarget()]

    await triggerScrapeSchedulerTick({ maxUrlsPerTick: 10 })

    expect(mocks.mockRunCreate).not.toHaveBeenCalled()
    expect(mocks.mockEnqueueScrapeUrl).not.toHaveBeenCalled()
  })

  it('skips scheduling when no adapters are due', async () => {
    mocks.registry.get.mockReturnValue({ id: 'adapter-1', version: '1.0.0', domain: 'example.com' })
    mocks.mockAdapterStatusFindMany.mockResolvedValue([])
    cycleTargets = [createTarget()]

    await triggerScrapeSchedulerTick({ maxUrlsPerTick: 10 })

    expect(mocks.mockRunCreate).not.toHaveBeenCalled()
    expect(mocks.mockEnqueueScrapeUrl).not.toHaveBeenCalled()
  })

  it('records run completion metrics for finalized runs', async () => {
    const adapter = { id: 'adapter-1', version: '1.2.3', domain: 'example.com' }
    mocks.registry.get.mockReturnValue(adapter)
    mocks.mockAdapterStatusFindMany.mockResolvedValue([])

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
    mocks.mockAdapterStatusFindMany.mockResolvedValue([])

    manualTargets = [createTarget({ id: 'target-1' })]
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

  it('skips scheduling when queue utilization is high', async () => {
    mocks.mockGetScrapeQueueStats.mockResolvedValue({
      waiting: 9000,
      active: 200,
      delayed: 0,
      total: 9200,
      capacity: 10000,
      utilizationPercent: 95,
    })
    cycleTargets = [createTarget()]

    await triggerScrapeSchedulerTick({ maxUrlsPerTick: 10 })

    expect(mocks.mockScrapeCyclesCreate).not.toHaveBeenCalled()
    expect(mocks.mockRunCreate).not.toHaveBeenCalled()
    expect(mocks.mockEnqueueScrapeUrl).not.toHaveBeenCalled()
  })

  it('reuses a running scheduled run for the same cycle', async () => {
    const adapter = { id: 'adapter-1', version: '1.2.3', domain: 'example.com' }
    const cycle = createCycle({ id: 'cycle-1' })
    mocks.registry.get.mockReturnValue(adapter)
    mocks.mockAdapterStatusFindMany.mockResolvedValue([
      {
        adapterId: 'adapter-1',
        schedule: null,
        lastCycleStartedAt: cycle.startedAt,
        currentCycleId: 'cycle-1',
        cycleTimeoutMinutes: 60,
        enabled: true,
        ingestionPaused: false,
      },
    ])
    mocks.mockScrapeCyclesFindUnique.mockResolvedValue(cycle)
    mocks.mockRunFindFirst.mockResolvedValue({
      id: 'run-1',
      trigger: 'SCHEDULED',
      cycleId: 'cycle-1',
    })
    cycleTargets = [
      createTarget({ id: 'target-1' }),
      createTarget({ id: 'target-2', url: 'https://example.com/other' }),
    ]

    await triggerScrapeSchedulerTick({ maxUrlsPerTick: 10 })

    expect(mocks.mockRunCreate).not.toHaveBeenCalled()
    expect(mocks.mockEnqueueScrapeUrl).toHaveBeenCalledTimes(2)
    expect(mocks.mockRunUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'run-1' },
        data: { urlsAttempted: { increment: 2 } },
      })
    )
  })

  it('reuses a running scheduled run when cycleId is null', async () => {
    const adapter = { id: 'adapter-1', version: '1.2.3', domain: 'example.com' }
    const cycle = createCycle({ id: 'cycle-1' })
    mocks.registry.get.mockReturnValue(adapter)
    mocks.mockAdapterStatusFindMany.mockResolvedValue([
      {
        adapterId: 'adapter-1',
        schedule: null,
        lastCycleStartedAt: cycle.startedAt,
        currentCycleId: 'cycle-1',
        cycleTimeoutMinutes: 60,
        enabled: true,
        ingestionPaused: false,
      },
    ])
    mocks.mockScrapeCyclesFindUnique.mockResolvedValue(cycle)
    mocks.mockRunFindFirst.mockResolvedValue({
      id: 'run-1',
      trigger: 'SCHEDULED',
      cycleId: null,
    })
    cycleTargets = [createTarget({ id: 'target-1' })]

    await triggerScrapeSchedulerTick({ maxUrlsPerTick: 10 })

    expect(mocks.mockRunCreate).not.toHaveBeenCalled()
    expect(mocks.mockEnqueueScrapeUrl).toHaveBeenCalledTimes(1)
    expect(mocks.mockRunUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'run-1' },
        data: { urlsAttempted: { increment: 1 } },
      })
    )
  })

  it('defers scheduling when an existing run is from a different trigger', async () => {
    const adapter = { id: 'adapter-1', version: '1.2.3', domain: 'example.com' }
    const cycle = createCycle({ id: 'cycle-1' })
    mocks.registry.get.mockReturnValue(adapter)
    mocks.mockAdapterStatusFindMany.mockResolvedValue([
      {
        adapterId: 'adapter-1',
        schedule: null,
        lastCycleStartedAt: cycle.startedAt,
        currentCycleId: 'cycle-1',
        cycleTimeoutMinutes: 60,
        enabled: true,
        ingestionPaused: false,
      },
    ])
    mocks.mockScrapeCyclesFindUnique.mockResolvedValue(cycle)
    mocks.mockRunFindFirst.mockResolvedValue({
      id: 'run-1',
      trigger: 'MANUAL',
      cycleId: 'cycle-1',
    })
    cycleTargets = [createTarget({ id: 'target-1' })]

    await triggerScrapeSchedulerTick({ maxUrlsPerTick: 10 })

    expect(mocks.mockEnqueueScrapeUrl).not.toHaveBeenCalled()
    expect(mocks.mockRunUpdate).not.toHaveBeenCalled()
    expect(mocks.mockScrapeCyclesUpdate).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'COMPLETED' }) })
    )
  })

  it('defers scheduling when an existing run belongs to a different cycle', async () => {
    const adapter = { id: 'adapter-1', version: '1.2.3', domain: 'example.com' }
    const cycle = createCycle({ id: 'cycle-1' })
    mocks.registry.get.mockReturnValue(adapter)
    mocks.mockAdapterStatusFindMany.mockResolvedValue([
      {
        adapterId: 'adapter-1',
        schedule: null,
        lastCycleStartedAt: cycle.startedAt,
        currentCycleId: 'cycle-1',
        cycleTimeoutMinutes: 60,
        enabled: true,
        ingestionPaused: false,
      },
    ])
    mocks.mockScrapeCyclesFindUnique.mockResolvedValue(cycle)
    mocks.mockRunFindFirst.mockResolvedValue({
      id: 'run-1',
      trigger: 'SCHEDULED',
      cycleId: 'cycle-other',
    })
    cycleTargets = [createTarget({ id: 'target-1' })]

    await triggerScrapeSchedulerTick({ maxUrlsPerTick: 10 })

    expect(mocks.mockEnqueueScrapeUrl).not.toHaveBeenCalled()
    expect(mocks.mockRunUpdate).not.toHaveBeenCalled()
    expect(mocks.mockScrapeCyclesUpdate).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'COMPLETED' }) })
    )
  })

  it('finalizes a cycle immediately when there are no targets', async () => {
    const adapter = { id: 'adapter-1', version: '1.2.3', domain: 'example.com' }
    mocks.registry.get.mockReturnValue(adapter)
    mocks.mockScrapeTargetsCount.mockResolvedValueOnce(0)
    const emptyCycle = createCycle({ id: 'cycle-empty', totalTargets: 0 })
    mocks.mockScrapeCyclesCreate.mockResolvedValueOnce(emptyCycle)
    mocks.mockScrapeCyclesFindUnique.mockResolvedValueOnce(emptyCycle)

    await triggerScrapeSchedulerTick({ maxUrlsPerTick: 10 })

    expect(mocks.mockScrapeCyclesUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'cycle-empty' },
        data: expect.objectContaining({ status: 'COMPLETED' }),
      })
    )
    expect(mocks.mockEnqueueScrapeUrl).not.toHaveBeenCalled()
  })

  it('handles stuck cycles by finalizing and starting a new cycle', async () => {
    const adapter = { id: 'adapter-1', version: '1.2.3', domain: 'example.com' }
    const now = Date.now()
    const stuckStartedAt = new Date(now - 2 * 60 * 60 * 1000)
    const stuckCycle = createCycle({ id: 'cycle-stuck', startedAt: stuckStartedAt })
    const newCycle = createCycle({ id: 'cycle-new', totalTargets: 0, startedAt: new Date(now) })

    mocks.registry.get.mockReturnValue(adapter)
    mocks.mockAdapterStatusFindMany.mockResolvedValue([
      {
        adapterId: 'adapter-1',
        schedule: null,
        lastCycleStartedAt: stuckStartedAt,
        currentCycleId: 'cycle-stuck',
        cycleTimeoutMinutes: 30,
        enabled: true,
        ingestionPaused: false,
      },
    ])

    mocks.mockScrapeCyclesFindUnique.mockImplementation(async (args: any) => {
      if (args?.where?.id === 'cycle-stuck') return stuckCycle
      if (args?.where?.id === 'cycle-new') return newCycle
      return stuckCycle
    })

    mocks.mockScrapeTargetsCount.mockResolvedValueOnce(0)
    mocks.mockScrapeCyclesCreate.mockResolvedValueOnce(newCycle)

    await triggerScrapeSchedulerTick({ maxUrlsPerTick: 10 })

    expect(mocks.mockScrapeCyclesUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'cycle-stuck' },
        data: expect.objectContaining({ status: 'FAILED' }),
      })
    )
    expect(mocks.mockScrapeCyclesCreate).toHaveBeenCalled()
    expect(mocks.mockAdapterStatusUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ currentCycleId: null }),
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
