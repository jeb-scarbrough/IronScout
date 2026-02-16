import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  acquireRedisLock: vi.fn(),
  releaseRedisLock: vi.fn(),
  extendRedisLock: vi.fn(),
}))

vi.mock('@ironscout/redis', () => ({
  acquireRedisLock: mocks.acquireRedisLock,
  releaseRedisLock: mocks.releaseRedisLock,
  extendRedisLock: mocks.extendRedisLock,
  DEFAULT_LOCK_TTL_MS: 120_000,
}))

vi.mock('../../config/logger', () => ({
  logger: {
    affiliate: {
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  },
}))

import {
  acquireFeedLock,
  startLockRenewal,
  stopLockRenewal,
  extendFeedLock,
} from '../lock'

describe('Feed lock', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns a lock handle when acquire succeeds', async () => {
    mocks.acquireRedisLock.mockResolvedValueOnce({ key: 'feed-lock:feed-1', token: 'token-123' })

    const lock = await acquireFeedLock('feed-1')

    expect(lock).not.toBeNull()
    expect(lock?.feedId).toBe('feed-1')
    expect(mocks.acquireRedisLock).toHaveBeenCalledWith('feed-lock:feed-1', 120_000)
  })

  it('returns null when lock is already held', async () => {
    mocks.acquireRedisLock.mockResolvedValueOnce(null)

    const lock = await acquireFeedLock('feed-1')

    expect(lock).toBeNull()
  })

  it('release delegates to releaseRedisLock', async () => {
    mocks.acquireRedisLock.mockResolvedValueOnce({ key: 'feed-lock:feed-1', token: 'token-123' })
    mocks.releaseRedisLock.mockResolvedValueOnce(true)

    const lock = await acquireFeedLock('feed-1')
    const released = await lock!.release()

    expect(released).toBe(true)
    expect(mocks.releaseRedisLock).toHaveBeenCalledWith({ key: 'feed-lock:feed-1', token: 'token-123' })
  })

  it('extendFeedLock delegates to extendRedisLock', async () => {
    mocks.acquireRedisLock.mockResolvedValueOnce({ key: 'feed-lock:feed-1', token: 'token-123' })
    mocks.extendRedisLock.mockResolvedValueOnce(true)

    const lock = await acquireFeedLock('feed-1')
    const extended = await extendFeedLock(lock!, 30_000)

    expect(extended).toBe(true)
    expect(mocks.extendRedisLock).toHaveBeenCalledWith(
      { key: 'feed-lock:feed-1', token: 'token-123' },
      30_000
    )
  })

  it('starts and stops renewal interval', async () => {
    vi.useFakeTimers()
    mocks.acquireRedisLock.mockResolvedValueOnce({ key: 'feed-lock:feed-1', token: 'token-123' })
    mocks.extendRedisLock.mockResolvedValue(true)

    const lock = await acquireFeedLock('feed-1')
    startLockRenewal(lock!, 120_000)

    vi.advanceTimersByTime(30_000)
    await Promise.resolve()
    expect(mocks.extendRedisLock).toHaveBeenCalledTimes(1)

    stopLockRenewal(lock!)
    vi.advanceTimersByTime(60_000)
    await Promise.resolve()
    expect(mocks.extendRedisLock).toHaveBeenCalledTimes(1)
  })
})
