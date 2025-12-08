/**
 * Admin Portal Logger
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
  DEBUG: '\x1b[36m',
  INFO: '\x1b[32m',
  WARN: '\x1b[33m',
  ERROR: '\x1b[31m',
  FATAL: '\x1b[35m',
};

const RESET = '\x1b[0m';

class Logger {
  private serviceName: string;
  private debugEnabled: boolean;

  constructor(serviceName: string = 'admin') {
    this.serviceName = serviceName;
    this.debugEnabled = process.env.ADMIN_DEBUG === 'true' || process.env.NODE_ENV !== 'production';
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
    
    const contextStr = context && Object.keys(context).length > 0
      ? ` ${JSON.stringify(context)}`
      : '';

    const logMessage = `${prefix} ${message}${contextStr}`;

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

  debug(message: string, context?: LogContext): void {
    this.log('DEBUG', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log('INFO', message, context);
  }

  warn(message: string, context?: LogContext, error?: unknown): void {
    this.log('WARN', message, context, error);
  }

  error(message: string, context?: LogContext, error?: unknown): void {
    this.log('ERROR', message, context, error);
  }

  fatal(message: string, context?: LogContext, error?: unknown): void {
    this.log('FATAL', message, context, error);
  }

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

export const logger = new Logger('admin');
export { Logger, ChildLogger };
