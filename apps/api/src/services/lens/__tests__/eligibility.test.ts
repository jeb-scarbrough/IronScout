import { describe, it, expect } from 'vitest'
import {
  evaluateRule,
  evaluateEligibility,
  applyEligibility,
  countFilterReasons,
} from '../eligibility'
import { EligibilityRule, AggregatedProduct } from '../types'

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

describe('evaluateRule', () => {
  describe('EQ operator', () => {
    it('returns true when field equals value', () => {
      const rule: EligibilityRule = { field: 'bulletType', operator: 'EQ', value: 'FMJ' }
      const product = createProduct({ bulletType: 'FMJ' })

      expect(evaluateRule(rule, product).passed).toBe(true)
    })

    it('returns false when field does not equal value', () => {
      const rule: EligibilityRule = { field: 'bulletType', operator: 'EQ', value: 'HP' }
      const product = createProduct({ bulletType: 'FMJ' })

      expect(evaluateRule(rule, product).passed).toBe(false)
    })

    it('returns false when field is null', () => {
      const rule: EligibilityRule = { field: 'bulletType', operator: 'EQ', value: 'FMJ' }
      const product = createProduct({ bulletType: null })

      expect(evaluateRule(rule, product).passed).toBe(false)
    })

    it('returns false on type mismatch', () => {
      const rule: EligibilityRule = { field: 'grain', operator: 'EQ', value: '115' }
      const product = createProduct({ grain: 115 })

      expect(evaluateRule(rule, product).passed).toBe(false)
    })
  })

  describe('NOT_EQ operator', () => {
    it('returns true when field does not equal value', () => {
      const rule: EligibilityRule = { field: 'bulletType', operator: 'NOT_EQ', value: 'HP' }
      const product = createProduct({ bulletType: 'FMJ' })

      expect(evaluateRule(rule, product).passed).toBe(true)
    })

    it('returns false when field equals value', () => {
      const rule: EligibilityRule = { field: 'bulletType', operator: 'NOT_EQ', value: 'FMJ' }
      const product = createProduct({ bulletType: 'FMJ' })

      expect(evaluateRule(rule, product).passed).toBe(false)
    })

    it('returns false when field is null', () => {
      const rule: EligibilityRule = { field: 'bulletType', operator: 'NOT_EQ', value: 'HP' }
      const product = createProduct({ bulletType: null })

      expect(evaluateRule(rule, product).passed).toBe(false)
    })
  })

  describe('IN operator', () => {
    it('returns true when field is in array', () => {
      const rule: EligibilityRule = { field: 'bulletType', operator: 'IN', value: ['FMJ', 'TMJ'] }
      const product = createProduct({ bulletType: 'FMJ' })

      expect(evaluateRule(rule, product).passed).toBe(true)
    })

    it('returns false when field is not in array', () => {
      const rule: EligibilityRule = { field: 'bulletType', operator: 'IN', value: ['HP', 'JHP'] }
      const product = createProduct({ bulletType: 'FMJ' })

      expect(evaluateRule(rule, product).passed).toBe(false)
    })

    it('returns false when field is null', () => {
      const rule: EligibilityRule = { field: 'bulletType', operator: 'IN', value: ['FMJ'] }
      const product = createProduct({ bulletType: null })

      expect(evaluateRule(rule, product).passed).toBe(false)
    })

    it('returns false when value is not an array', () => {
      const rule: EligibilityRule = { field: 'bulletType', operator: 'IN', value: 'FMJ' }
      const product = createProduct({ bulletType: 'FMJ' })

      expect(evaluateRule(rule, product).passed).toBe(false)
    })

    it('works with single-element array', () => {
      const rule: EligibilityRule = { field: 'bulletType', operator: 'IN', value: ['FMJ'] }
      const product = createProduct({ bulletType: 'FMJ' })

      expect(evaluateRule(rule, product).passed).toBe(true)
    })
  })

  describe('NOT_IN operator', () => {
    it('returns true when field is not in array', () => {
      const rule: EligibilityRule = { field: 'bulletType', operator: 'NOT_IN', value: ['HP', 'JHP'] }
      const product = createProduct({ bulletType: 'FMJ' })

      expect(evaluateRule(rule, product).passed).toBe(true)
    })

    it('returns false when field is in array', () => {
      const rule: EligibilityRule = { field: 'bulletType', operator: 'NOT_IN', value: ['FMJ', 'TMJ'] }
      const product = createProduct({ bulletType: 'FMJ' })

      expect(evaluateRule(rule, product).passed).toBe(false)
    })

    it('returns false when field is null', () => {
      const rule: EligibilityRule = { field: 'bulletType', operator: 'NOT_IN', value: ['HP'] }
      const product = createProduct({ bulletType: null })

      expect(evaluateRule(rule, product).passed).toBe(false)
    })

    it('returns false when value is not an array', () => {
      const rule: EligibilityRule = { field: 'bulletType', operator: 'NOT_IN', value: 'HP' }
      const product = createProduct({ bulletType: 'FMJ' })

      expect(evaluateRule(rule, product).passed).toBe(false)
    })
  })

  describe('GTE operator', () => {
    it('returns true when field >= value', () => {
      const rule: EligibilityRule = { field: 'grain', operator: 'GTE', value: 100 }
      const product = createProduct({ grain: 115 })

      expect(evaluateRule(rule, product).passed).toBe(true)
    })

    it('returns true when field equals value', () => {
      const rule: EligibilityRule = { field: 'grain', operator: 'GTE', value: 115 }
      const product = createProduct({ grain: 115 })

      expect(evaluateRule(rule, product).passed).toBe(true)
    })

    it('returns false when field < value', () => {
      const rule: EligibilityRule = { field: 'grain', operator: 'GTE', value: 124 }
      const product = createProduct({ grain: 115 })

      expect(evaluateRule(rule, product).passed).toBe(false)
    })

    it('returns false when field is null', () => {
      const rule: EligibilityRule = { field: 'grain', operator: 'GTE', value: 100 }
      const product = createProduct({ grain: null })

      expect(evaluateRule(rule, product).passed).toBe(false)
    })

    it('returns false on type mismatch (string vs number)', () => {
      const rule: EligibilityRule = { field: 'bulletType', operator: 'GTE', value: 100 }
      const product = createProduct({ bulletType: 'FMJ' })

      expect(evaluateRule(rule, product).passed).toBe(false)
    })
  })

  describe('LTE operator', () => {
    it('returns true when field <= value', () => {
      const rule: EligibilityRule = { field: 'grain', operator: 'LTE', value: 124 }
      const product = createProduct({ grain: 115 })

      expect(evaluateRule(rule, product).passed).toBe(true)
    })

    it('returns true when field equals value', () => {
      const rule: EligibilityRule = { field: 'grain', operator: 'LTE', value: 115 }
      const product = createProduct({ grain: 115 })

      expect(evaluateRule(rule, product).passed).toBe(true)
    })

    it('returns false when field > value', () => {
      const rule: EligibilityRule = { field: 'grain', operator: 'LTE', value: 100 }
      const product = createProduct({ grain: 115 })

      expect(evaluateRule(rule, product).passed).toBe(false)
    })

    it('returns false when field is null', () => {
      const rule: EligibilityRule = { field: 'grain', operator: 'LTE', value: 124 }
      const product = createProduct({ grain: null })

      expect(evaluateRule(rule, product).passed).toBe(false)
    })
  })

  describe('IS_NULL operator', () => {
    it('returns true when field is null', () => {
      const rule: EligibilityRule = { field: 'bulletType', operator: 'IS_NULL', value: null }
      const product = createProduct({ bulletType: null })

      expect(evaluateRule(rule, product).passed).toBe(true)
    })

    it('returns false when field is not null', () => {
      const rule: EligibilityRule = { field: 'bulletType', operator: 'IS_NULL', value: null }
      const product = createProduct({ bulletType: 'FMJ' })

      expect(evaluateRule(rule, product).passed).toBe(false)
    })
  })

  describe('IS_NOT_NULL operator', () => {
    it('returns true when field is not null', () => {
      const rule: EligibilityRule = { field: 'bulletType', operator: 'IS_NOT_NULL', value: null }
      const product = createProduct({ bulletType: 'FMJ' })

      expect(evaluateRule(rule, product).passed).toBe(true)
    })

    it('returns false when field is null', () => {
      const rule: EligibilityRule = { field: 'bulletType', operator: 'IS_NOT_NULL', value: null }
      const product = createProduct({ bulletType: null })

      expect(evaluateRule(rule, product).passed).toBe(false)
    })
  })

  describe('case sensitivity', () => {
    it('string comparisons are case-sensitive', () => {
      const rule: EligibilityRule = { field: 'bulletType', operator: 'EQ', value: 'fmj' }
      const product = createProduct({ bulletType: 'FMJ' })

      expect(evaluateRule(rule, product).passed).toBe(false)
    })

    it('IN operator is case-sensitive', () => {
      const rule: EligibilityRule = { field: 'bulletType', operator: 'IN', value: ['fmj', 'tmj'] }
      const product = createProduct({ bulletType: 'FMJ' })

      expect(evaluateRule(rule, product).passed).toBe(false)
    })
  })
})

