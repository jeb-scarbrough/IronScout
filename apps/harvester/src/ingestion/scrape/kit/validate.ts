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

export type ValidateScrapeConfigResult =
  | { ok: true; value: Record<string, unknown>; unknownTopLevelKeys: string[] }
  | { ok: false; error: string }

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function validateScrapeConfig(raw: unknown): ValidateScrapeConfigResult {
  if (!isPlainObject(raw)) {
    return { ok: false, error: 'scrapeConfig must be a JSON object' }
  }

  const config = raw as Record<string, unknown>
  const knownKeys = new Set(['fetcherType', 'rateLimit', 'customHeaders', 'discovery'])

  if (config.fetcherType !== undefined && config.fetcherType !== 'http') {
    return { ok: false, error: "scrapeConfig.fetcherType must be 'http' in v1" }
  }

  if (config.rateLimit !== undefined) {
    if (!isPlainObject(config.rateLimit)) {
      return { ok: false, error: 'scrapeConfig.rateLimit must be an object' }
    }

    const rateLimit = config.rateLimit as Record<string, unknown>
    if (
      rateLimit.requestsPerSecond !== undefined &&
      (typeof rateLimit.requestsPerSecond !== 'number' || rateLimit.requestsPerSecond <= 0)
    ) {
      return { ok: false, error: 'scrapeConfig.rateLimit.requestsPerSecond must be > 0' }
    }

    if (
      rateLimit.minDelayMs !== undefined &&
      (typeof rateLimit.minDelayMs !== 'number' || rateLimit.minDelayMs < 0)
    ) {
      return { ok: false, error: 'scrapeConfig.rateLimit.minDelayMs must be >= 0' }
    }

    if (
      rateLimit.maxConcurrent !== undefined &&
      (typeof rateLimit.maxConcurrent !== 'number' || rateLimit.maxConcurrent <= 0)
    ) {
      return { ok: false, error: 'scrapeConfig.rateLimit.maxConcurrent must be > 0' }
    }
  }

  if (config.customHeaders !== undefined) {
    if (!isPlainObject(config.customHeaders)) {
      return { ok: false, error: 'scrapeConfig.customHeaders must be an object' }
    }
    for (const [key, value] of Object.entries(config.customHeaders)) {
      if (typeof value !== 'string') {
        return { ok: false, error: `scrapeConfig.customHeaders.${key} must be a string` }
      }
    }
  }

  if (config.discovery !== undefined && !isPlainObject(config.discovery)) {
    return { ok: false, error: 'scrapeConfig.discovery must be an object when present' }
  }

  const unknownTopLevelKeys = Object.keys(config)
    .filter(key => !knownKeys.has(key))
    .sort((a, b) => a.localeCompare(b))

  return {
    ok: true,
    value: config,
    unknownTopLevelKeys,
  }
}
