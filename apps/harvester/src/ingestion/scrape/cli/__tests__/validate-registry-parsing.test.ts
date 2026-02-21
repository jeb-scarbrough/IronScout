import { describe, expect, it } from 'vitest'
import { extractKnownAdapterIds, hasKnownAdapterEntry } from '../commands/validate.js'

describe('validate registry parsing', () => {
  it('finds adapter entry for both single and double quoted ids', () => {
    expect(hasKnownAdapterEntry("id: 'brownells'", 'brownells')).toBe(true)
    expect(hasKnownAdapterEntry('id: "brownells"', 'brownells')).toBe(true)
    expect(hasKnownAdapterEntry("id: 'midwayusa'", 'brownells')).toBe(false)
  })

  it('extracts ids for mixed quote styles', () => {
    const content = `
      { id: "brownells" },
      { id: 'midwayusa' },
      { id: "sgammo" },
    `

    expect(extractKnownAdapterIds(content)).toEqual(['brownells', 'midwayusa', 'sgammo'])
  })
})
