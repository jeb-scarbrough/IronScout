import { describe, expect, it } from 'vitest'
import {
  deterministicHash,
  evaluateFixtureFreshness,
  validateFixtureMeta,
} from '../fixtures.js'

describe('deterministicHash', () => {
  it('normalizes object key order and offer array order', () => {
    const a = [
      { url: 'https://example.com/b', retailerSku: '2', retailerProductId: 'b' },
      { url: 'https://example.com/a', retailerSku: '1', retailerProductId: 'a' },
    ]
    const b = [
      { retailerProductId: 'a', retailerSku: '1', url: 'https://example.com/a' },
      { retailerProductId: 'b', retailerSku: '2', url: 'https://example.com/b' },
    ]

    expect(deterministicHash(a)).toBe(deterministicHash(b))
  })

  it('excludes observedAt by default to avoid timestamp drift in fixture hashes', () => {
    const first = [{ url: 'https://example.com/p/1', observedAt: '2026-01-01T00:00:00.000Z' }]
    const second = [{ url: 'https://example.com/p/1', observedAt: '2026-02-01T00:00:00.000Z' }]

    expect(deterministicHash(first)).toBe(deterministicHash(second))
  })
})

describe('fixture freshness', () => {
  it('validates fixture metadata shape', () => {
    const valid = validateFixtureMeta({
      capturedAt: '2026-02-01T00:00:00.000Z',
      capturedFrom: 'https://example.com/p/1',
      capturedBy: 'scraper:add',
      notes: 'fixture capture',
    })

    expect(valid.ok).toBe(true)
  })

  it('warns when metadata exceeds warning threshold', () => {
    const freshness = evaluateFixtureFreshness(
      {
        capturedAt: '2025-09-01T00:00:00.000Z',
        capturedFrom: 'https://example.com/p/1',
        capturedBy: 'scraper:add',
        notes: 'fixture capture',
      },
      {
        now: new Date('2026-01-01T00:00:00.000Z'),
        warnAfterDays: 90,
      }
    )

    expect(freshness.ok).toBe(true)
    if (!freshness.ok) return
    expect(freshness.status).toBe('warn')
  })

  it('fails in strict mode when metadata exceeds failure threshold', () => {
    const freshness = evaluateFixtureFreshness(
      {
        capturedAt: '2025-01-01T00:00:00.000Z',
        capturedFrom: 'https://example.com/p/1',
        capturedBy: 'scraper:add',
        notes: 'fixture capture',
      },
      {
        now: new Date('2026-01-01T00:00:00.000Z'),
        failAfterDays: 180,
        strict: true,
      }
    )

    expect(freshness.ok).toBe(false)
    if (freshness.ok) return
    expect(freshness.status).toBe('fail')
  })
})
