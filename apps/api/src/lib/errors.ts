/**
 * Error Classification and Structured Error Handling
 *
 * Provides consistent error categorization for logging and monitoring.
 * Errors are classified into categories that map to operational responses.
 */

import { ZodError } from 'zod'

/**
 * Error categories for classification
 */
export type ErrorCategory =
  | 'validation' // Client sent invalid data (4xx)
  | 'auth' // Authentication/authorization failure (401, 403)
  | 'not_found' // Resource not found (404)
  | 'rate_limit' // Rate limit exceeded (429)
  | 'db' // Database errors (connection, query, constraint)
  | 'external' // External service failures (APIs, network)
  | 'internal' // Unexpected internal errors (500)
  | 'timeout' // Operation timeout
  | 'conflict' // Resource conflict (409)

/**
 * Structured error information for logging
 */
export interface ClassifiedError {
  category: ErrorCategory
  code: string
  message: string
  statusCode: number
  isOperational: boolean // Expected errors vs bugs
  isRetryable: boolean
  details?: Record<string, unknown>
  originalError?: Error
}

/**
 * Known error codes by category
 */
export const ERROR_CODES = {
  // Validation
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT: 'INVALID_FORMAT',

  // Auth
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  SESSION_EXPIRED: 'SESSION_EXPIRED',

  // Not Found
  NOT_FOUND: 'NOT_FOUND',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  PRODUCT_NOT_FOUND: 'PRODUCT_NOT_FOUND',

  // Rate Limit
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',

  // Database
  DB_CONNECTION_ERROR: 'DB_CONNECTION_ERROR',
  DB_QUERY_ERROR: 'DB_QUERY_ERROR',
  DB_CONSTRAINT_VIOLATION: 'DB_CONSTRAINT_VIOLATION',
  DB_TIMEOUT: 'DB_TIMEOUT',

  // External
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  EXTERNAL_TIMEOUT: 'EXTERNAL_TIMEOUT',
  EXTERNAL_UNAVAILABLE: 'EXTERNAL_UNAVAILABLE',
  NETWORK_ERROR: 'NETWORK_ERROR',

  // Internal
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  UNEXPECTED_ERROR: 'UNEXPECTED_ERROR',
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',

  // Timeout
  OPERATION_TIMEOUT: 'OPERATION_TIMEOUT',
  REQUEST_TIMEOUT: 'REQUEST_TIMEOUT',

  // Conflict
  CONFLICT: 'CONFLICT',
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
  CONCURRENT_MODIFICATION: 'CONCURRENT_MODIFICATION',
} as const

/**
 * Classify an error into a structured format
 */
export function classifyError(error: unknown): ClassifiedError {
  // Already classified
  if (isClassifiedError(error)) {
    return error
  }

  // Zod validation errors
  if (error instanceof ZodError) {
    return {
      category: 'validation',
      code: ERROR_CODES.VALIDATION_FAILED,
      message: 'Validation failed',
      statusCode: 400,
      isOperational: true,
      isRetryable: false,
      details: {
        issues: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
          code: issue.code,
        })),
      },
      originalError: error,
    }
  }

  // Handle Error instances
  if (error instanceof Error) {
    // Check for known error patterns
    const classified = classifyByErrorProperties(error)
    if (classified) {
      return classified
    }

    // Check for Prisma errors
    const prismaClassified = classifyPrismaError(error)
    if (prismaClassified) {
      return prismaClassified
    }

    // Check for network/timeout errors
    const networkClassified = classifyNetworkError(error)
    if (networkClassified) {
      return networkClassified
    }

    // Default: internal error
    return {
      category: 'internal',
      code: ERROR_CODES.UNEXPECTED_ERROR,
      message: error.message || 'An unexpected error occurred',
      statusCode: 500,
      isOperational: false,
      isRetryable: false,
      originalError: error,
    }
  }

  // Non-Error thrown values
  return {
    category: 'internal',
    code: ERROR_CODES.UNEXPECTED_ERROR,
    message: String(error),
    statusCode: 500,
    isOperational: false,
    isRetryable: false,
  }
}

/**
 * Type guard for ClassifiedError
 */
function isClassifiedError(error: unknown): error is ClassifiedError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'category' in error &&
    'code' in error &&
    'statusCode' in error
  )
}

/**
 * Classify based on error properties (code, status, etc.)
 */