describe('evaluateEligibility', () => {
  it('returns eligible=true for empty rules', () => {
    const product = createProduct()
    const result = evaluateEligibility([], product)

    expect(result.eligible).toBe(true)
    expect(result.ruleResults).toHaveLength(0)
  })

  it('returns eligible=true when all rules pass', () => {
    const rules: EligibilityRule[] = [
      { field: 'bulletType', operator: 'IN', value: ['FMJ'] },
      { field: 'grain', operator: 'GTE', value: 100 },
    ]
    const product = createProduct({ bulletType: 'FMJ', grain: 115 })

    const result = evaluateEligibility(rules, product)
    expect(result.eligible).toBe(true)
  })

  it('returns eligible=false when any rule fails', () => {
    const rules: EligibilityRule[] = [
      { field: 'bulletType', operator: 'IN', value: ['FMJ'] },
      { field: 'grain', operator: 'GTE', value: 150 },
    ]
    const product = createProduct({ bulletType: 'FMJ', grain: 115 })

    const result = evaluateEligibility(rules, product)
    expect(result.eligible).toBe(false)
    expect(result.failureReasons).toHaveLength(1)
  })

  it('collects all failure reasons', () => {
    const rules: EligibilityRule[] = [
      { field: 'bulletType', operator: 'IN', value: ['HP'] },
      { field: 'grain', operator: 'GTE', value: 150 },
    ]
    const product = createProduct({ bulletType: 'FMJ', grain: 115 })

    const result = evaluateEligibility(rules, product)
    expect(result.eligible).toBe(false)
    expect(result.failureReasons).toHaveLength(2)
  })
})

