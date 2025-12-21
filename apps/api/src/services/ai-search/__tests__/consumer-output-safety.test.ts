/**
 * Consumer Output Safety Tests
 *
 * These tests verify that internal-only fields (retailerConfidenceHint,
 * brandDataCompletenessHint) NEVER leak to consumer-facing routes.
 *
 * Per ADR-006: Any 'confidence' signals are internal-only until objective
 * criteria exist.
 *
 * These tests assert ABSENCE, not presence. A test failure means we've
 * accidentally exposed internal scoring data to users.
 */

import { describe, it, expect } from 'vitest'
import { PriceSignalIndex } from '../price-signal-index'

/**
 * List of fields that must NEVER appear in consumer-facing responses.
 * If you need to add a new internal field, add it here.
 */
const FORBIDDEN_CONSUMER_FIELDS = [
  'retailerConfidenceHint',
  'brandDataCompletenessHint',
  'retailerTrust',
  'brandQuality',
  '_internal',
  'bestValueScore', // Removed per ADR-006
  'dealScore',
  'valueVerdict',
]

/**
 * Recursively check if an object contains any forbidden fields.
 * Returns the path to the first forbidden field found, or null if safe.
 */
function findForbiddenField(obj: unknown, path = ''): string | null {
  if (obj === null || obj === undefined) {
    return null
  }

  if (typeof obj !== 'object') {
    return null
  }

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const result = findForbiddenField(obj[i], `${path}[${i}]`)
      if (result) return result
    }
    return null
  }

  for (const [key, value] of Object.entries(obj)) {
    const currentPath = path ? `${path}.${key}` : key

    // Check if this key is forbidden
    if (FORBIDDEN_CONSUMER_FIELDS.includes(key)) {
      return currentPath
    }

    // Recurse into nested objects
    const result = findForbiddenField(value, currentPath)
    if (result) return result
  }

  return null
}

/**
 * Assert that an object is safe for consumer output.
 * Throws a descriptive error if a forbidden field is found.
 */
function assertConsumerSafe(obj: unknown, context: string): void {
  const forbidden = findForbiddenField(obj)
  if (forbidden) {
    throw new Error(
      `CONSUMER SAFETY VIOLATION in ${context}: ` +
        `Found forbidden field "${forbidden}". ` +
        `This field must never be exposed to consumer UI.`
    )
  }
}

