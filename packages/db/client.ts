import 'dotenv/config'
import { Pool, PoolConfig } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from './generated/prisma/client.js'

/**
 * Connection pool configuration
 *
 * Environment variables:
 * - DB_POOL_MAX: Maximum connections (default: 20)
 * - DB_POOL_MIN: Minimum idle connections (default: 2)
 * - DB_SERVICE_NAME: Application name for pg_stat_activity (default: ironscout)
 */
function getPoolConfig(connectionString: string): PoolConfig {
  return {
    connectionString,

    // === Pool Size ===
    max: parseInt(process.env.DB_POOL_MAX || '20'),
    min: parseInt(process.env.DB_POOL_MIN || '2'),

    // === Timeouts ===
    idleTimeoutMillis: 30000,       // Close idle clients after 30s
    connectionTimeoutMillis: 5000,   // Error if can't connect within 5s

    // === Connection Recycling ===
    maxUses: 7500,                   // Recycle connection after N queries (prevents memory leaks)
    maxLifetimeSeconds: 1800,        // Hard limit: recycle after 30 min (handles stale DNS, credential rotation)

    // === Keep-Alive (prevents firewall/NAT from killing idle TCP connections) ===
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000, // Start probes after 10s idle

    // === Application Identification ===
    application_name: process.env.DB_SERVICE_NAME || 'ironscout',
  }
}

/**
 * Creates a new PrismaClient with the PostgreSQL adapter and connection pooling.
 * Use this for scripts that need their own client instance.
 * For app code, import `prisma` from index.js instead.
 */
export function createPrismaClient(options?: { log?: boolean }) {
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set')
  }

  const pool = new Pool(getPoolConfig(connectionString))
  const adapter = new PrismaPg(pool)

  return new PrismaClient({
    adapter,
    log: options?.log ? ['query', 'info', 'warn', 'error'] : [],
  })
}

// Re-export PrismaClient type for type annotations
export { PrismaClient } from './generated/prisma/client.js'
