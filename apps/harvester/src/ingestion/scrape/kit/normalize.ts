import { canonicalizeUrl, generateIdentityKey } from '../../../scraper/utils/url.js'
import type {
  NormalizeInput,
  NormalizedScrapeOffer,
  ScrapePluginManifest,
  RawScrapeOffer,
} from '../types.js'
import { isPrivateOrReservedHost } from './network.js'

export function computeIdentityKey(input: {
  retailerProductId?: string
  retailerSku?: string
  canonicalUrl: string
}): string {
  return generateIdentityKey(input.retailerProductId, input.retailerSku, input.canonicalUrl)
}

function parsePositiveInt(value: string | number | undefined): number | undefined {
  if (value === undefined || value === null) {
    return undefined
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? Math.round(value) : undefined
  }

  const stripped = value.replace(/[^0-9.]/g, '')
  const parsed = Number.parseFloat(stripped)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined
  }

  return Math.round(parsed)
}

function parsePriceCents(price: string | number): number | null {
  if (typeof price === 'number') {
    return Number.isFinite(price) && price > 0 ? Math.round(price * 100) : null
  }

  const cleaned = price.replace(/[$,\s]/g, '')
  const parsed = Number.parseFloat(cleaned)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }
  return Math.round(parsed * 100)
}

function normalizeAvailability(raw: string): NormalizedScrapeOffer['availability'] {
  const value = raw.trim().toUpperCase()
  if (value.includes('IN_STOCK') || value.includes('IN STOCK') || value.includes('AVAILABLE')) {
    return 'IN_STOCK'
  }
  if (value.includes('BACKORDER') || value.includes('PREORDER')) {
    return 'BACKORDER'
  }
  if (value.includes('OUT_OF_STOCK') || value.includes('OUT OF STOCK') || value.includes('SOLD OUT')) {
    return 'OUT_OF_STOCK'
  }
  return 'UNKNOWN'
}

function normalizeUrlOrFallback(rawUrl: string, fallbackUrl: string): string {
  const candidate = rawUrl.trim() || fallbackUrl
  return canonicalizeUrl(candidate)
}

export function normalizeOffer(input: NormalizeInput): NormalizedScrapeOffer {
  const raw: RawScrapeOffer = input.rawOffer
  const canonicalUrl = normalizeUrlOrFallback(raw.url, raw.url)
  // Preserve parse failures as NaN so validation can emit a specific reason.
  const priceCents = parsePriceCents(raw.price) ?? Number.NaN
  const roundCount = parsePositiveInt(raw.roundCount)
  const grainWeight = parsePositiveInt(raw.grainWeight)

  const normalized: NormalizedScrapeOffer = {
    sourceId: input.sourceId,
    retailerId: input.retailerId,
    url: canonicalUrl,
    title: raw.title.trim(),
    priceCents,
    currency: 'USD',
    availability: normalizeAvailability(raw.availability),
    observedAt: input.observedAt,
    identityKey: computeIdentityKey({
      retailerProductId: raw.retailerProductId,
      retailerSku: raw.retailerSku,
      canonicalUrl,
    }),
    retailerSku: raw.retailerSku?.trim() || undefined,
    retailerProductId: raw.retailerProductId?.trim() || undefined,
    upc: raw.upc?.trim() || undefined,
    brand: raw.brand?.trim() || undefined,
    caliber: raw.caliber?.trim() || undefined,
    grainWeight,
    roundCount,
    caseMaterial: raw.caseMaterial?.trim() || undefined,
    bulletType: raw.bulletType?.trim() || undefined,
    loadType: raw.loadType?.trim() || undefined,
    shellLength: raw.shellLength?.trim() || undefined,
    imageUrl: raw.imageUrl?.trim() || undefined,
    shippingCents: raw.shippingCents ?? undefined,
    taxIncluded: raw.taxIncluded,
    adapterVersion: input.manifest.version,
  }

  if (roundCount && roundCount > 0) {
    normalized.costPerRoundCents = Math.round(normalized.priceCents / roundCount)
  }

  return normalized
}

export function validateBaseUrls(manifest: ScrapePluginManifest): {
  ok: boolean
  error?: string
} {
  if (!manifest.baseUrls.length) {
    return { ok: false, error: 'manifest.baseUrls must not be empty' }
  }

  for (const entry of manifest.baseUrls) {
    try {
      const parsed = new URL(entry)
      if (parsed.protocol !== 'https:') {
        return { ok: false, error: `base URL must be https: ${entry}` }
      }
      const host = parsed.hostname.toLowerCase()
      if (isPrivateOrReservedHost(host)) {
        return { ok: false, error: `base URL host is blocked: ${entry}` }
      }
    } catch {
      return { ok: false, error: `invalid base URL: ${entry}` }
    }
  }

  return { ok: true }
}
