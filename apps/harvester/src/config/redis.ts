/**
 * Redis configuration for Harvester
 *
 * Re-exports from @ironscout/redis for consistent connection handling
 * across all IronScout applications.
 *
 * IMPORTANT: Use `getSharedBullMQConnection()` for all BullMQ workers
 * to minimize Redis connection count. The free Redis tier has a 50
 * connection limit, and each worker normally creates 2-3 connections.
 */

export {
  redisConnection,
  createRedisClient,
  getRedisClient,
  disconnectRedis,
  warmupRedis,
  getRedisConnectionInfo,
  getSharedBullMQConnection,
  closeSharedBullMQConnection,
  Redis,
} from '@ironscout/redis'

export type { RedisOptions } from '@ironscout/redis'
