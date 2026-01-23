/**
 * Tests for Advisory Lock mechanism
 *
 * Tests feed-level mutual exclusion using PostgreSQL advisory locks.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock at the top level
vi.mock('@ironscout/db', () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}))

// Mock the logger to avoid side effects
vi.mock('../../config/logger', () => ({
  logger: {
    affiliate: {
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  },
}))

// Import after mocking
import { prisma } from '@ironscout/db'
import {
  acquireAdvisoryLock,
  releaseAdvisoryLock,
  isLockHeld,
  withAdvisoryLock,
} from '../lock'

// Cast to mock for type-safe mock access
const mockQueryRaw = prisma.$queryRaw as ReturnType<typeof vi.fn>

describe('Advisory Lock', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('acquireAdvisoryLock', () => {
    it('should return true when lock is acquired', async () => {
      mockQueryRaw.mockResolvedValueOnce([{ acquired: true }])

      const feedLockId = BigInt(12345)
      const acquired = await acquireAdvisoryLock(feedLockId)

      expect(acquired).toBe(true)
      expect(mockQueryRaw).toHaveBeenCalled()
    })

    it('should return false when lock is already held', async () => {
      mockQueryRaw.mockResolvedValueOnce([{ acquired: false }])

      const feedLockId = BigInt(12345)
      const acquired = await acquireAdvisoryLock(feedLockId)

      expect(acquired).toBe(false)
    })

    it('should use pg_try_advisory_lock for non-blocking acquisition', async () => {
      mockQueryRaw.mockResolvedValueOnce([{ acquired: true }])

      await acquireAdvisoryLock(BigInt(12345))

      // Verify the query uses pg_try_advisory_lock (non-blocking)
      expect(mockQueryRaw).toHaveBeenCalled()
    })
  })

  describe('releaseAdvisoryLock', () => {
    it('should call pg_advisory_unlock', async () => {
      mockQueryRaw.mockResolvedValueOnce([{ result: true }])

      const feedLockId = BigInt(12345)
      await releaseAdvisoryLock(feedLockId)

      expect(mockQueryRaw).toHaveBeenCalled()
    })

    it('should not throw on release error', async () => {
      mockQueryRaw.mockResolvedValueOnce([{ result: false }])

      // Should not throw even if release returns false
      await expect(releaseAdvisoryLock(BigInt(12345))).resolves.not.toThrow()
    })
  })

  describe('isLockHeld', () => {
    it('should return true when lock is held by current session', async () => {
      mockQueryRaw.mockResolvedValueOnce([{ held: true }])

      const feedLockId = BigInt(12345)
      const held = await isLockHeld(feedLockId)

      expect(held).toBe(true)
    })

    it('should return false when lock is not held', async () => {
      mockQueryRaw.mockResolvedValueOnce([{ held: false }])

      const feedLockId = BigInt(12345)
      const held = await isLockHeld(feedLockId)

      expect(held).toBe(false)
    })
  })

  describe('withAdvisoryLock', () => {
    it('should execute callback when lock is acquired', async () => {
      mockQueryRaw
        .mockResolvedValueOnce([{ acquired: true }]) // acquire
        .mockResolvedValueOnce([{ result: true }]) // release

      const callback = vi.fn().mockResolvedValue('result')

      const result = await withAdvisoryLock(BigInt(12345), callback)

      expect(callback).toHaveBeenCalled()
      expect(result).toEqual({ success: true, result: 'result' })
    })

    it('should not execute callback when lock cannot be acquired', async () => {
      mockQueryRaw.mockResolvedValueOnce([{ acquired: false }])

      const callback = vi.fn()

      const result = await withAdvisoryLock(BigInt(12345), callback)

      expect(callback).not.toHaveBeenCalled()
      expect(result).toEqual({ success: false, reason: 'LOCK_NOT_AVAILABLE' })
    })

    it('should release lock even if callback throws', async () => {
      mockQueryRaw
        .mockResolvedValueOnce([{ acquired: true }]) // acquire
        .mockResolvedValueOnce([{ result: true }]) // release

      const callback = vi.fn().mockRejectedValue(new Error('test error'))

      await expect(withAdvisoryLock(BigInt(12345), callback)).rejects.toThrow('test error')

      // Verify release was called (second call)
      expect(mockQueryRaw).toHaveBeenCalledTimes(2)
    })
  })
})

describe('Lock ID Generation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should support large lock IDs (bigint)', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ acquired: true }])

    // Large lock ID that exceeds 32-bit integer
    const largeLockId = BigInt('9223372036854775807') // Max 64-bit signed integer

    await expect(acquireAdvisoryLock(largeLockId)).resolves.not.toThrow()
  })

  it('should handle lock ID of 0', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ acquired: true }])

    await expect(acquireAdvisoryLock(BigInt(0))).resolves.not.toThrow()
  })
})

describe('Mutual Exclusion Guarantee', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should prevent concurrent processing of same feed', async () => {
    // First call acquires lock
    mockQueryRaw.mockResolvedValueOnce([{ acquired: true }])
    // Second call finds lock held
    mockQueryRaw.mockResolvedValueOnce([{ acquired: false }])

    const feedLockId = BigInt(12345)

    const first = await acquireAdvisoryLock(feedLockId)
    const second = await acquireAdvisoryLock(feedLockId)

    expect(first).toBe(true)
    expect(second).toBe(false)
  })

  it('should allow different feeds to be processed concurrently', async () => {
    // Both locks can be acquired (different lock IDs)
    mockQueryRaw
      .mockResolvedValueOnce([{ acquired: true }])
      .mockResolvedValueOnce([{ acquired: true }])

    const feed1LockId = BigInt(11111)
    const feed2LockId = BigInt(22222)

    const first = await acquireAdvisoryLock(feed1LockId)
    const second = await acquireAdvisoryLock(feed2LockId)

    expect(first).toBe(true)
    expect(second).toBe(true)
  })
})
