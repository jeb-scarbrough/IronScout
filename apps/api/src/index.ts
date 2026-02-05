/**
 * API Server Entry Point
 *
 * Starts the Express server and handles graceful shutdown.
 * The Express app configuration is in app.ts for testability.
 */

import { app, prisma } from './app.js'
import { loggers } from './config/logger'
import { disconnectRedis } from './config/redis.js'
import { clearRateLimitCleanup } from './middleware/auth.js'

const log = loggers.server
const PORT = process.env.PORT || 8000

const server = app.listen(PORT, () => {
  log.info('API server started', { port: PORT })

  // Log brand/URL configuration prominently for debugging
  const wwwUrl = process.env.NEXT_PUBLIC_WWW_URL || '(not set - using production default)'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || '(not set - using production default)'
  console.log('\n' + '='.repeat(60))
  console.log('  BRAND CONFIG')
  console.log('='.repeat(60))
  console.log(`  APP_URL: ${appUrl}`)
  console.log(`  WWW_URL: ${wwwUrl}`)
  console.log('='.repeat(60) + '\n')
})

// Track if shutdown is in progress
let isShuttingDown = false

// Graceful shutdown
const shutdown = async (signal: string) => {
  if (isShuttingDown) {
    log.warn('Shutdown already in progress')
    return
  }
  isShuttingDown = true

  const shutdownStart = Date.now()
  log.info('Starting graceful shutdown', { signal })

  try {
    // 1. Clear background timers
    clearRateLimitCleanup()

    // 2. Stop accepting new connections
    log.info('Closing HTTP server')
    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) reject(err)
        else resolve()
      })
    })
    log.info('HTTP server closed')

    // 3. Disconnect from database
    log.info('Disconnecting from database')
    await prisma.$disconnect()

    // 4. Disconnect Redis (if initialized)
    log.info('Disconnecting Redis')
    await disconnectRedis()

    const durationMs = Date.now() - shutdownStart
    log.info('Graceful shutdown complete', { durationMs })
    process.exit(0)
  } catch (error) {
    log.error('Error during shutdown', {}, error)
    process.exit(1)
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

process.on('uncaughtException', (error) => {
  log.fatal('Uncaught exception — initiating shutdown', {}, error)
  shutdown('uncaughtException')
})

process.on('unhandledRejection', (reason) => {
  log.fatal(
    'Unhandled rejection — initiating shutdown',
    {},
    reason instanceof Error ? reason : new Error(String(reason)),
  )
  shutdown('unhandledRejection')
})

export default app
