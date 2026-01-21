/**
 * API Logger Configuration
 *
 * Pre-configured loggers for API components with standard fields.
 *
 * Standard fields added to all log entries:
 * - service: 'api'
 * - env: NODE_ENV or 'development'
 * - version: Package version
 *
 * These fields are automatically included via the @ironscout/logger
 * child logger mechanism with default context.
 */

import { createLogger } from '@ironscout/logger'

// Standard context fields for all API logs
const SERVICE = 'api'
const ENV = process.env.NODE_ENV || 'development'
const VERSION = process.env.npm_package_version || '1.0.0'

// Root logger for API service with standard context
export const logger = createLogger(SERVICE)

// Pre-configured child loggers for common components
// Each child logger inherits the service name and adds its component path
export const loggers = {
  server: logger.child('server', { env: ENV, version: VERSION }),
  auth: logger.child('auth', { env: ENV, version: VERSION }),
  search: logger.child('search', { env: ENV, version: VERSION }),
  payments: logger.child('payments', { env: ENV, version: VERSION }),
  alerts: logger.child('alerts', { env: ENV, version: VERSION }),
  watchlist: logger.child('watchlist', { env: ENV, version: VERSION }),
  products: logger.child('products', { env: ENV, version: VERSION }),
  dashboard: logger.child('dashboard', { env: ENV, version: VERSION }),
  admin: logger.child('admin', { env: ENV, version: VERSION }),
  email: logger.child('email', { env: ENV, version: VERSION }),
  ai: logger.child('ai', { env: ENV, version: VERSION }),
}

/**
 * Create a new child logger with standard context
 *
 * @param component - Component name (e.g., 'myFeature')
 * @param additionalContext - Optional additional context fields
 * @returns Child logger with standard + additional context
 *
 * @example
 * ```ts
 * const myLogger = createChildLogger('myFeature', { customField: 'value' })
 * myLogger.info('Something happened', { extra: 'data' })
 * ```
 */
export function createChildLogger(
  component: string,
  additionalContext?: Record<string, unknown>
) {
  return logger.child(component, {
    env: ENV,
    version: VERSION,
    ...additionalContext,
  })
}

/**
 * Standard event names for consistent log taxonomy
 *
 * Use these constants for the event_name field to enable
 * consistent querying and alerting across the codebase.
 */
export const LOG_EVENTS = {
  // HTTP
  HTTP_REQUEST_END: 'http.request.end',
  HTTP_REQUEST_ERROR: 'http.request.error',

  // Auth
  AUTH_LOGIN_SUCCESS: 'auth.login.success',
  AUTH_LOGIN_FAILURE: 'auth.login.failure',
  AUTH_LOGOUT: 'auth.logout',
  AUTH_TOKEN_REFRESH: 'auth.token.refresh',
  AUTH_SIGNUP: 'auth.signup',

  // Search
  SEARCH_QUERY: 'search.query',
  SEARCH_SEMANTIC: 'search.semantic',
  SEARCH_SUGGESTIONS: 'search.suggestions',

  // Lens Evaluation (Appendix A telemetry)
  LENS_EVAL: 'lens_eval.v1',

  // Payments
  PAYMENT_INTENT_CREATED: 'payment.intent.created',
  PAYMENT_SUCCEEDED: 'payment.succeeded',
  PAYMENT_FAILED: 'payment.failed',
  SUBSCRIPTION_CREATED: 'subscription.created',
  SUBSCRIPTION_CANCELED: 'subscription.canceled',

  // Alerts
  ALERT_CREATED: 'alert.created',
  ALERT_TRIGGERED: 'alert.triggered',
  ALERT_DELETED: 'alert.deleted',

  // Admin
  ADMIN_SETTING_CHANGED: 'admin.setting.changed',
  ADMIN_USER_MODIFIED: 'admin.user.modified',

  // System
  SERVER_START: 'server.start',
  SERVER_SHUTDOWN: 'server.shutdown',
  DB_CONNECTION: 'db.connection',
  CACHE_HIT: 'cache.hit',
  CACHE_MISS: 'cache.miss',

  // Rate Limiting
  RATE_LIMIT_BLOCKED: 'rate_limit.blocked',
  RATE_LIMIT_WARNING: 'rate_limit.warning',

  // External Services
  EXTERNAL_REQUEST: 'external.request',
  EXTERNAL_ERROR: 'external.error',
  EXTERNAL_TIMEOUT: 'external.timeout',
} as const

export type LogEvent = (typeof LOG_EVENTS)[keyof typeof LOG_EVENTS]
