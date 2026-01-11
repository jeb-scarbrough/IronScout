/**
 * Error Classification Tests
 *
 * Tests error classification to ensure:
 * 1. Errors are correctly categorized
 * 2. Status codes are appropriate
 * 3. Error logging format is consistent
 * 4. Operational vs internal errors are distinguished
 */

import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import {
  classifyError,
  formatErrorForLog,
  createOperationalError,
  ERROR_CODES,
  ClassifiedError,
} from '../errors'

describe('classifyError', () => {
  describe('Zod validation errors', () => {
    it('classifies ZodError as validation', () => {
      const schema = z.object({ name: z.string() })
      try {
        schema.parse({ name: 123 })
      } catch (error) {
        const classified = classifyError(error)
        expect(classified.category).toBe('validation')
        expect(classified.code).toBe(ERROR_CODES.VALIDATION_FAILED)
        expect(classified.statusCode).toBe(400)
        expect(classified.isOperational).toBe(true)
        expect(classified.isRetryable).toBe(false)
        expect(classified.details).toBeDefined()
        expect(classified.details?.issues).toBeDefined()
      }
    })

    it('includes validation issues in details', () => {
      const schema = z.object({
        email: z.string().email(),
        age: z.number().min(0),
      })
      try {
        schema.parse({ email: 'invalid', age: -1 })
      } catch (error) {
        const classified = classifyError(error)
        const issues = classified.details?.issues as Array<{
          path: string
          message: string
        }>
        expect(issues).toHaveLength(2)
        expect(issues.some((i) => i.path === 'email')).toBe(true)
        expect(issues.some((i) => i.path === 'age')).toBe(true)
      }
    })
  })

  describe('JWT errors', () => {
    it('classifies TokenExpiredError as auth', () => {
      const error = new Error('jwt expired')
      error.name = 'TokenExpiredError'
      const classified = classifyError(error)
      expect(classified.category).toBe('auth')
      expect(classified.code).toBe(ERROR_CODES.TOKEN_EXPIRED)
      expect(classified.statusCode).toBe(401)
      expect(classified.isOperational).toBe(true)
    })

    it('classifies JsonWebTokenError as auth', () => {
      const error = new Error('invalid signature')
      error.name = 'JsonWebTokenError'
      const classified = classifyError(error)
      expect(classified.category).toBe('auth')
      expect(classified.code).toBe(ERROR_CODES.TOKEN_INVALID)
      expect(classified.statusCode).toBe(401)
    })
  })

  describe('HTTP status code errors', () => {
    it('classifies 401 errors as auth', () => {
      const error = new Error('Unauthorized') as Error & { status: number }
      error.status = 401
      const classified = classifyError(error)
      expect(classified.category).toBe('auth')
      expect(classified.code).toBe(ERROR_CODES.UNAUTHORIZED)
      expect(classified.statusCode).toBe(401)
    })

    it('classifies 403 errors as auth', () => {
      const error = new Error('Forbidden') as Error & { statusCode: number }
      error.statusCode = 403
      const classified = classifyError(error)
      expect(classified.category).toBe('auth')
      expect(classified.code).toBe(ERROR_CODES.FORBIDDEN)
      expect(classified.statusCode).toBe(403)
    })

    it('classifies 404 errors as not_found', () => {
      const error = new Error('Not found') as Error & { status: number }
      error.status = 404
      const classified = classifyError(error)
      expect(classified.category).toBe('not_found')
      expect(classified.code).toBe(ERROR_CODES.NOT_FOUND)
      expect(classified.statusCode).toBe(404)
    })

    it('classifies 429 errors as rate_limit', () => {
      const error = new Error('Too many requests') as Error & { status: number }
      error.status = 429
      const classified = classifyError(error)
      expect(classified.category).toBe('rate_limit')
      expect(classified.code).toBe(ERROR_CODES.RATE_LIMIT_EXCEEDED)
      expect(classified.statusCode).toBe(429)
      expect(classified.isRetryable).toBe(true)
    })

    it('classifies 409 errors as conflict', () => {
      const error = new Error('Conflict') as Error & { status: number }
      error.status = 409
      const classified = classifyError(error)
      expect(classified.category).toBe('conflict')
      expect(classified.code).toBe(ERROR_CODES.CONFLICT)
      expect(classified.statusCode).toBe(409)
    })
  })

  describe('Prisma errors', () => {
    it('classifies P1xxx errors as db connection', () => {
      const error = new Error('Can\'t reach database') as Error & { code: string }
      error.code = 'P1001'
      const classified = classifyError(error)
      expect(classified.category).toBe('db')
      expect(classified.code).toBe(ERROR_CODES.DB_CONNECTION_ERROR)
      expect(classified.statusCode).toBe(503)
      expect(classified.isRetryable).toBe(true)
    })

    it('classifies P2002 as conflict (unique constraint)', () => {
      const error = new Error('Unique constraint failed') as Error & {
        code: string
        meta: Record<string, unknown>
      }
      error.code = 'P2002'
      error.meta = { target: ['email'] }
      const classified = classifyError(error)
      expect(classified.category).toBe('conflict')
      expect(classified.code).toBe(ERROR_CODES.DUPLICATE_ENTRY)
      expect(classified.statusCode).toBe(409)
    })

    it('classifies P2025 as not_found', () => {
      const error = new Error('Record not found') as Error & { code: string }
      error.code = 'P2025'
      const classified = classifyError(error)
      expect(classified.category).toBe('not_found')
      expect(classified.code).toBe(ERROR_CODES.RESOURCE_NOT_FOUND)
      expect(classified.statusCode).toBe(404)
    })

    it('classifies other P2xxx errors as db query', () => {
      const error = new Error('Query failed') as Error & { code: string }
      error.code = 'P2003'
      const classified = classifyError(error)
      expect(classified.category).toBe('db')
      expect(classified.code).toBe(ERROR_CODES.DB_QUERY_ERROR)
      expect(classified.statusCode).toBe(500)
    })
  })

  describe('network errors', () => {
    it('classifies ECONNREFUSED as external', () => {
      const error = new Error('Connection refused') as Error & { code: string }
      error.code = 'ECONNREFUSED'
      const classified = classifyError(error)
      expect(classified.category).toBe('external')
      expect(classified.code).toBe(ERROR_CODES.NETWORK_ERROR)
      expect(classified.statusCode).toBe(503)
      expect(classified.isRetryable).toBe(true)
    })

    it('classifies ETIMEDOUT as timeout', () => {
      const error = new Error('Connection timed out') as Error & { code: string }
      error.code = 'ETIMEDOUT'
      const classified = classifyError(error)
      expect(classified.category).toBe('timeout')
      expect(classified.code).toBe(ERROR_CODES.EXTERNAL_TIMEOUT)
      expect(classified.statusCode).toBe(503)
      expect(classified.isRetryable).toBe(true)
    })

    it('classifies timeout message as timeout', () => {
      const error = new Error('Request timed out after 30000ms')
      const classified = classifyError(error)
      expect(classified.category).toBe('timeout')
      expect(classified.code).toBe(ERROR_CODES.OPERATION_TIMEOUT)
      expect(classified.statusCode).toBe(504)
    })
  })

  describe('generic errors', () => {
    it('classifies unknown Error as internal', () => {
      const error = new Error('Something unexpected happened')
      const classified = classifyError(error)
      expect(classified.category).toBe('internal')
      expect(classified.code).toBe(ERROR_CODES.UNEXPECTED_ERROR)
      expect(classified.statusCode).toBe(500)
      expect(classified.isOperational).toBe(false)
    })

    it('handles non-Error values', () => {
      const classified = classifyError('string error')
      expect(classified.category).toBe('internal')
      expect(classified.message).toBe('string error')
    })

    it('handles null and undefined', () => {
      const nullClassified = classifyError(null)
      expect(nullClassified.category).toBe('internal')

      const undefinedClassified = classifyError(undefined)
      expect(undefinedClassified.category).toBe('internal')
    })
  })

  describe('already classified errors', () => {
    it('passes through already classified errors', () => {
      const classified: ClassifiedError = {
        category: 'validation',
        code: 'CUSTOM_CODE',
        message: 'Custom error',
        statusCode: 422,
        isOperational: true,
        isRetryable: false,
      }
      const result = classifyError(classified)
      expect(result).toBe(classified)
    })
  })
})

