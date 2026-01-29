/**
 * Golden Corpus: Parse → Normalize Regression Tests
 *
 * Tests normalization against a fixture corpus to ensure:
 * 1. Caliber extraction from product names
 * 2. Grain weight extraction
 * 3. Round count extraction
 * 4. Brand passthrough
 * 5. URL signal extraction fallback
 *
 * Any change that breaks these fixtures requires explicit review.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { normalizeAmmoProduct, extractCaliber, extractGrainWeight, extractRoundCount } from '../../utils/ammo-utils'
import { parseUrlSignals } from '../signal-extraction'

interface FixtureInput {
  name: string
  url: string
  price: number
  inStock: boolean
  brand?: string
  sku?: string
}

interface FixtureExpected {
  caliber?: string
  grainWeight?: number
  roundCount?: number
  brand?: string
}

interface Fixture {
  id: string
  description: string
  input: FixtureInput
  expected: FixtureExpected
}

interface CorpusFile {
  description: string
  version: string
  fixtures: Fixture[]
}

// Load fixtures
const corpusPath = join(__dirname, 'fixtures', 'normalization-corpus.json')
const corpus: CorpusFile = JSON.parse(readFileSync(corpusPath, 'utf-8'))

describe('Golden Corpus: Parse → Normalize', () => {
  describe('Corpus metadata', () => {
    it('should have valid corpus structure', () => {
      expect(corpus.version).toBeDefined()
      expect(corpus.fixtures).toBeInstanceOf(Array)
      expect(corpus.fixtures.length).toBeGreaterThan(0)
    })
  })

  describe('Name-based extraction', () => {
    for (const fixture of corpus.fixtures) {
      // Skip URL-only extraction tests (no caliber in name)
      if (fixture.id === 'url-slug-caliber') continue

      describe(`[${fixture.id}] ${fixture.description}`, () => {
        it('should extract expected caliber from name', () => {
          if (fixture.expected.caliber === undefined) return

          const result = extractCaliber(fixture.input.name)
          expect(result).toBe(fixture.expected.caliber)
        })

        it('should extract expected grain weight from name', () => {
          if (fixture.expected.grainWeight === undefined) return

          const result = extractGrainWeight(fixture.input.name)
          expect(result).toBe(fixture.expected.grainWeight)
        })

        it('should extract expected round count from name', () => {
          if (fixture.expected.roundCount === undefined) return

          const result = extractRoundCount(fixture.input.name)
          expect(result).toBe(fixture.expected.roundCount)
        })
      })
    }
  })

  describe('URL signal extraction', () => {
    const urlFixture = corpus.fixtures.find(f => f.id === 'url-slug-caliber')

    if (urlFixture) {
      it('should extract caliber from URL when name is ambiguous', () => {
        const signals = parseUrlSignals(urlFixture.input.url)
        expect(signals.caliber).toBe(urlFixture.expected.caliber)
      })
    }
  })

  describe('Full normalization pipeline', () => {
    for (const fixture of corpus.fixtures) {
      // Skip URL-only tests for full normalization (name doesn't have caliber)
      if (fixture.id === 'url-slug-caliber') continue

      it(`[${fixture.id}] normalizeAmmoProduct extracts all fields`, () => {
        const normalized = normalizeAmmoProduct({
          name: fixture.input.name,
          brand: fixture.input.brand,
        })

        // Check caliber
        if (fixture.expected.caliber !== undefined) {
          expect(normalized.caliber).toBe(fixture.expected.caliber)
        }

        // Check grain weight
        if (fixture.expected.grainWeight !== undefined) {
          expect(normalized.grainWeight).toBe(fixture.expected.grainWeight)
        }

        // Check round count
        if (fixture.expected.roundCount !== undefined) {
          expect(normalized.roundCount).toBe(fixture.expected.roundCount)
        }

        // Check brand passthrough
        if (fixture.expected.brand !== undefined) {
          expect(normalized.brand).toBe(fixture.input.brand)
        }
      })
    }
  })

  describe('Caliber normalization consistency', () => {
    it('should normalize 9mm variants to 9mm', () => {
      const variants = ['9mm Luger', '9mm', '9x19', '9 luger', '9 MM']
      for (const variant of variants) {
        const result = extractCaliber(`Test ${variant} ammo`)
        expect(result).toBe('9mm')
      }
    })

    it('should keep .223 Remington distinct from 5.56 NATO', () => {
      expect(extractCaliber('Hornady .223 Remington 55gr')).toBe('.223 Remington')
      expect(extractCaliber('Federal 5.56 NATO M193')).toBe('5.56 NATO')
      expect(extractCaliber('Winchester 5.56mm NATO')).toBe('5.56 NATO')
    })

    it('should normalize shotgun gauges', () => {
      expect(extractCaliber('Remington 12 Gauge 00 Buck')).toBe('12 Gauge')
      expect(extractCaliber('Federal 20ga #4 Shot')).toBe('20 Gauge')
    })

    it('should handle 7.62x39 with word boundary', () => {
      // Pattern requires word boundary - works with space after
      expect(extractCaliber('Federal 7.62x39 123gr')).toBe('7.62x39mm')
    })
  })

  describe('Edge cases', () => {
    it('should handle empty strings gracefully', () => {
      expect(extractCaliber('')).toBeNull()
      expect(extractGrainWeight('')).toBeNull()
      expect(extractRoundCount('')).toBeNull()
    })

    it('should reject grain weights outside valid range', () => {
      // Too small
      expect(extractGrainWeight('Test 5gr ammo')).toBeNull()
      // Too large
      expect(extractGrainWeight('Test 1000gr ammo')).toBeNull()
    })

    it('should reject round counts outside valid range', () => {
      // Too small
      expect(extractRoundCount('Test 2 rounds')).toBeNull()
      // Too large
      expect(extractRoundCount('Test 20000 rounds')).toBeNull()
    })
  })

  describe('Identity-eligible gate', () => {
    /**
     * Identity-eligible means the product has enough extracted fields
     * to be matched to a canonical product. Minimum requirement: caliber.
     *
     * This gate ensures the normalizer maintains a minimum extraction rate
     * across the corpus. If this drops, it indicates a regression.
     */
    const MINIMUM_IDENTITY_ELIGIBLE_PERCENT = 90

    it(`should have >= ${MINIMUM_IDENTITY_ELIGIBLE_PERCENT}% identity-eligible products`, () => {
      let eligibleCount = 0
      const results: Array<{ id: string; eligible: boolean; caliber: string | null }> = []

      for (const fixture of corpus.fixtures) {
        // Try name extraction first, then URL fallback
        let caliber = extractCaliber(fixture.input.name)
        if (!caliber && fixture.input.url) {
          const urlSignals = parseUrlSignals(fixture.input.url)
          caliber = urlSignals.caliber ?? null
        }

        const eligible = caliber !== null
        if (eligible) eligibleCount++

        results.push({ id: fixture.id, eligible, caliber })
      }

      const eligiblePercent = (eligibleCount / corpus.fixtures.length) * 100

      // Log results for debugging
      const ineligible = results.filter(r => !r.eligible)
      if (ineligible.length > 0) {
        console.log('Ineligible fixtures:', ineligible.map(r => r.id))
      }

      expect(eligiblePercent).toBeGreaterThanOrEqual(MINIMUM_IDENTITY_ELIGIBLE_PERCENT)
    })

    it('should extract caliber for all fixtures with expected caliber', () => {
      // Stricter test: every fixture with an expected caliber must extract it
      const fixturesWithExpectedCaliber = corpus.fixtures.filter(f => f.expected.caliber !== undefined)

      for (const fixture of fixturesWithExpectedCaliber) {
        let caliber = extractCaliber(fixture.input.name)
        if (!caliber && fixture.input.url) {
          const urlSignals = parseUrlSignals(fixture.input.url)
          caliber = urlSignals.caliber ?? null
        }

        expect(caliber).toBe(fixture.expected.caliber)
      }
    })

    it('should report key field extraction rates', () => {
      let caliberCount = 0
      let grainCount = 0
      let roundCountCount = 0
      let brandCount = 0

      for (const fixture of corpus.fixtures) {
        const normalized = normalizeAmmoProduct({
          name: fixture.input.name,
          brand: fixture.input.brand,
        })

        // Also check URL signals for caliber
        let caliber = normalized.caliber
        if (!caliber && fixture.input.url) {
          const urlSignals = parseUrlSignals(fixture.input.url)
          caliber = urlSignals.caliber ?? null
        }

        if (caliber) caliberCount++
        if (normalized.grainWeight) grainCount++
        if (normalized.roundCount) roundCountCount++
        if (normalized.brand) brandCount++
      }

      const total = corpus.fixtures.length
      const rates = {
        caliber: ((caliberCount / total) * 100).toFixed(1),
        grainWeight: ((grainCount / total) * 100).toFixed(1),
        roundCount: ((roundCountCount / total) * 100).toFixed(1),
        brand: ((brandCount / total) * 100).toFixed(1),
      }

      console.log('Key field extraction rates:', rates)

      // Gate: caliber is required for identity
      expect(parseFloat(rates.caliber)).toBeGreaterThanOrEqual(MINIMUM_IDENTITY_ELIGIBLE_PERCENT)

      // Soft gates: these are informational but should stay high
      expect(parseFloat(rates.grainWeight)).toBeGreaterThanOrEqual(70)
      expect(parseFloat(rates.brand)).toBeGreaterThanOrEqual(80)
    })
  })
})
