/**
 * SGAmmo Adapter
 *
 * Per scraper-framework-01 spec v0.5
 *
 * SGAmmo is a WooCommerce-based ammunition retailer.
 * Extraction strategy:
 * 1. Parse JSON-LD schema (most reliable, contains all required fields)
 * 2. Fall back to DOM selectors if JSON-LD is missing/incomplete
 */

import * as cheerio from 'cheerio'
import type { ScrapeAdapter, ExtractResult, ScrapedOffer, NormalizeResult, ScrapeAdapterContext } from '../../types.js'
import { validateOffer } from '../../process/validator.js'
import { canonicalizeUrl, generateIdentityKey } from '../../utils/url.js'
import { SELECTORS, SCHEMA_AVAILABILITY } from './selectors.js'

const ADAPTER_ID = 'sgammo'
const ADAPTER_VERSION = '1.0.0'
const ADAPTER_DOMAIN = 'sgammo.com'

/**
 * JSON-LD Product schema structure (partial, fields we use)
 */
interface JsonLdProduct {
  '@type': 'Product'
  name?: string
  sku?: string
  image?: string | string[]
  offers?: JsonLdOffer | JsonLdOffer[]
}

interface JsonLdOffer {
  '@type'?: 'Offer' | string
  price?: string | number
  priceCurrency?: string
  availability?: string
  url?: string
  priceSpecification?: JsonLdPriceSpecification | JsonLdPriceSpecification[]
}

interface JsonLdPriceSpecification {
  price?: string | number
}

/**
 * Extract JSON-LD product data from the page.
 */
function extractJsonLd($: cheerio.CheerioAPI): JsonLdProduct | null {
  const scripts = $(SELECTORS.jsonLd)

  for (let i = 0; i < scripts.length; i++) {
    const script = scripts.eq(i)
    const content = script.html()
    if (!content) continue

    try {
      const data = JSON.parse(content)

      // Handle array root
      if (Array.isArray(data)) {
        for (const item of data) {
          if (item && item['@graph'] && Array.isArray(item['@graph'])) {
            const product = item['@graph'].find(
              (graphItem: { '@type'?: string }) => graphItem['@type'] === 'Product'
            )
            if (product) return product as JsonLdProduct
          }

          if (item && item['@type'] === 'Product') {
            return item as JsonLdProduct
          }
        }
      }

      // Handle @graph array (WooCommerce often wraps in graph)
      if (data['@graph'] && Array.isArray(data['@graph'])) {
        const product = data['@graph'].find(
          (item: { '@type'?: string }) => item['@type'] === 'Product'
        )
        if (product) return product as JsonLdProduct
      }

      // Direct Product object
      if (data['@type'] === 'Product') {
        return data as JsonLdProduct
      }
    } catch {
      // Invalid JSON, try next script
      continue
    }
  }

  return null
}

function normalizeJsonLdOffers(offers: JsonLdProduct['offers']): JsonLdOffer[] {
  if (!offers) return []
  return Array.isArray(offers) ? offers : [offers]
}

function extractPriceFromJsonLdOffers(offers: JsonLdOffer[]): number | null {
  for (const offer of offers) {
    const priceFromOffer = parsePriceToCents(offer.price)
    if (priceFromOffer !== null) return priceFromOffer

    if (offer.priceSpecification) {
      const specs = Array.isArray(offer.priceSpecification)
        ? offer.priceSpecification
        : [offer.priceSpecification]

      for (const spec of specs) {
        const priceFromSpec = parsePriceToCents(spec?.price)
        if (priceFromSpec !== null) return priceFromSpec
      }
    }
  }

  return null
}

function extractAvailabilityFromJsonLdOffers(offers: JsonLdOffer[]): string | undefined {
  for (const offer of offers) {
    if (offer.availability) return offer.availability
  }

  return undefined
}

/**
 * Parse price string to cents.
 * Handles formats like "$32.95", "32.95", "$1,234.56"
 */
function parsePriceToCents(priceStr: string | number | undefined): number | null {
  if (priceStr === undefined || priceStr === null) return null

  const str = String(priceStr)
  // Remove currency symbols and commas, extract numeric value
  const cleaned = str.replace(/[$,]/g, '').trim()
  const match = cleaned.match(/^(\d+(?:\.\d{1,2})?)$/)

  if (!match) return null

  const value = parseFloat(match[1]!)
  if (!Number.isFinite(value) || value <= 0) return null

  // Convert to cents
  return Math.round(value * 100)
}

/**
 * Map schema.org availability to our Availability type.
 */
