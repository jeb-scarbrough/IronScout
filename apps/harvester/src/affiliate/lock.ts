/**
 * Redis lock management for affiliate feed mutual exclusion.
 *
 * Uses tokenized Redis locks to ensure cross-process safety:
 * - acquire: SET NX PX with random owner token
 * - release/extend: Lua compare-and-delete / compare-and-pexpire
 */

import {
  acquireRedisLock,
  releaseRedisLock,
  extendRedisLock,
  DEFAULT_LOCK_TTL_MS,
  type RedisLockHandle,
} from '@ironscout/redis'
import { logger } from '../config/logger'

const log = logger.affiliate

const LOCK_PREFIX = 'feed-lock:'
const RENEWAL_INTERVAL_MS = 30_000

export interface FeedLockHandle {
  feedId: string
  handle: RedisLockHandle
  release: () => Promise<boolean>
  renewalTimer?: ReturnType<typeof setInterval>
}

function lockKey(feedId: string): string {
  return `${LOCK_PREFIX}${feedId}`
}

export async function acquireFeedLock(
  feedId: string,
  ttlMs = DEFAULT_LOCK_TTL_MS
): Promise<FeedLockHandle | null> {
  try {
    const handle = await acquireRedisLock(lockKey(feedId), ttlMs)
    if (!handle) {
      log.debug('Feed lock not available', { feedId })
      return null
    }

    log.debug('Feed lock acquired', { feedId })

    return {
      feedId,
      handle,
      release: async () => {
        try {
          const released = await releaseRedisLock(handle)
          if (released) {
            log.debug('Feed lock released', { feedId })
          } else {
            log.warn('Feed lock release failed (token mismatch or expired)', { feedId })
          }
          return released
        } catch (error) {
          log.warn('Feed lock release error', { feedId }, error as Error)
          return false
        }
      },
    }
  } catch (error) {
    log.error('Failed to acquire feed lock', { feedId }, error as Error)
    return null
  }
}

export async function extendFeedLock(
  feedLock: FeedLockHandle,
  ttlMs = DEFAULT_LOCK_TTL_MS
): Promise<boolean> {
  try {
    return await extendRedisLock(feedLock.handle, ttlMs)
  } catch (error) {
    log.warn('Feed lock extend error', { feedId: feedLock.feedId }, error as Error)
    return false
  }
}

export function startLockRenewal(feedLock: FeedLockHandle, ttlMs = DEFAULT_LOCK_TTL_MS): void {
  feedLock.renewalTimer = setInterval(async () => {
    try {
      const extended = await extendFeedLock(feedLock, ttlMs)
      if (!extended) {
        log.warn('Feed lock renewal failed - lock may have expired', { feedId: feedLock.feedId })
        stopLockRenewal(feedLock)
      }
    } catch (error) {
      log.warn('Feed lock renewal error', { feedId: feedLock.feedId }, error as Error)
      stopLockRenewal(feedLock)
    }
  }, RENEWAL_INTERVAL_MS)
}

export function stopLockRenewal(feedLock: FeedLockHandle): void {
  if (feedLock.renewalTimer) {
    clearInterval(feedLock.renewalTimer)
    feedLock.renewalTimer = undefined
  }
}