describe('formatErrorForLog', () => {
  it('formats classified error for logging', () => {
    const classified: ClassifiedError = {
      category: 'validation',
      code: ERROR_CODES.VALIDATION_FAILED,
      message: 'Invalid input',
      statusCode: 400,
      isOperational: true,
      isRetryable: false,
      details: { field: 'email' },
      originalError: new Error('Original error'),
    }

    const formatted = formatErrorForLog(classified)

    expect(formatted.error_category).toBe('validation')
    expect(formatted.error_code).toBe(ERROR_CODES.VALIDATION_FAILED)
    expect(formatted.error_message).toBe('Invalid input')
    expect(formatted.error_status_code).toBe(400)
    expect(formatted.error_is_operational).toBe(true)
    expect(formatted.error_is_retryable).toBe(false)
    expect(formatted.error_details).toEqual({ field: 'email' })
    expect(formatted.error_stack).toBeDefined()
    expect(formatted.error_name).toBe('Error')
  })

  it('omits optional fields when not present', () => {
    const classified: ClassifiedError = {
      category: 'internal',
      code: ERROR_CODES.UNEXPECTED_ERROR,
      message: 'Unknown error',
      statusCode: 500,
      isOperational: false,
      isRetryable: false,
    }

    const formatted = formatErrorForLog(classified)

    expect(formatted.error_details).toBeUndefined()
    expect(formatted.error_stack).toBeUndefined()
  })
})

