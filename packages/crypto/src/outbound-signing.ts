/**
 * Outbound Link Signing
 *
 * HMAC-SHA256 signing and verification for outbound redirect URLs.
 * Used by apps/api (signing) and apps/web (verification in /out handler).
 *
 * Canonical payload format: u=<enc>&rid=<enc>&pid=<enc>&pl=<enc>
 * All four keys are always present. Values are percent-encoded with
 * encodeURIComponent before concatenation to prevent delimiter collisions.
 *
 * @see context/specs/outbound-redirect-v1.md
 */

import crypto from 'crypto'

export interface OutboundPayload {
  u: string
  rid?: string
  pid?: string
  pl?: string
}

/**
 * Build the canonical payload string for HMAC signing.
 *
 * Fixed order: u, rid, pid, pl. All four keys always present.
 * Values are percent-encoded before concatenation.
 */
export function buildCanonicalPayload(payload: OutboundPayload): string {
  const u = encodeURIComponent(payload.u ?? '')
  const rid = encodeURIComponent(payload.rid ?? '')
  const pid = encodeURIComponent(payload.pid ?? '')
  const pl = encodeURIComponent(payload.pl ?? '')
  return `u=${u}&rid=${rid}&pid=${pid}&pl=${pl}`
}

/**
 * Compute HMAC-SHA256 signature over the canonical payload.
 * Returns base64url with no padding.
 */
export function computeOutboundSignature(
  payload: OutboundPayload,
  secret: string
): string {
  const canonical = buildCanonicalPayload(payload)
  return crypto
    .createHmac('sha256', secret)
    .update(canonical, 'utf8')
    .digest('base64url')
}

/**
 * Verify an HMAC signature in constant time.
 *
 * Supports dual-key verification for secret rotation:
 * - First checks against currentSecret
 * - If that fails and previousSecret is provided, checks against previousSecret
 *
 * Mismatched signature lengths fail immediately (before timingSafeEqual).
 */
export function verifyOutboundSignature(
  payload: OutboundPayload,
  sig: string,
  currentSecret: string,
  previousSecret?: string
): boolean {
  if (constantTimeVerify(payload, sig, currentSecret)) {
    return true
  }
  if (previousSecret) {
    return constantTimeVerify(payload, sig, previousSecret)
  }
  return false
}

function constantTimeVerify(
  payload: OutboundPayload,
  sig: string,
  secret: string
): boolean {
  const expected = computeOutboundSignature(payload, secret)
  const sigBuf = Buffer.from(sig, 'utf8')
  const expectedBuf = Buffer.from(expected, 'utf8')

  if (sigBuf.length !== expectedBuf.length) {
    return false
  }

  return crypto.timingSafeEqual(sigBuf, expectedBuf)
}
