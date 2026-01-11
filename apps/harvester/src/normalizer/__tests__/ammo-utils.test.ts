import { describe, it, expect } from 'vitest'
import { normalizeCaliberString, extractGrainWeight } from '../ammo-utils'

describe('extractGrainWeight', () => {
  it('extracts integer grain weight', () => {
    expect(extractGrainWeight('Federal 9mm 115gr FMJ')).toBe(115)
    expect(extractGrainWeight('Winchester 55 grain FMJ')).toBe(55)
  })

  it('extracts decimal grain weight', () => {
    expect(extractGrainWeight('Hornady .17 HMR 15.5gr V-MAX')).toBe(15.5)
    expect(extractGrainWeight('CCI 17.5 grain polymer tip')).toBe(17.5)
  })

  it('rejects grain outside valid range', () => {
    expect(extractGrainWeight('Test 10gr tiny')).toBeNull() // too small
    expect(extractGrainWeight('Test 900gr huge')).toBeNull() // too large
  })

  it('does not extract shotgun oz as grain', () => {
    // "1oz" should not be parsed as grain
    expect(extractGrainWeight('Federal 12ga 1oz slug')).toBeNull()
  })
})

describe('normalizeCaliberString', () => {
  it('normalizes 5.56mm NATO', () => {
    const result = normalizeCaliberString('Winchester USA 5.56mm NATO 55gr M193 FMJ')
    expect(result).toBe('5.56 NATO')
  })

  it('normalizes 5.56 without NATO suffix', () => {
    const result = normalizeCaliberString('Lake City M855 Green Tip 5.56 - 62 Grain Penetrator')
    expect(result).toBe('5.56 NATO')
  })

  it('normalizes 5.56x45mm', () => {
    const result = normalizeCaliberString('5.56x45mm')
    expect(result).toBe('5.56 NATO')
  })

  it('normalizes .357 SIG', () => {
    const result = normalizeCaliberString('Federal .357 SIG 125gr FMJ')
    expect(result).toBe('.357 SIG')
  })

  it('normalizes 7.62x39mm', () => {
    const result = normalizeCaliberString('7.62x39mm 123gr FMJ')
    expect(result).toBe('7.62x39mm')
  })
})
