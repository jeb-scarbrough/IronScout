import { describe, it, expect } from 'vitest'
import {
  createComparator,
  applyOrdering,
  extractSortKeys,
  verifyDeterminism,
} from '../ordering'
import { OrderingRule, AggregatedProduct } from '../types'

// Helper to create a test product
function createProduct(overrides: Partial<AggregatedProduct> = {}): AggregatedProduct {
  return {
    productId: 'test-product-1',
    bulletType: 'FMJ',
    grain: 115,
    casing: 'BRASS',
    packSize: 50,
    canonicalConfidence: 0.85,
    price: 29.99,
    availability: 'IN_STOCK',
    pricePerRound: 0.5998,
    _originalProduct: {},
    _visibleOfferCount: 3,
    ...overrides,
  }
}

describe('applyOrdering', () => {
  describe('basic ordering', () => {
    it('sorts by single field ASC', () => {
      const products = [
        createProduct({ productId: 'p3', price: 30 }),
        createProduct({ productId: 'p1', price: 10 }),
        createProduct({ productId: 'p2', price: 20 }),
      ]
      const rules: OrderingRule[] = [{ field: 'price', direction: 'ASC' }]

      const result = applyOrdering(products, rules)
      expect(result.map(p => p.productId)).toEqual(['p1', 'p2', 'p3'])
    })

    it('sorts by single field DESC', () => {
      const products = [
        createProduct({ productId: 'p1', price: 10 }),
        createProduct({ productId: 'p3', price: 30 }),
        createProduct({ productId: 'p2', price: 20 }),
      ]
      const rules: OrderingRule[] = [{ field: 'price', direction: 'DESC' }]

      const result = applyOrdering(products, rules)
      expect(result.map(p => p.productId)).toEqual(['p3', 'p2', 'p1'])
    })

    it('sorts by multiple fields', () => {
      const products = [
        createProduct({ productId: 'p2', availability: 'IN_STOCK', price: 20 }),
        createProduct({ productId: 'p1', availability: 'IN_STOCK', price: 10 }),
        createProduct({ productId: 'p3', availability: 'OUT_OF_STOCK', price: 5 }),
      ]
      const rules: OrderingRule[] = [
        { field: 'availability', direction: 'DESC' },
        { field: 'price', direction: 'ASC' },
      ]

      const result = applyOrdering(products, rules)
      // IN_STOCK first (sorted by price), then OUT_OF_STOCK
      expect(result.map(p => p.productId)).toEqual(['p1', 'p2', 'p3'])
    })
  })

  describe('null handling', () => {
    it('sorts nulls LAST in ASC order', () => {
      const products = [
        createProduct({ productId: 'p2', price: 20 }),
        createProduct({ productId: 'p1', price: null }),
        createProduct({ productId: 'p3', price: 10 }),
      ]
      const rules: OrderingRule[] = [{ field: 'price', direction: 'ASC' }]

      const result = applyOrdering(products, rules)
      expect(result.map(p => p.productId)).toEqual(['p3', 'p2', 'p1'])
    })

    it('sorts nulls LAST in DESC order', () => {
      const products = [
        createProduct({ productId: 'p1', canonicalConfidence: null }),
        createProduct({ productId: 'p2', canonicalConfidence: 0.5 }),
        createProduct({ productId: 'p3', canonicalConfidence: 0.9 }),
      ]
      const rules: OrderingRule[] = [{ field: 'canonicalConfidence', direction: 'DESC' }]

      const result = applyOrdering(products, rules)
      expect(result.map(p => p.productId)).toEqual(['p3', 'p2', 'p1'])
    })

    it('sorts pricePerRound nulls LAST', () => {
      const products = [
        createProduct({ productId: 'p2', pricePerRound: 0.50 }),
        createProduct({ productId: 'p1', pricePerRound: null }),
        createProduct({ productId: 'p3', pricePerRound: 0.30 }),
      ]
      const rules: OrderingRule[] = [{ field: 'pricePerRound', direction: 'ASC' }]

      const result = applyOrdering(products, rules)
      expect(result.map(p => p.productId)).toEqual(['p3', 'p2', 'p1'])
    })
  })

  describe('availability ordering', () => {
    it('sorts availability DESC: IN_STOCK > LOW_STOCK > OUT_OF_STOCK', () => {
      const products = [
        createProduct({ productId: 'p1', availability: 'OUT_OF_STOCK' }),
        createProduct({ productId: 'p2', availability: 'IN_STOCK' }),
        createProduct({ productId: 'p3', availability: 'LOW_STOCK' }),
      ]
      const rules: OrderingRule[] = [{ field: 'availability', direction: 'DESC' }]

      const result = applyOrdering(products, rules)
      expect(result.map(p => p.productId)).toEqual(['p2', 'p3', 'p1'])
    })

    it('sorts availability ASC: OUT_OF_STOCK > LOW_STOCK > IN_STOCK', () => {
      const products = [
        createProduct({ productId: 'p1', availability: 'IN_STOCK' }),
        createProduct({ productId: 'p2', availability: 'OUT_OF_STOCK' }),
        createProduct({ productId: 'p3', availability: 'LOW_STOCK' }),
      ]
      const rules: OrderingRule[] = [{ field: 'availability', direction: 'ASC' }]

      const result = applyOrdering(products, rules)
      expect(result.map(p => p.productId)).toEqual(['p2', 'p3', 'p1'])
    })
  })

  describe('tie-breaker', () => {
    it('uses productId ASC as final tie-breaker', () => {
      const products = [
        createProduct({ productId: 'p-charlie', price: 20 }),
        createProduct({ productId: 'p-alpha', price: 20 }),
        createProduct({ productId: 'p-bravo', price: 20 }),
      ]
      const rules: OrderingRule[] = [{ field: 'price', direction: 'ASC' }]

      const result = applyOrdering(products, rules)
      expect(result.map(p => p.productId)).toEqual(['p-alpha', 'p-bravo', 'p-charlie'])
    })

    it('tie-breaker applies after all rules', () => {
      const products = [
        createProduct({ productId: 'p-z', availability: 'IN_STOCK', pricePerRound: 0.50 }),
        createProduct({ productId: 'p-a', availability: 'IN_STOCK', pricePerRound: 0.50 }),
        createProduct({ productId: 'p-m', availability: 'IN_STOCK', pricePerRound: 0.50 }),
      ]
      const rules: OrderingRule[] = [
        { field: 'availability', direction: 'DESC' },
        { field: 'pricePerRound', direction: 'ASC' },
      ]

      const result = applyOrdering(products, rules)
      expect(result.map(p => p.productId)).toEqual(['p-a', 'p-m', 'p-z'])
    })
  })

  describe('edge cases', () => {
    it('returns empty array for empty input', () => {
      const result = applyOrdering([], [])
      expect(result).toEqual([])
    })

    it('returns single element array unchanged', () => {
      const products = [createProduct({ productId: 'p1' })]
      const result = applyOrdering(products, [])
      expect(result).toHaveLength(1)
      expect(result[0].productId).toBe('p1')
    })

    it('does not mutate input array', () => {
      const products = [
        createProduct({ productId: 'p2', price: 20 }),
        createProduct({ productId: 'p1', price: 10 }),
      ]
      const originalOrder = products.map(p => p.productId)
      const rules: OrderingRule[] = [{ field: 'price', direction: 'ASC' }]

      applyOrdering(products, rules)
      expect(products.map(p => p.productId)).toEqual(originalOrder)
    })
  })
})