describe('applyEligibility', () => {
  it('filters products based on eligibility rules', () => {
    const products = [
      createProduct({ productId: 'p1', bulletType: 'FMJ' }),
      createProduct({ productId: 'p2', bulletType: 'HP' }),
      createProduct({ productId: 'p3', bulletType: 'FMJ' }),
    ]
    const rules: EligibilityRule[] = [
      { field: 'bulletType', operator: 'IN', value: ['FMJ'] },
    ]

    const result = applyEligibility(products, rules)
    expect(result.eligible).toHaveLength(2)
    expect(result.filtered).toHaveLength(1)
    expect(result.eligible.map(p => p.productId)).toEqual(['p1', 'p3'])
  })

  it('tracks filter reasons per product', () => {
    const products = [
      createProduct({ productId: 'p1', bulletType: 'HP' }),
    ]
    const rules: EligibilityRule[] = [
      { field: 'bulletType', operator: 'IN', value: ['FMJ'] },
    ]

    const result = applyEligibility(products, rules)
    expect(result.filterReasons.get('p1')).toBeDefined()
    expect(result.filterReasons.get('p1')!.length).toBeGreaterThan(0)
  })

  it('returns all products when rules are empty', () => {
    const products = [
      createProduct({ productId: 'p1' }),
      createProduct({ productId: 'p2' }),
    ]

    const result = applyEligibility(products, [])
    expect(result.eligible).toHaveLength(2)
    expect(result.filtered).toHaveLength(0)
  })
})

describe('countFilterReasons', () => {
  it('counts unique filter reasons', () => {
    const filterReasons = new Map([
      ['p1', ['bulletType not in [FMJ]']],
      ['p2', ['bulletType not in [FMJ]']],
      ['p3', ['grain is null']],
    ])

    const counts = countFilterReasons(filterReasons)
    expect(counts['NOT_IN_MISMATCH']).toBe(2)
    expect(counts['NULL_FIELD']).toBe(1)
  })
})
