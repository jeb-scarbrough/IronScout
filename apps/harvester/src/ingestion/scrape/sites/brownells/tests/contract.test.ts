import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { deterministicHash } from '../../../kit/fixtures.js'
import type { RawScrapeOffer } from '../../../types.js'
import { plugin } from '../index.js'

const observedAt = new Date('2026-02-01T00:00:00.000Z')

function readFixture(name: string): string {
  return readFileSync(join(__dirname, `../fixtures/${name}`), 'utf8')
}

function selectOfferBySku(offers: RawScrapeOffer[], sku: string): RawScrapeOffer | undefined {
  return offers.find(offer => offer.retailerSku === sku || offer.retailerProductId === sku)
}

describe('brownells contract', () => {
  it('in-stock fixture yields normalized offer', () => {
    const payload = readFixture('in-stock.html')
    const extracted = plugin.extractRaw(
      payload,
      'https://www.brownells.com/ammunition/shotgun-ammunition/top-gun-light-ammo-12-gauge-2-34-1-18-oz-8-shot/'
    )

    expect(extracted.ok).toBe(true)
    if (!extracted.ok) return

    const selected = selectOfferBySku(extracted.rawOffers, '105054062') ?? extracted.rawOffers[0]
    expect(selected).toBeDefined()
    if (!selected) return

    const normalized = plugin.normalizeRaw({
      sourceId: 'source_test',
      retailerId: 'retailer_test',
      observedAt,
      rawOffer: selected,
      manifest: plugin.manifest,
    })

    expect(normalized.status).toBe('ok')
    if (normalized.status !== 'ok') return
    expect(normalized.offer.priceCents).toBe(10299)
    expect(normalized.offer.availability).toBe('IN_STOCK')
    expect(normalized.offer.identityKey).toBe('SKU:105054062')
    expect(normalized.offer.shippingCents).toBe(699)
    expect(normalized.offer.costPerRoundCents).toBeUndefined()
  })

  it('out-of-stock fixture yields normalized offer', () => {
    const payload = readFixture('out-of-stock.html')
    const extracted = plugin.extractRaw(
      payload,
      'https://www.brownells.com/ammunition/handgun-ammunition/blazer-brass-9mm-luger-handgun-ammo/'
    )

    expect(extracted.ok).toBe(true)
    if (!extracted.ok) return

    const selected = selectOfferBySku(extracted.rawOffers, '105002704') ?? extracted.rawOffers[0]
    expect(selected).toBeDefined()
    if (!selected) return

    const normalized = plugin.normalizeRaw({
      sourceId: 'source_test',
      retailerId: 'retailer_test',
      observedAt,
      rawOffer: selected,
      manifest: plugin.manifest,
    })

    expect(normalized.status).toBe('ok')
    if (normalized.status !== 'ok') return
    expect(normalized.offer.priceCents).toBe(22999)
    expect(normalized.offer.availability).toBe('OUT_OF_STOCK')
    expect(normalized.offer.identityKey).toBe('SKU:105002704')
    expect(normalized.offer.shippingCents).toBe(699)
    expect(normalized.offer.costPerRoundCents).toBeUndefined()
  })

  it('normalized output hash is deterministic', () => {
    const payload = readFixture('in-stock.html')
    const extracted = plugin.extractRaw(
      payload,
      'https://www.brownells.com/ammunition/shotgun-ammunition/top-gun-light-ammo-12-gauge-2-34-1-18-oz-8-shot/'
    )

    expect(extracted.ok).toBe(true)
    if (!extracted.ok) return

    const normalizedOffers = extracted.rawOffers
      .map(rawOffer =>
        plugin.normalizeRaw({
          sourceId: 'source_test',
          retailerId: 'retailer_test',
          observedAt,
          rawOffer,
          manifest: plugin.manifest,
        })
      )
      .filter(result => result.status === 'ok')
      .map(result => result.offer)

    expect(normalizedOffers.length).toBeGreaterThan(0)
    expect(deterministicHash(normalizedOffers)).toBe(
      '16677f9befdbe5f80282937244582b9b66717fdaeb3dd91d13ca6408b92fe91d'
    )
  })

  it('malformed fixture fails with explicit reason', () => {
    const payload = readFixture('malformed.html')
    const extracted = plugin.extractRaw(payload, 'https://www.brownells.com/ammunition/example/')

    expect(extracted.ok).toBe(false)
    if (extracted.ok) return
    expect(extracted.reason).toBe('PAGE_STRUCTURE_CHANGED')
  })

  it('multi-offer fixture returns deterministic raw offers', () => {
    const payload = readFixture('out-of-stock.html')
    const extracted = plugin.extractRaw(
      payload,
      'https://www.brownells.com/ammunition/handgun-ammunition/blazer-brass-9mm-luger-handgun-ammo/'
    )

    expect(extracted.ok).toBe(true)
    if (!extracted.ok) return
    expect(extracted.rawOffers.length).toBeGreaterThan(1)
    expect(extracted.rawOffers[0]?.retailerSku).toBe('105002704')
  })
})
