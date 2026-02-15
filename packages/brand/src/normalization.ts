/**
 * Brand normalization for resolver/admin brand alias workflows.
 * Shared canonical implementation per brand-aliases-v1 spec.
 */

// Current normalization version - bump when rules change.
export const BRAND_NORMALIZATION_VERSION = 1

// Corporate suffix tokens to strip.
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

// Generic tokens that should not be standalone aliases.
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

// Short aliases (2-3 chars) that are explicitly allowed.
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
 *
 * @param brand - Raw brand string to normalize
 * @returns Normalized brand string, or undefined if input is empty/null
 */
export function normalizeBrandString(brand?: string | null): string | undefined {
  if (!brand || brand.trim().length === 0) {
    return undefined
  }

  let normalized = brand

  // Step 1: Strip trademark symbols BEFORE NFKD normalization.
  // NFKD converts ™ to "TM", so strip them first.
  normalized = normalized.replace(/[\u2122\u00AE\u00A9]/g, '')
  normalized = normalized.replace(/\(tm\)/gi, '')
  normalized = normalized.replace(/\(r\)/gi, '')
  normalized = normalized.replace(/\(c\)/gi, '')

  // Step 2: Unicode normalization (NFKD) to decompose characters.
  normalized = normalized.normalize('NFKD')

  // Step 3: Strip diacritical marks (combining characters).
  normalized = normalized.replace(/[\u0300-\u036f]/g, '')

  // Step 4: Lowercase.
  normalized = normalized.toLowerCase()

  // Step 5: Normalize ampersand to "and".
  normalized = normalized.replace(/&/g, ' and ')

  // Step 6: Collapse punctuation/separators to whitespace.
  normalized = normalized.replace(/[\/|\\-_.,;:'"!?()[\]{}]/g, ' ')

  // Step 7: Collapse repeated whitespace.
  normalized = normalized.replace(/\s+/g, ' ').trim()

  // Step 8: Strip corporate suffixes from end.
  const tokens = normalized.split(' ')
  const filteredTokens = tokens.filter((token, index) => {
    if (index === tokens.length - 1 || index === tokens.length - 2) {
      return !CORPORATE_SUFFIXES.has(token)
    }
    return true
  })
  normalized = filteredTokens.join(' ')

  // Step 9: Final trim and collapse.
  normalized = normalized.replace(/\s+/g, ' ').trim()

  if (normalized.length === 0) {
    return undefined
  }

  return normalized
}

/**
 * Validate an alias for creation.
 *
 * @param aliasNorm - Normalized alias string
 * @param canonicalNorm - Normalized canonical string
 * @returns Validation error messages (empty if valid)
 */
export function validateAliasForCreation(aliasNorm: string, canonicalNorm: string): string[] {
  const errors: string[] = []

  if (!aliasNorm || aliasNorm.length === 0) {
    errors.push('Alias cannot be empty')
    return errors
  }

  if (aliasNorm.length < 2) {
    errors.push('Alias must be at least 2 characters')
  }

  if (aliasNorm.length >= 2 && aliasNorm.length <= 3) {
    if (!SHORT_ALIAS_ALLOWLIST.has(aliasNorm)) {
      errors.push(
        `Short aliases (2-3 chars) must be on the allowlist. "${aliasNorm}" is not allowed.`
      )
    }
  }

  if (GENERIC_TOKEN_BLOCKLIST.has(aliasNorm)) {
    errors.push(`"${aliasNorm}" is a generic term and cannot be used as an alias`)
  }

  if (aliasNorm === canonicalNorm) {
    errors.push('Alias cannot be the same as the canonical name')
  }

  return errors
}

/**
 * Check if an alias can be auto-activated based on spec criteria.
 */
export function canAutoActivate(
  aliasNorm: string,
  sourceType: 'RETAILER_FEED' | 'AFFILIATE_FEED' | 'MANUAL',
  estimatedDailyImpact: number,
  canonicalExistsInProducts: boolean,
  canonicalExistsAsActiveCanonical: boolean
): { canActivate: boolean; reason?: string } {
  if (sourceType === 'MANUAL') {
    return { canActivate: false, reason: 'Manual aliases require review' }
  }

  if (aliasNorm.length < 4) {
    return { canActivate: false, reason: 'Short aliases require review' }
  }

  if (GENERIC_TOKEN_BLOCKLIST.has(aliasNorm)) {
    return { canActivate: false, reason: 'Generic terms require review' }
  }

  if (!canonicalExistsInProducts && !canonicalExistsAsActiveCanonical) {
    return { canActivate: false, reason: 'Unknown canonical brand requires review' }
  }

  if (estimatedDailyImpact >= 500) {
    return { canActivate: false, reason: 'High-impact aliases require review' }
  }

  return { canActivate: true }
}
