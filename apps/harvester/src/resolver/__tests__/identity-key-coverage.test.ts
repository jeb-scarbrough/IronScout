/**
 * Identity-Key Coverage Tests
 *
 * Measures extraction success rates and identity-key eligibility using
 * synthetic fixtures. This test suite serves as a gate for extraction
 * pattern changes - improvements should increase coverage without
 * introducing false positives.
 */

import { describe, it, expect } from 'vitest'
import {
  extractCaliber,
  extractGrainWeight,
  extractRoundCount,
  extractShellLength,
  deriveShotgunLoadType,
} from '../../normalizer/ammo-utils'
import fixtures from './fixtures/extraction-fixtures.json'

interface ExpectedExtraction {
  caliber?: string | null
  grain?: number | null
  packCount?: number | null
  shellLength?: string | null
  loadType?: string | null
  identityEligible: boolean
  reason?: string
}

interface Fixture {
  id: string
  title: string
  expected: ExpectedExtraction
}

describe('Extraction Pattern Coverage', () => {
  const fixtureList = fixtures.fixtures as Fixture[]

  describe('Individual Extractions', () => {
    describe('Caliber Extraction', () => {
      const caliberFixtures = fixtureList.filter((f) => f.expected.caliber !== undefined)

      it.each(caliberFixtures.map((f) => [f.id, f.title, f.expected.caliber]))(
        '%s: extracts caliber from "%s"',
        (_id, title, expectedCaliber) => {
          const result = extractCaliber(title as string)
          expect(result).toBe(expectedCaliber)
        }
      )
    })

    describe('Grain Weight Extraction', () => {
      const grainFixtures = fixtureList.filter((f) => f.expected.grain !== undefined)

      it.each(grainFixtures.map((f) => [f.id, f.title, f.expected.grain]))(
        '%s: extracts grain from "%s"',
        (_id, title, expectedGrain) => {
          const result = extractGrainWeight(title as string)
          expect(result).toBe(expectedGrain)
        }
      )
    })

    describe('Pack Count Extraction', () => {
      const packFixtures = fixtureList.filter((f) => f.expected.packCount !== undefined)

      it.each(packFixtures.map((f) => [f.id, f.title, f.expected.packCount]))(
        '%s: extracts pack count from "%s"',
        (_id, title, expectedPack) => {
          const result = extractRoundCount(title as string)
          expect(result).toBe(expectedPack)
        }
      )
    })

    describe('Shell Length Extraction (Shotgun)', () => {
      const shellFixtures = fixtureList.filter((f) => f.expected.shellLength !== undefined)

      it.each(shellFixtures.map((f) => [f.id, f.title, f.expected.shellLength]))(
        '%s: extracts shell length from "%s"',
        (_id, title, expectedLength) => {
          const result = extractShellLength(title as string)
          expect(result).toBe(expectedLength)
        }
      )
    })

    describe('Load Type Extraction (Shotgun)', () => {
      const loadTypeFixtures = fixtureList.filter((f) => f.expected.loadType !== undefined)

      it.each(loadTypeFixtures.map((f) => [f.id, f.title, f.expected.loadType]))(
        '%s: extracts load type from "%s"',
        (_id, title, expectedLoadType) => {
          const result = deriveShotgunLoadType(title as string)
          expect(result).toBe(expectedLoadType)
        }
      )
    })
  })

  describe('Identity-Key Eligibility', () => {
    // For rifle/pistol: needs caliber, grain, packCount
    // For shotgun: needs caliber, packCount, shellLength (or loadType)

    function isShotgun(caliber: string | null): boolean {
      if (!caliber) return false
      return /gauge|bore/i.test(caliber)
    }

    function checkEligibility(title: string): {
      eligible: boolean
      extracted: {
        caliber: string | null
        grain: number | null
        packCount: number | null
        shellLength: string | null
        loadType: string | null
      }
      missing: string[]
    } {
      const caliber = extractCaliber(title)
      const grain = extractGrainWeight(title)
      const packCount = extractRoundCount(title)
      const shellLength = extractShellLength(title)
      const loadType = deriveShotgunLoadType(title)

      const missing: string[] = []
      let eligible = true

      if (!caliber) {
        missing.push('caliber')
        eligible = false
      }

      if (isShotgun(caliber)) {
        // Shotgun identity: caliber + packCount + (loadType OR shellLength)
        if (!packCount) {
          missing.push('packCount')
          eligible = false
        }
        if (!loadType && !shellLength) {
          missing.push('loadType/shellLength')
          eligible = false
        }
      } else {
        // Rifle/Pistol identity: caliber + grain + packCount
        if (!grain) {
          missing.push('grain')
          eligible = false
        }
        if (!packCount) {
          missing.push('packCount')
          eligible = false
        }
      }

      return {
        eligible,
        extracted: { caliber, grain, packCount, shellLength, loadType },
        missing,
      }
    }

    it.each(fixtureList.map((f) => [f.id, f.title, f.expected.identityEligible, f.expected.reason]))(
      '%s: identity eligibility matches expected (%s)',
      (_id, title, expectedEligible, _reason) => {
        const result = checkEligibility(title as string)
        expect(result.eligible).toBe(expectedEligible)
      }
    )
  })

  describe('Coverage Metrics', () => {
    it('reports extraction success rates', () => {
      let caliberSuccess = 0
      let grainSuccess = 0
      let packCountSuccess = 0
      let identityEligible = 0

      const total = fixtureList.length

      for (const fixture of fixtureList) {
        const caliber = extractCaliber(fixture.title)
        const grain = extractGrainWeight(fixture.title)
        const packCount = extractRoundCount(fixture.title)

        // Only count as success if it matches expected (or expected is null and we got null)
        if (fixture.expected.caliber !== undefined) {
          if (caliber === fixture.expected.caliber) caliberSuccess++
        }
        if (fixture.expected.grain !== undefined) {
          if (grain === fixture.expected.grain) grainSuccess++
        }
        if (fixture.expected.packCount !== undefined) {
          if (packCount === fixture.expected.packCount) packCountSuccess++
        }

        // Check identity eligibility
        const isShotgun = caliber && /gauge|bore/i.test(caliber)
        if (isShotgun) {
          const loadType = deriveShotgunLoadType(fixture.title)
          const shellLength = extractShellLength(fixture.title)
          if (caliber && packCount && (loadType || shellLength)) {
            identityEligible++
          }
        } else {
          if (caliber && grain && packCount) {
            identityEligible++
          }
        }
      }

      const caliberRate = (caliberSuccess / total) * 100
      const grainRate = (grainSuccess / total) * 100
      const packCountRate = (packCountSuccess / total) * 100
      const eligibilityRate = (identityEligible / total) * 100

      // Log metrics for visibility
      console.log('\n=== Extraction Coverage Metrics ===')
      console.log(`Total fixtures: ${total}`)
      console.log(`Caliber accuracy: ${caliberSuccess}/${total} (${caliberRate.toFixed(1)}%)`)
      console.log(`Grain accuracy: ${grainSuccess}/${total} (${grainRate.toFixed(1)}%)`)
      console.log(`Pack count accuracy: ${packCountSuccess}/${total} (${packCountRate.toFixed(1)}%)`)
      console.log(`Identity-key eligible: ${identityEligible}/${total} (${eligibilityRate.toFixed(1)}%)`)
      console.log('===================================\n')

      // These are baseline thresholds - should only increase over time
      expect(caliberRate).toBeGreaterThanOrEqual(90)
      expect(grainRate).toBeGreaterThanOrEqual(85)
      expect(packCountRate).toBeGreaterThanOrEqual(90)
      expect(eligibilityRate).toBeGreaterThanOrEqual(75)
    })

    it('identifies missing field distribution', () => {
      const missingCounts: Record<string, number> = {
        caliber: 0,
        grain: 0,
        packCount: 0,
        shellLength: 0,
        loadType: 0,
      }

      for (const fixture of fixtureList) {
        if (!extractCaliber(fixture.title)) missingCounts.caliber++
        if (!extractGrainWeight(fixture.title)) missingCounts.grain++
        if (!extractRoundCount(fixture.title)) missingCounts.packCount++
        if (!extractShellLength(fixture.title)) missingCounts.shellLength++
        if (!deriveShotgunLoadType(fixture.title)) missingCounts.loadType++
      }

      console.log('\n=== Missing Field Distribution ===')
      for (const [field, count] of Object.entries(missingCounts)) {
        const rate = (count / fixtureList.length) * 100
        console.log(`${field}: ${count} missing (${rate.toFixed(1)}%)`)
      }
      console.log('==================================\n')

      // Just ensure the test runs - this is for observability
      expect(true).toBe(true)
    })
  })
})
