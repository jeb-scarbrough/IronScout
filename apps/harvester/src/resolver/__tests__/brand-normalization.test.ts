import { describe, it, expect } from 'vitest'
import { normalizeBrandString } from '../brand-normalization'

describe('normalizeBrandString', () => {
  it('strips trademark symbols but preserves real letters', () => {
    expect(normalizeBrandString(`Taurus\u2122`)).toBe('taurus')
    expect(normalizeBrandString(`Remington\u00AE`)).toBe('remington')
    expect(normalizeBrandString(`CCI\u00A9`)).toBe('cci')
    expect(normalizeBrandString('Winchester')).toBe('winchester')
  })

  it('removes tm/r/c parenthetical markers', () => {
    expect(normalizeBrandString('Federal (TM)')).toBe('federal')
    expect(normalizeBrandString('Hornady (r)')).toBe('hornady')
    expect(normalizeBrandString('Nosler (c)')).toBe('nosler')
  })
})
