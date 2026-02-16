import { randomUUID } from 'node:crypto'
import type Redis from 'ioredis'

const RELEASE_LUA = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  else
    return 0
  end
`

const EXTEND_LUA = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("pexpire", KEYS[1], ARGV[2])
  else
    return 0
  end
`

export const DEFAULT_LOCK_TTL_MS = 120_000

export interface RedisLockHandle {
  key: string
  token: string
}

/**
 * Acquire a Redis lock with owner token + TTL.
 * Returns null if lock is already held.
 */
export async function acquireRedisLockWithClient(
  redis: Redis,
  key: string,
  ttlMs = DEFAULT_LOCK_TTL_MS
): Promise<RedisLockHandle | null> {
  const token = randomUUID()
  const result = await redis.set(key, token, 'PX', ttlMs, 'NX')
  if (result !== 'OK') {
    return null
  }
  return { key, token }
}

/**
 * Release a lock only if token matches current owner.
 */
export async function releaseRedisLockWithClient(
  redis: Redis,
  handle: RedisLockHandle
): Promise<boolean> {
  const result = await redis.eval(RELEASE_LUA, 1, handle.key, handle.token)
  return Number(result) === 1
}

/**
 * Extend a lock TTL only if token matches current owner.
 */
export async function extendRedisLockWithClient(
  redis: Redis,
  handle: RedisLockHandle,
  ttlMs = DEFAULT_LOCK_TTL_MS
): Promise<boolean> {
  const result = await redis.eval(EXTEND_LUA, 1, handle.key, handle.token, ttlMs.toString())
  return Number(result) === 1
}
