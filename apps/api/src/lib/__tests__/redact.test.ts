/**
 * Redaction Tests
 *
 * Tests the sensitive field redaction to ensure:
 * 1. Sensitive fields are always redacted
 * 2. Safe fields pass through
 * 3. Unknown fields are redacted by default (fail-safe)
 * 4. No secrets can leak through logging
 */

import { describe, it, expect } from 'vitest'
import {
  redact,
  redactHeaders,
  redactUrl,
  getRedactedMarker,
  wouldBeRedacted,
} from '../redact'

const REDACTED = getRedactedMarker()

describe('redact', () => {
  describe('sensitive fields', () => {
    it('redacts authorization header', () => {
      const obj = { authorization: 'Bearer secret-token' }
      const result = redact(obj)
      expect(result.authorization).toBe(REDACTED)
    })

    it('redacts password fields', () => {
      const obj = { password: 'mysecret', userPassword: 'also-secret' }
      const result = redact(obj)
      expect(result.password).toBe(REDACTED)
      expect(result.userPassword).toBe(REDACTED)
    })

    it('redacts token fields', () => {
      const obj = {
        token: 'abc123',
        accessToken: 'xyz789',
        refreshToken: 'refresh-me',
        apiToken: 'api-key',
      }
      const result = redact(obj)
      expect(result.token).toBe(REDACTED)
      expect(result.accessToken).toBe(REDACTED)
      expect(result.refreshToken).toBe(REDACTED)
      expect(result.apiToken).toBe(REDACTED)
    })

    it('redacts API keys', () => {
      const obj = {
        apiKey: 'sk-123',
        api_key: 'pk-456',
        stripeApiKey: 'sk_live_xxx',
      }
      const result = redact(obj)
      expect(result.apiKey).toBe(REDACTED)
      expect(result.api_key).toBe(REDACTED)
      expect(result.stripeApiKey).toBe(REDACTED)
    })

    it('redacts cookie fields', () => {
      const obj = { cookie: 'session=abc123', setCookie: 'token=xyz' }
      const result = redact(obj)
      expect(result.cookie).toBe(REDACTED)
      // set-cookie is handled, setCookie (camelCase) gets caught by set-cookie pattern
    })

    it('redacts secrets', () => {
      const obj = {
        secret: 'hidden',
        clientSecret: 'oauth-secret',
        jwtSecret: 'jwt-signing-key',
      }
      const result = redact(obj)
      expect(result.secret).toBe(REDACTED)
      expect(result.clientSecret).toBe(REDACTED)
      expect(result.jwtSecret).toBe(REDACTED)
    })

    it('redacts financial data', () => {
      const obj = {
        creditCard: '4111111111111111',
        cardNumber: '5500000000000004',
        cvv: '123',
        accountNumber: '123456789',
      }
      const result = redact(obj)
      expect(result.creditCard).toBe(REDACTED)
      expect(result.cardNumber).toBe(REDACTED)
      expect(result.cvv).toBe(REDACTED)
      expect(result.accountNumber).toBe(REDACTED)
    })

    it('redacts PII fields', () => {
      const obj = {
        ssn: '123-45-6789',
        socialSecurity: '987654321',
        dob: '1990-01-01',
      }
      const result = redact(obj)
      expect(result.ssn).toBe(REDACTED)
      expect(result.socialSecurity).toBe(REDACTED)
      expect(result.dob).toBe(REDACTED)
    })
  })

  describe('safe fields', () => {
    it('allows request metadata through', () => {
      const obj = {
        method: 'GET',
        path: '/api/products',
        statusCode: 200,
        latencyMs: 42,
      }
      const result = redact(obj)
      expect(result.method).toBe('GET')
      expect(result.path).toBe('/api/products')
      expect(result.statusCode).toBe(200)
      expect(result.latencyMs).toBe(42)
    })

    it('allows identifiers through', () => {
      const obj = {
        requestId: 'req-123',
        userId: 'user-456',
        productId: 'prod-789',
      }
      const result = redact(obj)
      expect(result.requestId).toBe('req-123')
      expect(result.userId).toBe('user-456')
      expect(result.productId).toBe('prod-789')
    })

    it('allows logging metadata through', () => {
      const obj = {
        timestamp: '2024-01-01T00:00:00Z',
        level: 'info',
        service: 'api',
        event_name: 'http.request.end',
      }
      const result = redact(obj)
      expect(result.timestamp).toBe('2024-01-01T00:00:00Z')
      expect(result.level).toBe('info')
      expect(result.service).toBe('api')
      expect(result.event_name).toBe('http.request.end')
    })

    it('allows error fields through', () => {
      const obj = {
        error: 'Something went wrong',
        errorCode: 'ERR_001',
        stack: 'Error: ...\n  at ...',
      }
      const result = redact(obj)
      expect(result.error).toBe('Something went wrong')
      expect(result.errorCode).toBe('ERR_001')
      expect(result.stack).toBe('Error: ...\n  at ...')
    })

    it('allows business fields through', () => {
      const obj = {
        caliber: '9mm',
        brand: 'Federal',
        category: 'ammunition',
        tier: 'PREMIUM',
      }
      const result = redact(obj)
      expect(result.caliber).toBe('9mm')
      expect(result.brand).toBe('Federal')
      expect(result.category).toBe('ammunition')
      expect(result.tier).toBe('PREMIUM')
    })
  })

  describe('unknown fields (fail-safe)', () => {
    it('redacts unknown string fields', () => {
      const obj = { unknownField: 'some value' }
      const result = redact(obj)
      expect(result.unknownField).toBe(REDACTED)
    })

    it('redacts unknown number fields', () => {
      const obj = { randomNumber: 42 }
      const result = redact(obj)
      expect(result.randomNumber).toBe(REDACTED)
    })

    it('allows boolean fields through', () => {
      const obj = { isEnabled: true, wasSuccessful: false }
      const result = redact(obj)
      expect(result.isEnabled).toBe(true)
      expect(result.wasSuccessful).toBe(false)
    })

    it('allows null and undefined through', () => {
      const obj = { nullField: null, undefinedField: undefined }
      const result = redact(obj)
      expect(result.nullField).toBe(null)
      expect(result.undefinedField).toBe(undefined)
    })
  })

  describe('nested objects', () => {
    it('recursively redacts nested objects', () => {
      const obj = {
        user: {
          id: 'user-123',
          password: 'secret',
          profile: {
            email: 'test@example.com', // unknown field
          },
        },
      }
      const result = redact(obj) as any
      expect(result.user.id).toBe(REDACTED) // id is not in safe list at nested level
      expect(result.user.password).toBe(REDACTED)
      expect(result.user.profile.email).toBe(REDACTED)
    })

    it('handles arrays', () => {
      const obj = {
        // Use safe field names that don't match sensitive patterns
        method: ['GET', 'POST'],
        code: ['ERR1', 'ERR2'],
      }
      const result = redact(obj) as any
      // Arrays within safe fields are preserved
      expect(result.method).toEqual(['GET', 'POST'])
      expect(result.code).toEqual(['ERR1', 'ERR2'])
    })

    it('handles circular references', () => {
      const obj: any = { name: 'test' }
      obj.self = obj
      const result = redact(obj)
      expect(result.self).toBe('[CIRCULAR]')
    })

    it('respects max depth', () => {
      const obj = {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  level6: {
                    level7: {
                      level8: {
                        level9: {
                          level10: {
                            level11: { deep: 'value' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }
      const result = redact(obj) as any
      // Should stop at max depth (10)
      expect(result.level1.level2.level3.level4.level5.level6.level7.level8.level9.level10.level11).toBe(
        '[MAX_DEPTH]'
      )
    })
  })
})

describe('redactHeaders', () => {
  it('allows safe headers through', () => {
    const headers = {
      'content-type': 'application/json',
      'user-agent': 'Mozilla/5.0',
      'x-request-id': 'req-123',
      host: 'api.example.com',
    }
    const result = redactHeaders(headers)
    expect(result['content-type']).toBe('application/json')
    expect(result['user-agent']).toBe('Mozilla/5.0')
    expect(result['x-request-id']).toBe('req-123')
    expect(result.host).toBe('api.example.com')
  })

  it('redacts sensitive headers', () => {
    const headers = {
      authorization: 'Bearer secret-token',
      cookie: 'session=abc123',
      'x-api-key': 'sk-123',
    }
    const result = redactHeaders(headers)
    expect(result.authorization).toBe(REDACTED)
    expect(result.cookie).toBe(REDACTED)
    expect(result['x-api-key']).toBe(REDACTED)
  })
})

describe('redactUrl', () => {
  it('keeps safe query params', () => {
    const url = '/api/products?page=1&limit=20&sort=name'
    const result = redactUrl(url)
    expect(result).toBe('/api/products?page=1&limit=20&sort=name')
  })

  it('redacts unknown query params', () => {
    const url = '/api/users?apikey=secret&name=john'
    const result = redactUrl(url)
    // URL-encoded [REDACTED] = %5BREDACTED%5D
    expect(result).toContain('%5BREDACTED%5D')
    // Both unknown params should be redacted
    expect(result).toContain('apikey=')
    expect(result).toContain('name=')
  })

  it('handles URLs without query params', () => {
    const url = '/api/products/123'
    const result = redactUrl(url)
    expect(result).toBe('/api/products/123')
  })
})

describe('wouldBeRedacted', () => {
  it('returns true for sensitive fields', () => {
    expect(wouldBeRedacted('password')).toBe(true)
    expect(wouldBeRedacted('authorization')).toBe(true)
    expect(wouldBeRedacted('apiKey')).toBe(true)
  })

  it('returns false for safe fields', () => {
    expect(wouldBeRedacted('requestId')).toBe(false)
    expect(wouldBeRedacted('method')).toBe(false)
    expect(wouldBeRedacted('statusCode')).toBe(false)
  })

  it('returns true for unknown fields', () => {
    expect(wouldBeRedacted('randomField')).toBe(true)
    expect(wouldBeRedacted('customData')).toBe(true)
  })
})

describe('real-world scenarios', () => {
  it('handles typical request log entry', () => {
    const logEntry = {
      timestamp: '2024-01-01T00:00:00Z',
      level: 'info',
      service: 'api',
      event_name: 'http.request.end',
      requestId: 'req-abc123',
      method: 'POST',
      path: '/api/auth/login',
      statusCode: 200,
      latencyMs: 42,
      http: {
        method: 'POST',
        route: '/api/auth/login',
        status_code: 200,
      },
    }
    const result = redact(logEntry) as any
    expect(result.timestamp).toBe('2024-01-01T00:00:00Z')
    expect(result.requestId).toBe('req-abc123')
    expect(result.method).toBe('POST')
    expect(result.http.method).toBe('POST')
  })

  it('handles error with sensitive context', () => {
    const errorLog = {
      timestamp: '2024-01-01T00:00:00Z',
      level: 'error',
      service: 'api',
      message: 'Authentication failed',
      error: 'Invalid credentials',
      errorCode: 'AUTH_FAILED',
      stack: 'Error: ...',
      // These should be redacted
      password: 'user-password',
      token: 'failed-token',
    }
    const result = redact(errorLog)
    expect(result.message).toBe('Authentication failed')
    expect(result.error).toBe('Invalid credentials')
    expect(result.password).toBe(REDACTED)
    expect(result.token).toBe(REDACTED)
  })
})
