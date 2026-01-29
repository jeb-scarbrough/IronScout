/**
 * Redis-backed Rate Limiter
 *
 * Per scraper-framework-01 spec v0.5 §6.2
 *
 * IMPORTANT: Implementation MUST be Redis-backed for coordination across workers.
 * Per-process rate limiting will exceed budgets when workers scale.
 *
 * Uses sliding window algorithm with global coordination.
 * Rate limits apply to the registrable domain (eTLD+1), not the full hostname.
 */

import Redis from 'ioredis'
import { redisConnection } from '../../config/redis.js'
import type { RateLimiter, RateLimitConfig } from '../types.js'
import { DEFAULT_RATE_LIMIT } from '../types.js'
import { getRegistrableDomain } from '../utils/url.js'

/** Key prefix for rate limiter state in Redis */
const REDIS_KEY_PREFIX = 'scraper:ratelimit:'

/** TTL for rate limit keys (prevents stale keys) */
const KEY_TTL_SECONDS = 3600 // 1 hour

export interface RedisRateLimiterOptions {
  /** Override default rate limits per domain */
  domainOverrides?: Map<string, RateLimitConfig>

  /** Custom Redis client (for testing) */
  redisClient?: Redis
}

/**
 * Redis-backed rate limiter implementation.
 * Uses sliding window algorithm with global coordination.
 */
export class RedisRateLimiter implements RateLimiter {
  private redis: Redis
  private readonly domainOverrides: Map<string, RateLimitConfig>
  private readonly ownsRedisClient: boolean

  constructor(options: RedisRateLimiterOptions = {}) {
    if (options.redisClient) {
      this.redis = options.redisClient
      this.ownsRedisClient = false
    } else {
      this.redis = new Redis(redisConnection)
      this.ownsRedisClient = true
    }

    this.domainOverrides = options.domainOverrides ?? new Map()
  }

  /**
   * Acquire permission to make a request to the given URL's domain.
   * Blocks until rate limit allows.
   */
  async acquire(urlOrDomain: string): Promise<void> {
    // If URL is passed, extract domain
    let domain: string
    try {
      domain = urlOrDomain.includes('://') ? getRegistrableDomain(urlOrDomain) : urlOrDomain
    } catch {
      domain = urlOrDomain
    }

    const config = this.getConfig(domain)
    const key = `${REDIS_KEY_PREFIX}${domain}`

    // Minimum delay between requests
    const minDelayMs = config.minDelayMs

    while (true) {
      const now = Date.now()

      // Try to acquire using atomic Lua script
      const result = await this.tryAcquire(key, now, config)

      if (result.acquired) {
        return
      }

      // Wait before retrying
      const waitMs = Math.max(result.retryAfterMs ?? minDelayMs, minDelayMs)
      await this.sleep(waitMs)
    }
  }

  /**
   * Get rate limit config for a domain.
   */
  getConfig(domain: string): RateLimitConfig {
    return this.domainOverrides.get(domain) ?? DEFAULT_RATE_LIMIT
  }

  /**
   * Set custom rate limit for a domain.
   */
  setConfig(domain: string, config: RateLimitConfig): void {
    this.domainOverrides.set(domain, config)
  }

  /**
   * Try to acquire rate limit token atomically.
   * Uses Lua script for atomicity.
   */
  private async tryAcquire(
    key: string,
    now: number,
    config: RateLimitConfig
  ): Promise<{ acquired: boolean; retryAfterMs?: number }> {
    // Window size based on requests per second
    // For 0.5 req/sec, window is 2000ms (2 seconds)
    const windowMs = Math.ceil(1000 / config.requestsPerSecond)

    // Lua script for atomic rate limiting
    // Uses a sorted set with timestamps as scores
    const script = `
      local key = KEYS[1]
      local now = tonumber(ARGV[1])
      local windowMs = tonumber(ARGV[2])
      local maxConcurrent = tonumber(ARGV[3])
      local ttl = tonumber(ARGV[4])

      -- Remove expired entries (outside the window)
      local windowStart = now - windowMs
      redis.call('ZREMRANGEBYSCORE', key, '-inf', windowStart)

      -- Count current entries in window
      local count = redis.call('ZCARD', key)

      if count < maxConcurrent then
        -- Can acquire - add our timestamp
        redis.call('ZADD', key, now, now)
        redis.call('EXPIRE', key, ttl)
        return {1, 0}
      else
        -- Cannot acquire - find when next slot opens
        local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
        if #oldest >= 2 then
          local oldestScore = tonumber(oldest[2])
          local retryAfter = oldestScore + windowMs - now
          return {0, retryAfter}
        end
        return {0, windowMs}
      end
    `

    const result = await this.redis.eval(
      script,
      1,
      key,
      now.toString(),
      windowMs.toString(),
      config.maxConcurrent.toString(),
      KEY_TTL_SECONDS.toString()
    ) as [number, number]

    return {
      acquired: result[0] === 1,
      retryAfterMs: result[1] > 0 ? result[1] : undefined,
    }
  }

  /**
   * Release rate limit token (optional, tokens expire automatically).
   * Useful if a request fails fast and we want to allow another attempt.
   */
  async release(urlOrDomain: string): Promise<void> {
    let domain: string
    try {
      domain = urlOrDomain.includes('://') ? getRegistrableDomain(urlOrDomain) : urlOrDomain
    } catch {
      domain = urlOrDomain
    }

    const key = `${REDIS_KEY_PREFIX}${domain}`
    const now = Date.now()

    // Remove our entry (approximately - we don't track exact entry)
    await this.redis.zremrangebyscore(key, now - 1, now + 1)
  }

  /**
   * Get current state for a domain (for debugging/monitoring).
   */
  async getState(domain: string): Promise<{ activeRequests: number; oldestTimestamp: number | null }> {
    const key = `${REDIS_KEY_PREFIX}${domain}`
    const config = this.getConfig(domain)
    const windowMs = Math.ceil(1000 / config.requestsPerSecond)
    const now = Date.now()

    // Clean up expired entries first
    await this.redis.zremrangebyscore(key, '-inf', now - windowMs)

    // Get current state
    const count = await this.redis.zcard(key)
    const oldest = await this.redis.zrange(key, 0, 0, 'WITHSCORES')

    return {
      activeRequests: count,
      oldestTimestamp: oldest.length >= 2 ? parseInt(oldest[1], 10) : null,
    }
  }

  /**
   * Clear rate limit state for a domain (for testing/recovery).
   */
  async clear(domain: string): Promise<void> {
    const key = `${REDIS_KEY_PREFIX}${domain}`
    await this.redis.del(key)
  }

  /**
   * Close the Redis connection (if owned by this instance).
   */
  async close(): Promise<void> {
    if (this.ownsRedisClient) {
      await this.redis.quit()
    }
  }

  /**
   * Sleep helper.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
