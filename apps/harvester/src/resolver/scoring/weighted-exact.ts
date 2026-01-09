/**
 * Weighted Exact Match Scoring Strategy
 *
 * Scores candidates using binary exact matches on key fields,
 * weighted by importance to ammunition product identification.
 *
 * This is the original scoring algorithm from resolver v1.2.
 */

import type { ScoringStrategy, ScoringResult, NormalizedInput, CandidateProduct } from '../types'
import { tokenize, tfidfCosineSimilarityWithTokens } from './text-similarity'

/**
 * Weight configuration for the strategy
 */
export interface WeightedExactMatchWeights {
  brand: number
  caliber: number
  pack: number
  grain: number
  title: number
}

/**
 * Default weights - sum to 1.0
 *
 * Rationale:
 * - Caliber (30%): Most critical - wrong caliber = completely different product
 * - Brand (25%): High importance - different brands are different products
 * - Pack count (20%): Important for pricing comparison (50rd vs 1000rd bulk)
 * - Grain (15%): Differentiates variants (115gr vs 124gr vs 147gr)
 * - Title (10%): TF-IDF cosine similarity between input title and candidate name
 */
const DEFAULT_WEIGHTS: WeightedExactMatchWeights = {
  brand: 0.25,
  caliber: 0.30,
  pack: 0.20,
  grain: 0.15,
  title: 0.10,
}

/**
 * Create a weighted exact match strategy with custom weights
 *
 * Performance: Caches input title tokens across calls to avoid
 * re-tokenizing the same input when scoring multiple candidates.
 */
export function createWeightedExactMatchStrategy(
  weights: WeightedExactMatchWeights = DEFAULT_WEIGHTS,
  version: string = '1.2.0'
): ScoringStrategy {
  // Validate weights sum to ~1.0
  const sum = Object.values(weights).reduce((a, b) => a + b, 0)
  if (Math.abs(sum - 1.0) > 0.001) {
    throw new Error(`Weights must sum to 1.0, got ${sum}`)
  }

  // Cache for input tokenization (avoids re-tokenizing same input across candidates)
  let cachedInputTitle: string | null = null
  let cachedInputTokens: string[] = []

  return {
    name: 'weighted-exact-match',
    version,

    score(input: NormalizedInput, candidate: CandidateProduct): ScoringResult {
      // Binary exact matches
      const brandMatch = input.brandNorm === candidate.brandNorm
      const caliberMatch = input.caliberNorm === candidate.caliberNorm
      const packMatch = input.packCount === candidate.roundCount
      const grainMatch = input.grain === candidate.grainWeight

      // Title similarity using TF-IDF cosine similarity
      // Compares input title (or normalized) against candidate product name
      const inputTitle = input.titleNorm ?? input.title ?? ''
      const candidateTitle = candidate.name ?? ''

      // Cache input tokens to avoid re-tokenizing for each candidate
      if (inputTitle !== cachedInputTitle) {
        cachedInputTokens = tokenize(inputTitle)
        cachedInputTitle = inputTitle
      }

      const titleSimilarity = tfidfCosineSimilarityWithTokens(cachedInputTokens, candidateTitle)

      // Compute component scores
      const componentScores = {
        brand: brandMatch ? weights.brand : 0,
        caliber: caliberMatch ? weights.caliber : 0,
        pack: packMatch ? weights.pack : 0,
        grain: grainMatch ? weights.grain : 0,
        title: titleSimilarity * weights.title,
      }

      // Sum for total
      const total =
        componentScores.brand +
        componentScores.caliber +
        componentScores.pack +
        componentScores.grain +
        componentScores.title

      return {
        total,
        componentScores,
        matchDetails: {
          brandMatch,
          caliberMatch,
          packMatch,
          grainMatch,
          titleSimilarity,
        },
      }
    },
  }
}

/**
 * Default strategy instance with standard weights
 */
export const WeightedExactMatchStrategy = createWeightedExactMatchStrategy()
