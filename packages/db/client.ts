import 'dotenv/config'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from './generated/prisma/client.js'

/**
 * Creates a new PrismaClient with the PostgreSQL adapter.
 * Use this for scripts that need their own client instance.
 * For app code, import `prisma` from index.js instead.
 */
export function createPrismaClient(options?: { log?: boolean }) {
  const connectionString = process.env.DATABASE_URL
  
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set')
  }
  
  const pool = new Pool({ connectionString })
  const adapter = new PrismaPg(pool)
  
  return new PrismaClient({
    adapter,
    log: options?.log ? ['query', 'info', 'warn', 'error'] : [],
  })
}

// Re-export PrismaClient type for type annotations
export { PrismaClient } from './generated/prisma/client.js'
