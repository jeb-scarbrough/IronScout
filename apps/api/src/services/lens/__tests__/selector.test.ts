import { describe, it, expect } from 'vitest'
import {
  evaluateTrigger,
  lensMatchesTriggers,
  getMatchingLenses,
  selectLens,
  InvalidLensError,
  calculateTriggerScore,
} from '../selector'
import { RANGE_LENS, DEFENSIVE_LENS, MATCH_LENS, ALL_LENS } from '../definitions'
import { LensSignals, LensTriggerRule } from '../types'

describe('evaluateTrigger', () => {
  it('returns true when signal matches exactly with sufficient confidence', () => {
    const rule: LensTriggerRule = { signal: 'usage_hint', value: 'RANGE', minConfidence: 0.7 }
    const signals: LensSignals = { usage_hint: { value: 'RANGE', confidence: 0.8 } }

    expect(evaluateTrigger(rule, signals)).toBe(true)
  })

  it('returns false when signal value does not match', () => {
    const rule: LensTriggerRule = { signal: 'usage_hint', value: 'RANGE', minConfidence: 0.7 }
    const signals: LensSignals = { usage_hint: { value: 'DEFENSIVE', confidence: 0.9 } }

    expect(evaluateTrigger(rule, signals)).toBe(false)
  })

  it('returns false when confidence is below threshold', () => {
    const rule: LensTriggerRule = { signal: 'usage_hint', value: 'RANGE', minConfidence: 0.7 }
    const signals: LensSignals = { usage_hint: { value: 'RANGE', confidence: 0.6 } }

    expect(evaluateTrigger(rule, signals)).toBe(false)
  })

  it('returns true when confidence exactly equals threshold', () => {
    const rule: LensTriggerRule = { signal: 'usage_hint', value: 'RANGE', minConfidence: 0.7 }
    const signals: LensSignals = { usage_hint: { value: 'RANGE', confidence: 0.7 } }

    expect(evaluateTrigger(rule, signals)).toBe(true)
  })

  it('returns false when signal is missing', () => {
    const rule: LensTriggerRule = { signal: 'usage_hint', value: 'RANGE', minConfidence: 0.7 }
    const signals: LensSignals = {}

    expect(evaluateTrigger(rule, signals)).toBe(false)
  })

  it('uses 0.0 as default minConfidence', () => {
    const rule: LensTriggerRule = { signal: 'usage_hint', value: 'RANGE' }
    const signals: LensSignals = { usage_hint: { value: 'RANGE', confidence: 0.01 } }

    expect(evaluateTrigger(rule, signals)).toBe(true)
  })

  it('performs case-sensitive value comparison', () => {
    const rule: LensTriggerRule = { signal: 'usage_hint', value: 'RANGE' }
    const signals: LensSignals = { usage_hint: { value: 'range', confidence: 0.9 } }

    expect(evaluateTrigger(rule, signals)).toBe(false)
  })
})

describe('lensMatchesTriggers', () => {
  it('returns true when any trigger matches (OR logic)', () => {
    const signals: LensSignals = {
      purpose: { value: 'Target', confidence: 0.9 },
    }

    expect(lensMatchesTriggers(RANGE_LENS, signals)).toBe(true)
  })

  it('returns false when no triggers match', () => {
    const signals: LensSignals = {
      usage_hint: { value: 'HUNTING', confidence: 0.9 },
    }

    expect(lensMatchesTriggers(RANGE_LENS, signals)).toBe(false)
  })

  it('returns false for lenses with no triggers', () => {
    const signals: LensSignals = {
      usage_hint: { value: 'RANGE', confidence: 0.9 },
    }

    expect(lensMatchesTriggers(ALL_LENS, signals)).toBe(false)
  })
})

describe('getMatchingLenses', () => {
  it('returns empty array when no lenses match', () => {
    const signals: LensSignals = {}

    expect(getMatchingLenses(signals)).toEqual([])
  })

  it('returns single lens when one matches', () => {
    const signals: LensSignals = {
      usage_hint: { value: 'RANGE', confidence: 0.8 },
    }

    expect(getMatchingLenses(signals)).toEqual(['RANGE'])
  })

  it('returns multiple lenses when multiple match, sorted lexicographically', () => {
    const signals: LensSignals = {
      usage_hint: { value: 'RANGE', confidence: 0.8 },
      purpose: { value: 'Defense', confidence: 0.9 },
    }

    const result = getMatchingLenses(signals)
    expect(result).toContain('RANGE')
    expect(result).toContain('DEFENSIVE')
    // Verify lexicographic order
    expect(result).toEqual([...result].sort())
  })
})