function classifyByErrorProperties(error: Error): ClassifiedError | null {
  const anyError = error as Error & {
    code?: string
    status?: number
    statusCode?: number
  }

  // JWT errors
  if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
    return {
      category: 'auth',
      code:
        error.name === 'TokenExpiredError'
          ? ERROR_CODES.TOKEN_EXPIRED
          : ERROR_CODES.TOKEN_INVALID,
      message: error.message,
      statusCode: 401,
      isOperational: true,
      isRetryable: false,
      originalError: error,
    }
  }

  // HTTP status codes embedded in error
  const status = anyError.status || anyError.statusCode
  if (status) {
    if (status === 401) {
      return {
        category: 'auth',
        code: ERROR_CODES.UNAUTHORIZED,
        message: error.message,
        statusCode: 401,
        isOperational: true,
        isRetryable: false,
        originalError: error,
      }
    }
    if (status === 403) {
      return {
        category: 'auth',
        code: ERROR_CODES.FORBIDDEN,
        message: error.message,
        statusCode: 403,
        isOperational: true,
        isRetryable: false,
        originalError: error,
      }
    }
    if (status === 404) {
      return {
        category: 'not_found',
        code: ERROR_CODES.NOT_FOUND,
        message: error.message,
        statusCode: 404,
        isOperational: true,
        isRetryable: false,
        originalError: error,
      }
    }
    if (status === 429) {
      return {
        category: 'rate_limit',
        code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
        message: error.message,
        statusCode: 429,
        isOperational: true,
        isRetryable: true,
        originalError: error,
      }
    }
    if (status === 409) {
      return {
        category: 'conflict',
        code: ERROR_CODES.CONFLICT,
        message: error.message,
        statusCode: 409,
        isOperational: true,
        isRetryable: false,
        originalError: error,
      }
    }
  }

  return null
}

/**
 * Classify Prisma database errors
 */
function classifyPrismaError(error: Error): ClassifiedError | null {
  const anyError = error as Error & { code?: string; meta?: Record<string, unknown> }

  // Prisma error codes: https://www.prisma.io/docs/reference/api-reference/error-reference
  if (anyError.code) {
    // Connection errors
    if (anyError.code.startsWith('P1')) {
      return {
        category: 'db',
        code: ERROR_CODES.DB_CONNECTION_ERROR,
        message: 'Database connection error',
        statusCode: 503,
        isOperational: true,
        isRetryable: true,
        details: { prismaCode: anyError.code },
        originalError: error,
      }
    }

    // Query errors
    if (anyError.code === 'P2002') {
      return {
        category: 'conflict',
        code: ERROR_CODES.DUPLICATE_ENTRY,
        message: 'A record with this value already exists',
        statusCode: 409,
        isOperational: true,
        isRetryable: false,
        details: { prismaCode: anyError.code, meta: anyError.meta },
        originalError: error,
      }
    }

    if (anyError.code === 'P2025') {
      return {
        category: 'not_found',
        code: ERROR_CODES.RESOURCE_NOT_FOUND,
        message: 'Record not found',
        statusCode: 404,
        isOperational: true,
        isRetryable: false,
        details: { prismaCode: anyError.code },
        originalError: error,
      }
    }

    if (anyError.code.startsWith('P2')) {
      return {
        category: 'db',
        code: ERROR_CODES.DB_QUERY_ERROR,
        message: 'Database query error',
        statusCode: 500,
        isOperational: true,
        isRetryable: false,
        details: { prismaCode: anyError.code },
        originalError: error,
      }
    }
  }

  // Check for Prisma in error name or constructor
  if (
    error.name?.includes('Prisma') ||
    error.constructor?.name?.includes('Prisma')
  ) {
    return {
      category: 'db',
      code: ERROR_CODES.DB_QUERY_ERROR,
      message: 'Database error',
      statusCode: 500,
      isOperational: true,
      isRetryable: false,
      originalError: error,
    }
  }

  return null
}

/**
 * Classify network and timeout errors
 */
