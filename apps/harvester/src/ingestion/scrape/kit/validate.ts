import type { NormalizedScrapeOffer } from '../types.js'

export type ValidateNormalizedResult =
  | { ok: true }
  | { ok: false; status: 'drop' | 'quarantine'; reason: string }

export function validateNormalizedOffer(offer: NormalizedScrapeOffer): ValidateNormalizedResult {
  if (!offer.sourceId || !offer.retailerId || !offer.title || !offer.url) {
    return { ok: false, status: 'drop', reason: 'MISSING_REQUIRED_FIELD' }
  }

  if (!Number.isInteger(offer.priceCents) || offer.priceCents <= 0) {
    return { ok: false, status: 'drop', reason: 'INVALID_PRICE' }
  }

  if (offer.availability === 'UNKNOWN') {
    return { ok: false, status: 'drop', reason: 'UNKNOWN_AVAILABILITY' }
  }

  if (!offer.identityKey) {
    return { ok: false, status: 'quarantine', reason: 'MISSING_IDENTITY_KEY' }
  }

  if (!offer.adapterVersion) {
    return { ok: false, status: 'drop', reason: 'MISSING_ADAPTER_VERSION' }
  }

  return { ok: true }
}
