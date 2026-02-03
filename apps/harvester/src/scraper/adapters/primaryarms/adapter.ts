/**
 * Primary Arms Adapter
 *
 * Primary Arms serves product data via a NetSuite JSON endpoint (/api/items).
 * This adapter expects JSON payloads from that endpoint (not the HTML shell).
 */

import type {
  ScrapeAdapter,
  ExtractResult,
  ScrapedOffer,
  NormalizeResult,
  ScrapeAdapterContext,
} from '../../types.js'
import { validateOffer } from '../../process/validator.js'
import { canonicalizeUrl, generateIdentityKey } from '../../utils/url.js'
import { ATTRIBUTE_LABELS } from './selectors.js'

const ADAPTER_ID = 'primaryarms'
const ADAPTER_VERSION = '1.0.0'
const ADAPTER_DOMAIN = 'primaryarms.com'

interface PrimaryArmsResponse {
  code?: number
  items?: PrimaryArmsItem[]
}

interface PrimaryArmsItem {
  isinstock?: boolean
  isbackorderable?: boolean
  ispurchasable?: boolean
  onlinecustomerprice?: number | string | null
  onlinecustomerprice_detail?: {
    onlinecustomerprice?: number | string | null
  }
  pagetitle?: string
  displayname?: string
  itemid?: string
  internalid?: number | string
  urlcomponent?: string
  upccode?: string
  custitem_brand?: string
  manufacturer?: string
  itemimages_detail?: {
    urls?: Array<{ url?: string }>
  }
  custitem_test_for_website?: string
}

interface AttributePayload {
  attributes?: Array<{ attribute?: string; value?: string }>
}

function parseResponse(raw: string): PrimaryArmsResponse | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('<')) return null

  try {
    return JSON.parse(trimmed) as PrimaryArmsResponse
  } catch {
    return null
  }
}

function parsePriceToCents(value: unknown): number | null {
  if (value === undefined || value === null) return null

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return null
    return Math.round(value * 100)
  }

  if (typeof value === 'string') {
    const cleaned = value.replace(/[$,]/g, '').trim()
    const parsed = Number(cleaned)
    if (!Number.isFinite(parsed) || parsed <= 0) return null
    return Math.round(parsed * 100)
  }

  return null
}

function resolveAvailability(item: PrimaryArmsItem): ScrapedOffer['availability'] {
  if (item.isinstock === true) return 'IN_STOCK'
  if (item.isbackorderable === true) return 'BACKORDER'
  if (item.isinstock === false) return 'OUT_OF_STOCK'
  if (item.ispurchasable === true) return 'IN_STOCK'
  if (item.ispurchasable === false) return 'OUT_OF_STOCK'
  return 'UNKNOWN'
}

function parseAttributes(raw?: string): Record<string, string> {
  if (!raw) return {}

  try {
    const parsed = JSON.parse(raw) as AttributePayload
    const map: Record<string, string> = {}

    if (!Array.isArray(parsed.attributes)) return map

    for (const entry of parsed.attributes) {
      const key = entry.attribute?.toString().trim().toLowerCase()
      const value = entry.value?.toString().trim()
      if (!key || !value) continue
      map[key] = value
    }

    return map
  } catch {
    return {}
  }
}

function getAttributeValue(map: Record<string, string>, labels: readonly string[]): string | undefined {
  for (const label of labels) {
    const value = map[label.toLowerCase()]
    if (value) return value
  }
  return undefined
}

function parseGrainWeight(value: string | undefined): number | undefined {
  if (!value) return undefined
  const match = value.match(/(\d+(?:\.\d+)?)\s*(?:gr|grain)/i)
  if (!match) return undefined
  const parsed = Number(match[1])
  if (!Number.isFinite(parsed)) return undefined
  return Math.round(parsed)
}

function parseRoundCount(title: string | undefined): number | undefined {
  if (!title) return undefined

  const patterns = [
    /\b(?:box|case|bag|pack)\s+of\s+(\d+)\b/i,
    /\b(\d+)\s*(?:rounds|round|rds|rd|ct)\b/i,
  ]

  for (const pattern of patterns) {
    const match = title.match(pattern)
    if (!match) continue
    const parsed = Number(match[1])
    if (Number.isFinite(parsed)) return parsed
  }

  return undefined
}

