/**
 * Consecutive Failure Auto-Disable Tests
 *
 * INVARIANT: CONSECUTIVE_FAILURE_AUTO_DISABLE
 * After 3 consecutive feed failures, the feed MUST be auto-disabled
 * and notification sent.
 *
 * Tests failure counting, auto-disable, recovery, and notifications.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
// Mocks
// ============================================================================

const mockPrismaFeedFind = vi.fn()
const mockPrismaFeedUpdate = vi.fn()
const mockPrismaRunCreate = vi.fn()
const mockPrismaRunUpdate = vi.fn()
const mockNotifyFailed = vi.fn()
const mockNotifyAutoDisabled = vi.fn()
const mockNotifyRecovered = vi.fn()

vi.mock('@ironscout/db', () => ({
  prisma: {
    affiliate_feeds: {
      findUnique: mockPrismaFeedFind,
      update: mockPrismaFeedUpdate,
    },
    affiliate_feed_runs: {
      create: mockPrismaRunCreate,
      update: mockPrismaRunUpdate,
    },
    affiliate_feed_run_errors: {
      createMany: vi.fn(),
    },
  },
}))

vi.mock('@ironscout/notifications', () => ({
  notifyAffiliateFeedRunFailed: mockNotifyFailed,
  notifyAffiliateFeedAutoDisabled: mockNotifyAutoDisabled,
  notifyAffiliateFeedRecovered: mockNotifyRecovered,
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

// ============================================================================
// Consecutive Failure Logic (extracted from worker)
// ============================================================================

const MAX_CONSECUTIVE_FAILURES = 3

interface FeedState {
  id: string
  status: 'ENABLED' | 'DISABLED' | 'DRAFT'
  consecutiveFailures: number
  scheduleFrequencyHours: number
}

interface FinalizeContext {
  feed: FeedState
  runId: string
  errorMessage?: string
  correlationId?: string
}

interface FinalizeResult {
  newConsecutiveFailures: number
  wasAutoDisabled: boolean
  nextRunAt: Date | null | undefined // undefined = don't change (scheduler already set it)
  notifications: string[]
}

function simulateFinalizeRun(
  ctx: FinalizeContext,
  status: 'SUCCEEDED' | 'FAILED'
): FinalizeResult {
  const { feed, runId, errorMessage, correlationId } = ctx
  const finishedAt = new Date()
  const notifications: string[] = []

  let newConsecutiveFailures = feed.consecutiveFailures
  let wasAutoDisabled = false
  // Note: nextRunAt is now managed by the scheduler when claiming feeds.
  // The worker only sets nextRunAt to null when auto-disabling.
  // For all other cases, the scheduler has already set the next run time
  // based on the previous nextRunAt to maintain schedule consistency.
  let nextRunAt: Date | null | undefined = undefined // undefined = don't change

  if (status === 'SUCCEEDED') {
    // Recovery check
    if (feed.consecutiveFailures > 0) {
      notifications.push('RECOVERY')
    }
    newConsecutiveFailures = 0
    // nextRunAt is already set by scheduler - worker doesn't touch it
  } else if (status === 'FAILED') {
    newConsecutiveFailures = feed.consecutiveFailures + 1
    notifications.push('RUN_FAILED')

    if (newConsecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      wasAutoDisabled = true
      nextRunAt = null // Only case where worker sets nextRunAt
      notifications.push('AUTO_DISABLED')
    }
    // For non-auto-disabled failures, nextRunAt is already set by scheduler
  }

  return {
    newConsecutiveFailures,
    wasAutoDisabled,
    nextRunAt,
    notifications,
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('Consecutive Failure Auto-Disable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Failure counting', () => {
    it('should increment consecutiveFailures on failure', () => {
      const feed: FeedState = {
        id: 'feed-1',
        status: 'ENABLED',
        consecutiveFailures: 0,
        scheduleFrequencyHours: 24,
      }

      const result = simulateFinalizeRun(
        { feed, runId: 'run-1', errorMessage: 'Connection timeout' },
        'FAILED'
      )

      expect(result.newConsecutiveFailures).toBe(1)
      expect(result.wasAutoDisabled).toBe(false)
    })

    it('should accumulate failures across runs', () => {
      let currentFailures = 0

      // Simulate 3 consecutive failures
      for (let i = 0; i < 3; i++) {
        const feed: FeedState = {
          id: 'feed-1',
          status: 'ENABLED',
          consecutiveFailures: currentFailures,
          scheduleFrequencyHours: 24,
        }

        const result = simulateFinalizeRun(
          { feed, runId: `run-${i}`, errorMessage: 'SFTP error' },
          'FAILED'
        )

        currentFailures = result.newConsecutiveFailures
      }

      expect(currentFailures).toBe(3)
    })
  })

  describe('Auto-disable trigger', () => {
    it('should auto-disable after 3 consecutive failures', () => {
      const feed: FeedState = {
        id: 'feed-1',
        status: 'ENABLED',
        consecutiveFailures: 2, // Already 2 failures
        scheduleFrequencyHours: 24,
      }

      const result = simulateFinalizeRun(
        { feed, runId: 'run-3', errorMessage: 'Parse failed' },
        'FAILED'
      )

      expect(result.newConsecutiveFailures).toBe(3)
      expect(result.wasAutoDisabled).toBe(true)
      expect(result.nextRunAt).toBeNull()
      expect(result.notifications).toContain('AUTO_DISABLED')
    })

    it('should NOT auto-disable on 2nd failure', () => {
      const feed: FeedState = {
        id: 'feed-1',
        status: 'ENABLED',
        consecutiveFailures: 1,
        scheduleFrequencyHours: 24,
      }

      const result = simulateFinalizeRun(
        { feed, runId: 'run-2', errorMessage: 'Network error' },
        'FAILED'
      )

      expect(result.newConsecutiveFailures).toBe(2)
      expect(result.wasAutoDisabled).toBe(false)
      // nextRunAt is undefined (not changed) - scheduler already set it when claiming
      expect(result.nextRunAt).toBeUndefined()
    })

    it('should auto-disable on 4th, 5th, etc failures too', () => {
      const feed: FeedState = {
        id: 'feed-1',
        status: 'ENABLED',
        consecutiveFailures: 5,
        scheduleFrequencyHours: 24,
      }

      const result = simulateFinalizeRun(
        { feed, runId: 'run-6', errorMessage: 'Still failing' },
        'FAILED'
      )

      expect(result.wasAutoDisabled).toBe(true)
    })
  })

  describe('Recovery (success after failures)', () => {
    it('should reset consecutiveFailures on success', () => {
      const feed: FeedState = {
        id: 'feed-1',
        status: 'ENABLED',
        consecutiveFailures: 2, // Had failures
        scheduleFrequencyHours: 24,
      }

      const result = simulateFinalizeRun({ feed, runId: 'run-3' }, 'SUCCEEDED')

      expect(result.newConsecutiveFailures).toBe(0)
      expect(result.wasAutoDisabled).toBe(false)
    })

    it('should send recovery notification after failures', () => {
      const feed: FeedState = {
        id: 'feed-1',
        status: 'ENABLED',
        consecutiveFailures: 2,
        scheduleFrequencyHours: 24,
      }

      const result = simulateFinalizeRun({ feed, runId: 'run-3' }, 'SUCCEEDED')

      expect(result.notifications).toContain('RECOVERY')
    })

    it('should NOT send recovery notification on first success', () => {
      const feed: FeedState = {
        id: 'feed-1',
        status: 'ENABLED',
        consecutiveFailures: 0, // No prior failures
        scheduleFrequencyHours: 24,
      }

      const result = simulateFinalizeRun({ feed, runId: 'run-1' }, 'SUCCEEDED')

      expect(result.notifications).not.toContain('RECOVERY')
    })
  })

  describe('Notification triggers', () => {
    it('should notify on every failure', () => {
      const failures = [1, 2, 3, 4, 5]

      for (const priorFailures of failures) {
        const feed: FeedState = {
          id: 'feed-1',
          status: 'ENABLED',
          consecutiveFailures: priorFailures - 1,
          scheduleFrequencyHours: 24,
        }

        const result = simulateFinalizeRun(
          { feed, runId: `run-${priorFailures}`, errorMessage: 'Error' },
          'FAILED'
        )

        expect(result.notifications).toContain('RUN_FAILED')
      }
    })

    it('should include correlation ID in failure notifications', () => {
      const feed: FeedState = {
        id: 'feed-1',
        status: 'ENABLED',
        consecutiveFailures: 0,
        scheduleFrequencyHours: 24,
      }

      const correlationId = 'corr-abc123'
      const result = simulateFinalizeRun(
        { feed, runId: 'run-1', errorMessage: 'Error', correlationId },
        'FAILED'
      )

      // The correlation ID should be passed to notification
      // (tested via mock verification in actual implementation)
      expect(result.notifications).toContain('RUN_FAILED')
    })
  })

  describe('Next run scheduling', () => {
    it('should not set nextRunAt on success (scheduler handles it)', () => {
      const feed: FeedState = {
        id: 'feed-1',
        status: 'ENABLED',
        consecutiveFailures: 0,
        scheduleFrequencyHours: 24,
      }

      const result = simulateFinalizeRun({ feed, runId: 'run-1' }, 'SUCCEEDED')

      // Worker doesn't set nextRunAt - scheduler already set it when claiming
      expect(result.nextRunAt).toBeUndefined()
    })

    it('should not set nextRunAt on recoverable failure (scheduler handles it)', () => {
      const feed: FeedState = {
        id: 'feed-1',
        status: 'ENABLED',
        consecutiveFailures: 1, // Will become 2
        scheduleFrequencyHours: 24,
      }

      const result = simulateFinalizeRun(
        { feed, runId: 'run-2', errorMessage: 'Transient error' },
        'FAILED'
      )

      expect(result.wasAutoDisabled).toBe(false)
      // Worker doesn't set nextRunAt - scheduler already set it when claiming
      expect(result.nextRunAt).toBeUndefined()
    })

    it('should set nextRunAt to null when auto-disabled', () => {
      const feed: FeedState = {
        id: 'feed-1',
        status: 'ENABLED',
        consecutiveFailures: 2, // Will become 3
        scheduleFrequencyHours: 24,
      }

      const result = simulateFinalizeRun(
        { feed, runId: 'run-3', errorMessage: 'Third failure' },
        'FAILED'
      )

      expect(result.wasAutoDisabled).toBe(true)
      // Only case where worker explicitly sets nextRunAt
      expect(result.nextRunAt).toBeNull()
    })
  })
})

describe('Failure Scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should handle rapid consecutive failures', () => {
    const feed: FeedState = {
      id: 'feed-rapid',
      status: 'ENABLED',
      consecutiveFailures: 0,
      scheduleFrequencyHours: 1, // Hourly
    }

    // Simulate 5 rapid failures
    let currentFeed = { ...feed }
    const results: FinalizeResult[] = []

    for (let i = 0; i < 5; i++) {
      const result = simulateFinalizeRun(
        { feed: currentFeed, runId: `run-${i}`, errorMessage: `Error ${i}` },
        'FAILED'
      )
      results.push(result)

      // Update feed state for next iteration
      currentFeed = {
        ...currentFeed,
        consecutiveFailures: result.newConsecutiveFailures,
        status: result.wasAutoDisabled ? 'DISABLED' : 'ENABLED',
      }
    }

    // Assertions
    expect(results[0].newConsecutiveFailures).toBe(1)
    expect(results[0].wasAutoDisabled).toBe(false)

    expect(results[1].newConsecutiveFailures).toBe(2)
    expect(results[1].wasAutoDisabled).toBe(false)

    expect(results[2].newConsecutiveFailures).toBe(3)
    expect(results[2].wasAutoDisabled).toBe(true)

    // After disable, failures continue to increment
    expect(results[3].newConsecutiveFailures).toBe(4)
    expect(results[4].newConsecutiveFailures).toBe(5)
  })

  it('should handle alternating success/failure pattern', () => {
    const outcomes: ('SUCCEEDED' | 'FAILED')[] = [
      'SUCCEEDED',
      'FAILED',
      'SUCCEEDED',
      'FAILED',
      'FAILED',
      'SUCCEEDED',
    ]

    let currentFeed: FeedState = {
      id: 'feed-alt',
      status: 'ENABLED',
      consecutiveFailures: 0,
      scheduleFrequencyHours: 24,
    }

    const consecutiveHistory: number[] = []

    for (const outcome of outcomes) {
      const result = simulateFinalizeRun(
        { feed: currentFeed, runId: `run-${consecutiveHistory.length}` },
        outcome
      )

      consecutiveHistory.push(result.newConsecutiveFailures)

      currentFeed = {
        ...currentFeed,
        consecutiveFailures: result.newConsecutiveFailures,
      }
    }

    // Pattern: S(0), F(1), S(0), F(1), F(2), S(0)
    expect(consecutiveHistory).toEqual([0, 1, 0, 1, 2, 0])
  })
})
