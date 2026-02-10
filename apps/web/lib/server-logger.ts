/**
 * Web App Server Logger
 *
 * Wraps @ironscout/logger with Slack alerting for error/fatal logs.
 * Server-only: do not import this module from client components.
 */

import { createLogger as baseCreateLogger, type ILogger, type LogContext } from '@ironscout/logger'
import { wrapLoggerWithSlack } from '@ironscout/notifications'

export type { ILogger, LogContext }

export function createLogger(service: string): ILogger {
  return wrapLoggerWithSlack(baseCreateLogger(service), { service })
}

// Pre-configured loggers for common web server components
export const logger = {
  api: createLogger('web:api'),
  auth: createLogger('web:auth'),
  search: createLogger('web:search'),
  dashboard: createLogger('web:dashboard'),
}

// Root logger for general server usage
export const rootLogger = createLogger('web')
