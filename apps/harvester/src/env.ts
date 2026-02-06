/**
 * Environment loader - must be imported first before any other modules
 *
 * This uses an explicit path to load from apps/harvester/.env.local
 */
import { config } from 'dotenv'
import { resolve } from 'path'

const envPath = resolve(__dirname, '..', '.env.local')

// Load .env.local from apps/harvester/ directory
config({ path: envPath })
