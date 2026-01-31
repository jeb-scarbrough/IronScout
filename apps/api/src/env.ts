/**
 * Environment loader - must be imported first before any other modules
 *
 * This uses an explicit path to load from apps/api/.env.local instead of
 * the monorepo root .env (which may have placeholder values)
 */
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const envPath = resolve(__dirname, '..', '.env.local')

// Load .env.local from apps/api/ directory
config({ path: envPath })
