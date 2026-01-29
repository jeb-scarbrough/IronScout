import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { sgammoAdapter } from '../adapter.js'
import type { ScrapeAdapterContext } from '../../../types.js'

const mockCtx: ScrapeAdapterContext = {
  sourceId: 'source_sgammo',
  retailerId: 'retailer_sgammo',
  runId: 'run_test',
  targetId: 'target_test',
  now: new Date('2026-01-29T00:00:00Z'),
  logger: {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
    child: () => mockCtx.logger,
  } as any,
}

describe('sgammo adapter', () => {
  describe('extract', () => {
    it('extracts in-stock product from JSON-LD', () => {
      const fixturePath = join(__dirname, 'fixtures', 'in-stock.html')
      const html = readFileSync(fixturePath, 'utf8')

      const result = sgammoAdapter.extract(
        html,
        'https://sgammo.com/product/9mm-luger-ammo/50-round-box-9mm-luger-115-grain-fmj',
        mockCtx
      )

      expect(result.ok).toBe(true)
      if (!result.ok) return

      expect(result.offer.title).toBe('50 Round Box - 9mm Luger 115 Grain FMJ Ammo')
      expect(result.offer.priceCents).toBe(1499) // $14.99
      expect(result.offer.availability).toBe('IN_STOCK')
      expect(result.offer.retailerSku).toBe('MGT-9A')
      expect(result.offer.currency).toBe('USD')
    })

    it('extracts out-of-stock product correctly', () => {
      const fixturePath = join(__dirname, 'fixtures', 'out-of-stock.html')
      const html = readFileSync(fixturePath, 'utf8')

      const result = sgammoAdapter.extract(
        html,
        'https://sgammo.com/product/300-blackout/500-round-case-300-blackout-220-grain',
        mockCtx
      )

      expect(result.ok).toBe(true)
      if (!result.ok) return

      expect(result.offer.title).toBe('500 Round Case - 300 Blackout 220 Grain OTM')
      expect(result.offer.priceCents).toBe(84875) // $848.75
      expect(result.offer.availability).toBe('OUT_OF_STOCK')
    })

    it('returns OOS_NO_PRICE when out of stock with no price', () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <script type="application/ld+json">
            {"@type":"Product","name":"Test Product","offers":{"@type":"Offer","availability":"https://schema.org/OutOfStock"}}
          </script>
        </head>
        <body>
          <h1 class="product_title">Test Product</h1>
          <p class="stock out-of-stock">Out of stock</p>
        </body>
        </html>
      `

      const result = sgammoAdapter.extract(
        html,
        'https://sgammo.com/product/test/test-product',
        mockCtx
      )

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.reason).toBe('OOS_NO_PRICE')
    })

    it('returns TITLE_NOT_FOUND when title is missing', () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <script type="application/ld+json">
            {"@type":"Product","offers":{"@type":"Offer","price":"19.99","availability":"https://schema.org/InStock"}}
          </script>
        </head>
        <body>
          <p class="stock in-stock">In stock</p>
        </body>
        </html>
      `

      const result = sgammoAdapter.extract(
        html,
        'https://sgammo.com/product/test/test-product',
        mockCtx
      )

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.reason).toBe('TITLE_NOT_FOUND')
    })

    it('returns PRICE_NOT_FOUND when in-stock but no price', () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <script type="application/ld+json">
            {"@type":"Product","name":"Test Product","offers":{"@type":"Offer","availability":"https://schema.org/InStock"}}
          </script>
        </head>
        <body>
          <h1 class="product_title">Test Product</h1>
          <p class="stock in-stock">In stock</p>
        </body>
        </html>
      `

      const result = sgammoAdapter.extract(
        html,
        'https://sgammo.com/product/test/test-product',
        mockCtx
      )

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.reason).toBe('PRICE_NOT_FOUND')
    })

    it('falls back to DOM selectors when JSON-LD is incomplete', () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <script type="application/ld+json">
            {"@type":"Product","name":"JSON Title"}
          </script>
        </head>
        <body>
          <h1 class="product_title">DOM Title</h1>
          <span class="woocommerce-Price-amount amount">$24.99</span>
          <p class="stock in-stock">150+ in stock</p>
          <span class="sku">DOM-SKU-123</span>
        </body>
        </html>
      `

      const result = sgammoAdapter.extract(
        html,
        'https://sgammo.com/product/test/test-product',
        mockCtx
      )

      expect(result.ok).toBe(true)
      if (!result.ok) return

      // Title from JSON-LD (preferred)
      expect(result.offer.title).toBe('JSON Title')
      // Price from DOM (JSON-LD didn't have it)
      expect(result.offer.priceCents).toBe(2499)
      // Availability from DOM
      expect(result.offer.availability).toBe('IN_STOCK')
      // SKU from DOM
      expect(result.offer.retailerSku).toBe('DOM-SKU-123')
    })
  })

  describe('normalize', () => {
    it('passes valid offers through', () => {
      const fixturePath = join(__dirname, 'fixtures', 'in-stock.html')
      const html = readFileSync(fixturePath, 'utf8')

      const extracted = sgammoAdapter.extract(
        html,
        'https://sgammo.com/product/9mm-luger-ammo/50-round-box-9mm-luger-115-grain-fmj',
        mockCtx
      )

      expect(extracted.ok).toBe(true)
      if (!extracted.ok) return

      const normalized = sgammoAdapter.normalize(extracted.offer, mockCtx)
      expect(normalized.status).toBe('ok')
    })
  })
})
