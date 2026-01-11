/**
 * HTTP Request Logger Middleware
 *
 * Logs a single structured log entry per request with:
 * - request_id correlation
 * - HTTP method, route, status code
 * - Latency in milliseconds
 * - Error information (if any)
 *
 * Design: ONE log per request (at response finish)
 * Event name: http.request.end
 */

import { Request, Response, NextFunction } from 'express'
import { getRequestContext } from '@ironscout/logger'
import { loggers } from '../config/logger'
import { classifyError, formatErrorForLog } from '../lib/errors'

const log = loggers.server

/**
 * Request metadata attached during processing
 */
declare global {
  namespace Express {
    interface Request {
      _startTime?: bigint
      _route?: string
    }
  }
}

/**
 * Paths to skip logging (health checks, metrics, etc.)
 */
const SKIP_PATHS = new Set(['/health', '/healthz', '/ready', '/metrics', '/favicon.ico'])

/**
 * Check if request should be logged
 */
function shouldLog(req: Request): boolean {
  // Skip health checks and metrics
  if (SKIP_PATHS.has(req.path)) {
    return false
  }

  return true
}

/**
 * Get the matched route pattern (e.g., /api/products/:id)
 * Falls back to path if no route is matched
 */
function getRoute(req: Request): string {
  // Express stores the matched route on req.route
  if (req.route?.path) {
    // Combine baseUrl (from router) with route path
    const baseUrl = req.baseUrl || ''
    return `${baseUrl}${req.route.path}`
  }

  // Check if we stored it during routing
  if (req._route) {
    return req._route
  }

  // Fall back to the actual path (sanitize dynamic segments)
  // Replace UUIDs and numeric IDs with placeholders
  return req.path
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
    .replace(/\/\d+(?=\/|$)/g, '/:id')
}

/**
 * Calculate latency from high-resolution start time
 */
function calculateLatencyMs(startTime: bigint): number {
  const endTime = process.hrtime.bigint()
  const latencyNs = endTime - startTime
  // Convert nanoseconds to milliseconds with 2 decimal precision
  return Math.round(Number(latencyNs) / 1_000_000 * 100) / 100
}

/**
 * Request logger middleware
 *
 * Must be placed early in the middleware chain (after requestContextMiddleware)
 * to capture the full request lifecycle.
 */
export function requestLoggerMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Skip if not loggable
  if (!shouldLog(req)) {
    return next()
  }

  // Record start time with high precision
  req._startTime = process.hrtime.bigint()

  // Get request context (contains requestId)
  const context = getRequestContext()
  const requestId = context?.requestId

  // Capture response finish event
  res.on('finish', () => {
    const latencyMs = req._startTime ? calculateLatencyMs(req._startTime) : 0
    const route = getRoute(req)

    // Build log entry
    const logEntry = {
      event_name: 'http.request.end',
      http: {
        method: req.method,
        route,
        path: req.path,
        status_code: res.statusCode,
        latency_ms: latencyMs,
      },
      request_id: requestId,
    }

    // Log at appropriate level based on status code
    if (res.statusCode >= 500) {
      log.error('Request completed with error', logEntry)
    } else if (res.statusCode >= 400) {
      log.warn('Request completed with client error', logEntry)
    } else {
      log.info('Request completed', logEntry)
    }
  })

  // Also handle errors that occur during request processing
  res.on('error', (error: Error) => {
    const latencyMs = req._startTime ? calculateLatencyMs(req._startTime) : 0
    const route = getRoute(req)
    const classified = classifyError(error)

    log.error('Request error', {
      event_name: 'http.request.error',
      http: {
        method: req.method,
        route,
        path: req.path,
        status_code: res.statusCode,
        latency_ms: latencyMs,
      },
      request_id: requestId,
      ...formatErrorForLog(classified),
    })
  })

  next()
}

/**
 * Error logging middleware
 *
 * Place at the end of the middleware chain to catch unhandled errors.
 * Logs errors with classification and then passes to the next error handler.
 */
export function errorLoggerMiddleware(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const context = getRequestContext()
  const requestId = context?.requestId
  const latencyMs = req._startTime ? calculateLatencyMs(req._startTime) : 0
  const route = getRoute(req)

  const classified = classifyError(err)

  log.error('Unhandled error', {
    event_name: 'http.request.error',
    http: {
      method: req.method,
      route,
      path: req.path,
      latency_ms: latencyMs,
    },
    request_id: requestId,
    ...formatErrorForLog(classified),
  })

  // Pass to next error handler
  next(err)
}

/**
 * Route capture middleware
 *
 * Stores the route pattern for use in logging.
 * Place after route matching to capture the actual pattern.
 */
export function routeCaptureMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // This will be called after route matching
  // Store the route for the request logger
  if (req.route?.path) {
    req._route = `${req.baseUrl}${req.route.path}`
  }
  next()
}
