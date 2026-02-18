import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { brownellsAdapter } from '../adapter.js'

const ctx = {
  sourceId: 'source_test',
  retailerId: 'retailer_test',
  runId: 'run_test',
  targetId: 'target_test',
  now: new Date('2026-01-01T00:00:00Z'),
  logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {}, fatal: () => {}, child: () => ctx.logger },
} as const

describe('brownells adapter', () => {
  it('extracts in-stock fixture', () => {
    const fixturePath = join(__dirname, 'fixtures', 'in-stock.html')
    const html = readFileSync(fixturePath, 'utf8')

    const extracted = brownellsAdapter.extract(
      html,
      'https://www.brownells.com/ammunition/shotgun-ammunition/top-gun-light-ammo-12-gauge-2-34-1-18-oz-8-shot/',
      ctx
    )
    if (!extracted.ok) {
      throw new Error(`extract failed: ${extracted.reason} ${extracted.details ?? ''}`)
    }

    expect(extracted.offer.priceCents).toBe(10299)
    expect(extracted.offer.availability).toBe('IN_STOCK')
    expect(extracted.offer.retailerSku).toBe('105054062')
    expect(extracted.offer.retailerProductId).toBeUndefined()

    const normalized = brownellsAdapter.normalize(extracted.offer, ctx)
    expect(normalized.status).toBe('ok')
  })

  it('extracts sku-specific offer when sku query param is present', () => {
    const fixturePath = join(__dirname, 'fixtures', 'in-stock.html')
    const html = readFileSync(fixturePath, 'utf8')

    const extracted = brownellsAdapter.extract(
      html,
      'https://www.brownells.com/ammunition/shotgun-ammunition/top-gun-light-ammo-12-gauge-2-34-1-18-oz-8-shot/?sku=105200890',
      ctx
    )
    if (!extracted.ok) {
      throw new Error(`extract failed: ${extracted.reason} ${extracted.details ?? ''}`)
    }

    expect(extracted.offer.priceCents).toBe(1099)
    expect(extracted.offer.availability).toBe('IN_STOCK')
    expect(extracted.offer.retailerSku).toBe('105200890')
    expect(extracted.offer.retailerProductId).toBe('105200890')

    const normalized = brownellsAdapter.normalize(extracted.offer, ctx)
    expect(normalized.status).toBe('ok')
  })

  it('extracts out-of-stock fixture', () => {
    const fixturePath = join(__dirname, 'fixtures', 'out-of-stock.html')
    const html = readFileSync(fixturePath, 'utf8')

    const extracted = brownellsAdapter.extract(
      html,
      'https://www.brownells.com/ammunition/handgun-ammunition/blazer-brass-9mm-luger-handgun-ammo/',
      ctx
    )
    if (!extracted.ok) {
      throw new Error(`extract failed: ${extracted.reason} ${extracted.details ?? ''}`)
    }

    expect(extracted.offer.priceCents).toBe(22999)
    expect(extracted.offer.availability).toBe('OUT_OF_STOCK')
    expect(extracted.offer.retailerSku).toBe('105002704')

    const normalized = brownellsAdapter.normalize(extracted.offer, ctx)
    expect(normalized.status).toBe('ok')
  })

  it('fails closed when JSON-LD Product is missing', () => {
    const extracted = brownellsAdapter.extract(
      '<html><body><h1>No Product Schema</h1></body></html>',
      'https://www.brownells.com/ammunition/example',
      ctx
    )
    expect(extracted.ok).toBe(false)
    if (!extracted.ok) {
      expect(extracted.reason).toBe('PAGE_STRUCTURE_CHANGED')
    }
  })

  it('maps Discontinued availability to OUT_OF_STOCK', () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Product",
              "name": "Discontinued Test Ammo",
              "offers": [
                {
                  "@type": "Offer",
                  "availability": "https://schema.org/Discontinued",
                  "price": 19.99,
                  "priceCurrency": "USD",
                  "sku": "DISC-001"
                }
              ]
            }
          </script>
        </head>
        <body></body>
      </html>
    `

    const extracted = brownellsAdapter.extract(
      html,
      'https://www.brownells.com/ammunition/handgun-ammunition/discontinued-test-ammo/',
      ctx
    )
    if (!extracted.ok) {
      throw new Error(`extract failed: ${extracted.reason} ${extracted.details ?? ''}`)
    }

    expect(extracted.offer.availability).toBe('OUT_OF_STOCK')
    expect(extracted.offer.priceCents).toBe(1999)

    const normalized = brownellsAdapter.normalize(extracted.offer, ctx)
    expect(normalized.status).toBe('ok')
  })
})
