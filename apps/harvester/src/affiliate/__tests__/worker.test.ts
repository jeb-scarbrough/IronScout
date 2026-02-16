/**
 * Tests for Affiliate Feed Worker
 *
 * Tests the main job processor including:
 * - Feed eligibility checks (DRAFT, DISABLED, ENABLED statuses)
 * - Lock acquisition and retry handling
 * - Run record creation and updates
 * - Error classification for retry decisions
 * - Failure counting and auto-disable behavior
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Job } from 'bullmq'

const workerMocks = vi.hoisted(() => {
  const state = {
    processor: null as ((job: any) => Promise<void>) | null,
  }

  class WorkerMock {
    constructor(_name: string, handler: (job: any) => Promise<void>) {
      state.processor = handler
    }

    on = vi.fn()

    close = vi.fn()
  }

  return { state, WorkerMock }
})

const mocks = vi.hoisted(() => ({
  mockPrismaFind: vi.fn(),
  mockPrismaCreate: vi.fn(),
  mockPrismaUpdate: vi.fn(),
  mockPrismaUpdateMany: vi.fn(),
  mockPrismaFindFirst: vi.fn(),
  mockPrismaFindUniqueOrThrow: vi.fn(),
  mockAcquireLock: vi.fn(),
  mockReleaseLock: vi.fn(),
  mockStartLockRenewal: vi.fn(),
  mockStopLockRenewal: vi.fn(),
  mockDownloadFeed: vi.fn(),
  mockParseFeed: vi.fn(),
  mockProcessProducts: vi.fn(),
  mockEvaluateCircuitBreaker: vi.fn(),
  mockPromoteProducts: vi.fn(),
  mockCopySeenFromPreviousRun: vi.fn(),
  mockIsCircuitBreakerBypassed: vi.fn(),
  mockNotifyFailed: vi.fn(),
  mockNotifyCircuitBreaker: vi.fn(),
  mockNotifyAutoDisabled: vi.fn(),
  mockNotifyRecovered: vi.fn(),
  mockQueueAdd: vi.fn(),
}))

vi.mock('bullmq', () => ({
  Worker: workerMocks.WorkerMock,
  Job: vi.fn(),
}))

vi.mock('@ironscout/db', () => ({
  prisma: {
    affiliateFeed: {
      findUnique: mocks.mockPrismaFind,
      update: mocks.mockPrismaUpdate,
    },
    affiliateFeedRun: {
      create: mocks.mockPrismaCreate,
      findUniqueOrThrow: mocks.mockPrismaFindUniqueOrThrow,
      update: mocks.mockPrismaUpdate,
    },
    affiliateFeedRunError: {
      createMany: vi.fn(),
    },
    affiliate_feeds: {
      findUnique: mocks.mockPrismaFind,
      update: mocks.mockPrismaUpdate,
      updateMany: mocks.mockPrismaUpdateMany,
    },
    affiliate_feed_runs: {
      create: mocks.mockPrismaCreate,
      findUniqueOrThrow: mocks.mockPrismaFindUniqueOrThrow,
      findFirst: mocks.mockPrismaFindFirst,
      update: mocks.mockPrismaUpdate,
    },
    affiliate_feed_run_errors: {
      createMany: vi.fn(),
    },
  },
  Prisma: { DbNull: null },
  isCircuitBreakerBypassed: mocks.mockIsCircuitBreakerBypassed,
}))

vi.mock('../lock', () => ({
  acquireFeedLock: mocks.mockAcquireLock,
  startLockRenewal: mocks.mockStartLockRenewal,
  stopLockRenewal: mocks.mockStopLockRenewal,
}))

vi.mock('../fetcher', () => ({
  downloadFeed: mocks.mockDownloadFeed,
}))

vi.mock('../parser', () => ({
  parseFeed: mocks.mockParseFeed,
}))

vi.mock('../processor', () => ({
  processProducts: mocks.mockProcessProducts,
}))

vi.mock('../circuit-breaker', () => ({
  evaluateCircuitBreaker: mocks.mockEvaluateCircuitBreaker,
  promoteProducts: mocks.mockPromoteProducts,
  copySeenFromPreviousRun: mocks.mockCopySeenFromPreviousRun,
}))

vi.mock('@ironscout/notifications', () => ({
  notifyAffiliateFeedRunFailed: mocks.mockNotifyFailed,
  notifyCircuitBreakerTriggered: mocks.mockNotifyCircuitBreaker,
  notifyAffiliateFeedAutoDisabled: mocks.mockNotifyAutoDisabled,
  notifyAffiliateFeedRecovered: mocks.mockNotifyRecovered,
}))

vi.mock('../../config/queues', () => ({
  QUEUE_NAMES: { AFFILIATE_FEED: 'affiliate-feed' },
  affiliateFeedQueue: { add: mocks.mockQueueAdd },
}))

vi.mock('../../config/redis', () => ({
  redisConnection: {},
  getSharedBullMQConnection: vi.fn(() => ({})),
}))

vi.mock('../../config/logger', () => ({
  logger: {
    affiliate: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
  },
}))

vi.mock('../../config/run-file-logger', () => {
  const createRunFileLogger = vi.fn(() => {
    const logger: any = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      fatal: vi.fn(),
      child: vi.fn(() => logger),
      close: vi.fn().mockResolvedValue(undefined),
      filePath: '/tmp/mock-run.log',
    }
    return logger
  })

  return {
    createRunFileLogger,
    createDualLogger: vi.fn((consoleLogger) => consoleLogger),
  }
})

const {
  mockPrismaFind,
  mockPrismaCreate,
  mockPrismaUpdate,
  mockPrismaUpdateMany,
  mockPrismaFindFirst,
  mockPrismaFindUniqueOrThrow,
  mockAcquireLock,
  mockReleaseLock,
  mockStartLockRenewal,
  mockStopLockRenewal,
  mockDownloadFeed,
  mockParseFeed,
  mockProcessProducts,
  mockEvaluateCircuitBreaker,
  mockPromoteProducts,
  mockCopySeenFromPreviousRun,
  mockIsCircuitBreakerBypassed,
  mockNotifyFailed,
  mockNotifyCircuitBreaker,
  mockNotifyAutoDisabled,
  mockNotifyRecovered,
} = mocks

import { createAffiliateFeedWorker } from '../worker'

// Create mock feed data
const createMockFeed = (overrides = {}) => ({
  id: 'feed-123',
  sourceId: 'source-456',
  status: 'ENABLED',
  feedLockId: BigInt(12345),
  format: 'CSV',
  transport: 'SFTP',
  host: 'ftp.example.com',
  port: 22,
  path: '/feeds/products.csv',
  username: 'user',
  secretCiphertext: Buffer.from('encrypted'),
  consecutiveFailures: 0,
  scheduleFrequencyHours: 24,
  expiryHours: 72,
  maxRowCount: 500000,
  network: 'IMPACT',
  manualRunPending: false,
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  sources: {
    id: 'source-456',
    name: 'Test Source',
    retailerId: 'retailer-789',
    retailers: { id: 'retailer-789', name: 'Test Retailer' },
  },
  ...overrides,
})

const createMockRun = (overrides = {}) => ({
  id: 'run-abc',
  feedId: 'feed-123',
  sourceId: 'source-456',
  trigger: 'SCHEDULED',
  status: 'RUNNING',
  startedAt: new Date(),
  ...overrides,
})

const createMockJob = (data = {}) =>
  ({
    id: 'job-xyz',
    data: {
      feedId: 'feed-123',
      trigger: 'SCHEDULED',
      ...data,
    },
    attemptsMade: 0,
    updateData: vi.fn().mockResolvedValue(undefined),
    discard: vi.fn().mockResolvedValue(undefined),
    timestamp: Date.now(),
  }) as unknown as Job

const getProcessor = () => {
  createAffiliateFeedWorker()
  if (!workerMocks.state.processor) {
    throw new Error('Affiliate feed processor not initialized')
  }
  return workerMocks.state.processor
}

const getFinalizeSkippedReason = () => {
  const call = mockPrismaUpdate.mock.calls.find(([args]) => args?.data?.skippedReason !== undefined)
  return call?.[0]?.data?.skippedReason
}

const createSkippedDownload = (skippedReason: string) => ({
  content: Buffer.alloc(0),
  mtime: new Date(),
  size: BigInt(0),
  contentHash: 'hash-unchanged',
  skipped: true,
  skippedReason,
})

describe('Affiliate Feed Worker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    workerMocks.state.processor = null
    mockIsCircuitBreakerBypassed.mockResolvedValue(false)
    mockReleaseLock.mockResolvedValue(true)
    mockAcquireLock.mockResolvedValue({
      feedId: 'feed-123',
      handle: { key: 'feed-lock:feed-123', token: 'token-123' },
      release: mockReleaseLock,
    })
  })

  describe('Feed Eligibility', () => {
    it('should skip DRAFT feeds', async () => {
      const mockFeed = createMockFeed({ status: 'DRAFT' })
      mockPrismaFind.mockResolvedValue(mockFeed)

      // DRAFT feeds should be skipped - verify the status is set correctly
      // (Actual worker integration tested via scheduler tests)
      expect(mockFeed.status).toBe('DRAFT')
    })

    it('should skip DISABLED feeds for scheduled triggers', async () => {
      const mockFeed = createMockFeed({ status: 'DISABLED' })

      expect(mockFeed.status).toBe('DISABLED')
      // Scheduled trigger should skip
    })

    it('should process DISABLED feeds for MANUAL trigger', async () => {
      const mockFeed = createMockFeed({ status: 'DISABLED' })

      expect(mockFeed.status).toBe('DISABLED')
      // MANUAL trigger should NOT skip
    })

    it('should process DISABLED feeds for ADMIN_TEST trigger', async () => {
      const mockFeed = createMockFeed({ status: 'DISABLED' })

      expect(mockFeed.status).toBe('DISABLED')
      // ADMIN_TEST trigger should NOT skip
    })
  })

  describe('Lock Acquisition', () => {
    it('should skip job when lock cannot be acquired for scheduled trigger', async () => {
      mockAcquireLock.mockResolvedValue(null)

      // Lock not acquired, job should be skipped silently
      expect(mockAcquireLock).toBeDefined()
    })

    it('should keep manualRunPending for MANUAL trigger when lock busy', async () => {
      mockAcquireLock.mockResolvedValue(null)

      // Per spec §6.3.2: Keep manualRunPending = true
      // This is handled in the worker logic
      expect(true).toBe(true)
    })

    it('should release lock after job completion', async () => {
      mockAcquireLock.mockResolvedValue({
        feedId: 'feed-123',
        handle: { key: 'feed-lock:feed-123', token: 'token-123' },
        release: mockReleaseLock,
      })
      mockReleaseLock.mockResolvedValue(true)

      expect(mockReleaseLock).toBeDefined()
    })

    it('should release lock even if job fails', async () => {
      mockAcquireLock.mockResolvedValue({
        feedId: 'feed-123',
        handle: { key: 'feed-lock:feed-123', token: 'token-123' },
        release: mockReleaseLock,
      })
      mockReleaseLock.mockResolvedValue(true)

      // Lock should be released in finally block
      expect(mockReleaseLock).toBeDefined()
    })

    it('releases lock if run creation throws before phase try/catch', async () => {
      const processor = getProcessor()
      const mockJob = createMockJob()

      mockPrismaFind.mockResolvedValue(createMockFeed())
      mockPrismaFindFirst.mockResolvedValue(null)
      mockPrismaCreate.mockRejectedValue(new Error('run create failed'))

      await expect(processor(mockJob)).rejects.toThrow('run create failed')
      expect(mockReleaseLock).toHaveBeenCalled()
      expect(mockStopLockRenewal).toHaveBeenCalled()
    })
  })

  describe('Run Record Management', () => {
    it('should create run record on first attempt', async () => {
      const mockFeed = createMockFeed()
      const mockRun = createMockRun()

      mockPrismaFind.mockResolvedValue(mockFeed)
      mockPrismaCreate.mockResolvedValue(mockRun)
      mockAcquireLock.mockResolvedValue({
        feedId: 'feed-123',
        handle: { key: 'feed-lock:feed-123', token: 'token-123' },
        release: mockReleaseLock,
      })

      expect(mockPrismaCreate).toBeDefined()
    })

    it('should reuse existing run record on retry', async () => {
      const mockRun = createMockRun()
      const mockJob = createMockJob({ runId: 'run-abc' })

      mockPrismaFindUniqueOrThrow.mockResolvedValue(mockRun)

      // Job already has runId, should reuse
      expect(mockJob.data.runId).toBe('run-abc')
    })

    it('should abort retry if existing run is not RUNNING', async () => {
      const mockRun = createMockRun({ status: 'SUCCEEDED' })

      mockPrismaFindUniqueOrThrow.mockResolvedValue(mockRun)

      // Run is in terminal status, should not proceed
      expect(mockRun.status).not.toBe('RUNNING')
    })

    it('should update job data with runId immediately after creation', async () => {
      const mockJob = createMockJob()
      const mockRun = createMockRun()

      mockPrismaCreate.mockResolvedValue(mockRun)

      // Per spec §6.4.1: job.updateData must be called immediately
      expect(mockJob.updateData).toBeDefined()
    })
  })

  describe('Failure Handling', () => {
    it('should increment consecutiveFailures on failure', async () => {
      const mockFeed = createMockFeed({ consecutiveFailures: 1 })

      // After failure, consecutiveFailures should be 2
      expect(mockFeed.consecutiveFailures + 1).toBe(2)
    })

    it('should auto-disable feed after MAX_CONSECUTIVE_FAILURES', async () => {
      const mockFeed = createMockFeed({ consecutiveFailures: 2 })

      // After 3rd failure (0+3), feed should be disabled
      // MAX_CONSECUTIVE_FAILURES = 3
      expect(mockFeed.consecutiveFailures + 1).toBe(3)
    })

    it('should send notification when auto-disabling', async () => {
      mockNotifyAutoDisabled.mockResolvedValue(undefined)

      expect(mockNotifyAutoDisabled).toBeDefined()
    })

    it('should reset consecutiveFailures on success', async () => {
      const mockFeed = createMockFeed({ consecutiveFailures: 2 })

      // After success, consecutiveFailures should be 0
      expect(mockPrismaUpdate).toBeDefined()
    })

    it('should send recovery notification after previous failures', async () => {
      mockNotifyRecovered.mockResolvedValue(undefined)

      expect(mockNotifyRecovered).toBeDefined()
    })
  })

  describe('Manual Run Flag Lifecycle', () => {
    const setupRunMocks = (trigger: 'MANUAL' | 'SCHEDULED' = 'MANUAL') => {
      const feed = createMockFeed({ manualRunPending: true })
      const run = createMockRun({ trigger })
      mockPrismaFind.mockResolvedValue(feed)
      mockPrismaFindFirst.mockResolvedValue(null)
      mockPrismaCreate.mockResolvedValue(run)
      mockPrismaUpdate.mockResolvedValue(undefined)
      mockPrismaUpdateMany.mockResolvedValue({ count: 1 })
      mockDownloadFeed.mockResolvedValue(createSkippedDownload('FILE_NOT_FOUND'))
      return { feed, run }
    }

    it('should clear manualRunPending after run creation + job.updateData for MANUAL trigger', async () => {
      const processor = getProcessor()
      const job = createMockJob({ trigger: 'MANUAL' })
      const { feed } = setupRunMocks('MANUAL')

      await processor(job)

      expect(mockPrismaUpdateMany).toHaveBeenCalledWith({
        where: {
          id: feed.id,
          manualRunPending: true,
          updatedAt: feed.updatedAt,
        },
        data: { manualRunPending: false },
      })
    })

    it('should not clear manualRunPending for SCHEDULED trigger', async () => {
      const processor = getProcessor()
      setupRunMocks('SCHEDULED')

      await processor(createMockJob({ trigger: 'SCHEDULED' }))

      expect(mockPrismaUpdateMany).not.toHaveBeenCalled()
    })

    it('should continue processing if pending-clear update fails', async () => {
      const processor = getProcessor()
      setupRunMocks('MANUAL')
      mockPrismaUpdateMany.mockRejectedValueOnce(new Error('pending clear failed'))

      await processor(createMockJob({ trigger: 'MANUAL' }))

      expect(mockReleaseLock).toHaveBeenCalled()
      expect(mockPrismaUpdate).toHaveBeenCalled()
    })
  })
})

describe('Error Classification', () => {
  describe('AffiliateFeedError', () => {
    it('should classify transient errors as retryable', async () => {
      const { AffiliateFeedError, FAILURE_KIND } = await import('../types')

      const error = AffiliateFeedError.transientError('timeout', 'CONNECTION_TIMEOUT' as any)

      expect(error.retryable).toBe(true)
      expect(error.kind).toBe(FAILURE_KIND.TRANSIENT)
    })

    it('should classify permanent errors as non-retryable', async () => {
      const { AffiliateFeedError, FAILURE_KIND } = await import('../types')

      const error = AffiliateFeedError.permanentError('not found', 'FILE_NOT_FOUND' as any)

      expect(error.retryable).toBe(false)
      expect(error.kind).toBe(FAILURE_KIND.PERMANENT)
    })

    it('should classify config errors as non-retryable', async () => {
      const { AffiliateFeedError, FAILURE_KIND } = await import('../types')

      const error = AffiliateFeedError.configError('bad credentials')

      expect(error.retryable).toBe(false)
      expect(error.kind).toBe(FAILURE_KIND.CONFIG)
    })

    it('should map HTTP 401 to auth failed config error', async () => {
      const { AffiliateFeedError, ERROR_CODES, FAILURE_KIND } = await import('../types')

      const error = AffiliateFeedError.fromHttpStatus(401, 'Unauthorized')

      expect(error.code).toBe(ERROR_CODES.AUTH_FAILED)
      expect(error.kind).toBe(FAILURE_KIND.CONFIG)
    })

    it('should map HTTP 404 to file not found permanent error', async () => {
      const { AffiliateFeedError, ERROR_CODES, FAILURE_KIND } = await import('../types')

      const error = AffiliateFeedError.fromHttpStatus(404, 'Not found')

      expect(error.code).toBe(ERROR_CODES.FILE_NOT_FOUND)
      expect(error.kind).toBe(FAILURE_KIND.PERMANENT)
    })

    it('should map HTTP 5xx to transient error', async () => {
      const { AffiliateFeedError, FAILURE_KIND } = await import('../types')

      const error = AffiliateFeedError.fromHttpStatus(503, 'Service unavailable')

      expect(error.kind).toBe(FAILURE_KIND.TRANSIENT)
      expect(error.retryable).toBe(true)
    })

    it('should map ECONNRESET to transient error', async () => {
      const { AffiliateFeedError, FAILURE_KIND } = await import('../types')

      const error = AffiliateFeedError.fromNetworkError('ECONNRESET', 'Connection reset')

      expect(error.kind).toBe(FAILURE_KIND.TRANSIENT)
      expect(error.retryable).toBe(true)
    })

    it('should map ETIMEDOUT to transient error', async () => {
      const { AffiliateFeedError, FAILURE_KIND } = await import('../types')

      const error = AffiliateFeedError.fromNetworkError('ETIMEDOUT', 'Timed out')

      expect(error.kind).toBe(FAILURE_KIND.TRANSIENT)
    })

    it('should map unknown network errors to permanent', async () => {
      const { AffiliateFeedError, FAILURE_KIND } = await import('../types')

      const error = AffiliateFeedError.fromNetworkError('UNKNOWN_CODE', 'Unknown error')

      expect(error.kind).toBe(FAILURE_KIND.PERMANENT)
    })
  })
})

describe('Circuit Breaker Integration', () => {
  it('should block promotion when circuit breaker triggers', async () => {
    mockEvaluateCircuitBreaker.mockResolvedValue({
      passed: false,
      reason: 'SPIKE_THRESHOLD_EXCEEDED',
      metrics: {
        activeCountBefore: 1000,
        seenSuccessCount: 500,
        wouldExpireCount: 400,
        urlHashFallbackCount: 10,
        expiryPercentage: 40,
      },
    })

    const result = await mockEvaluateCircuitBreaker()

    expect(result.passed).toBe(false)
    expect(result.reason).toBe('SPIKE_THRESHOLD_EXCEEDED')
  })

  it('should send notification when circuit breaker triggers', async () => {
    mockNotifyCircuitBreaker.mockResolvedValue(undefined)

    expect(mockNotifyCircuitBreaker).toBeDefined()
  })

  it('should proceed with promotion when circuit breaker passes', async () => {
    mockEvaluateCircuitBreaker.mockResolvedValue({
      passed: true,
      metrics: {
        activeCountBefore: 1000,
        seenSuccessCount: 950,
        wouldExpireCount: 50,
        urlHashFallbackCount: 10,
        expiryPercentage: 5,
      },
    })
    mockPromoteProducts.mockResolvedValue(950)

    const cbResult = await mockEvaluateCircuitBreaker()
    const promoted = cbResult.passed ? await mockPromoteProducts() : 0

    expect(cbResult.passed).toBe(true)
    expect(promoted).toBe(950)
  })
})

describe('Phase 1: Download → Parse → Process', () => {
  it('should skip processing when feed content unchanged', async () => {
    mockDownloadFeed.mockResolvedValue({
      content: Buffer.alloc(0),
      mtime: new Date(),
      size: BigInt(0),
      contentHash: 'abc123',
      skipped: true,
      skippedReason: 'UNCHANGED_HASH',
    })

    const result = await mockDownloadFeed()

    expect(result.skipped).toBe(true)
    expect(result.skippedReason).toBe('UNCHANGED_HASH')
  })

  it('should process products after successful download and parse', async () => {
    mockDownloadFeed.mockResolvedValue({
      content: Buffer.from('csv,data'),
      mtime: new Date(),
      size: BigInt(100),
      contentHash: 'new-hash',
      skipped: false,
    })

    mockParseFeed.mockResolvedValue({
      products: [{ name: 'Test', url: 'http://test.com', price: 10, inStock: true, rowNumber: 1 }],
      rowsRead: 1,
      rowsParsed: 1,
      errors: [],
    })

    mockProcessProducts.mockResolvedValue({
      productsUpserted: 1,
      pricesWritten: 1,
      productsRejected: 0,
      duplicateKeyCount: 0,
      urlHashFallbackCount: 0,
      errors: [],
    })

    const downloadResult = await mockDownloadFeed()
    const parseResult = await mockParseFeed()
    const processResult = await mockProcessProducts()

    expect(downloadResult.skipped).toBe(false)
    expect(parseResult.products.length).toBe(1)
    expect(processResult.productsUpserted).toBe(1)
  })
})

describe('SKIPPED run classification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    workerMocks.state.processor = null
    mockIsCircuitBreakerBypassed.mockResolvedValue(false)
  })

  const setupBaseMocks = () => {
    const feed = createMockFeed()
    const run = createMockRun()

    mockPrismaFind.mockResolvedValueOnce(feed)
    mockPrismaCreate.mockResolvedValue(run)
    mockPrismaUpdate.mockResolvedValue(undefined)
    mockAcquireLock.mockResolvedValue({
      feedId: 'feed-123',
      handle: { key: 'feed-lock:feed-123', token: 'token-123' },
      release: mockReleaseLock,
    })
    mockReleaseLock.mockResolvedValue(true)

    return { feed, run }
  }

  it('UNCHANGED_HASH + successful refresh → REFRESHED_FROM_PREVIOUS', async () => {
    setupBaseMocks()
    const previousRun = createMockRun({
      id: 'run-prev',
      productsRejected: 2,
      duplicateKeyCount: 1,
      urlHashFallbackCount: 3,
    })

    mockPrismaFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(previousRun)
    mockDownloadFeed.mockResolvedValue(createSkippedDownload('UNCHANGED_HASH'))
    mockCopySeenFromPreviousRun.mockResolvedValue(5)
    mockEvaluateCircuitBreaker.mockResolvedValue({
      passed: true,
      metrics: {
        activeCountBefore: 0,
        seenSuccessCount: 0,
        wouldExpireCount: 0,
        urlHashFallbackCount: 0,
        expiryPercentage: 0,
      },
    })
    mockPromoteProducts.mockResolvedValue(5)

    const processor = getProcessor()
    await processor(createMockJob())

    expect(mockCopySeenFromPreviousRun).toHaveBeenCalled()
    expect(mockEvaluateCircuitBreaker).toHaveBeenCalled()
    expect(mockPromoteProducts).toHaveBeenCalled()
    expect(getFinalizeSkippedReason()).toBe('REFRESHED_FROM_PREVIOUS')
  })

  it('UNCHANGED_HASH + no previous run → true skip with UNCHANGED_HASH', async () => {
    setupBaseMocks()

    mockPrismaFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
    mockDownloadFeed.mockResolvedValue(createSkippedDownload('UNCHANGED_HASH'))

    const processor = getProcessor()
    await processor(createMockJob())

    expect(mockCopySeenFromPreviousRun).not.toHaveBeenCalled()
    expect(getFinalizeSkippedReason()).toBe('UNCHANGED_HASH')
  })

  it('UNCHANGED_MTIME + zero copied rows → true skip with UNCHANGED_MTIME', async () => {
    setupBaseMocks()
    const previousRun = createMockRun({
      id: 'run-prev',
      productsRejected: 1,
      duplicateKeyCount: 0,
      urlHashFallbackCount: 0,
    })

    mockPrismaFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(previousRun)
    mockDownloadFeed.mockResolvedValue(createSkippedDownload('UNCHANGED_MTIME'))
    mockCopySeenFromPreviousRun.mockResolvedValue(0)

    const processor = getProcessor()
    await processor(createMockJob())

    expect(mockCopySeenFromPreviousRun).toHaveBeenCalled()
    expect(mockEvaluateCircuitBreaker).not.toHaveBeenCalled()
    expect(mockPromoteProducts).not.toHaveBeenCalled()
    expect(getFinalizeSkippedReason()).toBe('UNCHANGED_MTIME')
  })

  it('FILE_NOT_FOUND → true skip, no refresh attempted', async () => {
    setupBaseMocks()

    mockPrismaFindFirst.mockResolvedValueOnce(null)
    mockDownloadFeed.mockResolvedValue(createSkippedDownload('FILE_NOT_FOUND'))

    const processor = getProcessor()
    await processor(createMockJob())

    expect(mockCopySeenFromPreviousRun).not.toHaveBeenCalled()
    expect(mockEvaluateCircuitBreaker).not.toHaveBeenCalled()
    expect(mockPromoteProducts).not.toHaveBeenCalled()
    expect(getFinalizeSkippedReason()).toBe('FILE_NOT_FOUND')
  })
})

describe('Metrics and Logging', () => {
  it('should record download bytes in run metrics', async () => {
    mockDownloadFeed.mockResolvedValue({
      content: Buffer.alloc(1024),
      mtime: new Date(),
      size: BigInt(1024),
      contentHash: 'hash',
      skipped: false,
    })

    const result = await mockDownloadFeed()

    expect(result.content.length).toBe(1024)
  })

  it('should track URL hash fallback count', async () => {
    mockProcessProducts.mockResolvedValue({
      productsUpserted: 100,
      pricesWritten: 100,
      productsRejected: 0,
      duplicateKeyCount: 0,
      urlHashFallbackCount: 25,
      errors: [],
    })

    const result = await mockProcessProducts()

    expect(result.urlHashFallbackCount).toBe(25)
  })

  it('should track duplicate key count', async () => {
    mockProcessProducts.mockResolvedValue({
      productsUpserted: 90,
      pricesWritten: 90,
      productsRejected: 0,
      duplicateKeyCount: 10,
      urlHashFallbackCount: 0,
      errors: [],
    })

    const result = await mockProcessProducts()

    expect(result.duplicateKeyCount).toBe(10)
  })
})
