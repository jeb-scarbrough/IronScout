import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mocks = vi.hoisted(() => {
  const state = {
    processor: null as ((job: any) => Promise<void>) | null,
  }

  const fetchImpl = vi.fn()
  const acquireImpl = vi.fn()
  const robotsAllowedImpl = vi.fn()
  const robotsDelayImpl = vi.fn()

  class WorkerMock {
    constructor(_name: string, handler: (job: any) => Promise<void>) {
      state.processor = handler
    }

    on = vi.fn()

    close = vi.fn()
  }

  class HttpFetcherMock {
    fetch = fetchImpl
  }

  class RedisRateLimiterMock {
    acquire = acquireImpl

    close = vi.fn()
  }

  class RobotsPolicyImplMock {
    isAllowed = robotsAllowedImpl

    getCrawlDelay = robotsDelayImpl
  }

  return {
    state,
    fetchImpl,
    acquireImpl,
    robotsAllowedImpl,
    robotsDelayImpl,
    WorkerMock,
    HttpFetcherMock,
    RedisRateLimiterMock,
    RobotsPolicyImplMock,
    mockRegisterAllAdapters: vi.fn(),
    mockWriteScrapeOffer: vi.fn(),
    mockUpdateTargetTracking: vi.fn(),
    mockMarkTargetBroken: vi.fn(),
    mockFinalizeRun: vi.fn(),
    mockScrapeTargetsFindUnique: vi.fn(),
    mockSourcesFindUnique: vi.fn(),
    mockScrapeRunsUpdate: vi.fn(),
    registry: {
      get: vi.fn(),
      size: vi.fn().mockReturnValue(1),
    },
  }
})

const metricsMocks = vi.hoisted(() => ({
  recordZeroPriceQuarantine: vi.fn(),
}))

vi.mock('bullmq', () => ({
  Worker: mocks.WorkerMock,
  Job: vi.fn(),
}))

vi.mock('@ironscout/db', () => ({
  prisma: {
    scrape_targets: { findUnique: mocks.mockScrapeTargetsFindUnique },
    sources: { findUnique: mocks.mockSourcesFindUnique },
    scrape_runs: { update: mocks.mockScrapeRunsUpdate },
    quarantined_records: { upsert: vi.fn() },
  },
}))

vi.mock('../registry.js', () => ({
  getAdapterRegistry: () => mocks.registry,
}))

vi.mock('../adapters/index.js', () => ({
  registerAllAdapters: mocks.mockRegisterAllAdapters,
}))

vi.mock('../fetch/http-fetcher.js', () => ({
  HttpFetcher: mocks.HttpFetcherMock,
}))

vi.mock('../fetch/rate-limiter.js', () => ({
  RedisRateLimiter: mocks.RedisRateLimiterMock,
}))

vi.mock('../fetch/robots.js', () => ({
  RobotsPolicyImpl: mocks.RobotsPolicyImplMock,
}))

vi.mock('../process/writer.js', () => ({
  writeScrapeOffer: mocks.mockWriteScrapeOffer,
  updateTargetTracking: mocks.mockUpdateTargetTracking,
  markTargetBroken: mocks.mockMarkTargetBroken,
  finalizeRun: mocks.mockFinalizeRun,
}))

vi.mock('../process/validator.js', () => ({
  validateOffer: vi.fn(),
  createDropFromExtractFailure: vi.fn(),
  shouldCountTowardDrift: vi.fn().mockReturnValue(false),
}))

vi.mock('../process/run-dedupe.js', () => ({
  checkAndAddIdentityKey: vi.fn().mockResolvedValue(false),
  closeDedupeClient: vi.fn(),
}))

vi.mock('../process/drift-detector.js', () => ({
  shouldMarkUrlBroken: vi.fn((failures) => failures >= 5),
  checkAutoDisable: vi.fn(),
}))

vi.mock('../metrics.js', () => metricsMocks)

vi.mock('../../config/queues.js', () => ({
  QUEUE_NAMES: { SCRAPE_URL: 'scrape-url' },
  enqueueProductResolve: vi.fn(),
  decrementAdapterPending: vi.fn(),
}))

vi.mock('../../resolver/index.js', () => ({
  RESOLVER_VERSION: '1.0.0-test',
}))

vi.mock('../../config/redis.js', () => ({
  redisConnection: {},
}))

vi.mock('../../config/logger.js', () => {
  const mockLoggerChild = vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }))

  const mockLoggerInstance = {
    scraper: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      child: mockLoggerChild,
    },
    resolver: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      child: mockLoggerChild,
    },
  }

  return {
    logger: mockLoggerInstance,
    loggers: mockLoggerInstance,
  }
})

import { startScrapeWorker, stopScrapeWorker } from '../worker.js'

const createAdapter = (overrides: Partial<any> = {}) => ({
  id: 'adapter-1',
  version: '1.0.0',
  domain: 'example.com',
  requiresJsRendering: false,
  extract: vi.fn(),
  normalize: vi.fn(),
  ...overrides,
})

const createJob = (overrides: Partial<any> = {}) => ({
  id: 'job-1',
  data: {
    targetId: 'target-1',
    url: 'https://example.com/product',
    sourceId: 'source-1',
    retailerId: 'retailer-1',
    adapterId: 'adapter-1',
    runId: 'run-1',
    priority: 1,
    trigger: 'SCHEDULED',
    ...overrides,
  },
})

