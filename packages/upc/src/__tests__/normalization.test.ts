import { describe, it, expect } from 'vitest'
import {
  normalizeUpc,
  toCanonicalUpc,
  isValidBarcode,
  VALID_BARCODE_LENGTHS,
} from '../normalization'

describe('VALID_BARCODE_LENGTHS', () => {
  it('contains exactly [8, 12, 13, 14]', () => {
    expect([...VALID_BARCODE_LENGTHS]).toEqual([8, 12, 13, 14])
  })
})

describe('isValidBarcode', () => {
  it.each([8, 12, 13, 14])('returns true for %d digits', (len) => {
    expect(isValidBarcode('1'.repeat(len))).toBe(true)
  })

  it.each([0, 3, 5, 7, 9, 10, 11, 15, 20])('returns false for %d digits', (len) => {
    expect(isValidBarcode('1'.repeat(len))).toBe(false)
  })
})

describe('normalizeUpc', () => {
  describe('valid lengths preserved with leading zeros', () => {
    it('preserves 8-digit code (UPC-E)', () => {
      expect(normalizeUpc('01234567')).toBe('01234567')
    })

    it('preserves 12-digit code (UPC-A)', () => {
      expect(normalizeUpc('020892215513')).toBe('020892215513')
    })

    it('preserves 13-digit code (EAN-13)', () => {
      expect(normalizeUpc('0012345678905')).toBe('0012345678905')
    })

    it('preserves 14-digit code (GTIN-14)', () => {
      expect(normalizeUpc('00012345678905')).toBe('00012345678905')
    })
  })

  describe('strips non-digit characters', () => {
    it('strips hyphens', () => {
      expect(normalizeUpc('0-12345-67890-1')).toBe('012345678901')
    })

    it('strips spaces', () => {
      expect(normalizeUpc('012 345 678 901')).toBe('012345678901')
    })

    it('strips mixed separators', () => {
      expect(normalizeUpc('0 1234-5678 901')).toBe('012345678901')
    })
  })

  describe('rejects invalid lengths', () => {
    it.each([3, 5, 7, 9, 10, 11, 15, 20])('rejects %d-digit string', (len) => {
      expect(normalizeUpc('1'.repeat(len))).toBeNull()
    })
  })

  describe('rejects garbage input', () => {
    it('returns null for null', () => {
      expect(normalizeUpc(null)).toBeNull()
    })

    it('returns null for undefined', () => {
      expect(normalizeUpc(undefined)).toBeNull()
    })

    it('returns null for empty string', () => {
      expect(normalizeUpc('')).toBeNull()
    })

    it('returns null for all-alpha string', () => {
      expect(normalizeUpc('ABCDEFGHIJKL')).toBeNull()
    })

    it('returns null for "N/A"', () => {
      expect(normalizeUpc('N/A')).toBeNull()
    })
  })
})

describe('toCanonicalUpc', () => {
  describe('padding behavior', () => {
    it('pads 8-digit UPC-E to 12 digits', () => {
      expect(toCanonicalUpc('01234567')).toBe('000001234567')
    })

    it('passes through 12-digit UPC-A unchanged', () => {
      expect(toCanonicalUpc('020892215513')).toBe('020892215513')
    })

    it('passes through 13-digit EAN-13 unchanged', () => {
      expect(toCanonicalUpc('0012345678905')).toBe('0012345678905')
    })

    it('passes through 14-digit GTIN-14 unchanged', () => {
      expect(toCanonicalUpc('00012345678905')).toBe('00012345678905')
    })
  })

  describe('strips non-digits before padding', () => {
    it('strips hyphens then pads', () => {
      expect(toCanonicalUpc('0-1234567')).toBe('000001234567')
    })
  })

  describe('rejects invalid lengths before padding', () => {
    it.each([3, 5, 9, 10, 11, 15])('rejects %d-digit string', (len) => {
      expect(toCanonicalUpc('1'.repeat(len))).toBeNull()
    })
  })

  describe('rejects garbage input', () => {
    it('returns null for null', () => {
      expect(toCanonicalUpc(null)).toBeNull()
    })

    it('returns null for undefined', () => {
      expect(toCanonicalUpc(undefined)).toBeNull()
    })

    it('returns null for empty string', () => {
      expect(toCanonicalUpc('')).toBeNull()
    })
  })
})