describe('createOperationalError', () => {
  it('creates an operational error with correct fields', () => {
    const error = createOperationalError(
      'validation',
      'CUSTOM_VALIDATION',
      'Field is invalid',
      400,
      { field: 'name' }
    )

    expect(error.category).toBe('validation')
    expect(error.code).toBe('CUSTOM_VALIDATION')
    expect(error.message).toBe('Field is invalid')
    expect(error.statusCode).toBe(400)
    expect(error.isOperational).toBe(true)
    expect(error.isRetryable).toBe(false)
    expect(error.details).toEqual({ field: 'name' })
  })

  it('sets isRetryable based on category', () => {
    const externalError = createOperationalError(
      'external',
      'EXTERNAL_FAILURE',
      'Service unavailable',
      503
    )
    expect(externalError.isRetryable).toBe(true)

    const timeoutError = createOperationalError(
      'timeout',
      'TIMEOUT',
      'Request timed out',
      504
    )
    expect(timeoutError.isRetryable).toBe(true)

    const dbError = createOperationalError('db', 'DB_ERROR', 'Connection lost', 503)
    expect(dbError.isRetryable).toBe(true)

    const authError = createOperationalError('auth', 'UNAUTHORIZED', 'Invalid token', 401)
    expect(authError.isRetryable).toBe(false)
  })
})

describe('log schema validation', () => {
  // These tests ensure log entries have the required schema
  const requiredLogFields = [
    'error_category',
    'error_code',
    'error_message',
    'error_status_code',
    'error_is_operational',
    'error_is_retryable',
  ]

  it('formatErrorForLog includes all required fields', () => {
    const classified: ClassifiedError = {
      category: 'internal',
      code: ERROR_CODES.INTERNAL_ERROR,
      message: 'Test error',
      statusCode: 500,
      isOperational: false,
      isRetryable: false,
    }

    const formatted = formatErrorForLog(classified)

    for (const field of requiredLogFields) {
      expect(formatted).toHaveProperty(field)
    }
  })

  it('error_category is a valid category', () => {
    const validCategories = [
      'validation',
      'auth',
      'not_found',
      'rate_limit',
      'db',
      'external',
      'internal',
      'timeout',
      'conflict',
    ]

    // Test a sample of error classifications
    const testCases = [
      { error: new z.ZodError([]), expectedCategory: 'validation' },
      {
        error: Object.assign(new Error(''), { status: 401 }),
        expectedCategory: 'auth',
      },
      {
        error: Object.assign(new Error(''), { status: 404 }),
        expectedCategory: 'not_found',
      },
      { error: new Error('Unknown error'), expectedCategory: 'internal' },
    ]

    for (const { error, expectedCategory } of testCases) {
      const classified = classifyError(error)
      expect(validCategories).toContain(classified.category)
      expect(classified.category).toBe(expectedCategory)
    }
  })

  it('status codes are valid HTTP status codes', () => {
    const validStatusCodes = [400, 401, 403, 404, 409, 429, 500, 502, 503, 504]

    const testErrors = [
      new z.ZodError([]),
      Object.assign(new Error(''), { status: 401 }),
      Object.assign(new Error(''), { status: 404 }),
      Object.assign(new Error(''), { code: 'ECONNREFUSED' }),
      new Error('timeout'),
      new Error('Unknown'),
    ]

    for (const error of testErrors) {
      const classified = classifyError(error)
      expect(classified.statusCode).toBeGreaterThanOrEqual(400)
      expect(classified.statusCode).toBeLessThanOrEqual(599)
    }
  })
})
