import * as cheerio from 'cheerio'
import type {
  ScrapeAdapter,
  ExtractResult,
  ScrapedOffer,
  NormalizeResult,
  ScrapeAdapterContext,
} from '../../types.js'
import { validateOffer } from '../../process/validator.js'
import { canonicalizeUrl, generateIdentityKey } from '../../utils/url.js'
import { SELECTORS } from './selectors.js'

const ADAPTER_ID = 'brownells'
const ADAPTER_VERSION = '1.0.0'
const ADAPTER_DOMAIN = 'brownells.com'

type JsonLdOffer = {
  '@type'?: string | string[]
  price?: string | number
  priceCurrency?: string
  availability?: string
  sku?: string
  url?: string
  priceSpecification?:
    | {
        price?: string | number
        minPrice?: string | number
        maxPrice?: string | number
      }
    | Array<{
        price?: string | number
        minPrice?: string | number
        maxPrice?: string | number
      }>
}

type JsonLdProduct = {
  '@type'?: string | string[]
  name?: string
  sku?: string
  image?: string | string[]
  brand?: string | { name?: string }
  offers?: JsonLdOffer | JsonLdOffer[]
}

const SCHEMA_AVAILABILITY = {
  inStock: 'InStock',
  outOfStock: 'OutOfStock',
  backOrder: 'BackOrder',
  preOrder: 'PreOrder',
  discontinued: 'Discontinued',
} as const

function parsePriceToCents(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) {
      return null
    }
    return Math.round(value * 100)
  }

  const cleaned = value.replace(/[$,\s]/g, '')
  const parsed = Number(cleaned)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }
  return Math.round(parsed * 100)
}

function isTypeMatch(value: JsonLdProduct['@type'], target: string): boolean {
  if (!value) return false
  if (Array.isArray(value)) {
    return value.some(item => String(item).toLowerCase() === target.toLowerCase())
  }
  return String(value).toLowerCase() === target.toLowerCase()
}

function normalizeArray<T>(value: T | T[] | null | undefined): T[] {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

function flattenJsonLdNodes(value: unknown): unknown[] {
  const queue: unknown[] = Array.isArray(value) ? [...value] : [value]
  const flattened: unknown[] = []

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current || typeof current !== 'object') continue
    flattened.push(current)

    const typed = current as { '@graph'?: unknown }
    if (Array.isArray(typed['@graph'])) {
      queue.push(...typed['@graph'])
    }
  }

  return flattened
}

function extractJsonLdProduct($: cheerio.CheerioAPI): JsonLdProduct | null {
  const scripts = $(SELECTORS.jsonLd)

  for (let i = 0; i < scripts.length; i++) {
    const raw = scripts.eq(i).text().trim()
    if (!raw) continue

    try {
      const parsed = JSON.parse(raw)
      const nodes = flattenJsonLdNodes(parsed)
      for (const node of nodes) {
        if (!node || typeof node !== 'object') continue
        const product = node as JsonLdProduct
        if (isTypeMatch(product['@type'], 'Product')) {
          return product
        }
      }
    } catch {
      continue
    }
  }

  return null
}

function getSkuParam(url: string): string | undefined {
  try {
    const sku = new URL(url).searchParams.get('sku')?.trim()
    return sku || undefined
  } catch {
    return undefined
  }
}

function selectOffer(offers: JsonLdOffer[], url: string): JsonLdOffer | null {
  if (offers.length === 0) return null

  const skuParam = getSkuParam(url)
  if (skuParam) {
    const matched = offers.find(offer => offer.sku?.trim() === skuParam)
    if (matched) return matched
  }

  return offers[0] ?? null
}

function extractOfferPriceCents(offer: JsonLdOffer | null): number | null {
  if (!offer) return null

  const directPrice = parsePriceToCents(offer.price)
  if (directPrice !== null) return directPrice

  const specs = normalizeArray(offer.priceSpecification)
  for (const spec of specs) {
    const values = [spec.price, spec.minPrice, spec.maxPrice]
    for (const value of values) {
      const parsed = parsePriceToCents(value)
      if (parsed !== null) return parsed
    }
  }

  return null
}

