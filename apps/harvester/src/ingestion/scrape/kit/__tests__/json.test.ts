import { describe, expect, it } from 'vitest'
import { safeJsonParse } from '../json.js'

describe('safeJsonParse', () => {
  it('parses valid JSON objects', () => {
    const parsed = safeJsonParse<{ id: string }>('{"id":"brownells"}')
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.value.id).toBe('brownells')
  })

  it('returns structured error for malformed JSON', () => {
    const parsed = safeJsonParse('{"id":')
    expect(parsed.ok).toBe(false)
    if (parsed.ok) return
    expect(parsed.error.length).toBeGreaterThan(0)
  })
})