describe('extractSortKeys', () => {
  it('extracts sort keys for all ordering fields', () => {
    const product = createProduct({
      productId: 'p1',
      price: 29.99,
      pricePerRound: 0.5998,
      availability: 'IN_STOCK',
      canonicalConfidence: 0.85,
    })
    const rules: OrderingRule[] = [
      { field: 'availability', direction: 'DESC' },
      { field: 'pricePerRound', direction: 'ASC' },
    ]

    const sortKeys = extractSortKeys(product, rules)
    expect(sortKeys.avail).toBe(3) // IN_STOCK = 3
    expect(sortKeys.ppr).toBe(0.5998)
    expect(sortKeys.tie).toBe('p1')
  })

  it('rounds pricePerRound to 4 decimals', () => {
    const product = createProduct({ pricePerRound: 0.59986789 })
    const rules: OrderingRule[] = [{ field: 'pricePerRound', direction: 'ASC' }]

    const sortKeys = extractSortKeys(product, rules)
    expect(sortKeys.ppr).toBe(0.5999)
  })

  it('includes null values correctly', () => {
    const product = createProduct({ price: null, pricePerRound: null })
    const rules: OrderingRule[] = [{ field: 'price', direction: 'ASC' }]

    const sortKeys = extractSortKeys(product, rules)
    expect(sortKeys.price).toBeNull()
  })
})

describe('verifyDeterminism', () => {
  it('returns true for deterministic ordering', () => {
    const products = [
      createProduct({ productId: 'p3', price: 30 }),
      createProduct({ productId: 'p1', price: 10 }),
      createProduct({ productId: 'p2', price: 20 }),
    ]
    const rules: OrderingRule[] = [{ field: 'price', direction: 'ASC' }]

    expect(verifyDeterminism(products, rules, 100)).toBe(true)
  })

  it('returns true for empty products', () => {
    expect(verifyDeterminism([], [], 10)).toBe(true)
  })

  it('handles products with same values (relies on tie-breaker)', () => {
    const products = [
      createProduct({ productId: 'p-z', price: 20 }),
      createProduct({ productId: 'p-a', price: 20 }),
      createProduct({ productId: 'p-m', price: 20 }),
    ]
    const rules: OrderingRule[] = [{ field: 'price', direction: 'ASC' }]

    // Should be deterministic due to productId tie-breaker
    expect(verifyDeterminism(products, rules, 100)).toBe(true)
  })
})

describe('1000x determinism test', () => {
  it('produces identical results across 1000 iterations', () => {
    const products = [
      createProduct({ productId: 'p-e', availability: 'IN_STOCK', pricePerRound: 0.40, canonicalConfidence: 0.90 }),
      createProduct({ productId: 'p-a', availability: 'IN_STOCK', pricePerRound: 0.35, canonicalConfidence: 0.85 }),
      createProduct({ productId: 'p-c', availability: 'LOW_STOCK', pricePerRound: 0.30, canonicalConfidence: 0.95 }),
      createProduct({ productId: 'p-b', availability: 'IN_STOCK', pricePerRound: 0.35, canonicalConfidence: 0.80 }),
      createProduct({ productId: 'p-d', availability: 'OUT_OF_STOCK', pricePerRound: 0.25, canonicalConfidence: 0.70 }),
      createProduct({ productId: 'p-f', availability: 'IN_STOCK', pricePerRound: null, canonicalConfidence: 0.60 }),
    ]
    const rules: OrderingRule[] = [
      { field: 'availability', direction: 'DESC' },
      { field: 'pricePerRound', direction: 'ASC' },
      { field: 'canonicalConfidence', direction: 'DESC' },
    ]

    // Run 1000 iterations and collect results
    const results: string[] = []
    for (let i = 0; i < 1000; i++) {
      const ordered = applyOrdering(products, rules)
      results.push(JSON.stringify(ordered.map(p => p.productId)))
    }

    // All results should be identical
    const uniqueResults = new Set(results)
    expect(uniqueResults.size).toBe(1)
  })
})