describe('selectLens', () => {
  const extractorModelId = 'test-model-v1'

  describe('user override', () => {
    it('uses user-selected lens when valid', () => {
      const signals: LensSignals = {}
      const result = selectLens(signals, 'DEFENSIVE', extractorModelId)

      expect(result.lens.id).toBe('DEFENSIVE')
      expect(result.metadata.reasonCode).toBe('USER_OVERRIDE')
      expect(result.metadata.autoApplied).toBe(false)
    })

    it('throws InvalidLensError when lens ID is invalid', () => {
      const signals: LensSignals = {}

      expect(() => selectLens(signals, 'INVALID', extractorModelId)).toThrow(InvalidLensError)
    })

    it('InvalidLensError contains valid lens IDs', () => {
      const signals: LensSignals = {}

      try {
        selectLens(signals, 'INVALID', extractorModelId)
        fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidLensError)
        const lensError = error as InvalidLensError
        expect(lensError.validLenses).toContain('ALL')
        expect(lensError.validLenses).toContain('RANGE')
        expect(lensError.validLenses).toContain('DEFENSIVE')
        expect(lensError.validLenses).toContain('MATCH')
      }
    })
  })

  describe('trigger evaluation', () => {
    it('returns ALL with NO_MATCH when no triggers match', () => {
      const signals: LensSignals = {}
      const result = selectLens(signals, undefined, extractorModelId)

      expect(result.lens.id).toBe('ALL')
      expect(result.metadata.reasonCode).toBe('NO_MATCH')
      expect(result.metadata.autoApplied).toBe(false)
    })

    it('returns matched lens with TRIGGER_MATCH when exactly one matches', () => {
      const signals: LensSignals = {
        usage_hint: { value: 'DEFENSIVE', confidence: 0.8 },
      }
      const result = selectLens(signals, undefined, extractorModelId)

      expect(result.lens.id).toBe('DEFENSIVE')
      expect(result.metadata.reasonCode).toBe('TRIGGER_MATCH')
      expect(result.metadata.autoApplied).toBe(true)
    })

    it('returns ALL with AMBIGUOUS when multiple lenses match', () => {
      const signals: LensSignals = {
        usage_hint: { value: 'RANGE', confidence: 0.8 },
        purpose: { value: 'Defense', confidence: 0.9 },
      }
      const result = selectLens(signals, undefined, extractorModelId)

      expect(result.lens.id).toBe('ALL')
      expect(result.metadata.reasonCode).toBe('AMBIGUOUS')
      expect(result.metadata.autoApplied).toBe(false)
      expect(result.metadata.ambiguous).toBe(true)
      expect(result.metadata.candidates).toBeDefined()
      expect(result.metadata.candidates!.length).toBeGreaterThan(1)
    })

    it('ambiguous candidates are sorted lexicographically', () => {
      const signals: LensSignals = {
        usage_hint: { value: 'RANGE', confidence: 0.8 },
        purpose: { value: 'Defense', confidence: 0.9 },
      }
      const result = selectLens(signals, undefined, extractorModelId)

      expect(result.metadata.candidates).toEqual([...result.metadata.candidates!].sort())
    })
  })

  describe('metadata fields', () => {
    it('includes extractorModelId', () => {
      const signals: LensSignals = {}
      const result = selectLens(signals, undefined, extractorModelId)

      expect(result.metadata.extractorModelId).toBe(extractorModelId)
    })

    it('sets canOverride to true', () => {
      const signals: LensSignals = {}
      const result = selectLens(signals, undefined, extractorModelId)

      expect(result.metadata.canOverride).toBe(true)
    })

    it('includes lens version', () => {
      const signals: LensSignals = {}
      const result = selectLens(signals, undefined, extractorModelId)

      expect(result.metadata.version).toBeDefined()
      expect(result.metadata.version.length).toBeGreaterThan(0)
    })
  })
})

describe('calculateTriggerScore', () => {
  it('returns 0 for lenses with no triggers', () => {
    const signals: LensSignals = { usage_hint: { value: 'RANGE', confidence: 0.9 } }

    expect(calculateTriggerScore(ALL_LENS, signals)).toBe(0)
  })

  it('returns highest matching confidence', () => {
    const signals: LensSignals = {
      usage_hint: { value: 'RANGE', confidence: 0.8 },
      purpose: { value: 'Target', confidence: 0.9 },
    }

    expect(calculateTriggerScore(RANGE_LENS, signals)).toBe(0.9)
  })

  it('returns 0 when no triggers match', () => {
    const signals: LensSignals = { usage_hint: { value: 'HUNTING', confidence: 0.9 } }

    expect(calculateTriggerScore(RANGE_LENS, signals)).toBe(0)
  })
})
