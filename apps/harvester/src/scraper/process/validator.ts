/**
 * Offer Validator (Fail-Closed)
 *
 * Per scraper-framework-01 spec v0.5 §5.1
 *
 * Validates scraped offers before writing to database.
 * Fail-closed: missing required fields cause drop, not quarantine.
 */

import type { ScrapedOffer, NormalizeResult, DropReason, QuarantineReason } from '../types.js'
import { isValidUrl } from '../utils/url.js'

/**
 * Required fields that MUST be present for an offer to be written.
 * Missing any of these causes a DROP (fail-closed).
 */
const REQUIRED_FIELDS: (keyof ScrapedOffer)[] = [
  'sourceId',
  'retailerId',
  'url',
  'title',
  'priceCents',
  'currency',
  'availability',
  'observedAt',
  'identityKey',
  'adapterVersion',
]

/**
 * Validate that all required fields are present.
 * Returns the first missing field or null if all present.
 */
function findMissingRequiredField(offer: ScrapedOffer): string | null {
  for (const field of REQUIRED_FIELDS) {
    const value = offer[field]
    if (value === undefined || value === null || value === '') {
      return field
    }
  }
  return null
}

/**
 * Validate price is a valid positive integer.
 */
function isValidPrice(priceCents: number): boolean {
  // Must be positive integer
  if (!Number.isInteger(priceCents) || priceCents < 1) {
    return false
  }

  // Max price: $999,999.99 = 99999999 cents
  if (priceCents > 99999999) {
    return false
  }

  return true
}

/**
 * Check if price is zero (separate from invalid).
 * Zero prices are quarantined, not dropped.
 */
function isZeroPrice(priceCents: number): boolean {
  return priceCents === 0
}

/**
 * Validate an offer for writing to database.
 * Implements fail-closed semantics per spec.
 *
 * @param offer - The offer to validate
 * @param seenIdentityKeys - Set of identity keys already seen in this run (for dedup)
 * @returns Validation result (ok, drop, or quarantine)
 */
export function validateOffer(
  offer: ScrapedOffer,
  seenIdentityKeys?: Set<string>
): NormalizeResult {
  // Check for missing required fields (DROP)
  const missingField = findMissingRequiredField(offer)
  if (missingField) {
    return {
      status: 'drop',
      reason: 'MISSING_REQUIRED_FIELD',
      offer,
    }
  }

  // Check for UNKNOWN availability (DROP - fail-closed)
  if (offer.availability === 'UNKNOWN') {
    return {
      status: 'drop',
      reason: 'UNKNOWN_AVAILABILITY',
      offer,
    }
  }

  // Check for zero price (QUARANTINE)
  if (isZeroPrice(offer.priceCents)) {
    return {
      status: 'quarantine',
      reason: 'ZERO_PRICE_EXTRACTED',
      offer,
    }
  }

  // Check for invalid price (DROP)
  if (!isValidPrice(offer.priceCents)) {
    return {
      status: 'drop',
      reason: 'INVALID_PRICE',
      offer,
    }
  }

  // Check for invalid URL (DROP)
  if (!isValidUrl(offer.url)) {
    return {
      status: 'drop',
      reason: 'INVALID_URL',
      offer,
    }
  }

  // Check for duplicate within run (DROP)
  if (seenIdentityKeys?.has(offer.identityKey)) {
    return {
      status: 'drop',
      reason: 'DUPLICATE_WITHIN_RUN',
      offer,
    }
  }

  // All validations passed
  return {
    status: 'ok',
    offer,
  }
}

/**
 * Create a drop result for extraction failures.
 * Used when adapter returns { ok: false, reason }.
 */
export function createDropFromExtractFailure(
  reason: string,
  partialOffer: Partial<ScrapedOffer>
): NormalizeResult {
  // Map extraction failure reasons to drop reasons
  let dropReason: DropReason = 'MISSING_REQUIRED_FIELD'

  if (reason === 'OOS_NO_PRICE') {
    dropReason = 'OOS_NO_PRICE'
  } else if (reason === 'BLOCKED_BY_ROBOTS_TXT') {
    dropReason = 'BLOCKED_BY_ROBOTS_TXT'
  }

  return {
    status: 'drop',
    reason: dropReason,
    // Create minimal offer for logging/tracking
    offer: {
      sourceId: partialOffer.sourceId ?? '',
      retailerId: partialOffer.retailerId ?? '',
      url: partialOffer.url ?? '',
      title: partialOffer.title ?? '',
      priceCents: partialOffer.priceCents ?? 0,
      currency: partialOffer.currency ?? 'USD',
      availability: partialOffer.availability ?? 'UNKNOWN',
      observedAt: partialOffer.observedAt ?? new Date(),
      identityKey: partialOffer.identityKey ?? '',
      adapterVersion: partialOffer.adapterVersion ?? '',
    },
  }
}

/**
 * Check if a drop reason should be counted toward drift metrics.
 * Per spec §7.2: OOS_NO_PRICE drops are NOT counted toward drift.
 */
export function shouldCountTowardDrift(reason: DropReason): boolean {
  // OOS_NO_PRICE is expected behavior, not drift
  if (reason === 'OOS_NO_PRICE') {
    return false
  }

  // Duplicates are not drift (just dedup)
  if (reason === 'DUPLICATE_WITHIN_RUN') {
    return false
  }

  // All other drops count toward drift
  return true
}

/**
 * Map quarantine reason to a human-readable message.
 */
export function quarantineReasonToMessage(reason: QuarantineReason): string {
  switch (reason) {
    case 'VALIDATION_FAILED':
      return 'Offer failed validation'
    case 'DRIFT_DETECTED':
      return 'Offer flagged during drift detection'
    case 'SELECTOR_FAILURE':
      return 'CSS selector failed to extract expected data'
    case 'NORMALIZATION_FAILED':
      return 'Offer normalization failed'
    case 'ZERO_PRICE_EXTRACTED':
      return 'Extracted price was zero'
    case 'AMBIGUOUS_PRICE':
      return 'Multiple prices detected, could not determine correct one'
  }
}

/**
 * Map drop reason to a human-readable message.
 */
export function dropReasonToMessage(reason: DropReason): string {
  switch (reason) {
    case 'MISSING_REQUIRED_FIELD':
      return 'Required field was missing'
    case 'INVALID_PRICE':
      return 'Price was invalid (negative, non-integer, or out of range)'
    case 'INVALID_URL':
      return 'URL was invalid'
    case 'DUPLICATE_WITHIN_RUN':
      return 'Duplicate offer within same run'
    case 'BLOCKED_BY_ROBOTS_TXT':
      return 'URL blocked by robots.txt'
    case 'OOS_NO_PRICE':
      return 'Out of stock page with no price displayed'
    case 'UNKNOWN_AVAILABILITY':
      return 'Could not determine availability from page'
  }
}
