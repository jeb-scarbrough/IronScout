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

/**
 * Luhn algorithm check for credit card number validation.
 * Returns true if the number passes the Luhn checksum.
 */
function passesLuhn(digits: string): boolean {
  const nums = digits.split('').map(Number)
  let sum = 0
  let isSecond = false
  for (let i = nums.length - 1; i >= 0; i--) {
    let d = nums[i]
    if (isSecond) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
    isSecond = !isSecond
  }
  return sum % 10 === 0
}

/**
 * PII pattern definitions.
 *
 * Detected types:
 * - EMAIL: user@domain.tld
 * - PHONE: US 10-digit (e.g., 555-123-4567) and international (e.g., +44 20 7946 0958)
 * - SSN: 9-digit US Social Security numbers (e.g., 123-45-6789)
 * - ZIP: US ZIP codes, 5-digit and ZIP+4
 * - CARD: Credit/debit card numbers with separators (Luhn-validated)
 *
 * Note: We intentionally do NOT match bare 13-19 digit sequences without separators
 * because they cause false positives with UPCs, order IDs, etc. Only structured
 * card formats (with spaces/dashes) are detected, and those are Luhn-validated.
 */
const PII_PATTERNS: Array<{ regex: RegExp; label: string; validate?: (match: string) => boolean }> = [
  { regex: /\b[\w.-]+@[\w.-]+\.\w{2,}\b/gi, label: '[EMAIL]' },
  { regex: /\+\d{1,3}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{2,4}[-.\s]?\d{3,4}\b/g, label: '[PHONE]' },
  { regex: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, label: '[PHONE]' },
  { regex: /\b\d{3}[-]?\d{2}[-]?\d{4}\b/g, label: '[SSN]' },
  { regex: /\b\d{5}(-\d{4})?\b/g, label: '[ZIP]' },
  // Card patterns with separators - require Luhn validation to reduce false positives
  { regex: /\b\d{4}[- ]\d{4}[- ]\d{4}[- ]\d{4}\b/g, label: '[CARD]', validate: (m) => passesLuhn(m.replace(/[- ]/g, '')) },
  { regex: /\b\d{4}[- ]\d{6}[- ]\d{5}\b/g, label: '[CARD]', validate: (m) => passesLuhn(m.replace(/[- ]/g, '')) },
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
 * Heuristic check for emails, phone numbers, SSNs, ZIP codes, and card numbers.
 */
export function hasPii(query: string): boolean {
  return PII_PATTERNS.some(({ regex, validate }) => {
    regex.lastIndex = 0
    const match = regex.exec(query)
    if (!match) return false
    // If pattern has a validator, only count as PII if validation passes
    return validate ? validate(match[0]) : true
  })
}

/**
 * Redact PII patterns from a query string.
 * Replaces emails, phone numbers, SSNs, ZIP codes, and card numbers with labels.
 */
export function redactPii(query: string): string {
  let result = query
  for (const { regex, label, validate } of PII_PATTERNS) {
    regex.lastIndex = 0
    if (validate) {
      // For patterns with validators, only replace matches that pass validation
      result = result.replace(regex, (match) => validate(match) ? label : match)
    } else {
      result = result.replace(regex, label)
    }
  }
  return result
}
