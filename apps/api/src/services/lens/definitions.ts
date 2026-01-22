/**
 * Lens Definitions
 *
 * Static lens configurations for IronScout v1.
 * Implements the Search Lens Specification v1.1.0.
 *
 * Governance:
 * - Lens definitions are versioned
 * - Changes require PR review
 * - Lens changes are treated as product policy changes
 * - No semantic changes without an ADR
 */

import { Lens, LensId } from './types'

/**
 * Current lens spec version.
 * Update when lens definitions change.
 */
export const LENS_SPEC_VERSION = '1.1.0'

/**
 * Current lens definition version.
 * Bump on any eligibility/ordering/trigger change.
 */
export const LENS_DEFINITION_VERSION = '1.0.0'

/**
 * ALL Lens - Default lens with no eligibility filters.
 *
 * Ordering:
 * 1. availability DESC
 * 2. pricePerRound ASC
 * 3. canonicalConfidence DESC
 * 4. productId ASC (tie-breaker)
 */
export const ALL_LENS: Lens = {
  id: 'ALL',
  label: 'All Results',
  description: 'Shows all matching products with availability-first ordering',
  triggers: [],  // ALL never auto-applies via triggers
  eligibility: [],  // No filters
  ordering: [
    { field: 'availability', direction: 'DESC' },
    { field: 'pricePerRound', direction: 'ASC' },
    { field: 'canonicalConfidence', direction: 'DESC' },
    // productId ASC tie-breaker is automatically appended by ordering logic
  ],
  version: LENS_DEFINITION_VERSION,
}

/**
 * RANGE Lens - For range/target practice ammunition.
 *
 * Eligibility:
 * - bulletType IN ["FMJ"]
 *
 * Ordering:
 * 1. pricePerRound ASC
 * 2. availability DESC
 * 3. canonicalConfidence DESC
 * 4. productId ASC (tie-breaker)
 */
export const RANGE_LENS: Lens = {
  id: 'RANGE',
  label: 'Range / Training',
  description: 'Full metal jacket ammunition for range practice, sorted by value',
  triggers: [
    { signal: 'usage_hint', value: 'RANGE', minConfidence: 0.7 },
    { signal: 'purpose', value: 'Target', minConfidence: 0.8 },
    { signal: 'purpose', value: 'Training', minConfidence: 0.8 },
  ],
  eligibility: [
    { field: 'bulletType', operator: 'IN', value: ['FMJ'] },
  ],
  ordering: [
    { field: 'pricePerRound', direction: 'ASC' },
    { field: 'availability', direction: 'DESC' },
    { field: 'canonicalConfidence', direction: 'DESC' },
  ],
  version: LENS_DEFINITION_VERSION,
}

/**
 * DEFENSIVE Lens - For self-defense ammunition.
 *
 * Eligibility:
 * - bulletType IN ["HP"]
 *
 * Ordering:
 * 1. availability DESC
 * 2. canonicalConfidence DESC
 * 3. pricePerRound ASC
 * 4. productId ASC (tie-breaker)
 */
export const DEFENSIVE_LENS: Lens = {
  id: 'DEFENSIVE',
  label: 'Defensive',
  description: 'Hollow point ammunition for self-defense, availability-first',
  triggers: [
    { signal: 'usage_hint', value: 'DEFENSIVE', minConfidence: 0.7 },
    { signal: 'purpose', value: 'Defense', minConfidence: 0.8 },
  ],
  eligibility: [
    { field: 'bulletType', operator: 'IN', value: ['HP'] },
  ],
  ordering: [
    { field: 'availability', direction: 'DESC' },
    { field: 'canonicalConfidence', direction: 'DESC' },
    { field: 'pricePerRound', direction: 'ASC' },
  ],
  version: LENS_DEFINITION_VERSION,
}

/**
 * MATCH Lens - For competition/precision ammunition.
 *
 * Eligibility:
 * - bulletType IN ["OTM", "MATCH"]
 *
 * Ordering:
 * 1. canonicalConfidence DESC
 * 2. availability DESC
 * 3. pricePerRound ASC
 * 4. productId ASC (tie-breaker)
 */
export const MATCH_LENS: Lens = {
  id: 'MATCH',
  label: 'Match / Precision',
  description: 'Open tip match ammunition for competition, precision-first',
  triggers: [
    { signal: 'usage_hint', value: 'MATCH', minConfidence: 0.7 },
    { signal: 'qualityLevel', value: 'match-grade', minConfidence: 0.8 },
  ],
  eligibility: [
    { field: 'bulletType', operator: 'IN', value: ['OTM', 'MATCH'] },
  ],
  ordering: [
    { field: 'canonicalConfidence', direction: 'DESC' },
    { field: 'availability', direction: 'DESC' },
    { field: 'pricePerRound', direction: 'ASC' },
  ],
  version: LENS_DEFINITION_VERSION,
}

/**
 * Registry of all lens definitions.
 * Keyed by lens ID for O(1) lookup.
 */
export const LENS_REGISTRY: Readonly<Record<LensId, Lens>> = {
  ALL: ALL_LENS,
  RANGE: RANGE_LENS,
  DEFENSIVE: DEFENSIVE_LENS,
  MATCH: MATCH_LENS,
}

/**
 * Get a lens by ID.
 * @param id - The lens ID
 * @returns The lens definition or undefined if not found
 */
export function getLens(id: LensId): Lens | undefined {
  return LENS_REGISTRY[id]
}

/**
 * Get all lenses that can be auto-applied (have triggers).
 * ALL lens is excluded as it has no triggers.
 */
export function getAutoApplyableLenses(): Lens[] {
  return Object.values(LENS_REGISTRY).filter(lens => lens.triggers.length > 0)
}

/**
 * Get all available lens IDs for API response.
 */
export function getValidLensIds(): LensId[] {
  return Object.keys(LENS_REGISTRY) as LensId[]
}
