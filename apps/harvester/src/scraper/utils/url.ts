/**
 * URL Canonicalization Utilities
 *
 * Per scraper-framework-01 spec v0.5 Appendix A
 *
 * Rules:
 * 1. Enforce https (upgrade http)
 * 2. Remove tracking parameters: utm_*, fbclid, gclid, ref, source, campaign
 * 3. Remove fragment identifiers (#...)
 * 4. Lowercase hostname
 * 5. Remove trailing slash (except root path)
 * 6. Remove empty query parameters
 * 7. Sort query parameters alphabetically (for consistent hashing)
 */

import { createHash } from 'crypto'
import psl from 'psl'

/**
 * Tracking parameters to remove from URLs.
 * These are marketing/analytics parameters that don't affect page content.
 */
const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'fbclid',
  'gclid',
  'ref',
  'source',
  'campaign',
])

/**
 * Canonicalize a URL for deduplication.
 *
 * @param url - The URL to canonicalize
 * @returns The canonicalized URL
 * @throws Error if URL is invalid
 */
export function canonicalizeUrl(url: string): string {
  const parsed = new URL(url)

  // 1. Enforce https
  parsed.protocol = 'https:'

  // 2. Lowercase hostname
  parsed.hostname = parsed.hostname.toLowerCase()

  // 3. Remove tracking params
  for (const param of TRACKING_PARAMS) {
    parsed.searchParams.delete(param)
  }

  // Also remove any utm_* params not in our explicit list
  const keysToDelete: string[] = []
  for (const key of parsed.searchParams.keys()) {
    if (key.startsWith('utm_')) {
      keysToDelete.push(key)
    }
  }
  for (const key of keysToDelete) {
    parsed.searchParams.delete(key)
  }

  // 4. Remove empty query parameters
  const emptyKeys: string[] = []
  for (const [key, value] of parsed.searchParams.entries()) {
    if (value === '') {
      emptyKeys.push(key)
    }
  }
  for (const key of emptyKeys) {
    parsed.searchParams.delete(key)
  }

  // 5. Sort remaining params alphabetically
  parsed.searchParams.sort()

  // 6. Remove fragment
  parsed.hash = ''

  // 7. Remove trailing slash (except root)
  if (parsed.pathname !== '/' && parsed.pathname.endsWith('/')) {
    parsed.pathname = parsed.pathname.slice(0, -1)
  }

  return parsed.toString()
}

/**
 * Validate that a URL is valid and has a supported protocol.
 *
 * @param url - The URL to validate
 * @returns True if valid, false otherwise
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Extract the registrable domain (eTLD+1) from a URL.
 * For rate limiting, we scope by registrable domain.
 *
 * Uses the Public Suffix List (psl) library for proper eTLD+1 handling,
 * correctly handling multi-part TLDs like .co.uk, .com.au, etc.
 *
 * @param url - The URL to extract domain from
 * @returns The registrable domain (e.g., "sgammo.com" from "www.sgammo.com")
 */
export function getRegistrableDomain(url: string): string {
  const parsed = new URL(url)
  const hostname = parsed.hostname.toLowerCase()

  // Use psl library for proper eTLD+1 parsing
  const parsedDomain = psl.parse(hostname)

  if (parsedDomain.error) {
    // On parsing error, fall back to hostname
    return hostname
  }

  // parsedDomain.domain is the registrable domain (eTLD+1)
  // e.g., "example.co.uk" for "www.example.co.uk"
  return parsedDomain.domain || hostname
}

/**
 * Generate a URL hash for identity key fallback.
 * Per Appendix B: URL:{urlHash} where urlHash is SHA-256 of canonical URL, first 16 chars.
 *
 * @param url - The URL to hash (should be canonical)
 * @returns The first 16 characters of the SHA-256 hash
 */
export function hashUrl(url: string): string {
  const hash = createHash('sha256').update(url).digest('hex')
  return hash.slice(0, 16)
}

/**
 * Generate an identity key from available identifiers.
 * Per Appendix B:
 * Priority: retailerProductId > retailerSku > urlHash
 *
 * @param retailerProductId - Retailer's product ID if available
 * @param retailerSku - Retailer's SKU if available
 * @param canonicalUrl - The canonical URL (for fallback hash)
 * @returns Identity key in format {idType}:{idValue}
 */
export function generateIdentityKey(
  retailerProductId: string | undefined,
  retailerSku: string | undefined,
  canonicalUrl: string
): string {
  if (retailerProductId && retailerProductId.trim()) {
    return `PID:${retailerProductId.trim()}`
  }

  if (retailerSku && retailerSku.trim()) {
    return `SKU:${retailerSku.trim()}`
  }

  return `URL:${hashUrl(canonicalUrl)}`
}

/**
 * Parse an identity key into its components.
 *
 * @param identityKey - The identity key to parse
 * @returns Object with idType and idValue
 * @throws Error if identity key format is invalid
 */
export function parseIdentityKey(identityKey: string): { idType: string; idValue: string } {
  const colonIndex = identityKey.indexOf(':')
  if (colonIndex === -1) {
    throw new Error(`Invalid identity key format: missing colon separator`)
  }

  const idType = identityKey.slice(0, colonIndex)
  const idValue = identityKey.slice(colonIndex + 1)

  if (!['PID', 'SKU', 'URL'].includes(idType)) {
    throw new Error(`Invalid identity key type: ${idType}`)
  }

  if (!idValue) {
    throw new Error(`Invalid identity key: empty value`)
  }

  if (idValue.includes(':')) {
    throw new Error(`Invalid identity key: value cannot contain ':'`)
  }

  if (idValue.length > 255) {
    throw new Error(`Invalid identity key: value exceeds 255 characters`)
  }

  return { idType, idValue }
}
