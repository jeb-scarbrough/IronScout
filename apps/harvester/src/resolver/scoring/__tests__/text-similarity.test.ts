import { describe, it, expect } from 'vitest'
import {
  tokenize,
  computeTF,
  computeIDF,
  computeTFIDF,
  cosineSimilarity,
  tfidfCosineSimilarity,
  tfidfCosineSimilarityWithTokens,
  jaccardSimilarity,
  levenshteinSimilarity,
} from '../text-similarity'

describe('text-similarity', () => {
  describe('tokenize', () => {
    it('should lowercase and split on whitespace', () => {
      expect(tokenize('Federal Premium 9mm')).toEqual(['federal', 'premium', '9mm'])
    })

    it('should remove punctuation except hyphens', () => {
      expect(tokenize('Federal, Premium (9mm)')).toEqual(['federal', 'premium', '9mm'])
    })

    it('should preserve hyphens within words', () => {
      expect(tokenize('Full-Metal-Jacket 115gr')).toEqual(['full-metal-jacket', '115gr'])
    })

    it('should filter empty tokens', () => {
      expect(tokenize('  Federal   Premium  ')).toEqual(['federal', 'premium'])
    })

    it('should handle empty string', () => {
      expect(tokenize('')).toEqual([])
    })

    // Edge case tests
    it('should split digit-hyphen-digit patterns', () => {
      // "9mm-124gr" splits into ["9mm", "124gr"] for better matching
      expect(tokenize('9mm-124gr')).toEqual(['9mm', '124gr'])
      expect(tokenize('50-round')).toEqual(['50', 'round'])
      expect(tokenize('7-62')).toEqual(['7', '62'])
    })

    it('should keep word-hyphen-word patterns together', () => {
      // Compound words without leading digits stay together
      expect(tokenize('full-metal-jacket')).toEqual(['full-metal-jacket'])
      expect(tokenize('hollow-point')).toEqual(['hollow-point'])
    })

    it('should treat space-separated values as separate tokens', () => {
      expect(tokenize('9mm 124gr')).toEqual(['9mm', '124gr'])
    })

    it('should strip non-ASCII characters (v1 limitation)', () => {
      // Current behavior: \w matches only ASCII [a-zA-Z0-9_]
      // Non-ASCII letters are stripped, which may affect international brands
      expect(tokenize('Ückeritz Arms')).toEqual(['ckeritz', 'arms'])
      expect(tokenize('Señor Ammo')).toEqual(['se', 'or', 'ammo'])
    })
  })

  describe('computeTF', () => {
    it('should compute normalized term frequency', () => {
      const tf = computeTF(['the', 'cat', 'sat', 'on', 'the', 'mat'])
      expect(tf.get('the')).toBeCloseTo(2 / 6)
      expect(tf.get('cat')).toBeCloseTo(1 / 6)
    })

    it('should return empty map for empty array', () => {
      expect(computeTF([]).size).toBe(0)
    })
  })

  describe('computeIDF', () => {
    it('should compute smoothed IDF', () => {
      const docs = [
        ['federal', 'premium', '9mm'],
        ['hornady', 'critical', '9mm'],
        ['speer', 'gold', 'dot', '9mm'],
      ]
      const idf = computeIDF(docs)

      // '9mm' appears in all 3 docs
      // IDF = log((3+1)/(3+1)) + 1 = log(1) + 1 = 1
      expect(idf.get('9mm')).toBeCloseTo(1)

      // 'federal' appears in 1 doc
      // IDF = log((3+1)/(1+1)) + 1 = log(2) + 1 ≈ 1.693
      expect(idf.get('federal')).toBeCloseTo(Math.log(2) + 1)
    })
  })

  describe('cosineSimilarity', () => {
    it('should return 1 for identical vectors', () => {
      const vec = new Map([['a', 0.5], ['b', 0.5]])
      expect(cosineSimilarity(vec, vec)).toBeCloseTo(1)
    })

    it('should return 0 for orthogonal vectors', () => {
      const vec1 = new Map([['a', 1]])
      const vec2 = new Map([['b', 1]])
      expect(cosineSimilarity(vec1, vec2)).toBe(0)
    })

    it('should return 0 for empty vectors', () => {
      expect(cosineSimilarity(new Map(), new Map([['a', 1]]))).toBe(0)
      expect(cosineSimilarity(new Map([['a', 1]]), new Map())).toBe(0)
    })

    it('should compute correct similarity for overlapping vectors', () => {
      const vec1 = new Map([['a', 1], ['b', 0]])
      const vec2 = new Map([['a', 1], ['b', 1]])
      // dot = 1*1 + 0*1 = 1
      // |v1| = sqrt(1) = 1
      // |v2| = sqrt(2) ≈ 1.414
      // cos = 1 / 1.414 ≈ 0.707
      expect(cosineSimilarity(vec1, vec2)).toBeCloseTo(1 / Math.sqrt(2))
    })
  })

  describe('tfidfCosineSimilarity', () => {
    it('should return 1 for identical texts', () => {
      const text = 'Federal Premium 9mm 115gr FMJ'
      expect(tfidfCosineSimilarity(text, text)).toBeCloseTo(1)
    })

    it('should return high similarity for near-identical texts', () => {
      const text1 = 'Federal Premium 9mm Luger 115 Grain FMJ'
      const text2 = 'Federal Premium 9mm 115 Grain FMJ Ammunition'
      const similarity = tfidfCosineSimilarity(text1, text2)
      expect(similarity).toBeGreaterThan(0.7)
    })

    it('should return low similarity for different products', () => {
      const text1 = 'Federal Premium 9mm 115gr FMJ'
      const text2 = 'Hornady Critical Defense 45 ACP 185gr'
      const similarity = tfidfCosineSimilarity(text1, text2)
      expect(similarity).toBeLessThan(0.3)
    })

    it('should return 0 for empty texts', () => {
      expect(tfidfCosineSimilarity('', 'Federal 9mm')).toBe(0)
      expect(tfidfCosineSimilarity('Federal 9mm', '')).toBe(0)
      expect(tfidfCosineSimilarity('', '')).toBe(0)
    })

    it('should handle texts with no overlap', () => {
      expect(tfidfCosineSimilarity('alpha beta', 'gamma delta')).toBe(0)
    })

    it('should be case insensitive', () => {
      const text1 = 'FEDERAL PREMIUM 9MM'
      const text2 = 'federal premium 9mm'
      expect(tfidfCosineSimilarity(text1, text2)).toBeCloseTo(1)
    })
  })

  describe('tfidfCosineSimilarityWithTokens', () => {
    it('should produce same results as tfidfCosineSimilarity', () => {
      const text1 = 'Federal Premium 9mm 115gr FMJ'
      const text2 = 'Federal Premium 9mm Luger 115 Grain'

      const tokens1 = tokenize(text1)
      const resultWithTokens = tfidfCosineSimilarityWithTokens(tokens1, text2)
      const resultDirect = tfidfCosineSimilarity(text1, text2)

      expect(resultWithTokens).toBeCloseTo(resultDirect)
    })

    it('should return 0 for empty input tokens', () => {
      expect(tfidfCosineSimilarityWithTokens([], 'Federal 9mm')).toBe(0)
    })

    it('should return 0 for empty candidate text', () => {
      const tokens = tokenize('Federal 9mm')
      expect(tfidfCosineSimilarityWithTokens(tokens, '')).toBe(0)
    })

    it('should handle multiple candidates with same input tokens', () => {
      const inputTokens = tokenize('Federal Premium 9mm 115gr')

      const similarity1 = tfidfCosineSimilarityWithTokens(inputTokens, 'Federal Premium 9mm 115gr FMJ')
      const similarity2 = tfidfCosineSimilarityWithTokens(inputTokens, 'Hornady Critical Defense 45 ACP')
      const similarity3 = tfidfCosineSimilarityWithTokens(inputTokens, 'Federal Premium 9mm 124gr')

      // Same brand/caliber/grain should score highest
      expect(similarity1).toBeGreaterThan(similarity3)
      expect(similarity3).toBeGreaterThan(similarity2)
    })
  })

  describe('jaccardSimilarity', () => {
    it('should return 1 for identical texts', () => {
      expect(jaccardSimilarity('federal 9mm', 'federal 9mm')).toBe(1)
    })

    it('should return 0 for texts with no overlap', () => {
      expect(jaccardSimilarity('alpha beta', 'gamma delta')).toBe(0)
    })

    it('should compute correct overlap ratio', () => {
      // tokens1 = {federal, premium, 9mm}
      // tokens2 = {federal, 9mm, fmj}
      // intersection = {federal, 9mm} = 2
      // union = {federal, premium, 9mm, fmj} = 4
      // Jaccard = 2/4 = 0.5
      const similarity = jaccardSimilarity('Federal Premium 9mm', 'Federal 9mm FMJ')
      expect(similarity).toBeCloseTo(0.5)
    })

    it('should return 0 for empty texts', () => {
      expect(jaccardSimilarity('', 'test')).toBe(0)
      expect(jaccardSimilarity('test', '')).toBe(0)
    })
  })

  describe('levenshteinSimilarity', () => {
    it('should return 1 for identical strings', () => {
      expect(levenshteinSimilarity('federal', 'federal')).toBe(1)
    })

    it('should return high similarity for typos', () => {
      // Hornady vs Horandy - 1 transposition
      const similarity = levenshteinSimilarity('Hornady', 'Horandy')
      expect(similarity).toBeGreaterThan(0.7)
    })

    it('should return low similarity for very different strings', () => {
      const similarity = levenshteinSimilarity('Federal', 'Speer')
      expect(similarity).toBeLessThan(0.3)
    })

    it('should return 0 for empty strings', () => {
      expect(levenshteinSimilarity('', 'test')).toBe(0)
      expect(levenshteinSimilarity('test', '')).toBe(0)
    })

    it('should be case insensitive', () => {
      expect(levenshteinSimilarity('FEDERAL', 'federal')).toBe(1)
    })

    it('should handle single character edits', () => {
      // 'cat' -> 'bat' = 1 edit, length 3
      // similarity = 1 - 1/3 ≈ 0.667
      expect(levenshteinSimilarity('cat', 'bat')).toBeCloseTo(2 / 3)
    })
  })

  describe('edge case similarity impacts', () => {
    it('hyphen vs space variants now match correctly', () => {
      // "9mm-124gr" now tokenizes to ["9mm", "124gr"] (same as space-separated)
      // Full token overlap expected
      const similarity = tfidfCosineSimilarity('Federal 9mm-124gr', 'Federal 9mm 124gr')
      expect(similarity).toBeCloseTo(1.0, 1) // Near-perfect match
    })

    it('non-ASCII brand names have reduced similarity (v1 limitation)', () => {
      // "Ückeritz" becomes "ckeritz" - partial match possible
      const similarity = tfidfCosineSimilarity('Ückeritz Arms 9mm', 'Uckeritz Arms 9mm')
      // "ckeritz" vs "uckeritz" - no match, but "arms" and "9mm" match
      expect(similarity).toBeGreaterThan(0.5)
    })
  })

  describe('ammunition product title comparisons', () => {
    it('should score similar ammunition products highly', () => {
      const cases: [string, string, { min?: number; max?: number }][] = [
        // Same product, slight variations - moderate similarity due to synonym differences
        [
          'Federal American Eagle 9mm Luger 115 Grain FMJ',
          'Federal American Eagle 9mm 115gr Full Metal Jacket',
          { min: 0.3 }, // Tokens differ: "luger", "grain", "fmj" vs "115gr", "full", "metal", "jacket"
        ],
        // Same brand and caliber, different grain
        [
          'Hornady Critical Defense 9mm 115gr',
          'Hornady Critical Defense 9mm 124gr',
          { min: 0.6 }, // Most tokens match, only grain differs
        ],
        // Completely different products - should have very low similarity
        [
          'Federal 9mm 115gr FMJ',
          'Winchester 45 ACP 230gr JHP',
          { max: 0.15 }, // Different brands, calibers, grains
        ],
      ]

      for (const [text1, text2, bounds] of cases) {
        const similarity = tfidfCosineSimilarity(text1, text2)
        if (bounds.min !== undefined) {
          expect(similarity).toBeGreaterThan(bounds.min)
        }
        if (bounds.max !== undefined) {
          expect(similarity).toBeLessThan(bounds.max)
        }
      }
    })
  })
})
