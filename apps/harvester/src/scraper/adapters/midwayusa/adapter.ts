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
  offers?: JsonLdOffer | JsonLdOffer[]
}

interface JsonLdOffer {
  '@type'?: string
  price?: string | number
  priceCurrency?: string
  availability?: string
  url?: string
}

interface JsonLdProductGroup {
  '@type'?: string
  name?: string
  productGroupID?: string
  sku?: string
  brand?: { '@type'?: string; name?: string }
  image?: string
  offers?: {
    '@type'?: string
    lowPrice?: string | number
    highPrice?: string | number
    availability?: string
    priceCurrency?: string
    url?: string
  }
  hasVariant?: JsonLdProduct | JsonLdProduct[]
}

interface JsonLdExtractResult {
  product: JsonLdProduct | null
  details?: string
}

function normalizeOffers(offers: JsonLdProduct['offers']): JsonLdOffer[] {
  if (!offers) return []
  return Array.isArray(offers) ? offers : [offers]
}

function getPidFromUrl(url: string): string | null {
  try {
    return new URL(url).searchParams.get('pid')
  } catch {
    return null
  }
}

function offerMatchesPid(offer: JsonLdOffer | undefined, pid: string): boolean {
  if (!offer?.url) return false
  try {
    return new URL(offer.url).searchParams.get('pid') === pid
  } catch {
    return false
  }
}

function productMatchesPid(product: JsonLdProduct, pid: string): boolean {
  if (product.sku?.trim() === pid) return true
  const offers = normalizeOffers(product.offers)
  return offers.some(offer => offerMatchesPid(offer, pid))
}

function selectOffer(offers: JsonLdOffer[]): JsonLdOffer | null {
  if (offers.length === 0) return null
  return offers.find(offer => offer.price !== undefined) ?? offers[0] ?? null
}

function extractJsonLdProduct(html: string, url: string): JsonLdExtractResult {
  const $ = cheerio.load(html)
  const scripts = $('script[type="application/ld+json"]')

  const pid = getPidFromUrl(url)
  let product: JsonLdProduct | null = null
  let sawProductGroup = false
  let maxVariantCount = 0

  const trySelectFromGroup = (group: JsonLdProductGroup): JsonLdProduct | null => {
    sawProductGroup = true
    const variants = Array.isArray(group.hasVariant)
      ? group.hasVariant
      : group.hasVariant
        ? [group.hasVariant]
        : []

    maxVariantCount = Math.max(maxVariantCount, variants.length)

    if (variants.length === 0) return null

    if (pid) {
      const match = variants.find(variant => productMatchesPid(variant, pid))
      return match ?? null
    }

    if (variants.length === 1) {
      return variants[0]
    }

    return null
  }

  const trySelectFromObject = (item: unknown): JsonLdProduct | null => {
    if (!item || typeof item !== 'object') return null
    const typed = item as { '@type'?: string }
    if (typed['@type'] === 'Product') {
      return item as JsonLdProduct
    }
    if (typed['@type'] === 'ProductGroup') {
      return trySelectFromGroup(item as JsonLdProductGroup)
    }
    return null
  }

  scripts.each((_i, el) => {
    if (product) return

    try {
      const raw = $(el).text().trim()
      if (!raw) return

      const parsed = JSON.parse(raw) as unknown

      // MidwayUSA wraps JSON-LD in an array
      const items = Array.isArray(parsed) ? parsed : [parsed]

      for (const item of items) {
        const picked = trySelectFromObject(item)
        if (picked) {
          product = picked
          return
        }

        const graph = item && typeof item === 'object' ? (item as { '@graph'?: unknown })['@graph'] : undefined
        if (Array.isArray(graph)) {
          const graphItems = graph as unknown[]
          for (const graphItem of graphItems) {
            const graphPicked = trySelectFromObject(graphItem)
            if (graphPicked) {
              product = graphPicked
              return
            }
          }
        }
      }
    } catch {
      // Ignore malformed JSON-LD blocks
    }
  })

  if (product) {
    return { product }
  }

  if (sawProductGroup) {
    if (maxVariantCount === 0) {
      return { product: null, details: 'ProductGroup missing variants' }
    }
    if (!pid && maxVariantCount > 1) {
      return { product: null, details: 'ProductGroup requires pid to select variant' }
    }
    if (pid) {
      return { product: null, details: `ProductGroup variant not found for pid=${pid}` }
    }
  }

  return { product: null, details: 'No JSON-LD Product found' }
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
    const { product, details } = extractJsonLdProduct(html, url)
    if (!product) {
      return { ok: false, reason: 'PAGE_STRUCTURE_CHANGED', details }
    }

    const title = product.name?.trim()
    if (!title) {
      return { ok: false, reason: 'TITLE_NOT_FOUND' }
    }

    const offers = normalizeOffers(product.offers)
    const selectedOffer = selectOffer(offers)
    const availability = resolveAvailability(selectedOffer?.availability)

    const priceCents = parsePriceToCents(selectedOffer?.price)
    if (priceCents === null) {
      if (availability === 'OUT_OF_STOCK') {
        return { ok: false, reason: 'OOS_NO_PRICE' }
      }
      return { ok: false, reason: 'PRICE_NOT_FOUND' }
    }

    const canonicalUrl = canonicalizeUrl(url)
    const pid = getPidFromUrl(url)
    const retailerSku = product.sku?.trim() || undefined
    const retailerProductId = pid?.trim() || product.inProductGroupWithID?.trim() || undefined
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
