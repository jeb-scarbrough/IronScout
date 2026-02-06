/**
 * @ironscout/redis - Shared Redis connection utilities
 *
 * Provides a single source of truth for Redis connection configuration
 * across all IronScout applications (API, Harvester, Admin, etc.)
 *
 * IMPORTANT: Always use this package instead of creating Redis connections
 * directly from ioredis to ensure consistent configuration.
 */

import Redis, { RedisOptions } from 'ioredis'

// =============================================================================
// Configuration Parsing
// =============================================================================

/**
 * Parse Redis configuration from environment variables.
 *
 * Supports two modes:
 * - REDIS_URL: Full URL (e.g., redis://:password@host:port) - parsed into components
 * - REDIS_HOST/PORT/PASSWORD: Individual environment variables
 *
 * CRITICAL: When REDIS_URL is provided, we always parse it into host/port/password
 * components. This ensures that `redisConnection` can be used directly with
 * `new Redis(redisConnection)` without falling back to localhost.
 */
function parseRedisConfig(): {
  host: string
  port: number
  password: string | undefined
  redisUrl: string | undefined
} {
  const redisUrl = process.env.REDIS_URL

  if (redisUrl) {
    try {
      const url = new URL(redisUrl)
      return {
        host: url.hostname,
        port: parseInt(url.port || '6379', 10),
        password: url.password || undefined,
        redisUrl,
      }
    } catch {
      console.warn('[redis] Failed to parse REDIS_URL, falling back to REDIS_HOST/PORT')
    }
  }

  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    redisUrl: undefined,
  }
}

const config = parseRedisConfig()

// For logging - mask password in URL
const redisLogInfo = config.redisUrl
  ? config.redisUrl.replace(/\/\/:[^@]+@/, '//***@')
  : `${config.host}:${config.port}`

// =============================================================================
// Connection Options
// =============================================================================

// Circuit breaker state for reducing log spam during prolonged outages
let consecutiveFailures = 0
let lastCircuitBreakerLog = 0

/**
 * Redis connection options with robust retry and keepalive settings.
 *
 * These options are designed for production reliability:
 * - TCP keepalive to prevent idle connection drops (ECONNRESET)
 * - Exponential backoff with circuit breaker for prolonged outages
 * - Reconnection on common network errors
 *
 * ALWAYS includes host/port/password - never relies on ioredis defaults.
 */
export const redisConnection: RedisOptions = {
  // Explicit connection details - NEVER rely on defaults
  host: config.host,
  port: config.port,
  password: config.password,

  // BullMQ compatibility - must be null for worker queues
  maxRetriesPerRequest: null,

  // Keepalive to prevent idle connection drops (ECONNRESET)
  // Sends TCP keepalive probes every 10 seconds
  keepAlive: 10000,

  // Connection timeout for initial connect
  connectTimeout: 10000,

  // Command timeout - detect dead connections faster
  commandTimeout: 30000,

  // Queue commands while reconnecting
  enableOfflineQueue: true,

  // Reconnection settings for dropped connections
  retryStrategy(times: number) {
    consecutiveFailures = times

    // Circuit breaker: after 20 attempts, reduce logging frequency
    if (times > 20) {
      const now = Date.now()
      // Log once per minute during prolonged outage
      if (now - lastCircuitBreakerLog > 60000) {
        lastCircuitBreakerLog = now
        console.error('[redis] Circuit breaker: prolonged outage', {
          attempts: times,
          connection: redisLogInfo,
        })
      }
      return 30000 // Cap at 30s, keep trying
    }

    const delay = Math.min(times * 500, 30000)
    console.info(`[redis] Reconnecting (attempt ${times}, delay ${delay}ms)`)
    return delay
  },

  // Reconnect on common network errors
  reconnectOnError(err: Error) {
    const targetErrors = [
      'READONLY',
      'ECONNRESET',
      'ETIMEDOUT',
      'ECONNREFUSED',
      'EHOSTUNREACH',
      'ENETUNREACH',
      'ENOTFOUND',
    ]
    if (targetErrors.some((e) => err.message.includes(e))) {
      // Only log if not in circuit breaker mode
      if (consecutiveFailures <= 20) {
        console.warn('[redis] Reconnecting due to error:', err.message)
      }
      return true
    }
    return false
  },
}

// =============================================================================
// Client Factory Functions
// =============================================================================

/**
 * Create a new Redis client instance.
 *
 * Use this when you need a dedicated connection (e.g., for pub/sub,
 * blocking operations, or isolation from other commands).
 *
 * The returned client uses the shared connection configuration
 * with robust retry and keepalive settings.
 */
export function createRedisClient(): Redis {
  return new Redis(redisConnection)
}

// Singleton client instance
let singletonClient: Redis | null = null

/**
 * Get the singleton Redis client instance.
 *
 * Use this for general-purpose Redis operations where connection
 * sharing is acceptable. The client is lazily initialized on first call.
 *
 * For pub/sub or blocking operations, use createRedisClient() instead
 * to avoid interfering with other commands.
 */
export function getRedisClient(): Redis {
  if (!singletonClient) {
    singletonClient = new Redis(redisConnection)

    singletonClient.on('error', (err) => {
      console.error('[redis] Connection error:', err.message)
    })

    singletonClient.on('connect', () => {
      consecutiveFailures = 0
      console.info('[redis] Connected successfully to', redisLogInfo)
    })
  }
  return singletonClient
}

/**
 * Gracefully disconnect the singleton Redis client.
 *
 * Safe to call even if no client was ever created.
 * Use this during graceful shutdown.
 */
export async function disconnectRedis(): Promise<void> {
  if (singletonClient) {
    await singletonClient.quit()
    singletonClient = null
  }
}

// =============================================================================
// Warmup / Health Check
// =============================================================================

/**
 * Warm up Redis connection with retries.
 *
 * Use this at application startup to ensure Redis is available
 * before starting workers or accepting requests.
 *
 * @param maxAttempts - Maximum number of connection attempts (default: 5)
 * @returns true if connection succeeded, false otherwise
 */
export async function warmupRedis(maxAttempts = 5): Promise<boolean> {
  const warmupOptions: RedisOptions = {
    host: config.host,
    port: config.port,
    password: config.password,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null, // Disable retries for warmup check
    connectTimeout: 5000,
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.info(`[redis] Warmup attempt ${attempt}/${maxAttempts} to ${redisLogInfo}`)
      const client = new Redis(warmupOptions)

      await client.ping()
      await client.quit()
      console.info('[redis] Warmup successful')
      return true
    } catch (error) {
      const err = error as Error
      console.error('[redis] Warmup failed:', err.message)

      if (attempt < maxAttempts) {
        const delayMs = Math.min(2000 * Math.pow(2, attempt - 1), 30000)
        console.info(`[redis] Retrying warmup in ${delayMs}ms`)
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }
    }
  }

  console.error(`[redis] Warmup failed after ${maxAttempts} attempts`)
  return false
}

// =============================================================================
// Utility Exports
// =============================================================================

/**
 * Get connection info for logging (password masked).
 */
export function getRedisConnectionInfo(): string {
  return redisLogInfo
}

// Re-export Redis class and types for convenience
export { Redis }
export type { RedisOptions }
