import { describe, expect, it } from 'vitest'
import { validateScrapeConfig } from '../validate.js'

describe('validateScrapeConfig', () => {
  it('accepts known fields and reports unknown top-level keys', () => {
    const result = validateScrapeConfig({
      fetcherType: 'http',
      rateLimit: {
        requestsPerSecond: 1,
        minDelayMs: 500,
        maxConcurrent: 1,
      },
      customHeaders: {
        Accept: 'application/json',
      },
      discovery: {
        productPathPrefix: '/ammo/',
      },
      extraFlag: true,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.unknownTopLevelKeys).toEqual(['extraFlag'])
  })

  it('fails for invalid rateLimit values', () => {
    const result = validateScrapeConfig({
      rateLimit: {
        requestsPerSecond: 0,
      },
    })

    expect(result.ok).toBe(false)
    if (result.ok) {
      return
    }
    expect(result.error).toContain('requestsPerSecond')
  })

  it('fails when customHeaders contain non-string values', () => {
    const result = validateScrapeConfig({
      customHeaders: {
        Accept: 'text/html',
        Age: 42,
      },
    })

    expect(result.ok).toBe(false)
    if (result.ok) {
      return
    }
    expect(result.error).toContain('customHeaders')
  })
})
