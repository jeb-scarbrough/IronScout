import Redis from 'ioredis'

const redisHost = process.env.REDIS_HOST || 'localhost'
const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10)
const redisPassword = process.env.REDIS_PASSWORD || undefined

export const redisConnection = {
  host: redisHost,
  port: redisPort,
  password: redisPassword,
  maxRetriesPerRequest: null,
}

let redisClient: Redis | null = null

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(redisConnection)

    redisClient.on('error', (err) => {
      console.error('[Redis] Connection error:', err.message)
    })

    redisClient.on('connect', () => {
      console.log('[Redis] Connected successfully')
    })
  }
  return redisClient
}

export function createRedisClient(): Redis {
  return new Redis(redisConnection)
}
