/**
 * PII Detection and Redaction Utilities
 *
 * Regex-based free-text content redaction for user queries.
 * Distinct from `lib/redact.ts` which does allowlist-based deep object
 * redaction for structured logging.
 *
 * Used by:
 * - Lens telemetry (query hashing / PII-safe logging)
 * - Query analytics logging
 */

import { createHash } from 'crypto'

const PII_PATTERNS = [
  { regex: /\b[\w.-]+@[\w.-]+\.\w{2,}\b/gi, label: '[EMAIL]' },
  { regex: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, label: '[PHONE]' },
  { regex: /\b\d{3}[-]?\d{2}[-]?\d{4}\b/g, label: '[SSN]' },
  { regex: /\b\d{5}(-\d{4})?\b/g, label: '[ZIP]' },
]

/**
 * Normalize a query for consistent hashing.
 * Lowercases, trims, and collapses whitespace.
 */
export function normalizeQuery(query: string): string {
  return query.toLowerCase().trim().replace(/\s+/g, ' ')
}

/**
 * Hash a query string for PII-safe logging.
 * SHA-256 of the normalized query.
 */
export function hashQuery(query: string): string {
  return createHash('sha256')
    .update(normalizeQuery(query))
    .digest('hex')
}

/**
 * Check if a query likely contains PII.
 * Heuristic check for emails, phone numbers, SSNs, ZIP codes.
 */
export function hasPii(query: string): boolean {
  return PII_PATTERNS.some(({ regex }) => {
    // Reset lastIndex for global regexes
    regex.lastIndex = 0
    return regex.test(query)
  })
}

/**
 * Redact PII patterns from a query string.
 * Replaces emails, phone numbers, SSNs, ZIP codes with labels.
 */
export function redactPii(query: string): string {
  let result = query
  for (const { regex, label } of PII_PATTERNS) {
    regex.lastIndex = 0
    result = result.replace(regex, label)
  }
  return result
}
