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

function parsePriceToCents(text: string): { cents: number | null; ambiguous: boolean } {
  const cleaned = text.replace(/[,]/g, '')
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
    if (!SELECTORS.title || !SELECTORS.price) {
      return {
        ok: false,
        reason: 'SELECTOR_NOT_FOUND',
        details: 'Title/price selectors not configured',
      }
    }

    const $ = cheerio.load(html)

    const title = $(SELECTORS.title).first().text().trim()
    if (!title) {
      return { ok: false, reason: 'TITLE_NOT_FOUND' }
    }

    const priceText = $(SELECTORS.price).first().text().trim()
    if (!priceText) {
      return { ok: false, reason: 'PRICE_NOT_FOUND' }
    }

    const priceParse = parsePriceToCents(priceText)
    if (priceParse.ambiguous) {
      return {
        ok: false,
        reason: 'PAGE_STRUCTURE_CHANGED',
        details: 'Multiple price candidates found; implement adapter-specific disambiguation',
      }
    }

    if (priceParse.cents === null) {
      return { ok: false, reason: 'PRICE_NOT_FOUND' }
    }

    const availability = resolveAvailability($)
    if (!availability) {
      return {
        ok: false,
        reason: 'SELECTOR_NOT_FOUND',
        details: 'Availability selectors not configured or not found',
      }
    }

    const canonicalUrl = canonicalizeUrl(url)
    const retailerSku = SELECTORS.sku ? $(SELECTORS.sku).attr('data-sku')?.trim() : undefined
    const retailerProductId = SELECTORS.productId
      ? $(SELECTORS.productId).attr('data-product-id')?.trim()
      : undefined
    const upc = SELECTORS.upc ? $(SELECTORS.upc).text().trim() : undefined

    const identityKey = generateIdentityKey(retailerProductId, retailerSku, canonicalUrl)

    const offer: ScrapedOffer = {
      sourceId: ctx.sourceId,
      retailerId: ctx.retailerId,
      url: canonicalUrl,
      title,
      priceCents: priceParse.cents,
      currency: 'USD',
      availability,
      observedAt: ctx.now,
      identityKey,
      retailerSku,
      retailerProductId,
      upc: upc || undefined,
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