function mapSchemaAvailability(value: string | undefined): ScrapedOffer['availability'] {
  if (!value) return 'UNKNOWN'
  const normalized = String(value).split('/').pop() || ''
  if (normalized === SCHEMA_AVAILABILITY.inStock) return 'IN_STOCK'
  if (
    normalized === SCHEMA_AVAILABILITY.outOfStock ||
    normalized === SCHEMA_AVAILABILITY.discontinued
  ) {
    return 'OUT_OF_STOCK'
  }
  if (normalized === SCHEMA_AVAILABILITY.backOrder || normalized === SCHEMA_AVAILABILITY.preOrder) {
    return 'BACKORDER'
  }
  return 'UNKNOWN'
}

function resolveAvailabilityFromDom($: cheerio.CheerioAPI): ScrapedOffer['availability'] {
  if (SELECTORS.inStock && $(SELECTORS.inStock).length > 0) return 'IN_STOCK'
  if (SELECTORS.outOfStock && $(SELECTORS.outOfStock).length > 0) return 'OUT_OF_STOCK'
  if (SELECTORS.backorder && $(SELECTORS.backorder).length > 0) return 'BACKORDER'
  return 'UNKNOWN'
}

function resolveImageUrl(image: JsonLdProduct['image']): string | undefined {
  if (Array.isArray(image)) {
    const first = image[0]?.trim()
    return first || undefined
  }
  if (typeof image === 'string') {
    const trimmed = image.trim()
    return trimmed || undefined
  }
  return undefined
}

function resolveBrand(brand: JsonLdProduct['brand']): string | undefined {
  if (!brand) return undefined
  if (typeof brand === 'string') {
    const trimmed = brand.trim()
    return trimmed || undefined
  }
  const trimmed = brand.name?.trim()
  return trimmed || undefined
}

export const brownellsAdapter: ScrapeAdapter = {
  id: ADAPTER_ID,
  version: ADAPTER_VERSION,
  domain: ADAPTER_DOMAIN,
  requiresJsRendering: false,

  extract(html: string, url: string, ctx: ScrapeAdapterContext): ExtractResult {
    const $ = cheerio.load(html)
    const product = extractJsonLdProduct($)
    if (!product) {
      return {
        ok: false,
        reason: 'PAGE_STRUCTURE_CHANGED',
        details: 'No JSON-LD Product object found',
      }
    }

    const title = product.name?.trim() || (SELECTORS.title ? $(SELECTORS.title).first().text().trim() : '')
    if (!title) {
      return { ok: false, reason: 'TITLE_NOT_FOUND' }
    }

    const offers = normalizeArray(product.offers)
    const selectedOffer = selectOffer(offers, url)
    let availability = mapSchemaAvailability(selectedOffer?.availability)
    if (availability === 'UNKNOWN') {
      availability = resolveAvailabilityFromDom($)
    }

    const priceCents = extractOfferPriceCents(selectedOffer)
    if (priceCents === null) {
      if (availability === 'OUT_OF_STOCK') {
        return { ok: false, reason: 'OOS_NO_PRICE' }
      }
      return {
        ok: false,
        reason: 'PRICE_NOT_FOUND',
        details: 'Selected offer did not contain a usable price',
      }
    }

    const canonicalUrl = canonicalizeUrl(url)
    const skuParam = getSkuParam(url)
    const retailerSku = selectedOffer?.sku?.trim() || product.sku?.trim() || undefined
    const identityKey = generateIdentityKey(skuParam, retailerSku, canonicalUrl)

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
      retailerProductId: skuParam,
      brand: resolveBrand(product.brand),
      imageUrl: resolveImageUrl(product.image),
      adapterVersion: ADAPTER_VERSION,
    }

    return { ok: true, offer }
  },

  normalize(offer: ScrapedOffer, _ctx: ScrapeAdapterContext): NormalizeResult {
    return validateOffer(offer)
  },
}
