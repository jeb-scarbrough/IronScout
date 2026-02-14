/**
 * Express App Configuration (without server startup)
 *
 * This file exports the configured Express app for use in:
 * - Integration tests (via supertest)
 * - Index.ts (actual server startup)
 *
 * The server.listen() call is in index.ts, not here.
 */

// Load environment variables first - this MUST be the first import
import './env.js'

import express, { Express, Request, Response, NextFunction } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { prisma, isMaintenanceMode } from '@ironscout/db'
import { getRedisClient } from './config/redis'
import { loggers } from './config/logger'

const log = loggers.server

import { requestContextMiddleware } from './middleware/request-context'
import { requestLoggerMiddleware, errorLoggerMiddleware } from './middleware/request-logger'
import { validateAllLensDefinitions } from './services/lens'
import { productsRouter } from './routes/products'
import { alertsRouter } from './routes/alerts'
import { paymentsRouter } from './routes/payments'
import { dataRouter } from './routes/data'
import { sourcesRouter } from './routes/sources'
import { executionsRouter } from './routes/executions'
import { logsRouter } from './routes/logs'
import { harvesterRouter } from './routes/harvester'
import reportsRouter from './routes/reports'
import { searchRouter } from './routes/search'
import { authRouter } from './routes/auth'
import { dashboardRouter } from './routes/dashboard'
import { watchlistRouter } from './routes/watchlist'
import { savedItemsRouter } from './routes/saved-items'
import { gunLockerRouter } from './routes/gun-locker'
import { firearmAmmoPreferenceRouter, ammoPreferencesRouter } from './routes/firearm-ammo-preference'
import { priceCheckRouter } from './routes/price-check'
import { adminRouter } from './routes/admin'
import { reviewQueueRouter } from './routes/review-queue'
import { usersRouter } from './routes/users'
import { marketSnapshotsRouter } from './routes/market-snapshots'
import { classifyError, getSafeMessage } from './lib/errors'
import { getRequestContext } from '@ironscout/logger'

// ============================================================================
// Deploy-Time Validation
// ============================================================================

// Per search-lens-v1.md §Governance: "Lens definitions must reference only
// fields in 'Expected Field Types'. Unknown fields fail deploy-time validation."
// This runs at module load time and throws if lens definitions are invalid.
// NOTE: Validation runs unconditionally (regardless of ENABLE_LENS_V1) to ensure
// definitions are always valid and safe to enable at any time.
try {
  validateAllLensDefinitions()
  log.info('Lens definitions validated successfully')
} catch (error) {
  log.error('Lens definition validation failed - server will not start', {}, error as Error)
  throw error
}

// ============================================================================
// Express App Configuration
// ============================================================================

export const app: Express = express()

app.use(helmet())

// Render deploys behind a reverse proxy — trust X-Forwarded-For so req.ip
// returns the real client IP instead of the proxy's IP.
app.set('trust proxy', 1)

// Request context middleware - provides requestId correlation for logging
// Must be early in the chain to capture all request processing
app.use(requestContextMiddleware)

// Request logger middleware - logs one entry per request at response finish
// Must come after requestContextMiddleware to have access to requestId
app.use(requestLoggerMiddleware)

// CORS configuration to support multiple domains
// Production origins are hardcoded. All other origins (local dev, staging,
// preview deployments) must be configured via CORS_ORIGINS env var or
// per-app FRONTEND_URL / ADMIN_URL / MERCHANT_URL env vars.
const corsOriginsFromEnv = process.env.CORS_ORIGINS?.split(',').map(s => s.trim()).filter(Boolean) || []
const allowedOrigins = [
  ...corsOriginsFromEnv,
  // Production domains only
  'https://www.ironscout.ai',
  'https://ironscout.ai',
  'https://app.ironscout.ai',
  'https://admin.ironscout.ai',
  'https://merchant.ironscout.ai',
  // Per-app URL overrides (staging, preview)
  process.env.FRONTEND_URL,
  process.env.ADMIN_URL,
  process.env.MERCHANT_URL,
].filter(Boolean)

