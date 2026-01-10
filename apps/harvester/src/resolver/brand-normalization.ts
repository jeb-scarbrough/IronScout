/**
 * Brand Normalization for Resolver
 * Per brand-aliases-v1 spec: Shared normalization rules between resolver and alias management.
 *
 * Normalization rules:
 * - Unicode normalization (NFKD) + strip diacritics
 * - lowercase
 * - normalize ampersand to "and"
 * - strip trademark symbols (TM, R, (C))
 * - strip common corporate suffix tokens
 * - collapse punctuation/separators to whitespace
 * - collapse repeated tokens and whitespace
 */

// Current normalization version - bump when rules change
export const BRAND_NORMALIZATION_VERSION = 1

// Corporate suffix tokens to strip
const CORPORATE_SUFFIXES = new Set([
  'inc',
  'incorporated',
  'llc',
  'ltd',
  'limited',
  'co',
  'corp',
  'corporation',
  'gmbh',
  'sarl',
  'sa',
  'bv',
  'nv',
])

// Generic tokens that should not be standalone aliases
export const GENERIC_TOKEN_BLOCKLIST = new Set([
  'ammo',
  'ammunition',
  'bulk',
  'sale',
  'discount',
  'special',
  'new',
  'best',
  'premium',
])

// Short aliases (2-3 chars) that are explicitly allowed
export const SHORT_ALIAS_ALLOWLIST = new Set([
  'pmc',
  'cci',
  'imi',
  'ppu',
  'cbc',
  'wpa',
  'tul',
  'hsm',
  'hpr',
])

/**
 * Normalize a brand string for matching.
 * This is the canonical normalization function used by both resolver and alias management.
 *
 * @param brand - Raw brand string to normalize
 * @returns Normalized brand string, or undefined if input is empty/null
 */
export function normalizeBrandString(brand?: string | null): string | undefined {
  if (!brand || brand.trim().length === 0) {
    return undefined
  }

  let normalized = brand

  // Step 1: Strip trademark symbols BEFORE NFKD normalization
  // NFKD converts ™ to "TM", so we must strip these first
  // ™ (U+2122), ® (U+00AE), © (U+00A9)
  normalized = normalized.replace(/[\u2122\u00AE\u00A9]/g, '')
  normalized = normalized.replace(/\(tm\)/gi, '')
  normalized = normalized.replace(/\(r\)/gi, '')
  normalized = normalized.replace(/\(c\)/gi, '')

  // Step 2: Unicode normalization (NFKD) to decompose characters
  // This separates base characters from diacritical marks
  normalized = normalized.normalize('NFKD')

  // Step 3: Strip diacritical marks (combining characters)
  // \u0300-\u036f covers combining diacritical marks
  normalized = normalized.replace(/[\u0300-\u036f]/g, '')

  // Step 4: Lowercase
  normalized = normalized.toLowerCase()

  // Step 5: Normalize ampersand to "and"
  normalized = normalized.replace(/&/g, ' and ')

  // Step 6: Collapse punctuation/separators to whitespace
  // Slashes, pipes, hyphens, underscores, dots, commas, etc.
  normalized = normalized.replace(/[\/|\\-_.,;:'"!?()[\]{}]/g, ' ')

  // Step 7: Collapse repeated whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim()

  // Step 8: Strip corporate suffixes (at end of string or followed by space)
  const tokens = normalized.split(' ')
  const filteredTokens = tokens.filter((token, index) => {
    // Only strip suffix tokens from the end
    if (index === tokens.length - 1 || index === tokens.length - 2) {
      return !CORPORATE_SUFFIXES.has(token)
    }
    return true
  })

  normalized = filteredTokens.join(' ')

  // Step 9: Final trim and collapse
  normalized = normalized.replace(/\s+/g, ' ').trim()

  // Return undefined for empty result
  if (normalized.length === 0) {
    return undefined
  }

  return normalized
}

/**
 * Validate an alias for creation.
 * Returns validation errors if any rules are violated.
 *
 * @param aliasNorm - Normalized alias string
 * @param canonicalNorm - Normalized canonical string
 * @returns Array of validation error messages (empty if valid)
 */
export function validateAliasForCreation(
  aliasNorm: string,
  canonicalNorm: string
): string[] {
  const errors: string[] = []

  // Block empty aliasNorm
  if (!aliasNorm || aliasNorm.length === 0) {
    errors.push('Alias cannot be empty')
    return errors
  }

  // Block aliasNorm length < 2
  if (aliasNorm.length < 2) {
    errors.push('Alias must be at least 2 characters')
  }

  // Require allowlist for 2-3 character aliases
  if (aliasNorm.length >= 2 && aliasNorm.length <= 3) {
    if (!SHORT_ALIAS_ALLOWLIST.has(aliasNorm)) {
      errors.push(
        `Short aliases (2-3 chars) must be on the allowlist. "${aliasNorm}" is not allowed.`
      )
    }
  }

  // Block generic tokens as standalone aliases
  if (GENERIC_TOKEN_BLOCKLIST.has(aliasNorm)) {
    errors.push(`"${aliasNorm}" is a generic term and cannot be used as an alias`)
  }

  // Reject aliasNorm == canonicalNorm
  if (aliasNorm === canonicalNorm) {
    errors.push('Alias cannot be the same as the canonical name')
  }

  return errors
}

/**
 * Check if an alias can be auto-activated based on the spec criteria.
 *
 * Auto-activation criteria (all must pass):
 * - sourceType is AFFILIATE_FEED or RETAILER_FEED
 * - aliasNorm length >= 4
 * - aliasNorm not on generic blocklist
 * - canonicalNorm exists in products.brandNorm OR in another ACTIVE row as canonical
 * - Estimated daily impact < 500
 *
 * @param aliasNorm - Normalized alias string
 * @param sourceType - Source type of the alias
 * @param estimatedDailyImpact - Estimated daily impact count
 * @param canonicalExistsInProducts - Whether canonicalNorm exists in products table
 * @param canonicalExistsAsActiveCanonical - Whether canonicalNorm exists as canonical in active aliases
 * @returns Whether the alias can be auto-activated
 */
export function canAutoActivate(
  aliasNorm: string,
  sourceType: 'RETAILER_FEED' | 'AFFILIATE_FEED' | 'MANUAL',
  estimatedDailyImpact: number,
  canonicalExistsInProducts: boolean,
  canonicalExistsAsActiveCanonical: boolean
): { canActivate: boolean; reason?: string } {
  // MANUAL sources always require review
  if (sourceType === 'MANUAL') {
    return { canActivate: false, reason: 'Manual aliases require review' }
  }

  // aliasNorm length >= 4
  if (aliasNorm.length < 4) {
    return { canActivate: false, reason: 'Short aliases require review' }
  }

  // Not on generic blocklist
  if (GENERIC_TOKEN_BLOCKLIST.has(aliasNorm)) {
    return { canActivate: false, reason: 'Generic terms require review' }
  }

  // canonicalNorm must exist somewhere
  if (!canonicalExistsInProducts && !canonicalExistsAsActiveCanonical) {
    return { canActivate: false, reason: 'Unknown canonical brand requires review' }
  }

  // Impact < 500
  if (estimatedDailyImpact >= 500) {
    return { canActivate: false, reason: 'High-impact aliases require review' }
  }

  return { canActivate: true }
}
