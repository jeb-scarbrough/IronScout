/**
 * Product Resolver v1.2
 *
 * Incrementally and deterministically links each source_products row to exactly one
 * canonical products row so prices from multiple retailers can be grouped.
 *
 * Per Spec v1.2:
 * - Maintains near-real-time behavior
 * - Preserves immutable price facts
 * - Makes identity decisions auditable, replayable, and safe under evolution
 *
 * @see context/specs/product-resolver-12.md
 */

export { RESOLVER_VERSION, resolveSourceProduct } from './resolver'
export {
  productResolverWorker,
  startProductResolverWorker,
  stopProductResolverWorker,
  startProcessingSweeper,
  stopProcessingSweeper,
} from './worker'
export type {
  ResolverResult,
  ResolverEvidence,
  ScoringStrategy,
  ScoringResult,
  CandidateProduct,
  NormalizedInput,
} from './types'

// Scoring strategies
export {
  DEFAULT_SCORING_STRATEGY,
  WeightedExactMatchStrategy,
  createWeightedExactMatchStrategy,
} from './scoring'

// Metrics exports (Appendix B)
export {
  recordRequest,
  recordDecision,
  recordFailure,
  recordLatency,
  recordResolverJob,
  getMetricsSnapshot,
  getPrometheusMetrics,
  resetMetrics,
  getLatencyPercentile,
  getFailureRate,
  getMatchRate,
} from './metrics'
export type { SourceKindLabel, StatusLabel, ReasonCodeLabel, ResolverMetricsSnapshot } from './metrics'