// Log allowed origins at startup (deduplicated for clarity)
const uniqueOrigins = [...new Set(allowedOrigins)]
log.info('CORS allowed origins configured', { origins: uniqueOrigins })

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true)

    if (allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      log.warn('CORS blocked request from unknown origin', { origin, allowedOrigins: uniqueOrigins })
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true
}))

// Store raw body for Stripe webhook signature verification
// Must be before express.json() middleware
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }))

// JSON body parsing for all other routes
app.use(express.json())

app.get('/health', async (_req, res) => {
  const timeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
    Promise.race([promise, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))])

  const [dbOk, redisOk] = await Promise.all([
    timeout(prisma.$queryRaw`SELECT 1`.then(() => true), 3000).catch(() => false),
    timeout(getRedisClient().ping().then(() => true), 3000).catch(() => false),
  ])

  const healthy = dbOk && redisOk
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    dependencies: { db: dbOk, redis: redisOk },
  })
})

// Maintenance mode middleware - allows health check and admin routes through
const maintenanceMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  // Always allow health check and admin routes
  if (req.path === '/health' || req.path.startsWith('/api/admin')) {
    return next()
  }

  try {
    const inMaintenance = await isMaintenanceMode()
    if (inMaintenance) {
      log.info('Request blocked due to maintenance mode', { path: req.path })
      return res.status(503).json({
        error: 'Service temporarily unavailable for maintenance',
        code: 'MAINTENANCE_MODE'
      })
    }
  } catch (error) {
    // Per ADR-009: Fail closed on eligibility or trust ambiguity
    // If we can't check maintenance mode, block the request
    log.error('Failed to check maintenance mode, blocking request (fail-closed)', {}, error as Error)
    return res.status(503).json({
      error: 'Service temporarily unavailable',
      code: 'MAINTENANCE_CHECK_FAILED'
    })
  }

  next()
}

app.use(maintenanceMiddleware)

app.use('/api/products', productsRouter)
app.use('/api/alerts', alertsRouter)
app.use('/api/payments', paymentsRouter)
app.use('/api/data', dataRouter)
app.use('/api/sources', sourcesRouter)
app.use('/api/executions', executionsRouter)
app.use('/api/logs', logsRouter)
app.use('/api/harvester', harvesterRouter)
app.use('/api/reports', reportsRouter)
app.use('/api/search', searchRouter)
app.use('/api/auth', authRouter)
app.use('/api/dashboard', dashboardRouter)
app.use('/api/watchlist', watchlistRouter)
app.use('/api/saved-items', savedItemsRouter)
app.use('/api/gun-locker', gunLockerRouter)
app.use('/api/gun-locker', firearmAmmoPreferenceRouter) // Ammo preferences nested under gun-locker
app.use('/api/ammo-preferences', ammoPreferencesRouter)  // User-level ammo preferences (My Loadout)
app.use('/api/price-check', priceCheckRouter)
app.use('/api/admin', adminRouter)
app.use('/api/review-queue', reviewQueueRouter)
app.use('/api/users', usersRouter)
app.use('/api/market-snapshots', marketSnapshotsRouter)

// Error logger middleware - logs errors with classification
app.use(errorLoggerMiddleware)

// Final error handler - sends safe response to client (never expose internal details)
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // Error is already logged by errorLoggerMiddleware with full details
  const classified = classifyError(err)
  const requestId = getRequestContext()?.requestId || 'unknown'

  // Return standardized safe response - NEVER include err.message or stack
  // Exception: Zod validation errors include field-level details (safe - no internal data)
  const response: Record<string, unknown> = {
    errorCode: classified.code,
    message: getSafeMessage(classified),
    requestId,
  }

  // Include validation details for Zod errors (field paths, codes - no sensitive data)
  if (classified.code === 'VALIDATION_FAILED' && classified.details?.issues) {
    response.validationErrors = classified.details.issues
  }

  res.status(classified.statusCode).json(response)
})

// Export prisma for graceful shutdown
export { prisma }
