import { describe, expect, it } from 'vitest'
import { normalizeOffer } from '../normalize.js'
import { validateNormalizedOffer } from '../validate.js'
import type { NormalizeInput, RawScrapeOffer, ScrapePluginManifest } from '../../types.js'

const manifest: ScrapePluginManifest = {
  id: 'testsite',
  name: 'Test Site',
  owner: 'harvester',
  version: '1.2.3',
  mode: 'html',
  baseUrls: ['https://www.testsite.com'],
}

function createInput(rawOffer: Partial<RawScrapeOffer>): NormalizeInput {
  return {
    sourceId: 'source_test',
    retailerId: 'retailer_test',
    observedAt: new Date('2026-01-01T00:00:00.000Z'),
    manifest,
    rawOffer: {
      title: 'Test Ammo',
      price: 19.99,
      availability: 'IN_STOCK',
      url: 'https://www.testsite.com/product/test-ammo?utm_source=test',
      ...rawOffer,
    },
  }
}

describe('normalizeOffer', () => {
  it('normalizes price to integer cents', () => {
    const normalized = normalizeOffer(
      createInput({
        price: '$1,234.56',
      })
    )

    expect(normalized.priceCents).toBe(123456)
  })

  it('computes identity key precedence as PID > SKU > URL hash', () => {
    const withPid = normalizeOffer(
      createInput({
        retailerProductId: 'PID-1',
        retailerSku: 'SKU-1',
      })
    )
    expect(withPid.identityKey).toBe('PID:PID-1')

    const withSkuOnly = normalizeOffer(
      createInput({
        retailerSku: 'SKU-2',
      })
    )
    expect(withSkuOnly.identityKey).toBe('SKU:SKU-2')

    const withUrlFallback = normalizeOffer(createInput({}))
    expect(withUrlFallback.identityKey.startsWith('URL:')).toBe(true)
  })

  it('derives costPerRoundCents when roundCount is present', () => {
    const normalized = normalizeOffer(
      createInput({
        price: 20,
        roundCount: 50,
      })
    )

    expect(normalized.priceCents).toBe(2000)
    expect(normalized.roundCount).toBe(50)
    expect(normalized.costPerRoundCents).toBe(40)
  })
})

describe('normalize + validate fail-closed behavior', () => {
  it('drops offers with unknown availability', () => {
    const normalized = normalizeOffer(
      createInput({
        availability: 'MAYBE',
      })
    )
    const validation = validateNormalizedOffer(normalized)

    expect(validation.ok).toBe(false)
    if (validation.ok) return
    expect(validation.reason).toBe('UNKNOWN_AVAILABILITY')
  })

  it('returns explicit parse failure when price cannot be parsed', () => {
    const normalized = normalizeOffer(
      createInput({
        price: 'not-a-price',
      })
    )
    const validation = validateNormalizedOffer(normalized)

    expect(Number.isNaN(normalized.priceCents)).toBe(true)
    expect(validation.ok).toBe(false)
    if (validation.ok) return
    expect(validation.reason).toBe('PRICE_PARSE_FAILED')
  })
})