describe('Consumer Output Safety', () => {
  describe('PriceSignalIndex type', () => {
    it('should not include internal hint fields in public type', () => {
      // This is a compile-time check embodied as a runtime test.
      // The PriceSignalIndex type should only have consumer-safe fields.
      const validSignal: PriceSignalIndex = {
        relativePricePct: -5.2,
        positionInRange: 0.25,
        contextBand: 'LOW',
        meta: {
          windowDays: 30,
          sampleCount: 42,
          asOf: new Date().toISOString(),
        },
      }

      assertConsumerSafe(validSignal, 'PriceSignalIndex')
    })

    it('should reject objects with retailerConfidenceHint', () => {
      const unsafeObject = {
        relativePricePct: -5.2,
        positionInRange: 0.25,
        contextBand: 'LOW',
        retailerConfidenceHint: 'high', // FORBIDDEN
        meta: { windowDays: 30, sampleCount: 42, asOf: '2024-01-01' },
      }

      expect(() => assertConsumerSafe(unsafeObject, 'test')).toThrow(
        /retailerConfidenceHint/
      )
    })

    it('should reject objects with brandDataCompletenessHint', () => {
      const unsafeObject = {
        relativePricePct: -5.2,
        positionInRange: 0.25,
        contextBand: 'LOW',
        brandDataCompletenessHint: 'complete', // FORBIDDEN
        meta: { windowDays: 30, sampleCount: 42, asOf: '2024-01-01' },
      }

      expect(() => assertConsumerSafe(unsafeObject, 'test')).toThrow(
        /brandDataCompletenessHint/
      )
    })

    it('should reject objects with _internal property', () => {
      const unsafeObject = {
        relativePricePct: -5.2,
        positionInRange: 0.25,
        contextBand: 'LOW',
        meta: { windowDays: 30, sampleCount: 42, asOf: '2024-01-01' },
        _internal: {
          retailerConfidenceHint: 'high',
          brandDataCompletenessHint: 'complete',
        },
      }

      expect(() => assertConsumerSafe(unsafeObject, 'test')).toThrow(/_internal/)
    })

    it('should reject legacy retailerTrust field', () => {
      const unsafeObject = {
        score: 85,
        retailerTrust: 0.9, // FORBIDDEN - old field name
      }

      expect(() => assertConsumerSafe(unsafeObject, 'test')).toThrow(
        /retailerTrust/
      )
    })

    it('should reject legacy brandQuality field', () => {
      const unsafeObject = {
        score: 85,
        brandQuality: 0.8, // FORBIDDEN - old field name
      }

      expect(() => assertConsumerSafe(unsafeObject, 'test')).toThrow(
        /brandQuality/
      )
    })
  })

  describe('Nested object safety', () => {
    it('should detect forbidden fields in nested objects', () => {
      const unsafeObject = {
        products: [
          {
            id: '123',
            priceSignal: {
              relativePricePct: -5.2,
              _internal: { retailerConfidenceHint: 'high' }, // FORBIDDEN
            },
          },
        ],
      }

      expect(() => assertConsumerSafe(unsafeObject, 'test')).toThrow(/_internal/)
    })

    it('should detect forbidden fields in deeply nested arrays', () => {
      const unsafeObject = {
        data: {
          results: [
            {
              items: [
                {
                  scores: {
                    brandQuality: 0.9, // FORBIDDEN - deeply nested
                  },
                },
              ],
            },
          ],
        },
      }

      expect(() => assertConsumerSafe(unsafeObject, 'test')).toThrow(
        /brandQuality/
      )
    })
  })

  describe('Safe objects pass validation', () => {
    it('should accept valid search response shape', () => {
      const validSearchResponse = {
        products: [
          {
            id: 'prod-123',
            name: 'Federal Premium HST 9mm',
            caliber: '9mm',
            prices: [{ price: 24.99, inStock: true }],
            premium: {
              priceSignal: {
                relativePricePct: -8.5,
                positionInRange: 0.15,
                contextBand: 'LOW',
                meta: { windowDays: 30, sampleCount: 150, asOf: '2024-01-01' },
              },
              badges: ['short-barrel-optimized', 'controlled-expansion'],
            },
          },
        ],
        pagination: { page: 1, limit: 20, total: 100 },
      }

      // Should not throw
      assertConsumerSafe(validSearchResponse, 'search response')
    })

    it('should accept valid dashboard response shape', () => {
      const validDashboardResponse = {
        pulse: [
          {
            caliber: '9mm',
            currentAvg: 0.32,
            trend: 'DOWN',
            trendPercent: -3.5,
            priceContext: 'LOWER_THAN_RECENT',
            contextMeta: {
              windowDays: 7,
              sampleCount: 50,
              asOf: '2024-01-01',
            },
          },
        ],
        _meta: { tier: 'PREMIUM', calibersShown: 5 },
      }

      // Should not throw
      assertConsumerSafe(validDashboardResponse, 'dashboard response')
    })

    it('should accept valid alert payload shape', () => {
      const validAlertPayload = {
        alertId: 'alert-123',
        productId: 'prod-456',
        productName: 'Federal HST 9mm 124gr',
        triggerType: 'PRICE_DROP',
        currentPrice: 24.99,
        targetPrice: 28.00,
        priceContext: {
          relativePricePct: -12.5,
          contextBand: 'LOW',
        },
      }

      // Should not throw
      assertConsumerSafe(validAlertPayload, 'alert payload')
    })
  })
})

// Export the safety check function for use in other tests
export { assertConsumerSafe, findForbiddenField, FORBIDDEN_CONSUMER_FIELDS }
