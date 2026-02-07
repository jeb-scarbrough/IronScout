/**
 * @ironscout/redis - Shared Redis connection utilities
 *
 * Provides a single source of truth for Redis connection configuration
 * across all IronScout applications (API, Harvester, Admin, etc.)
 *
 * IMPORTANT: Always use this package instead of creating Redis connections
 * directly from ioredis to ensure consistent configuration.
 */
import Redis, { RedisOptions } from 'ioredis';
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
export declare const redisConnection: RedisOptions;
/**
 * Create a new Redis client instance.
 *
 * Use this when you need a dedicated connection (e.g., for pub/sub,
 * blocking operations, or isolation from other commands).
 *
 * The returned client uses the shared connection configuration
 * with robust retry and keepalive settings.
 */
export declare function createRedisClient(): Redis;
/**
 * Get the singleton Redis client instance.
 *
 * Use this for general-purpose Redis operations where connection
 * sharing is acceptable. The client is lazily initialized on first call.
 *
 * For pub/sub or blocking operations, use createRedisClient() instead
 * to avoid interfering with other commands.
 */
export declare function getRedisClient(): Redis;
/**
 * Get a shared Redis connection for BullMQ workers.
 *
 * Use this with BullMQ Worker/Queue constructors to reduce connection count:
 * ```
 * const worker = new Worker('queue', processor, {
 *   connection: getSharedBullMQConnection(),
 * })
 * ```
 *
 * @returns Shared Redis connection configured for BullMQ
 */
export declare function getSharedBullMQConnection(): Redis;
/**
 * Close the shared BullMQ connection.
 *
 * IMPORTANT: Only call this after ALL BullMQ workers/queues are closed.
 * Call this during graceful shutdown after worker.close() calls complete.
 */
export declare function closeSharedBullMQConnection(): Promise<void>;
/**
 * Gracefully disconnect the singleton Redis client.
 *
 * Safe to call even if no client was ever created.
 * Use this during graceful shutdown.
 */
export declare function disconnectRedis(): Promise<void>;
/**
 * Warm up Redis connection with retries.
 *
 * Use this at application startup to ensure Redis is available
 * before starting workers or accepting requests.
 *
 * @param maxAttempts - Maximum number of connection attempts (default: 5)
 * @returns true if connection succeeded, false otherwise
 */
export declare function warmupRedis(maxAttempts?: number): Promise<boolean>;
/**
 * Get connection info for logging (password masked).
 */
export declare function getRedisConnectionInfo(): string;
export { Redis };
export type { RedisOptions };
//# sourceMappingURL=index.d.ts.map