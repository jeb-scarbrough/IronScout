// AI-powered semantic search module

// Intent parsing
export { 
  parseSearchIntent, 
  SearchIntent, 
  PremiumSearchIntent,
  SafetyConstraint,
  ParseOptions
} from './intent-parser'

// Main search service
export { 
  aiSearch, 
  getSearchSuggestions, 
  AISearchResult, 
  ExplicitFilters,
  AISearchOptions
} from './search-service'

// Premium ranking
export {
  applyPremiumRanking,
  applyFreeRanking,
  ProductForRanking,
  PremiumRankedProduct,
  PremiumRankingOptions
} from './premium-ranking'

// Price Signal Index (descriptive context, not recommendations)
export {
  calculatePriceSignalIndex,
  batchCalculatePriceSignalIndex,
  PriceSignalIndex,
  ContextBand,
  PriceContextMeta,
  clearPriceStatsCache,
  warmPriceStatsCache
} from './price-signal-index'

// Domain knowledge
export * from './ammo-knowledge'

// Embedding service
export * from './embedding-service'
