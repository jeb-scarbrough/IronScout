import Redis, { RedisOptions } from 'ioredis'
import { logger } from './logger'

const log = logger.child('redis')

// Support REDIS_URL (Render-style) or individual HOST/PORT/PASSWORD (local dev)
// Parse URL into components for consistent interface with BullMQ
function parseRedisConfig(): RedisOptions {
  const redisUrl = process.env.REDIS_URL

  if (redisUrl) {
    try {
      const url = new URL(redisUrl)
      return {
        host: url.hostname,
        port: parseInt(url.port || '6379', 10),
        password: url.password || undefined,
        maxRetriesPerRequest: null,
      }
    } catch {
      log.warn('Failed to parse REDIS_URL, falling back to defaults')
    }
  }

  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
  }
}

export const redisConnection: RedisOptions = parseRedisConfig()

let redisClient: Redis | null = null

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(redisConnection)

    redisClient.on('error', (err) => {
      log.error('Connection error', { message: err.message })
    })

    redisClient.on('connect', () => {
      log.info('Connected successfully')
    })
  }
  return redisClient
}

export function createRedisClient(): Redis {
  return new Redis(redisConnection)
}

/**
 * Gracefully disconnect the singleton Redis client (if initialized).
 * Safe to call even if no client was ever created.
 */
export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit()
    redisClient = null
  }
}
