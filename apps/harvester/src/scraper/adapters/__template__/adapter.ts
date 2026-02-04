/**
 * Adapter Template
 *
 * Copy this folder to `adapters/<retailer>/` and replace all TODOs.
 * Keep behavior deterministic and fail-closed.
 */

import * as cheerio from 'cheerio'
import type { ScrapeAdapter, ExtractResult, ScrapedOffer, NormalizeResult } from '../../types.js'
import { validateOffer } from '../../process/validator.js'
import { canonicalizeUrl, generateIdentityKey } from '../../utils/url.js'
import { SELECTORS } from './selectors.js'

const ADAPTER_ID = 'template'
const ADAPTER_VERSION = '0.0.0'
const ADAPTER_DOMAIN = 'example.com'

type JsonLdOffer = {
  '@type'?: string | string[]
  price?: string | number
  priceCurrency?: string
  availability?: string
  url?: string
  priceSpecification?: {
    price?: string | number
    minPrice?: string | number
    maxPrice?: string | number
  }
}

type JsonLdProduct = {
  '@type'?: string | string[]
  name?: string
  sku?: string
  image?: string | string[]
  offers?: JsonLdOffer | JsonLdOffer[]
}

const SCHEMA_AVAILABILITY = {
  inStock: 'InStock',
  outOfStock: 'OutOfStock',
  backOrder: 'BackOrder',
  preOrder: 'PreOrder',
} as const

function parsePriceToCents(value: string | number | null | undefined): { cents: number | null; ambiguous: boolean } {
  if (value === null || value === undefined) {
    return { cents: null, ambiguous: false }
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) {
      return { cents: null, ambiguous: false }
    }
    return { cents: Math.round(value * 100), ambiguous: false }
  }

  const cleaned = String(value).replace(/[,]/g, '')
  const matches = cleaned.match(/\d+(?:\.\d{1,2})?/g) ?? []
  if (matches.length === 0) {
    return { cents: null, ambiguous: false }
  }
  if (matches.length > 1) {
    return { cents: null, ambiguous: true }
  }

  const [dollarsRaw, centsRaw] = matches[0]!.split('.')
  const dollars = Number.parseInt(dollarsRaw, 10)
  const cents = Number.parseInt((centsRaw ?? '00').padEnd(2, '0').slice(0, 2), 10)

  if (!Number.isFinite(dollars) || !Number.isFinite(cents)) {
    return { cents: null, ambiguous: false }
  }

  return { cents: dollars * 100 + cents, ambiguous: false }
}

function isTypeMatch(value: JsonLdProduct['@type'], target: string): boolean {
  if (!value) return false
  if (Array.isArray(value)) {
    return value.some(item => String(item).toLowerCase() === target.toLowerCase())
  }
  return String(value).toLowerCase() === target.toLowerCase()
}

function normalizeJsonArray<T>(value: T | T[] | undefined | null): T[] {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

function flattenJsonLd(value: unknown): JsonLdProduct[] {
  const output: JsonLdProduct[] = []
  const queue: unknown[] = Array.isArray(value) ? [...value] : [value]

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current || typeof current !== 'object') continue

    if (Array.isArray(current)) {
      queue.push(...current)
      continue
    }

    const typed = current as Record<string, unknown>
    if (typed['@graph']) {
      queue.push(...normalizeJsonArray(typed['@graph'] as unknown))
    }
    output.push(current as JsonLdProduct)
  }

  return output
}

function extractJsonLdObjects($: cheerio.CheerioAPI): JsonLdProduct[] {
  const selector = SELECTORS.jsonLd || 'script[type="application/ld+json"]'
  const scripts = $(selector)
  const objects: JsonLdProduct[] = []

  scripts.each((_, el) => {
    const raw = $(el).text().trim()
    if (!raw) return

    try {
      const parsed = JSON.parse(raw)
      objects.push(...flattenJsonLd(parsed))
    } catch {
      return
    }
  })

  return objects
}

function mapSchemaAvailability(value: string | undefined): ScrapedOffer['availability'] | null {
  if (!value) return null
  const normalized = String(value).split('/').pop() || ''
  if (normalized === SCHEMA_AVAILABILITY.inStock) return 'IN_STOCK'
  if (normalized === SCHEMA_AVAILABILITY.outOfStock) return 'OUT_OF_STOCK'
  if (normalized === SCHEMA_AVAILABILITY.backOrder || normalized === SCHEMA_AVAILABILITY.preOrder) {
    return 'BACKORDER'
  }
  return null
}

function resolveJsonLdOffer(product: JsonLdProduct | null, objects: JsonLdProduct[]) {
  let offers = normalizeJsonArray(product?.offers)
  if (offers.length === 0) {
    offers = objects.filter(obj => isTypeMatch(obj['@type'], 'Offer')) as JsonLdOffer[]
  }
  if (offers.length === 0) return null

  const priceValues = offers
    .map(offer => offer?.price ?? offer?.priceSpecification?.price ?? offer?.priceSpecification?.minPrice ?? offer?.priceSpecification?.maxPrice)
    .filter(value => value !== undefined && value !== null)
    .map(value => String(value))
  const uniquePrices = Array.from(new Set(priceValues))

  if (uniquePrices.length > 1) {
    return { ambiguous: true, reason: 'Multiple offer prices detected' }
  }

  const availabilityValues = offers
    .map(offer => offer?.availability)
    .filter(Boolean)
    .map(value => String(value))
  const uniqueAvailability = Array.from(new Set(availabilityValues))

  if (uniqueAvailability.length > 1) {
    return { ambiguous: true, reason: 'Multiple offer availability values detected' }
  }

  const offer = offers[0] as JsonLdOffer
  const price =
    offer?.price ??
    offer?.priceSpecification?.price ??
    offer?.priceSpecification?.minPrice ??
    offer?.priceSpecification?.maxPrice ??
    null

  return {
    ambiguous: false,
    offer,
    price,
    availability: offer?.availability,
  }
}

