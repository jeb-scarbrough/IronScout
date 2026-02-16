import { describe, it, expect, vi } from 'vitest'

vi.mock('@ironscout/db', () => ({
  prisma: {},
}))

import { normalizeUpcForLookup } from '../upc-lookup'

describe('normalizeUpcForLookup', () => {
  it('preserves valid 12-digit UPC-A', () => {
    expect(normalizeUpcForLookup('020892215513')).toBe('020892215513')
  })

  it('pads 8-digit UPC-E to canonical 12-digit form', () => {
    expect(normalizeUpcForLookup('01234567')).toBe('000001234567')
  })

  it('strips separators before canonicalization', () => {
    expect(normalizeUpcForLookup('0-12345-67890-1')).toBe('012345678901')
  })

  it('rejects invalid lengths', () => {
    expect(normalizeUpcForLookup('12345678901')).toBeNull()
  })
})
