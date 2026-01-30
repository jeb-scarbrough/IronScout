import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockRunCreate: vi.fn(),
  mockRunUpdate: vi.fn(),
  mockAdapterStatusFind: vi.fn(),
  mockEnqueueScrapeUrl: vi.fn(),
  registry: {
    get: vi.fn(),
  },
}))

vi.mock('@ironscout/db', () => ({
  prisma: {
    scrape_targets: { findMany: mocks.mockFindMany },
    scrape_runs: { create: mocks.mockRunCreate, update: mocks.mockRunUpdate },
    scrape_adapter_status: { findUnique: mocks.mockAdapterStatusFind },
  },
}))

vi.mock('../registry.js', () => ({
  getAdapterRegistry: () => mocks.registry,
}))

vi.mock('../../config/queues.js', () => ({
  enqueueScrapeUrl: mocks.mockEnqueueScrapeUrl,
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

import { triggerScrapeSchedulerTick } from '../scheduler.js'

const createTarget = (overrides: Partial<any> = {}) => ({
  id: 'target-1',
  url: 'https://example.com/product',
  sourceId: 'source-1',
  adapterId: 'adapter-1',
  priority: 5,
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
  })

  it('creates runs and enqueues jobs per adapter', async () => {
    const adapter = { id: 'adapter-1', version: '1.2.3', domain: 'example.com' }
    mocks.registry.get.mockReturnValue(adapter)
    mocks.mockAdapterStatusFind.mockResolvedValue({ enabled: true })

    mocks.mockFindMany.mockResolvedValue([
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
    mocks.mockFindMany.mockResolvedValue([createTarget()])

    await triggerScrapeSchedulerTick({ maxUrlsPerTick: 10 })

    expect(mocks.mockRunCreate).not.toHaveBeenCalled()
    expect(mocks.mockEnqueueScrapeUrl).not.toHaveBeenCalled()
  })

  it('skips targets when adapter is disabled', async () => {
    const adapter = { id: 'adapter-1', version: '1.0.0', domain: 'example.com' }
    mocks.registry.get.mockReturnValue(adapter)
    mocks.mockAdapterStatusFind.mockResolvedValue({ enabled: false })
    mocks.mockFindMany.mockResolvedValue([createTarget()])

    await triggerScrapeSchedulerTick({ maxUrlsPerTick: 10 })

    expect(mocks.mockRunCreate).not.toHaveBeenCalled()
    expect(mocks.mockEnqueueScrapeUrl).not.toHaveBeenCalled()
  })
})
