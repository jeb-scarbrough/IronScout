import type { ParsedFeedProduct } from './types'

export const AMMO_PACK_RE = /\b(?:rounds?|rds?)\b/i
export const AMMO_CONTEXT_RE = /\b(?:ammo|ammunition|cartridges?|loads?|shells?)\b/i
export const HANDLOADING_RE = /\bprojectiles?\b.*\bhandloading\b|\bhandloading\b.*\bprojectiles?\b/i

/**
 * Count ammunition signals for a product (0-4).
 * Shared by prescan and runtime quarantine filtering to avoid logic drift.
 */
export function countAmmoSignals(product: ParsedFeedProduct): number {
  let signals = 0
  if (product.caliber) signals++
  if (product.grainWeight) signals++
  if (AMMO_PACK_RE.test(product.name)) signals++
  if (AMMO_CONTEXT_RE.test(product.name)) signals++
  return signals
}

/**
 * Signal-only ammunition filter used by filterNonAmmunition.
 */
export function passesNonAmmunitionFilter(product: ParsedFeedProduct): boolean {
  if (HANDLOADING_RE.test(product.name)) return false
  return countAmmoSignals(product) > 0
}

/**
 * True when the product would survive both quarantine filters:
 * 1) non-ammunition filter
 * 2) missing caliber filter
 */
export function wouldSurviveQuarantine(product: ParsedFeedProduct): boolean {
  return Boolean(product.caliber) && passesNonAmmunitionFilter(product)
}
