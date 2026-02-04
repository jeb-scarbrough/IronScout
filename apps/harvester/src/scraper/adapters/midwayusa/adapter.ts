/**
 * MidwayUSA Adapter
 *
 * MidwayUSA embeds product data in JSON-LD structured data within the HTML.
 * This adapter extracts from the JSON-LD Product object rather than CSS selectors,
 * since price and availability are loaded dynamically via React.
 */

import * as cheerio from 'cheerio'
import type { ScrapeAdapter, ExtractResult, ScrapedOffer, NormalizeResult } from '../../types.js'
import { validateOffer } from '../../process/validator.js'
import { canonicalizeUrl, generateIdentityKey } from '../../utils/url.js'

const ADAPTER_ID = 'midwayusa'
const ADAPTER_VERSION = '1.0.0'
const ADAPTER_DOMAIN = 'midwayusa.com'

interface JsonLdProduct {
  '@type'?: string
  name?: string
  sku?: string
  mpn?: string
  image?: string
  inProductGroupWithID?: string
  brand?: { '@type'?: string; name?: string }
  offers?: {
    '@type'?: string
    price?: string | number
    priceCurrency?: string
    availability?: string
  }
}

function extractJsonLdProduct(html: string): JsonLdProduct | null {
  const $ = cheerio.load(html)
  const scripts = $('script[type="application/ld+json"]')

  let product: JsonLdProduct | null = null

  scripts.each((_i, el) => {
    if (product) return

    try {
      const raw = $(el).text().trim()
      if (!raw) return

      const parsed = JSON.parse(raw) as unknown

      // MidwayUSA wraps JSON-LD in an array
      const items = Array.isArray(parsed) ? parsed : [parsed]

      for (const item of items) {
        if (item && typeof item === 'object' && '@type' in item && (item as JsonLdProduct)['@type'] === 'Product') {
          product = item as JsonLdProduct
          return
        }
      }
    } catch {
      // Ignore malformed JSON-LD blocks
    }
  })

  return product
}

function parsePriceToCents(value: string | number | undefined | null): number | null {
  if (value === undefined || value === null) return null

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return null
    return Math.round(value * 100)
  }

  const cleaned = value.replace(/[$,]/g, '').trim()
  const parsed = Number(cleaned)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return Math.round(parsed * 100)
}

function resolveAvailability(schemaUrl: string | undefined): ScrapedOffer['availability'] {
  if (!schemaUrl) return 'UNKNOWN'

  const lower = schemaUrl.toLowerCase()
  if (lower.includes('instock')) return 'IN_STOCK'
  if (lower.includes('outofstock')) return 'OUT_OF_STOCK'
  if (lower.includes('backorder') || lower.includes('preorder')) return 'BACKORDER'
  return 'UNKNOWN'
}

export const midwayusaAdapter: ScrapeAdapter = {
  id: ADAPTER_ID,
  version: ADAPTER_VERSION,
  domain: ADAPTER_DOMAIN,
  requiresJsRendering: false,

  extract(html: string, url: string, ctx): ExtractResult {
    const product = extractJsonLdProduct(html)
    if (!product) {
      return { ok: false, reason: 'PAGE_STRUCTURE_CHANGED', details: 'No JSON-LD Product found' }
    }

    const title = product.name?.trim()
    if (!title) {
      return { ok: false, reason: 'TITLE_NOT_FOUND' }
    }

    const availability = resolveAvailability(product.offers?.availability)

    const priceCents = parsePriceToCents(product.offers?.price)
    if (priceCents === null) {
      if (availability === 'OUT_OF_STOCK') {
        return { ok: false, reason: 'OOS_NO_PRICE' }
      }
      return { ok: false, reason: 'PRICE_NOT_FOUND' }
    }

    const canonicalUrl = canonicalizeUrl(url)
    const retailerSku = product.sku?.trim() || undefined
    const retailerProductId = product.inProductGroupWithID?.trim() || undefined
    const upc = product.mpn?.trim() || undefined
    const brand = product.brand?.name?.trim() || undefined
    const imageUrl = product.image?.trim() || undefined

    const identityKey = generateIdentityKey(retailerProductId, retailerSku, canonicalUrl)

    const offer: ScrapedOffer = {
      sourceId: ctx.sourceId,
      retailerId: ctx.retailerId,
      url: canonicalUrl,
      title,
      priceCents,
      currency: 'USD',
      availability,
      observedAt: ctx.now,
      identityKey,
      retailerSku,
      retailerProductId,
      upc: upc || undefined,
      brand: brand || undefined,
      imageUrl: imageUrl || undefined,
      adapterVersion: ADAPTER_VERSION,
    }

    return { ok: true, offer }
  },

  normalize(offer: ScrapedOffer): NormalizeResult {
    return validateOffer(offer)
  },
}
