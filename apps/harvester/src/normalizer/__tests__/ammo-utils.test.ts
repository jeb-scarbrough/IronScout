import { describe, it, expect } from 'vitest'
import { normalizeCaliberString } from '../ammo-utils'

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
})