describe('Scrape URL Worker', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    mocks.state.processor = null
    mocks.fetchImpl.mockResolvedValue(undefined)
    mocks.acquireImpl.mockResolvedValue(undefined)
    // Default source mock: scraping enabled
    mocks.mockSourcesFindUnique.mockResolvedValue({
      scrapeEnabled: true,
      robotsCompliant: true,
    })
    await startScrapeWorker()
  })

  afterEach(async () => {
    await stopScrapeWorker()
  })

  it('throws when adapter is not found', async () => {
    mocks.registry.get.mockReturnValue(undefined)

    const job = createJob({ adapterId: 'missing' })

    await expect(mocks.state.processor!(job)).rejects.toThrow("Adapter 'missing' not found")
  })

  it('marks URL as BROKEN after consecutive fetch failures', async () => {
    const adapter = createAdapter()
    mocks.registry.get.mockReturnValue(adapter)

    mocks.mockScrapeTargetsFindUnique.mockResolvedValue({
      id: 'target-1',
      sourceProductId: null,
      consecutiveFailures: 4,
      robotsPathBlocked: false,
    })

    mocks.fetchImpl.mockResolvedValue({ status: 'error', error: 'boom', durationMs: 5 })

    const job = createJob()
    await mocks.state.processor!(job)

    expect(mocks.mockUpdateTargetTracking).toHaveBeenCalledWith('target-1', false)
    expect(mocks.mockMarkTargetBroken).toHaveBeenCalledWith('target-1')
    expect(mocks.mockScrapeRunsUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'run-1' },
        data: { urlsFailed: { increment: 1 } },
      })
    )
  })

  it('skips fetch when URL is admin-blocked', async () => {
    const adapter = createAdapter()
    mocks.registry.get.mockReturnValue(adapter)

    mocks.mockScrapeTargetsFindUnique.mockResolvedValue({
      id: 'target-1',
      sourceProductId: null,
      consecutiveFailures: 0,
      robotsPathBlocked: true,
    })

    const job = createJob()
    await mocks.state.processor!(job)

    expect(mocks.fetchImpl).not.toHaveBeenCalled()
    // Per spec: admin-blocked URLs skip without counting as failure
    expect(mocks.mockUpdateTargetTracking).not.toHaveBeenCalled()
  })

  it('writes offer on success path', async () => {
    const adapter = createAdapter()
    mocks.registry.get.mockReturnValue(adapter)

    mocks.mockScrapeTargetsFindUnique.mockResolvedValue({
      id: 'target-1',
      sourceProductId: null,
      consecutiveFailures: 0,
      robotsPathBlocked: false,
    })

    const offer = {
      sourceId: 'source-1',
      retailerId: 'retailer-1',
      url: 'https://example.com/product',
      title: 'Test',
      priceCents: 1999,
      currency: 'USD',
      availability: 'IN_STOCK',
      observedAt: new Date('2025-01-01T00:00:00Z'),
      identityKey: 'SKU:ABC',
      adapterVersion: '1.0.0',
    }

    adapter.extract.mockReturnValue({ ok: true, offer })
    adapter.normalize.mockReturnValue({ status: 'ok', offer })

    mocks.fetchImpl.mockResolvedValue({ status: 'ok', html: '<html></html>', durationMs: 5 })
    mocks.mockWriteScrapeOffer.mockResolvedValue({
      success: true,
      sourceProductId: 'sp-1',
      priceId: 'price-1',
    })

    const job = createJob()
    await mocks.state.processor!(job)

    expect(mocks.mockWriteScrapeOffer).toHaveBeenCalled()
    expect(mocks.mockUpdateTargetTracking).toHaveBeenCalledWith('target-1', true)
    expect(mocks.mockScrapeRunsUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'run-1' },
        data: { urlsSucceeded: { increment: 1 } },
      })
    )
  })

  it('records zero-price quarantine alert', async () => {
    const adapter = createAdapter()
    mocks.registry.get.mockReturnValue(adapter)

    mocks.mockScrapeTargetsFindUnique.mockResolvedValue({
      id: 'target-1',
      sourceProductId: null,
      consecutiveFailures: 0,
      robotsPathBlocked: false,
    })

    const offer = {
      sourceId: 'source-1',
      retailerId: 'retailer-1',
      url: 'https://example.com/product',
      title: 'Test',
      priceCents: 0,
      currency: 'USD',
      availability: 'IN_STOCK',
      observedAt: new Date('2025-01-01T00:00:00Z'),
      identityKey: 'SKU:ABC',
      adapterVersion: '1.0.0',
    }

    adapter.extract.mockReturnValue({ ok: true, offer })
    adapter.normalize.mockReturnValue({ status: 'quarantine', reason: 'ZERO_PRICE_EXTRACTED', offer })

    mocks.fetchImpl.mockResolvedValue({ status: 'ok', html: '<html></html>', durationMs: 5 })

    const job = createJob()
    await mocks.state.processor!(job)

    expect(metricsMocks.recordZeroPriceQuarantine).toHaveBeenCalledWith(
      expect.objectContaining({
        adapterId: 'adapter-1',
        sourceId: 'source-1',
        runId: 'run-1',
        targetId: 'target-1',
        url: 'https://example.com/product',
      })
    )
  })
})
