import type Redis from 'ioredis';
export declare const DEFAULT_LOCK_TTL_MS = 120000;
export interface RedisLockHandle {
    key: string;
    token: string;
}
/**
 * Acquire a Redis lock with owner token + TTL.
 * Returns null if lock is already held.
 */
export declare function acquireRedisLockWithClient(redis: Redis, key: string, ttlMs?: number): Promise<RedisLockHandle | null>;
/**
 * Release a lock only if token matches current owner.
 */
export declare function releaseRedisLockWithClient(redis: Redis, handle: RedisLockHandle): Promise<boolean>;
/**
 * Extend a lock TTL only if token matches current owner.
 */
export declare function extendRedisLockWithClient(redis: Redis, handle: RedisLockHandle, ttlMs?: number): Promise<boolean>;
//# sourceMappingURL=lock.d.ts.map