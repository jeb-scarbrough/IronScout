/**
 * Dealer Portal Logger Configuration
 *
 * Pre-configured loggers for dealer portal components
 * Uses @ironscout/logger for structured logging
 */

import { createLogger, type ILogger, type LogContext } from '@ironscout/logger'

// Root logger for dealer service
const rootLogger = createLogger('dealer')

// Pre-configured child loggers for dealer components
export const logger = rootLogger
export const loggers = {
  auth: rootLogger.child('auth'),
  feeds: rootLogger.child('feeds'),
  insights: rootLogger.child('insights'),
  billing: rootLogger.child('billing'),
  settings: rootLogger.child('settings'),
}

// Re-export types for backwards compatibility
export type { LogContext, ILogger }
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal'
