/**
 * UPC/EAN/GTIN Normalization
 *
 * Canonical normalization for barcode identifiers used across IronScout.
 * All barcode validation and normalization should flow through this module.
 *
 * Valid barcode lengths per GS1 standard:
 *   8  — UPC-E / EAN-8
 *  12  — UPC-A
 *  13  — EAN-13
 *  14  — GTIN-14
 *
 * Lengths 9, 10, 11, 15+ are NOT valid barcode formats and are rejected.
 */

/** Bump when normalization logic changes (for cache invalidation / audit) */
export const UPC_NORMALIZATION_VERSION = '1.0.0'

/** Valid barcode lengths per GS1 standard */
export const VALID_BARCODE_LENGTHS = [8, 12, 13, 14] as const

/**
 * Check whether a digit string is a valid barcode length.
 */
export function isValidBarcode(digits: string): boolean {
  return (VALID_BARCODE_LENGTHS as readonly number[]).includes(digits.length)
}

/**
 * Validate & normalize a UPC/EAN/GTIN string.
 *
 * - Strips all non-digit characters (hyphens, spaces, etc.)
 * - Rejects codes whose digit count is not in VALID_BARCODE_LENGTHS
 * - Preserves leading zeros exactly (they are significant in barcodes)
 *
 * @returns Digit-only string of valid length, or null if invalid/empty
 */
export function normalizeUpc(upc: string | null | undefined): string | null {
  if (!upc) return null

  const digits = upc.replace(/\D/g, '')

  if (!digits) return null

  if (!isValidBarcode(digits)) return null

  return digits
}

/**
 * Normalize a UPC and pad to canonical 12-digit form for storage.
 *
 * Calls normalizeUpc first, then pads with leading zeros to 12 digits.
 * This is the form stored in products.upcNorm and used as canonical keys.
 *
 * Padding behavior:
 * - 8-digit UPC-E → padded to 12 digits (e.g. "01234567" → "000001234567")
 * - 12/13/14-digit codes → unchanged (already >= 12 digits)
 *
 * LEGACY COMPAT NOTE: The padStart(12, '0') for 8-digit UPC-E is a
 * backward-compatible shim, NOT proper GS1 UPC-E→UPC-A expansion.
 * Proper expansion requires mapping based on the last digit of the
 * UPC-E payload. A future migration (see #226 follow-up) will add
 * real GS1 expansion and backfill existing records.
 *
 * @returns 12+-digit canonical string, or null if input is invalid
 */
export function toCanonicalUpc(upc: string | null | undefined): string | null {
  const normalized = normalizeUpc(upc)
  if (!normalized) return null
  return normalized.padStart(12, '0')
}
