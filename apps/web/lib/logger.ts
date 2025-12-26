/**
 * Web App Logger Configuration
 *
 * Server-side: Uses @ironscout/logger for structured logging
 * Client-side: Uses simple console wrapper (logger package uses Node.js APIs)
 */

// Check if we're on the server
const isServer = typeof window === 'undefined'

export interface LogContext {
  [key: string]: unknown
}

export interface ILogger {
  debug(message: string, meta?: LogContext): void
  info(message: string, meta?: LogContext): void
  warn(message: string, meta?: LogContext, error?: unknown): void
  error(message: string, meta?: LogContext, error?: unknown): void
  child(componentOrContext: string | LogContext, defaultContext?: LogContext): ILogger
}

// Simple client-side logger
class ClientLogger implements ILogger {
  private component: string

  constructor(component: string) {
    this.component = component
  }

  private formatMeta(meta?: LogContext): string {
    if (!meta || Object.keys(meta).length === 0) return ''
    return ` ${JSON.stringify(meta)}`
  }

  debug(message: string, meta?: LogContext): void {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`[${this.component}] ${message}${this.formatMeta(meta)}`)
    }
  }

  info(message: string, meta?: LogContext): void {
    console.info(`[${this.component}] ${message}${this.formatMeta(meta)}`)
  }

  warn(message: string, meta?: LogContext, error?: unknown): void {
    console.warn(`[${this.component}] ${message}${this.formatMeta(meta)}`, error || '')
  }

  error(message: string, meta?: LogContext, error?: unknown): void {
    console.error(`[${this.component}] ${message}${this.formatMeta(meta)}`, error || '')
  }

  child(componentOrContext: string | LogContext, defaultContext?: LogContext): ILogger {
    if (typeof componentOrContext === 'object') {
      // Backwards compatibility: context object passed, keep same component
      return new ClientLogger(this.component)
    }
    return new ClientLogger(`${this.component}:${componentOrContext}`)
  }
}

// Server-side logger using the shared package
let serverLogger: ILogger | null = null

async function getServerLogger(): Promise<ILogger> {
  if (!serverLogger) {
    const { createLogger } = await import('@ironscout/logger')
    serverLogger = createLogger('web')
  }
  return serverLogger
}

/**
 * Create a logger for a component
 *
 * On the server, uses @ironscout/logger for structured JSON output
 * On the client, uses a simple console wrapper
 */
export function createLogger(component: string): ILogger {
  if (isServer) {
    // Return a proxy that lazily loads the server logger
    const createServerProxy = (comp: string): ILogger => ({
      debug: async (message: string, meta?: LogContext) => {
        const log = await getServerLogger()
        log.child(comp).debug(message, meta)
      },
      info: async (message: string, meta?: LogContext) => {
        const log = await getServerLogger()
        log.child(comp).info(message, meta)
      },
      warn: async (message: string, meta?: LogContext, error?: unknown) => {
        const log = await getServerLogger()
        log.child(comp).warn(message, meta, error)
      },
      error: async (message: string, meta?: LogContext, error?: unknown) => {
        const log = await getServerLogger()
        log.child(comp).error(message, meta, error)
      },
      child: (componentOrContext: string | LogContext, defaultContext?: LogContext): ILogger => {
        if (typeof componentOrContext === 'object') {
          return createServerProxy(comp)
        }
        return createServerProxy(`${comp}:${componentOrContext}`)
      },
    })
    return createServerProxy(component)
  }

  return new ClientLogger(component)
}

// Pre-configured loggers for common components
export const logger = {
  api: createLogger('api'),
  auth: createLogger('auth'),
  search: createLogger('search'),
  dashboard: createLogger('dashboard'),
}