function deriveUrlComponent(itemUrlComponent: string | undefined, requestUrl: string): string | undefined {
  if (itemUrlComponent) return itemUrlComponent

  try {
    const parsed = new URL(requestUrl)
    const urlParam = parsed.searchParams.get('url')
    if (!urlParam) return undefined
    return urlParam.replace(/^\//, '')
  } catch {
    return undefined
  }
}

function buildProductUrl(urlComponent: string | undefined, fallbackUrl: string): string {
  if (urlComponent) {
    if (urlComponent.startsWith('http://') || urlComponent.startsWith('https://')) {
      return urlComponent
    }
    const trimmed = urlComponent.replace(/^\//, '')
    return `https://www.primaryarms.com/${trimmed}`
  }

  return fallbackUrl
}

export const primaryarmsAdapter: ScrapeAdapter = {
  id: ADAPTER_ID,
  version: ADAPTER_VERSION,
  domain: ADAPTER_DOMAIN,
  requiresJsRendering: false,

  extract(html: string, url: string, ctx: ScrapeAdapterContext): ExtractResult {
    const payload = parseResponse(html)
    if (!payload) {
      return { ok: false, reason: 'PAGE_STRUCTURE_CHANGED', details: 'Expected JSON payload' }
    }

    if (payload.code && payload.code !== 200) {
      return { ok: false, reason: 'PAGE_STRUCTURE_CHANGED', details: `API code ${payload.code}` }
    }

    const item = payload.items?.[0]
    if (!item) {
      return { ok: false, reason: 'EMPTY_PAGE' }
    }

    const title = item.pagetitle?.trim() || item.displayname?.trim() || item.itemid?.trim()
    if (!title) {
      return { ok: false, reason: 'TITLE_NOT_FOUND' }
    }

    const availability = resolveAvailability(item)

    const rawPrice = item.onlinecustomerprice ?? item.onlinecustomerprice_detail?.onlinecustomerprice
    const priceCents = parsePriceToCents(rawPrice)
    if (priceCents === null) {
      if (availability === 'OUT_OF_STOCK') {
        return { ok: false, reason: 'OOS_NO_PRICE' }
      }
      return { ok: false, reason: 'PRICE_NOT_FOUND' }
    }

    const urlComponent = deriveUrlComponent(item.urlcomponent, url)
    const productUrl = buildProductUrl(urlComponent, url)
    const canonicalUrl = canonicalizeUrl(productUrl)

    const retailerProductId = item.internalid ? String(item.internalid) : undefined
    const retailerSku = item.itemid?.trim() || undefined
    const identityKey = generateIdentityKey(retailerProductId, retailerSku, canonicalUrl)

    const attributes = parseAttributes(item.custitem_test_for_website)
    const caliber = getAttributeValue(attributes, ATTRIBUTE_LABELS.caliber)
    const bulletWeightText = getAttributeValue(attributes, ATTRIBUTE_LABELS.bulletWeight)
    const grainWeight = parseGrainWeight(bulletWeightText) ?? parseGrainWeight(title)
    const caseMaterial = getAttributeValue(attributes, ATTRIBUTE_LABELS.caseMaterial)
    const bulletType = getAttributeValue(attributes, ATTRIBUTE_LABELS.bulletType)
    const brand =
      item.custitem_brand?.trim() ||
      item.manufacturer?.trim() ||
      getAttributeValue(attributes, ATTRIBUTE_LABELS.brand)
    const loadType = getAttributeValue(attributes, ATTRIBUTE_LABELS.loadType)
    const shellLength = getAttributeValue(attributes, ATTRIBUTE_LABELS.shellLength)
    const roundCount = parseRoundCount(title)

    const imageUrl = item.itemimages_detail?.urls?.find(entry => entry?.url)?.url

    if (!urlComponent) {
      ctx.logger.warn('Primary Arms payload missing urlcomponent; using request URL', {
        targetId: ctx.targetId,
        url,
      })
    }

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
      upc: item.upccode?.trim() || undefined,
      brand: brand?.trim() || undefined,
      caliber: caliber?.trim() || undefined,
      grainWeight,
      roundCount,
      caseMaterial: caseMaterial?.trim() || undefined,
      bulletType: bulletType?.trim() || undefined,
      loadType: loadType?.trim() || undefined,
      shellLength: shellLength?.trim() || undefined,
      imageUrl: imageUrl?.trim() || undefined,
      adapterVersion: ADAPTER_VERSION,
    }

    return { ok: true, offer }
  },

  normalize(offer: ScrapedOffer, _ctx: ScrapeAdapterContext): NormalizeResult {
    return validateOffer(offer)
  },
}
