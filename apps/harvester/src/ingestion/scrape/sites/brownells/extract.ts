import type { RawScrapeOffer, ScrapePluginExtractResult } from '../../types.js'
import { loadHtml, firstText } from '../../kit/html.js'
import { safeJsonParse } from '../../kit/json.js'

const SELECTORS = {
  jsonLd: 'script[type="application/ld+json"]',
  title: 'h1.pdp-info__title, h1',
  inStock: '[data-product-isinstock="true"], .in-stock',
  outOfStock: '[data-product-isoutofstock="true"], .out-of-stock',
  backorder: '[data-product-isbackorder="true"], .backorder',
} as const

type JsonLdOffer = {
  '@type'?: string | string[]
  price?: string | number
  priceCurrency?: string
  availability?: string
  sku?: string
  url?: string
  shippingDetails?: {
    shippingRate?: {
      value?: string | number
    }
  }
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

function parsePrice(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? value : null
  }
  const cleaned = value.replace(/[$,\s]/g, '')
  const parsed = Number.parseFloat(cleaned)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function parseShippingCents(offer: JsonLdOffer): number | null | undefined {
  const shippingValue = offer.shippingDetails?.shippingRate?.value
  const parsed = parsePrice(shippingValue)
  if (parsed === null) return undefined
  return Math.round(parsed * 100)
}

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

function isTypeMatch(value: string | string[] | undefined, expected: string): boolean {
  if (!value) return false
  if (Array.isArray(value)) {
    return value.some(item => item.toLowerCase() === expected.toLowerCase())
  }
  return value.toLowerCase() === expected.toLowerCase()
}

function flattenJsonLdNodes(value: unknown): unknown[] {
  const queue: unknown[] = Array.isArray(value) ? [...value] : [value]
  const nodes: unknown[] = []

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current || typeof current !== 'object') continue
    nodes.push(current)

    const typed = current as { '@graph'?: unknown }
    if (Array.isArray(typed['@graph'])) {
      queue.push(...typed['@graph'])
    }
  }

  return nodes
}

function extractJsonLdProduct(payload: string): JsonLdProduct | null {
  const $ = loadHtml(payload)
  const scripts = $(SELECTORS.jsonLd)

  for (let i = 0; i < scripts.length; i++) {
    const raw = scripts.eq(i).text().trim()
    if (!raw) continue

    const parsed = safeJsonParse(raw)
    if (!parsed.ok) continue

    for (const node of flattenJsonLdNodes(parsed.value)) {
      if (!node || typeof node !== 'object') continue
      const product = node as JsonLdProduct
      if (isTypeMatch(product['@type'], 'Product')) {
        return product
      }
    }
  }

  return null
}

function mapSchemaAvailability(value: string | undefined): RawScrapeOffer['availability'] {
  if (!value) return 'UNKNOWN'
  const normalized = value.split('/').pop() ?? ''

  if (normalized === 'InStock') return 'IN_STOCK'
  if (normalized === 'OutOfStock' || normalized === 'Discontinued') return 'OUT_OF_STOCK'
  if (normalized === 'BackOrder' || normalized === 'PreOrder') return 'BACKORDER'
  return 'UNKNOWN'
}

function resolveAvailabilityFromDom(payload: string): RawScrapeOffer['availability'] {
  const $ = loadHtml(payload)
  if ($(SELECTORS.inStock).length > 0) return 'IN_STOCK'
  if ($(SELECTORS.outOfStock).length > 0) return 'OUT_OF_STOCK'
  if ($(SELECTORS.backorder).length > 0) return 'BACKORDER'
  return 'UNKNOWN'
}

function extractSkuParam(url: string): string | undefined {
  try {
    const sku = new URL(url).searchParams.get('sku')?.trim()
    return sku || undefined
  } catch {
    return undefined
  }
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

function extractOfferPrice(offer: JsonLdOffer): number | null {
  const direct = parsePrice(offer.price)
  if (direct !== null) return direct

  for (const spec of asArray(offer.priceSpecification)) {
    const parsed =
      parsePrice(spec.price) ?? parsePrice(spec.minPrice) ?? parsePrice(spec.maxPrice)
    if (parsed !== null) return parsed
  }

  return null
}

export function extractRaw(payload: string, url: string): ScrapePluginExtractResult {
  if (!payload || payload.trim().length === 0) {
    return { ok: false, reason: 'EMPTY_PAGE' }
  }

  const product = extractJsonLdProduct(payload)
  if (!product) {
    return {
      ok: false,
      reason: 'PAGE_STRUCTURE_CHANGED',
      details: 'No JSON-LD Product object found',
    }
  }

  const $ = loadHtml(payload)
  const title = product.name?.trim() || firstText($, SELECTORS.title)
  if (!title) {
    return { ok: false, reason: 'TITLE_NOT_FOUND' }
  }

  const skuParam = extractSkuParam(url)
  const offers = asArray(product.offers)
  if (offers.length === 0) {
    return { ok: false, reason: 'PRICE_NOT_FOUND', details: 'No offers in JSON-LD Product' }
  }

  const domAvailability = resolveAvailabilityFromDom(payload)
  const rawOffers: RawScrapeOffer[] = []

  for (const offer of offers) {
    const price = extractOfferPrice(offer)
    if (price === null) {
      continue
    }

    const retailerSku = offer.sku?.trim() || product.sku?.trim() || undefined
    const availability = mapSchemaAvailability(offer.availability)

    rawOffers.push({
      title,
      price,
      availability: availability === 'UNKNOWN' ? domAvailability : availability,
      url,
      retailerSku,
      retailerProductId:
        skuParam && retailerSku && retailerSku === skuParam ? skuParam : undefined,
      brand: resolveBrand(product.brand),
      imageUrl: resolveImageUrl(product.image),
      shippingCents: parseShippingCents(offer),
    })
  }

  if (rawOffers.length === 0) {
    const allOutOfStock = offers.every(offer => {
      const mapped = mapSchemaAvailability(offer.availability)
      return mapped === 'OUT_OF_STOCK'
    })
    if (allOutOfStock || domAvailability === 'OUT_OF_STOCK') {
      return { ok: false, reason: 'OOS_NO_PRICE' }
    }
    return {
      ok: false,
      reason: 'PRICE_NOT_FOUND',
      details: 'Offers did not include a usable price',
    }
  }

  return { ok: true, rawOffers }
}
