/**
 * Safe Logger for Client-Side Code
 *
 * This wrapper prevents accidental exposure of sensitive error data in browser
 * console logs. It strips error messages and stacks, keeping only the error name.
 *
 * SECURITY: Error messages can contain SQL queries, internal paths, user data,
 * or other sensitive information. In browser DevTools, anyone can see console
 * output. This wrapper ensures only safe error metadata reaches the browser.
 *
 * Usage:
 * ```typescript
 * import { safeLogger } from '@/lib/safe-logger'
 * safeLogger.error('Failed to fetch', { userId }, err)
 * // Browser console shows: { errorName: 'TypeError' } - no message or stack
 * ```
 */

import { createLogger, type LogContext } from '@ironscout/logger'

/**
 * Extract only safe error info for client-side logging.
 * NEVER includes message or stack - those could contain sensitive data.
 */
export function safeErrorInfo(error: unknown): { errorName: string } {
  if (error instanceof Error) {
    return { errorName: error.name }
  }
  if (typeof error === 'string') {
    return { errorName: 'StringError' }
  }
  return { errorName: 'UnknownError' }
}

/**
 * Create a safe logger that strips sensitive data from errors.
 *
 * @param component - Logger component name (e.g., 'dashboard', 'search')
 */
export function createSafeLogger(component: string) {
  const baseLogger = createLogger(`web:${component}`)

  return {
    debug(message: string, meta: LogContext = {}) {
      baseLogger.debug(message, meta)
    },

    info(message: string, meta: LogContext = {}) {
      baseLogger.info(message, meta)
    },

    warn(message: string, meta: LogContext = {}, error?: unknown) {
      baseLogger.warn(message, {
        ...meta,
        ...(error !== undefined ? safeErrorInfo(error) : {}),
      })
    },

    error(message: string, meta: LogContext = {}, error?: unknown) {
      baseLogger.error(message, {
        ...meta,
        ...(error !== undefined ? safeErrorInfo(error) : {}),
      })
    },

    fatal(message: string, meta: LogContext = {}, error?: unknown) {
      baseLogger.fatal(message, {
        ...meta,
        ...(error !== undefined ? safeErrorInfo(error) : {}),
      })
    },

    /**
     * Create a child logger with inherited component context.
     */
    child(subComponent: string) {
      return createSafeLogger(`${component}:${subComponent}`)
    },
  }
}

/**
 * Pre-configured safe loggers for common web components.
 * Use these instead of importing from @/lib/logger directly.
 */
export const safeLogger = {
  api: createSafeLogger('api'),
  auth: createSafeLogger('auth'),
  search: createSafeLogger('search'),
  dashboard: createSafeLogger('dashboard'),
  hooks: createSafeLogger('hooks'),
  components: createSafeLogger('components'),
  admin: createSafeLogger('admin'),
}

/**
 * Default safe logger for general use.
 */
export default createSafeLogger('app')
