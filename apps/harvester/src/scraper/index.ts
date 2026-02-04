/**
 * Scraper Framework
 *
 * Per scraper-framework-01 spec v0.5
 *
 * Surgical URL scraping framework for price monitoring.
 */

// Core types
export * from './types.js'

// Registry
export { InMemoryAdapterRegistry, getAdapterRegistry, resetAdapterRegistry } from './registry.js'

// Fetch layer
export type { Fetcher, FetchOptions, FetchResult } from './fetch/fetcher.js'
export { HttpFetcher } from './fetch/http-fetcher.js'
export { RobotsPolicyImpl } from './fetch/robots.js'
export type { RobotsPolicy } from './types.js'
export { RedisRateLimiter } from './fetch/rate-limiter.js'
export type { RateLimiter } from './types.js'

// Processing
export { validateOffer, shouldCountTowardDrift } from './process/validator.js'
export {
  computeDerivedMetrics,
  checkDriftAlert,
  checkAutoDisable,
  checkZeroPriceDisable,
  shouldMarkUrlBroken,
  updateBaseline,
} from './process/drift-detector.js'
export {
  writeScrapeOffer,
  updateTargetTracking,
  markTargetBroken,
  finalizeRun,
} from './process/writer.js'
export type { WriteResult, ScrapeTarget } from './process/writer.js'

// Utilities
export {
  canonicalizeUrl,
  isValidUrl,
  getRegistrableDomain,
  hashUrl,
  generateIdentityKey,
  parseIdentityKey,
} from './utils/url.js'
