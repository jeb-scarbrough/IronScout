/**
 * Scoring Strategy Registry
 *
 * Export all scoring strategies and provide a default.
 * New strategies can be added here and selected via configuration.
 */

export { WeightedExactMatchStrategy, createWeightedExactMatchStrategy } from './weighted-exact'
export {
  tfidfCosineSimilarity,
  jaccardSimilarity,
  levenshteinSimilarity,
  tokenize,
} from './text-similarity'

// Re-export types for convenience
export type { ScoringStrategy, ScoringResult, CandidateProduct } from '../types'

// ═══════════════════════════════════════════════════════════════════════════════
// Default Strategy
// ═══════════════════════════════════════════════════════════════════════════════

import { WeightedExactMatchStrategy } from './weighted-exact'

/**
 * Default scoring strategy used by the resolver
 * Currently: Weighted exact match with fixed weights
 */
export const DEFAULT_SCORING_STRATEGY = WeightedExactMatchStrategy
