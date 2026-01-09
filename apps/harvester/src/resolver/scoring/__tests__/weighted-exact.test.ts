/**
 * Unit tests for Weighted Exact Match Scoring Strategy
 */

import { describe, it, expect } from 'vitest'
import {
  WeightedExactMatchStrategy,
  createWeightedExactMatchStrategy,
} from '../weighted-exact'
import type { NormalizedInput, CandidateProduct } from '../../types'

describe('WeightedExactMatchStrategy', () => {
  describe('metadata', () => {
    it('has correct name and version', () => {
      expect(WeightedExactMatchStrategy.name).toBe('weighted-exact-match')
      expect(WeightedExactMatchStrategy.version).toBe('1.2.0')
    })
  })

  describe('scoring', () => {
    const baseInput: NormalizedInput = {
      title: 'Federal Premium 9mm 124gr JHP',
      titleNorm: 'federal premium 9mm 124gr jhp',
      brand: 'Federal',
      brandNorm: 'federal',
      caliber: '9mm',
      caliberNorm: '9mm',
      packCount: 50,
      grain: 124,
      url: 'https://example.com/product/1',
    }

    const perfectCandidate: CandidateProduct = {
      id: 'prod_1',
      canonicalKey: 'UPC:012345678901',
      brandNorm: 'federal',
      caliberNorm: '9mm',
      roundCount: 50,
      grainWeight: 124,
      name: 'Federal Premium 9mm 124gr JHP', // Matches input title for TF-IDF
    }

    it('returns max score for perfect match', () => {
      const result = WeightedExactMatchStrategy.score(baseInput, perfectCandidate)

      // brand(0.25) + caliber(0.30) + pack(0.20) + grain(0.15) + title(1.0 * 0.10) = 1.0
      expect(result.total).toBeCloseTo(1.0, 2)
      expect(result.matchDetails.brandMatch).toBe(true)
      expect(result.matchDetails.caliberMatch).toBe(true)
      expect(result.matchDetails.packMatch).toBe(true)
      expect(result.matchDetails.grainMatch).toBe(true)
    })

    it('returns lower score when brand differs', () => {
      const candidate: CandidateProduct = {
        ...perfectCandidate,
        brandNorm: 'winchester',
      }

      const result = WeightedExactMatchStrategy.score(baseInput, candidate)

      // caliber(0.30) + pack(0.20) + grain(0.15) + title(~1.0 * 0.10) = 0.75
      expect(result.total).toBeCloseTo(0.75, 2)
      expect(result.matchDetails.brandMatch).toBe(false)
      expect(result.matchDetails.caliberMatch).toBe(true)
    })

    it('returns lower score when caliber differs', () => {
      const candidate: CandidateProduct = {
        ...perfectCandidate,
        caliberNorm: '.45 ACP',
      }

      const result = WeightedExactMatchStrategy.score(baseInput, candidate)

      // brand(0.25) + pack(0.20) + grain(0.15) + title(~1.0 * 0.10) = 0.70
      expect(result.total).toBeCloseTo(0.70, 2)
      expect(result.matchDetails.brandMatch).toBe(true)
      expect(result.matchDetails.caliberMatch).toBe(false)
    })

    it('returns lower score when pack count differs', () => {
      const candidate: CandidateProduct = {
        ...perfectCandidate,
        roundCount: 20,
      }

      const result = WeightedExactMatchStrategy.score(baseInput, candidate)

      // brand(0.25) + caliber(0.30) + grain(0.15) + title(~1.0 * 0.10) = 0.80
      expect(result.total).toBeCloseTo(0.80, 2)
      expect(result.matchDetails.packMatch).toBe(false)
    })

    it('returns lower score when grain differs', () => {
      const candidate: CandidateProduct = {
        ...perfectCandidate,
        grainWeight: 115,
      }

      const result = WeightedExactMatchStrategy.score(baseInput, candidate)

      // brand(0.25) + caliber(0.30) + pack(0.20) + title(~1.0 * 0.10) = 0.85
      expect(result.total).toBeCloseTo(0.85, 2)
      expect(result.matchDetails.grainMatch).toBe(false)
    })

    it('handles null candidate values', () => {
      const candidate: CandidateProduct = {
        id: 'prod_2',
        canonicalKey: null,
        brandNorm: null,
        caliberNorm: null,
        roundCount: null,
        grainWeight: null,
        name: null,
      }

      const result = WeightedExactMatchStrategy.score(baseInput, candidate)

      // No matches, no name for TF-IDF = 0 total
      expect(result.total).toBeCloseTo(0, 2)
      expect(result.matchDetails.brandMatch).toBe(false)
      expect(result.matchDetails.caliberMatch).toBe(false)
      expect(result.matchDetails.packMatch).toBe(false)
      expect(result.matchDetails.grainMatch).toBe(false)
    })

    it('handles undefined input values', () => {
      const sparseInput: NormalizedInput = {
        title: 'Mystery Ammo',
        url: 'https://example.com/product/1',
        // All other fields undefined
      }

      const result = WeightedExactMatchStrategy.score(sparseInput, perfectCandidate)

      // No field matches, titles don't overlap ('Mystery Ammo' vs 'Federal Premium...')
      // TF-IDF with no common tokens = 0
      expect(result.total).toBeCloseTo(0, 2)
    })

    it('includes component scores in result', () => {
      const result = WeightedExactMatchStrategy.score(baseInput, perfectCandidate)

      expect(result.componentScores).toHaveProperty('brand')
      expect(result.componentScores).toHaveProperty('caliber')
      expect(result.componentScores).toHaveProperty('pack')
      expect(result.componentScores).toHaveProperty('grain')
      expect(result.componentScores).toHaveProperty('title')

      expect(result.componentScores.brand).toBeCloseTo(0.25, 2)
      expect(result.componentScores.caliber).toBeCloseTo(0.30, 2)
      expect(result.componentScores.pack).toBeCloseTo(0.20, 2)
      expect(result.componentScores.grain).toBeCloseTo(0.15, 2)
      // TF-IDF returns 1.0 for identical titles: 1.0 * 0.10 = 0.10
      expect(result.componentScores.title).toBeCloseTo(0.10, 2)
    })
  })

  describe('createWeightedExactMatchStrategy', () => {
    it('creates strategy with custom weights', () => {
      const customStrategy = createWeightedExactMatchStrategy({
        brand: 0.40,
        caliber: 0.40,
        pack: 0.10,
        grain: 0.05,
        title: 0.05,
      }, '2.0.0')

      expect(customStrategy.name).toBe('weighted-exact-match')
      expect(customStrategy.version).toBe('2.0.0')

      const input: NormalizedInput = {
        title: 'Federal 9mm Ammo',
        brandNorm: 'federal',
        caliberNorm: '9mm',
        url: 'https://example.com',
      }

      const candidate: CandidateProduct = {
        id: 'prod_1',
        canonicalKey: null,
        brandNorm: 'federal',
        caliberNorm: '9mm',
        roundCount: null,
        grainWeight: null,
        name: 'Federal 9mm Ammo', // Match input for TF-IDF = 1.0
      }

      const result = customStrategy.score(input, candidate)

      // brand(0.40) + caliber(0.40) + title(1.0 * 0.05) = 0.85
      expect(result.total).toBeCloseTo(0.85, 2)
      expect(result.componentScores.brand).toBeCloseTo(0.40, 2)
      expect(result.componentScores.caliber).toBeCloseTo(0.40, 2)
    })

    it('throws error if weights do not sum to 1.0', () => {
      expect(() => {
        createWeightedExactMatchStrategy({
          brand: 0.50,
          caliber: 0.50,
          pack: 0.50,
          grain: 0.50,
          title: 0.50,
        })
      }).toThrow('Weights must sum to 1.0')
    })
  })
})