function mapSchemaAvailability(availability: string | undefined): ScrapedOffer['availability'] {
  if (!availability) return 'UNKNOWN'

  if (availability === SCHEMA_AVAILABILITY.inStock) {
    return 'IN_STOCK'
  }
  if (availability === SCHEMA_AVAILABILITY.outOfStock) {
    return 'OUT_OF_STOCK'
  }
  if (availability === SCHEMA_AVAILABILITY.backOrder || availability === SCHEMA_AVAILABILITY.preOrder) {
    return 'BACKORDER'
  }

  return 'UNKNOWN'
}

/**
 * Extract availability from DOM if JSON-LD is missing.
 */
function extractAvailabilityFromDom($: cheerio.CheerioAPI): ScrapedOffer['availability'] {
  // Check for in-stock indicator
  if ($(SELECTORS.inStock).length > 0) {
    return 'IN_STOCK'
  }

  // Check for out-of-stock indicator
  if ($(SELECTORS.outOfStock).length > 0) {
    return 'OUT_OF_STOCK'
  }

  // Check for "Out of stock" text in stock elements
  const stockText = $('.stock').text().toLowerCase()
  if (stockText.includes('out of stock')) {
    return 'OUT_OF_STOCK'
  }
  if (stockText.includes('in stock')) {
    return 'IN_STOCK'
  }

  return 'UNKNOWN'
}

/**
 * Extract price from DOM if JSON-LD is missing.
 */
function extractPriceFromDom($: cheerio.CheerioAPI): number | null {
  const priceEl = $(SELECTORS.price).first()
  if (priceEl.length === 0) return null

  // Get text, handle WooCommerce price structure
  // Price might be nested: <span class="woocommerce-Price-amount"><bdi>$32.95</bdi></span>
  const priceText = priceEl.text().trim()
  return parsePriceToCents(priceText)
}

/**
 * SGAmmo scrape adapter.
 */
export const sgammoAdapter: ScrapeAdapter = {
  id: ADAPTER_ID,
  version: ADAPTER_VERSION,
  domain: ADAPTER_DOMAIN,
  requiresJsRendering: false,

  extract(html: string, url: string, ctx: ScrapeAdapterContext): ExtractResult {
    const $ = cheerio.load(html)

    // Strategy 1: Extract from JSON-LD (preferred)
    const jsonLd = extractJsonLd($)

    let title: string | undefined
    let priceCents: number | null = null
    let availability: ScrapedOffer['availability'] = 'UNKNOWN'
    let sku: string | undefined
    let imageUrl: string | undefined

    if (jsonLd) {
      // Extract from JSON-LD
      const offers = normalizeJsonLdOffers(jsonLd.offers)

      title = jsonLd.name?.trim()
      priceCents = extractPriceFromJsonLdOffers(offers)
      availability = mapSchemaAvailability(extractAvailabilityFromJsonLdOffers(offers))
      sku = jsonLd.sku?.trim()

      // Image can be string or array
      if (Array.isArray(jsonLd.image)) {
        imageUrl = jsonLd.image[0]
      } else {
        imageUrl = jsonLd.image
      }

      ctx.logger.debug('Extracted from JSON-LD', {
        hasTitle: !!title,
        hasPriceCents: priceCents !== null,
        availability,
        hasSku: !!sku,
      })
    }

    // Strategy 2: Fall back to DOM for missing fields
    if (!title) {
      title = $(SELECTORS.title).first().text().trim()
    }

    if (priceCents === null) {
      priceCents = extractPriceFromDom($)
    }

    if (availability === 'UNKNOWN') {
      availability = extractAvailabilityFromDom($)
    }

    if (!sku) {
      sku = $(SELECTORS.sku).first().text().trim() || undefined
    }

    if (!imageUrl) {
      imageUrl = $(SELECTORS.image).first().attr('src') || undefined
    }

    // Validate required fields
    if (!title) {
      return { ok: false, reason: 'TITLE_NOT_FOUND' }
    }

    if (priceCents === null) {
      // Check if out of stock - OOS without price is expected
      if (availability === 'OUT_OF_STOCK') {
        return { ok: false, reason: 'OOS_NO_PRICE' }
      }
      return { ok: false, reason: 'PRICE_NOT_FOUND' }
    }

    // Per spec §7.2: Let UNKNOWN availability pass through to normalizer
    // The validator will drop with UNKNOWN_AVAILABILITY reason for proper drift counting
    // (Don't return extract failure - that would bypass drift tracking)

    // Build the offer
    const canonicalUrl = canonicalizeUrl(url)
    const identityKey = generateIdentityKey(undefined, sku, canonicalUrl)

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
      retailerSku: sku,
      imageUrl,
      adapterVersion: ADAPTER_VERSION,
    }

    return { ok: true, offer }
  },

  normalize(offer: ScrapedOffer, _ctx: ScrapeAdapterContext): NormalizeResult {
    // SGAmmo-specific normalization rules could go here
    // For now, use standard validation
    return validateOffer(offer)
  },
}
