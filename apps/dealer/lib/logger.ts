/**
 * Dealer Portal Logger
 * 
 * Structured logging with levels: DEBUG, INFO, WARN, ERROR, FATAL
 * 
 * In production, DEBUG is suppressed unless DEALER_DEBUG=true
 * All other levels are always logged
 */

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';

interface LogContext {
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

const LOG_COLORS: Record<LogLevel, string> = {
  DEBUG: '\x1b[36m',  // Cyan
  INFO: '\x1b[32m',   // Green
  WARN: '\x1b[33m',   // Yellow
  ERROR: '\x1b[31m',  // Red
  FATAL: '\x1b[35m',  // Magenta
};

const RESET = '\x1b[0m';

class Logger {
  private serviceName: string;
  private debugEnabled: boolean;

  constructor(serviceName: string = 'dealer') {
    this.serviceName = serviceName;
    this.debugEnabled = process.env.DEALER_DEBUG === 'true' || process.env.NODE_ENV !== 'production';
  }

  private formatError(error: unknown): LogEntry['error'] | undefined {
    if (!error) return undefined;
    
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }
    
    return {
      name: 'UnknownError',
      message: String(error),
    };
  }

  private log(level: LogLevel, message: string, context?: LogContext, error?: unknown): void {
    // Skip DEBUG in production unless explicitly enabled
    if (level === 'DEBUG' && !this.debugEnabled) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      error: this.formatError(error),
    };

    const color = LOG_COLORS[level];
    const prefix = `${color}[${entry.timestamp}] [${this.serviceName}] [${level}]${RESET}`;
    
    // Format context for readability
    const contextStr = context && Object.keys(context).length > 0
      ? ` ${JSON.stringify(context)}`
      : '';

    const logMessage = `${prefix} ${message}${contextStr}`;

    // Use appropriate console method
    switch (level) {
      case 'DEBUG':
        console.debug(logMessage);
        break;
      case 'INFO':
        console.info(logMessage);
        break;
      case 'WARN':
        console.warn(logMessage);
        break;
      case 'ERROR':
      case 'FATAL':
        console.error(logMessage);
        if (entry.error?.stack) {
          console.error(entry.error.stack);
        }
        break;
    }
  }

  /**
   * Debug level - detailed information for debugging
   * Only logged when DEALER_DEBUG=true or in development
   */
  debug(message: string, context?: LogContext): void {
    this.log('DEBUG', message, context);
  }

  /**
   * Info level - general operational information
   */
  info(message: string, context?: LogContext): void {
    this.log('INFO', message, context);
  }

  /**
   * Warn level - potentially harmful situations
   */
  warn(message: string, context?: LogContext, error?: unknown): void {
    this.log('WARN', message, context, error);
  }

  /**
   * Error level - error events that might still allow the application to continue
   */
  error(message: string, context?: LogContext, error?: unknown): void {
    this.log('ERROR', message, context, error);
  }

  /**
   * Fatal level - severe error events that will likely cause the application to abort
   */
  fatal(message: string, context?: LogContext, error?: unknown): void {
    this.log('FATAL', message, context, error);
  }

  /**
   * Create a child logger with additional default context
   */
  child(defaultContext: LogContext): ChildLogger {
    return new ChildLogger(this, defaultContext);
  }
}

class ChildLogger {
  private parent: Logger;
  private defaultContext: LogContext;

  constructor(parent: Logger, defaultContext: LogContext) {
    this.parent = parent;
    this.defaultContext = defaultContext;
  }

  private mergeContext(context?: LogContext): LogContext {
    return { ...this.defaultContext, ...context };
  }

  debug(message: string, context?: LogContext): void {
    this.parent.debug(message, this.mergeContext(context));
  }

  info(message: string, context?: LogContext): void {
    this.parent.info(message, this.mergeContext(context));
  }

  warn(message: string, context?: LogContext, error?: unknown): void {
    this.parent.warn(message, this.mergeContext(context), error);
  }

  error(message: string, context?: LogContext, error?: unknown): void {
    this.parent.error(message, this.mergeContext(context), error);
  }

  fatal(message: string, context?: LogContext, error?: unknown): void {
    this.parent.fatal(message, this.mergeContext(context), error);
  }
}

// Export singleton instance
export const logger = new Logger('dealer');

// Export class for custom instances
export { Logger, ChildLogger };
