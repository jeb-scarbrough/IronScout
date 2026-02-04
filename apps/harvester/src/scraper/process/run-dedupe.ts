/**
 * Run-Level Deduplication
 *
 * Per scraper-framework-01 spec v0.5 §5.1
 *
 * Uses Redis to track seen identity keys per run.
 * This ensures duplicates within a run are detected across
 * multiple concurrent worker processes.
 */

import Redis from 'ioredis'
import { createRedisClient } from '../../config/redis.js'
import { loggers } from '../../config/logger.js'

const log = loggers.scraper

/** TTL for dedupe sets: 2 hours (covers long-running runs + buffer) */
const DEDUPE_SET_TTL_SECONDS = 2 * 60 * 60

/** Redis key prefix for dedupe sets */
const DEDUPE_KEY_PREFIX = 'scrape:dedupe:'

let redisClient: Redis | null = null

/**
 * Get or create Redis client for dedupe operations.
 */
function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = createRedisClient()
    redisClient.on('error', (err) => {
      log.error('Dedupe Redis error', { error: err.message })
    })
  }
  return redisClient
}

/**
 * Check if an identity key is a duplicate within a run.
 * If not a duplicate, adds it to the set atomically.
 *
 * @param runId - The scrape run ID
 * @param identityKey - The offer's identity key
 * @returns true if duplicate (already seen), false if new
 */
export async function checkAndAddIdentityKey(
  runId: string,
  identityKey: string
): Promise<boolean> {
  const redis = getRedisClient()
  const key = `${DEDUPE_KEY_PREFIX}${runId}`

  try {
    // SADD returns 1 if new member added, 0 if already exists
    const added = await redis.sadd(key, identityKey)

    // Set/refresh TTL on the set (only if we added a new member)
    if (added === 1) {
      await redis.expire(key, DEDUPE_SET_TTL_SECONDS)
    }

    // If added === 0, the key already existed (duplicate)
    return added === 0
  } catch (error) {
    // On Redis error, log but don't fail the job
    // Worst case: potential duplicate written (acceptable degradation)
    log.warn('Dedupe check failed', {
      runId,
      identityKey: identityKey.substring(0, 50),
      error: (error as Error).message,
    })
    return false // Assume not duplicate on error
  }
}

/**
 * Clean up a run's dedupe set.
 * Called when a run is finalized.
 */
export async function cleanupRunDedupeSet(runId: string): Promise<void> {
  const redis = getRedisClient()
  const key = `${DEDUPE_KEY_PREFIX}${runId}`

  try {
    await redis.del(key)
  } catch (error) {
    log.warn('Failed to cleanup dedupe set', {
      runId,
      error: (error as Error).message,
    })
  }
}

/**
 * Get count of identity keys seen in a run.
 * Useful for debugging/metrics.
 */
export async function getRunDedupeCount(runId: string): Promise<number> {
  const redis = getRedisClient()
  const key = `${DEDUPE_KEY_PREFIX}${runId}`

  try {
    return await redis.scard(key)
  } catch (error) {
    return 0
  }
}

/**
 * Close the Redis client.
 * Call during shutdown.
 */
export async function closeDedupeClient(): Promise<void> {
  if (redisClient) {
    await redisClient.quit()
    redisClient = null
  }
}