function classifyNetworkError(error: Error): ClassifiedError | null {
  const anyError = error as Error & { code?: string }

  // Node.js network error codes
  const networkErrorCodes = [
    'ECONNREFUSED',
    'ECONNRESET',
    'ENOTFOUND',
    'ETIMEDOUT',
    'EPIPE',
    'EHOSTUNREACH',
    'ENETUNREACH',
  ]

  if (anyError.code && networkErrorCodes.includes(anyError.code)) {
    const isTimeout = anyError.code === 'ETIMEDOUT'
    return {
      category: isTimeout ? 'timeout' : 'external',
      code: isTimeout ? ERROR_CODES.EXTERNAL_TIMEOUT : ERROR_CODES.NETWORK_ERROR,
      message: `Network error: ${anyError.code}`,
      statusCode: 503,
      isOperational: true,
      isRetryable: true,
      details: { errorCode: anyError.code },
      originalError: error,
    }
  }

  // Timeout keywords in message
  if (
    error.message.toLowerCase().includes('timeout') ||
    error.message.toLowerCase().includes('timed out')
  ) {
    return {
      category: 'timeout',
      code: ERROR_CODES.OPERATION_TIMEOUT,
      message: error.message,
      statusCode: 504,
      isOperational: true,
      isRetryable: true,
      originalError: error,
    }
  }

  return null
}

/**
 * Format a classified error for logging
 */
export function formatErrorForLog(classified: ClassifiedError): Record<string, unknown> {
  return {
    error_category: classified.category,
    error_code: classified.code,
    error_message: classified.message,
    error_status_code: classified.statusCode,
    error_is_operational: classified.isOperational,
    error_is_retryable: classified.isRetryable,
    ...(classified.details && { error_details: classified.details }),
    ...(classified.originalError && {
      error_stack: classified.originalError.stack,
      error_name: classified.originalError.name,
    }),
  }
}

/**
 * User-safe error messages (never expose internal details)
 */
const SAFE_MESSAGES: Record<string, string> = {
  // Validation
  VALIDATION_FAILED: 'Please check your input and try again',
  INVALID_INPUT: 'Invalid input provided',
  MISSING_REQUIRED_FIELD: 'Required information is missing',
  INVALID_FORMAT: 'Invalid format provided',

  // Auth
  UNAUTHORIZED: 'Please sign in to continue',
  FORBIDDEN: "You don't have permission for this action",
  TOKEN_EXPIRED: 'Your session has expired. Please sign in again',
  TOKEN_INVALID: 'Invalid authentication. Please sign in again',
  SESSION_EXPIRED: 'Your session has expired. Please sign in again',

  // Not Found
  NOT_FOUND: 'The requested resource was not found',
  RESOURCE_NOT_FOUND: 'The requested resource was not found',
  USER_NOT_FOUND: 'User not found',
  PRODUCT_NOT_FOUND: 'Product not found',

  // Rate Limit
  RATE_LIMIT_EXCEEDED: 'Too many requests. Please wait a moment',
  QUOTA_EXCEEDED: 'Usage limit reached. Please try again later',

  // Database (never expose internal DB details)
  DB_CONNECTION_ERROR: 'Service temporarily unavailable. Please try again',
  DB_QUERY_ERROR: 'An error occurred. Please try again',
  DB_CONSTRAINT_VIOLATION: 'This operation could not be completed',
  DB_TIMEOUT: 'Request timed out. Please try again',

  // External
  EXTERNAL_SERVICE_ERROR: 'An external service error occurred',
  EXTERNAL_TIMEOUT: 'Request timed out. Please try again',
  EXTERNAL_UNAVAILABLE: 'Service temporarily unavailable',
  NETWORK_ERROR: 'Network error occurred. Please try again',

  // Internal (never expose internal details)
  INTERNAL_ERROR: 'Something went wrong. Please try again',
  UNEXPECTED_ERROR: 'An unexpected error occurred',
  CONFIGURATION_ERROR: 'Service configuration error',

  // Timeout
  OPERATION_TIMEOUT: 'Operation timed out. Please try again',
  REQUEST_TIMEOUT: 'Request timed out. Please try again',

  // Conflict
  CONFLICT: 'A conflict occurred. Please refresh and try again',
  DUPLICATE_ENTRY: 'This item already exists',
  CONCURRENT_MODIFICATION: 'The item was modified. Please refresh and try again',
}

/**
 * Get a user-safe message for an error code (never expose internal details)
 */
export function getSafeMessage(classified: ClassifiedError): string {
  return SAFE_MESSAGES[classified.code] || 'An error occurred'
}

/**
 * Create a custom operational error
 */
export function createOperationalError(
  category: ErrorCategory,
  code: string,
  message: string,
  statusCode: number,
  details?: Record<string, unknown>
): ClassifiedError {
  return {
    category,
    code,
    message,
    statusCode,
    isOperational: true,
    isRetryable: category === 'external' || category === 'timeout' || category === 'db',
    details,
  }
}
