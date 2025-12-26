/**
 * @ironscout/logger
 *
 * Structured logging for all IronScout applications.
 *
 * Features:
 * - JSON-formatted output for production (machine-parseable)
 * - Colored output for development (human-readable)
 * - ISO 8601 timestamps
 * - Log levels: debug, info, warn, error, fatal
 * - Structured metadata support
 * - Child loggers with inherited context
 * - Environment-based configuration
 *
 * Environment variables:
 * - LOG_LEVEL: Minimum log level (debug, info, warn, error, fatal). Default: info
 * - LOG_FORMAT: Output format (json, pretty). Default: json in production, pretty in development
 * - NODE_ENV: Used to determine defaults
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal'

export interface LogContext {
  [key: string]: unknown
}

interface LogEntry {
  timestamp: string
  level: LogLevel
  service: string
  component?: string
  message: string
  error?: {
    name: string
    message: string
    stack?: string
  }
  [key: string]: unknown
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
}

const LOG_COLORS: Record<LogLevel, string> = {
  debug: '\x1b[36m', // Cyan
  info: '\x1b[32m', // Green
  warn: '\x1b[33m', // Yellow
  error: '\x1b[31m', // Red
  fatal: '\x1b[35m', // Magenta
}

const RESET = '\x1b[0m'
const DIM = '\x1b[2m'
const BRIGHT = '\x1b[1m'

function getLogLevel(): LogLevel {
  const level = process.env.LOG_LEVEL?.toLowerCase() as LogLevel
  if (level && LOG_LEVELS[level] !== undefined) {
    return level
  }
  return 'info'
}

function getLogFormat(): 'json' | 'pretty' {
  const format = process.env.LOG_FORMAT?.toLowerCase()
  if (format === 'json' || format === 'pretty') {
    return format
  }
  // Default: pretty in development, json in production
  return process.env.NODE_ENV === 'production' ? 'json' : 'pretty'
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[getLogLevel()]
}

function formatError(error: unknown): LogEntry['error'] | undefined {
  if (!error) return undefined

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    }
  }

  return {
    name: 'UnknownError',
    message: String(error),
  }
}

function formatJson(entry: LogEntry): string {
  return JSON.stringify(entry)
}

function formatPretty(entry: LogEntry): string {
  const color = LOG_COLORS[entry.level]
  const levelStr = entry.level.toUpperCase().padEnd(5)

  // Build component path
  const componentPath = entry.component
    ? `${entry.service}:${entry.component}`
    : entry.service

  // Extract known fields
  const { timestamp, level, service, component, message, error, ...meta } = entry

  // Format metadata
  const metaStr =
    Object.keys(meta).length > 0 ? ` ${DIM}${JSON.stringify(meta)}${RESET}` : ''

  // Format error
  const errorStr = error ? `\n  ${DIM}${error.stack || error.message}${RESET}` : ''

  return `${DIM}${timestamp}${RESET} ${color}${BRIGHT}${levelStr}${RESET} ${DIM}[${componentPath}]${RESET} ${message}${metaStr}${errorStr}`
}

function output(entry: LogEntry): void {
  const format = getLogFormat()
  const formatted = format === 'json' ? formatJson(entry) : formatPretty(entry)

  switch (entry.level) {
    case 'debug':
      console.debug(formatted)
      break
    case 'info':
      console.info(formatted)
      break
    case 'warn':
      console.warn(formatted)
      break
    case 'error':
    case 'fatal':
      console.error(formatted)
      break
  }
}

export interface ILogger {
  debug(message: string, meta?: LogContext): void
  info(message: string, meta?: LogContext): void
  warn(message: string, meta?: LogContext, error?: unknown): void
  error(message: string, meta?: LogContext, error?: unknown): void
  fatal(message: string, meta?: LogContext, error?: unknown): void
  /**
   * Create a child logger
   * @param componentOrContext - Component name (string) or context object for backwards compatibility
   * @param defaultContext - Optional default context (only used when first arg is a string)
   */
  child(componentOrContext: string | LogContext, defaultContext?: LogContext): ILogger
}

export class Logger implements ILogger {
  private service: string
  private component?: string
  private defaultContext: LogContext

  constructor(service: string, component?: string, defaultContext: LogContext = {}) {
    this.service = service
    this.component = component
    this.defaultContext = defaultContext
  }

  private log(
    level: LogLevel,
    message: string,
    meta?: LogContext,
    error?: unknown
  ): void {
    if (!shouldLog(level)) return

    const errorData = error ? formatError(error) : undefined

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.service,
      message,
      ...this.defaultContext,
      ...meta,
    }

    if (this.component) {
      entry.component = this.component
    }

    if (errorData) {
      entry.error = errorData
    }

    output(entry)
  }

  debug(message: string, meta?: LogContext): void {
    this.log('debug', message, meta)
  }

  info(message: string, meta?: LogContext): void {
    this.log('info', message, meta)
  }

  warn(message: string, meta?: LogContext, error?: unknown): void {
    this.log('warn', message, meta, error)
  }

  error(message: string, meta?: LogContext, error?: unknown): void {
    this.log('error', message, meta, error)
  }

  fatal(message: string, meta?: LogContext, error?: unknown): void {
    this.log('fatal', message, meta, error)
  }

  child(componentOrContext: string | LogContext, defaultContext: LogContext = {}): ILogger {
    // Backwards compatibility: if first arg is object, treat as context
    if (typeof componentOrContext === 'object') {
      return new Logger(this.service, this.component, {
        ...this.defaultContext,
        ...componentOrContext,
      })
    }
    // New signature: first arg is component name string
    const newComponent = this.component
      ? `${this.component}:${componentOrContext}`
      : componentOrContext
    return new Logger(this.service, newComponent, {
      ...this.defaultContext,
      ...defaultContext,
    })
  }
}

/**
 * Create a logger for a service
 *
 * @param service - The service name (e.g., 'api', 'web', 'harvester')
 * @returns A logger instance
 *
 * @example
 * ```ts
 * import { createLogger } from '@ironscout/logger'
 *
 * const logger = createLogger('api')
 * logger.info('Server started', { port: 3000 })
 *
 * const authLogger = logger.child('auth')
 * authLogger.info('User logged in', { userId: '123' })
 * ```
 */
export function createLogger(service: string): ILogger {
  return new Logger(service)
}
