import { beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth', () => ({
  getAdminSession: vi.fn(),
  logAdminAction: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  loggers: {
    feeds: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
  },
}))

const mockFindUnique = vi.fn()
const mockFindFirst = vi.fn()
const mockUpdate = vi.fn()

vi.mock('@ironscout/db', () => ({
  prisma: {
    affiliate_feeds: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
    affiliate_feed_runs: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
    },
  },
}))

const mockGetJobState = vi.fn()
const mockEnqueue = vi.fn()

vi.mock('@/lib/queue', () => ({
  getJobState: (...args: unknown[]) => mockGetJobState(...args),
  enqueueAffiliateFeedJob: (...args: unknown[]) => mockEnqueue(...args),
}))

// ---------------------------------------------------------------------------
// Import after mocks are defined
// ---------------------------------------------------------------------------

import { getAdminSession, logAdminAction } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { triggerManualRun } from '../actions'

const mockedGetAdminSession = vi.mocked(getAdminSession)
const mockedLogAdminAction = vi.mocked(logAdminAction)
const mockedRevalidatePath = vi.mocked(revalidatePath)

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('triggerManualRun', () => {
  const feedId = 'feed-1'
  const session = { userId: 'admin-1', email: 'admin@test.com' }

  beforeEach(() => {
    vi.clearAllMocks()
    mockedGetAdminSession.mockResolvedValue(session)

    // Default: feed exists and is ENABLED
    mockFindUnique.mockResolvedValue({ id: feedId, status: 'ENABLED' })
  })

  it('returns unauthorized when session is missing', async () => {
    mockedGetAdminSession.mockResolvedValue(null)
    const result = await triggerManualRun(feedId)
    expect(result).toEqual({ success: false, error: 'Unauthorized' })
  })

  it('sets manualRunPending when RUNNING row exists', async () => {
    mockFindFirst.mockResolvedValue({ id: 'run-1' })
    mockUpdate.mockResolvedValue({})

    const result = await triggerManualRun(feedId)

    expect(result.success).toBe(true)
    expect(result.message).toMatch(/currently in progress/i)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: feedId },
        data: { manualRunPending: true },
      })
    )
    // Should NOT touch queue at all
    expect(mockGetJobState).not.toHaveBeenCalled()
    expect(mockEnqueue).not.toHaveBeenCalled()
  })

  it('sets manualRunPending when no RUNNING row but job is active', async () => {
    mockFindFirst.mockResolvedValue(null)
    mockGetJobState.mockResolvedValue('active')
    mockUpdate.mockResolvedValue({})

    const result = await triggerManualRun(feedId)

    expect(result.success).toBe(true)
    expect(result.message).toMatch(/currently active/i)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: feedId },
        data: { manualRunPending: true },
      })
    )
    expect(mockedLogAdminAction).toHaveBeenCalledWith(
      session.userId,
      'TRIGGER_MANUAL_RUN',
      expect.objectContaining({
        newValue: expect.objectContaining({ manualRunPending: true, reason: 'active_job_no_run_row' }),
      })
    )
    expect(mockEnqueue).not.toHaveBeenCalled()
  })

  it('returns already-queued when no RUNNING row and job is waiting', async () => {
    mockFindFirst.mockResolvedValue(null)
    mockGetJobState.mockResolvedValue('waiting')

    const result = await triggerManualRun(feedId)

    expect(result.success).toBe(true)
    expect(result.message).toMatch(/already queued/i)
    // Should NOT set manualRunPending
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(mockEnqueue).not.toHaveBeenCalled()
  })

  it('enqueues a fresh job when no RUNNING row and no queue job', async () => {
    mockFindFirst.mockResolvedValue(null)
    mockGetJobState.mockResolvedValue(null)
    mockEnqueue.mockResolvedValue({ jobId: 'feed-1-manual' })

    const result = await triggerManualRun(feedId)

    expect(result.success).toBe(true)
    expect(result.message).toContain('feed-1-manual')
    expect(mockEnqueue).toHaveBeenCalledWith(feedId, 'MANUAL')
    expect(mockedRevalidatePath).toHaveBeenCalledWith('/affiliate-feeds')
    expect(mockedRevalidatePath).toHaveBeenCalledWith(`/affiliate-feeds/${feedId}`)
  })
})
