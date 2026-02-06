/**
 * Environment loader - must be imported first before any other modules
 *
 * This uses an explicit path to load from apps/harvester/.env.local
 * Only loads in development - production uses platform-injected env vars
 */
import { config } from 'dotenv'
import { resolve } from 'path'

// Only load .env.local in development
// Production (Render) injects env vars directly - dotenv is not needed
if (process.env.NODE_ENV !== 'production') {
  const envPath = resolve(__dirname, '..', '.env.local')
  config({ path: envPath })
}
