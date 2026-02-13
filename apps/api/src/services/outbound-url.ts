/**
 * Outbound URL Generation for API Responses
 *
 * Generates signed out_url values for each offer/price row returned by the API.
 * Uses HMAC-SHA256 from @ironscout/crypto to sign the canonical payload.
 *
 * Environment:
 *   OUTBOUND_LINK_SECRET — required for signing. If missing, returns null (fail-closed).
 *   NEXT_PUBLIC_APP_URL  — base URL for the web app. Falls back to production URL.
 *
 * @see context/specs/outbound-redirect-v1.md
 */

import { computeOutboundSignature, buildOutboundUrl } from '@ironscout/crypto'
import { logger } from '../config/logger'

const log = logger

let warnedMissingSecret = false

/**
 * Generate a signed out_url for a single offer/price row.
 *
 * @param destinationUrl - The raw retailer product URL
 * @param rid - Retailer ID (optional)
 * @param pid - Product ID (optional)
 * @returns Absolute signed outbound URL, or null if OUTBOUND_LINK_SECRET is not configured
 */
export function generateOutUrl(
  destinationUrl: string,
  rid?: string,
  pid?: string,
): string | null {
  const secret = process.env.OUTBOUND_LINK_SECRET
  if (!secret) {
    if (!warnedMissingSecret) {
      log.warn('OUTBOUND_LINK_SECRET not set — out_url will be null')
      warnedMissingSecret = true
    }
    return null
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.ironscout.ai'

  // pl is empty: API does not know placement. Placement is tracked in GA4 only.
  const payload = { u: destinationUrl, rid: rid ?? '', pid: pid ?? '', pl: '' }
  const sig = computeOutboundSignature(payload, secret)

  return buildOutboundUrl({ baseUrl, payload, sig })
}
