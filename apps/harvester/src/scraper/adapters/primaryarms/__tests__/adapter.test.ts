import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { primaryarmsAdapter } from '../adapter.js'
import type { ScrapeAdapterContext } from '../../../types.js'

const mockCtx: ScrapeAdapterContext = {
  sourceId: 'source_primaryarms',
  retailerId: 'retailer_primaryarms',
  runId: 'run_test',
  targetId: 'target_test',
  now: new Date('2026-02-02T00:00:00Z'),
  logger: {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
    child: () => mockCtx.logger,
  } as any,
}

describe('primaryarms adapter', () => {
  describe('extract', () => {
    it('extracts in-stock product from JSON payload', () => {
      const fixturePath = join(__dirname, 'fixtures', 'in-stock.json')
      const json = readFileSync(fixturePath, 'utf8')

      const result = primaryarmsAdapter.extract(
        json,
        'https://www.primaryarms.com/api/items?id=3794&fieldset=details',
        mockCtx
      )

      expect(result.ok).toBe(true)
      if (!result.ok) return

      expect(result.offer.title).toBe('PMC Ammunition X-TAC 5.56 NATO 55 gr FMJ BT - Box of 20')
      expect(result.offer.priceCents).toBe(1099)
      expect(result.offer.availability).toBe('IN_STOCK')
      expect(result.offer.retailerSku).toBe('XP193')
      expect(result.offer.retailerProductId).toBe('3794')
      expect(result.offer.identityKey).toBe('PID:3794')
      expect(result.offer.url).toBe('https://www.primaryarms.com/pmc-ammunition-x-tac-5.56-nato-55-gr-fmj-bt-box-of-20')
      expect(result.offer.upc).toBe('741569010115')
      expect(result.offer.brand).toBe('PMC')
      expect(result.offer.caliber).toBe('5.56 NATO')
      expect(result.offer.grainWeight).toBe(55)
      expect(result.offer.caseMaterial).toBe('Brass')
      expect(result.offer.roundCount).toBe(20)
    })

    it('extracts out-of-stock product from JSON payload', () => {
      const fixturePath = join(__dirname, 'fixtures', 'out-of-stock.json')
      const json = readFileSync(fixturePath, 'utf8')

      const result = primaryarmsAdapter.extract(
        json,
        'https://www.primaryarms.com/api/items?id=43375&fieldset=details',
        mockCtx
      )

      expect(result.ok).toBe(true)
      if (!result.ok) return

      expect(result.offer.title).toBe(
        'Aguila 7.62x51 NATO 150gr Full Metal Jacket Boat Tail Ammo - Box of 20'
      )
      expect(result.offer.priceCents).toBe(2999)
      expect(result.offer.availability).toBe('OUT_OF_STOCK')
      expect(result.offer.retailerSku).toBe('AGA1E762110')
      expect(result.offer.retailerProductId).toBe('43375')
      expect(result.offer.identityKey).toBe('PID:43375')
      expect(result.offer.brand).toBe('Aguila Ammunition')
      expect(result.offer.caliber).toBe('7.62X51mm')
      expect(result.offer.grainWeight).toBe(150)
      expect(result.offer.roundCount).toBe(20)
    })

    it('returns OOS_NO_PRICE when out of stock with no price', () => {
      const payload = JSON.stringify({
        items: [
          {
            isinstock: false,
            isbackorderable: false,
            ispurchasable: false,
            pagetitle: 'Test Product',
            urlcomponent: 'test-product',
            internalid: 1,
            itemid: 'SKU-1',
          },
        ],
      })

      const result = primaryarmsAdapter.extract(
        payload,
        'https://www.primaryarms.com/api/items?id=1&fieldset=details',
        mockCtx
      )

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.reason).toBe('OOS_NO_PRICE')
    })

    it('returns TITLE_NOT_FOUND when title is missing', () => {
      const payload = JSON.stringify({
        items: [
          {
            isinstock: true,
            onlinecustomerprice: 12.99,
          },
        ],
      })

      const result = primaryarmsAdapter.extract(
        payload,
        'https://www.primaryarms.com/api/items?id=2&fieldset=details',
        mockCtx
      )

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.reason).toBe('TITLE_NOT_FOUND')
    })
  })

  describe('normalize', () => {
    it('passes valid offers through', () => {
      const fixturePath = join(__dirname, 'fixtures', 'in-stock.json')
      const json = readFileSync(fixturePath, 'utf8')

      const extracted = primaryarmsAdapter.extract(
        json,
        'https://www.primaryarms.com/api/items?id=3794&fieldset=details',
        mockCtx
      )

      expect(extracted.ok).toBe(true)
      if (!extracted.ok) return

      const normalized = primaryarmsAdapter.normalize(extracted.offer, mockCtx)
      expect(normalized.status).toBe('ok')
    })
  })
})
