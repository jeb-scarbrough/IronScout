/**
 * Redis configuration for Harvester
 *
 * Re-exports from @ironscout/redis for consistent connection handling
 * across all IronScout applications.
 */

export {
  redisConnection,
  createRedisClient,
  getRedisClient,
  disconnectRedis,
  warmupRedis,
  getRedisConnectionInfo,
  Redis,
} from '@ironscout/redis'

export type { RedisOptions } from '@ironscout/redis'