function extractFromJsonLd($: cheerio.CheerioAPI) {
  const objects = extractJsonLdObjects($)
  if (objects.length === 0) return null

  const product = objects.find(obj => isTypeMatch(obj['@type'], 'Product')) ?? null
  const offerResult = resolveJsonLdOffer(product, objects)
  if (!offerResult) {
    return { ambiguous: false, title: product?.name, price: null, availability: null, sku: product?.sku, image: product?.image }
  }

  if (offerResult.ambiguous) {
    return { ambiguous: true, reason: offerResult.reason }
  }

  return {
    ambiguous: false,
    title: product?.name,
    price: offerResult.price,
    availability: offerResult.availability,
    sku: product?.sku,
    image: product?.image,
  }
}

function resolveAvailability($: cheerio.CheerioAPI): ScrapedOffer['availability'] | null {
  if (SELECTORS.inStock && $(SELECTORS.inStock).length > 0) {
    return 'IN_STOCK'
  }
  if (SELECTORS.outOfStock && $(SELECTORS.outOfStock).length > 0) {
    return 'OUT_OF_STOCK'
  }
  if (SELECTORS.backorder && $(SELECTORS.backorder).length > 0) {
    return 'BACKORDER'
  }
  return null
}

export const templateAdapter: ScrapeAdapter = {
  id: ADAPTER_ID,
  version: ADAPTER_VERSION,
  domain: ADAPTER_DOMAIN,
  requiresJsRendering: false,

  extract(html: string, url: string, ctx): ExtractResult {
    const $ = cheerio.load(html)

    let title = ''
    let priceCents: number | null = null
    let availability: ScrapedOffer['availability'] | null = null
    let retailerSku = ''
    let imageUrl = ''

    const jsonLd = extractFromJsonLd($)
    if (jsonLd?.ambiguous) {
      return {
        ok: false,
        reason: 'PAGE_STRUCTURE_CHANGED',
        details: jsonLd.reason,
      }
    }

    if (jsonLd) {
      if (jsonLd.title) title = String(jsonLd.title).trim()
      if (jsonLd.price !== null && jsonLd.price !== undefined) {
        const parsed = parsePriceToCents(jsonLd.price)
        if (parsed.ambiguous) {
          return {
            ok: false,
            reason: 'PAGE_STRUCTURE_CHANGED',
            details: 'Multiple price candidates found in JSON-LD',
          }
        }
        priceCents = parsed.cents
      }
      availability = mapSchemaAvailability(jsonLd.availability ?? undefined)
      if (jsonLd.sku) retailerSku = String(jsonLd.sku).trim()
      if (Array.isArray(jsonLd.image)) {
        imageUrl = jsonLd.image[0] || ''
      } else if (jsonLd.image) {
        imageUrl = String(jsonLd.image)
      }
    }

    if (!title && SELECTORS.title) {
      title = $(SELECTORS.title).first().text().trim()
    }
    if (!title) {
      return { ok: false, reason: 'TITLE_NOT_FOUND' }
    }

    if (priceCents === null && SELECTORS.price) {
      const priceText = $(SELECTORS.price).first().text().trim()
      if (priceText) {
        const parsed = parsePriceToCents(priceText)
        if (parsed.ambiguous) {
          return {
            ok: false,
            reason: 'PAGE_STRUCTURE_CHANGED',
            details: 'Multiple price candidates found; implement adapter-specific disambiguation',
          }
        }
        priceCents = parsed.cents
      }
    }

    if (priceCents === null) {
      if (availability === 'OUT_OF_STOCK') {
        return { ok: false, reason: 'OOS_NO_PRICE' }
      }
      return { ok: false, reason: 'PRICE_NOT_FOUND' }
    }

    if (!availability) {
      availability = resolveAvailability($)
    }
    if (!availability) {
      return {
        ok: false,
        reason: 'SELECTOR_NOT_FOUND',
        details: 'Availability selectors not configured or not found',
      }
    }

    const canonicalUrl = canonicalizeUrl(url)
    const selectorSku = SELECTORS.sku ? $(SELECTORS.sku).attr('data-sku')?.trim() : undefined
    const selectorProductId = SELECTORS.productId
      ? $(SELECTORS.productId).attr('data-product-id')?.trim()
      : undefined
    const selectorUpc = SELECTORS.upc ? $(SELECTORS.upc).text().trim() : undefined
    const selectorImage = SELECTORS.image ? $(SELECTORS.image).first().attr('src')?.trim() : undefined

    if (!retailerSku && selectorSku) {
      retailerSku = selectorSku
    }
    if (!imageUrl && selectorImage) {
      imageUrl = selectorImage
    }

    const identityKey = generateIdentityKey(selectorProductId, retailerSku, canonicalUrl)

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
      retailerProductId: selectorProductId,
      upc: selectorUpc || undefined,
      imageUrl: imageUrl || undefined,
      adapterVersion: ADAPTER_VERSION,
    }

    return { ok: true, offer }
  },

  normalize(offer: ScrapedOffer): NormalizeResult {
    // TODO: if price signals are ambiguous, return quarantine here.
    // Example:
    // return { status: 'quarantine', reason: 'AMBIGUOUS_PRICE', offer }
    return validateOffer(offer)
  },
}
