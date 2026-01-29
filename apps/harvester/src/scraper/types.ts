/**
 * Scraper Framework Core Types
 *
 * Per scraper-framework-01 spec v0.5 §5
 *
 * All types for surgical URL scraping: ScrapedOffer, ExtractResult, Adapter interfaces.
 */

import type { Logger } from '@ironscout/logger'

// ═══════════════════════════════════════════════════════════════════════════════
// Currency and Availability Types (§5.1)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Currency codes supported by the scraper framework.
 * USD only for v1; extend as needed.
 */
export type CurrencyCode = 'USD'

/**
 * Stock availability signals.
 * Adapters must derive from explicit page signals, never guess.
 *
 * IMPORTANT: UNKNOWN triggers a drop (fail-closed). If availability
 * cannot be determined from the page, the offer is not written.
 */
export type Availability =
  | 'IN_STOCK'
  | 'OUT_OF_STOCK'
  | 'BACKORDER'
  | 'UNKNOWN' // Fail-closed: drops offer, does not write to DB

// ═══════════════════════════════════════════════════════════════════════════════
// Extraction Result Types (§5.1)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Reasons for extraction failure.
 * Used when extract() cannot produce an offer.
 */
export type ExtractFailureReason =
  | 'SELECTOR_NOT_FOUND' // Expected element missing from DOM
  | 'PRICE_NOT_FOUND' // Price element missing
  | 'TITLE_NOT_FOUND' // Title element missing
  | 'PAGE_STRUCTURE_CHANGED' // DOM structure doesn't match expected
  | 'BLOCKED_PAGE' // Captcha, access denied, etc.
  | 'EMPTY_PAGE' // Page returned but has no content
  | 'OOS_NO_PRICE' // Out of stock page with no price displayed (expected)

/**
 * Extraction result - explicit success or failure with reason.
 * Replaces returning null (which was a silent drop violating fail-closed).
 */
export type ExtractResult =
  | { ok: true; offer: ScrapedOffer }
  | { ok: false; reason: ExtractFailureReason; details?: string }

// ═══════════════════════════════════════════════════════════════════════════════
// Validation Outcome Types (§5.1)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validation outcome from adapter normalize step.
 */
export type NormalizeResult =
  | { status: 'ok'; offer: ScrapedOffer }
  | { status: 'drop'; reason: DropReason; offer: ScrapedOffer }
  | { status: 'quarantine'; reason: QuarantineReason; offer: ScrapedOffer }

/**
 * Reasons for dropping an offer (not written to DB).
 */
export type DropReason =
  | 'MISSING_REQUIRED_FIELD'
  | 'INVALID_PRICE'
  | 'INVALID_URL'
  | 'DUPLICATE_WITHIN_RUN'
  | 'BLOCKED_BY_ROBOTS_TXT'
  | 'OOS_NO_PRICE' // Out of stock with no price - expected, don't count toward drift
  | 'UNKNOWN_AVAILABILITY' // Fail-closed: availability indeterminate, don't store ambiguous data

/**
 * Reasons for quarantining an offer (written to quarantine table).
 */
export type QuarantineReason =
  | 'VALIDATION_FAILED'
  | 'DRIFT_DETECTED'
  | 'SELECTOR_FAILURE'
  | 'NORMALIZATION_FAILED'
  | 'ZERO_PRICE_EXTRACTED'
  | 'AMBIGUOUS_PRICE'

// ═══════════════════════════════════════════════════════════════════════════════
// ScrapedOffer - Output Contract (§5.1)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * The canonical output of a scraper adapter.
 *
 * IMPORTANT: All prices are in CENTS (integer) to avoid floating point issues.
 * Convert to Decimal(10,2) when writing to prices table.
 */
export interface ScrapedOffer {
  // ═══════════════════════════════════════════════════════════════════════════
  // Required Fields (fail-closed if missing)
  // ═══════════════════════════════════════════════════════════════════════════

  /** Source ID from sources table */
  sourceId: string

  /** Retailer ID from retailers table */
  retailerId: string

  /** Canonical URL (normalized, no tracking params) */
  url: string

  /** Product title as displayed on page */
  title: string

  /**
   * Single-unit price in CENTS (e.g., 1999 = $19.99)
   *
   * Price semantics (canonical rule):
   * 1. Capture current selling price (not crossed-out list price)
   * 2. If tiered pricing, prefer qty=1 tier (see Appendix C for details)
   * 3. If multiple prices visible and ambiguous, quarantine with AMBIGUOUS_PRICE
   * 4. If out-of-stock and price hidden, return ExtractResult with OOS_NO_PRICE reason
   */
  priceCents: number

  /** Currency code (USD only for v1) */
  currency: CurrencyCode

  /** Stock availability */
  availability: Availability

  /** When this offer was observed (set by adapter, not server) */
  observedAt: Date

  // ═══════════════════════════════════════════════════════════════════════════
  // Identity Fields (for source-scoped deduplication)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Source-scoped identity key.
   * Format: {idType}:{idValue}
   * Priority: retailerProductId > retailerSku > urlHash
   */
  identityKey: string

  /** Retailer's SKU if available */
  retailerSku?: string

  /** Retailer's product ID if available */
  retailerProductId?: string

  // ═══════════════════════════════════════════════════════════════════════════
  // Product Identity Fields (for resolver matching)
  // ═══════════════════════════════════════════════════════════════════════════

  /** UPC/GTIN if present (written to source_product_identifiers) */
  upc?: string

  /** Brand name as displayed */
  brand?: string

  /** Caliber as displayed (e.g., "9mm Luger", "5.56 NATO") */
  caliber?: string

  /** Grain weight if applicable */
  grainWeight?: number

  /** Round count / pack size */
  roundCount?: number

  /** Case material (brass, steel, aluminum) */
  caseMaterial?: string

  /** Bullet type (FMJ, HP, etc.) */
  bulletType?: string

  /** Shotgun load type (shot size or slug weight) */
  loadType?: string

  /** Shotgun shell length */
  shellLength?: string

  // ═══════════════════════════════════════════════════════════════════════════
  // Pricing Metadata (optional, all in CENTS)
  // ═══════════════════════════════════════════════════════════════════════════

  /** Cost per round in CENTS (derived if roundCount known) */
  costPerRoundCents?: number

  /** Shipping cost in CENTS if displayed */
  shippingCents?: number | null

  /** Whether tax is included in price */
  taxIncluded?: boolean

  // ═══════════════════════════════════════════════════════════════════════════
  // Metadata
  // ═══════════════════════════════════════════════════════════════════════════

  /** Image URL */
  imageUrl?: string

  /** Adapter version that produced this offer */
  adapterVersion: string
}

// ═══════════════════════════════════════════════════════════════════════════════
// Fetcher Interface (§5.2)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Fetcher interface - allows swapping HTTP for Playwright later.
 * Adapter receives HTML regardless of how it was fetched.
 */
export interface Fetcher {
  /**
   * Fetch a URL and return the HTML content.
   */
  fetch(url: string, options?: FetchOptions): Promise<FetchResult>
}

export interface FetchOptions {
  /** Request timeout in ms (default: 30000) */
  timeoutMs?: number

  /** Maximum response size in bytes (default: 10MB) */
  maxSizeBytes?: number

  /** Custom headers (merged with defaults) */
  headers?: Record<string, string>
}

/**
 * Default headers for all HTTP requests.
 * REQUIRED: User-Agent identifies the bot with contact info.
 * Sites may block requests without proper identification.
 */
export const DEFAULT_FETCH_HEADERS = {
  'User-Agent': 'IronScout/1.0 (+https://ironscout.ai/bot; bot@ironscout.ai)',
  Accept: 'text/html,application/xhtml+xml',
  'Accept-Language': 'en-US,en;q=0.9',
} as const

export const DEFAULT_FETCH_OPTIONS: FetchOptions = {
  timeoutMs: 30000,
  maxSizeBytes: 10 * 1024 * 1024, // 10 MB
}

export type FetchResultStatus =
  | 'ok'
  | 'error'
  | 'blocked'
  | 'timeout'
  | 'too_large'
  | 'robots_blocked'

export interface FetchResult {
  status: FetchResultStatus
  statusCode?: number
  html?: string
  contentHash?: string
  error?: string
  durationMs: number
}

// ═══════════════════════════════════════════════════════════════════════════════
// Rate Limiter Interface (§6.2)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Rate limiter interface.
 *
 * IMPORTANT: Implementation MUST be Redis-backed for coordination across workers.
 * Per-process rate limiting will exceed budgets when workers scale.
 *
 * DOMAIN DEFINITION: Rate limits apply to the registrable domain (eTLD+1),
 * not the full hostname. For example:
 * - sgammo.com, www.sgammo.com, cdn.sgammo.com all share one limit
 * - This prevents subdomains/CDNs from multiplying allowed traffic
 */
export interface RateLimiter {
  /**
   * Acquire permission to make a request to the given registrable domain (eTLD+1).
   * Blocks until rate limit allows.
   *
   * MUST use shared state (Redis) to coordinate across all workers.
   */
  acquire(domain: string): Promise<void>

  /**
   * Get current config for domain.
   */
  getConfig(domain: string): RateLimitConfig
}

export interface RateLimitConfig {
  /** Requests per second (default: 0.5) */
  requestsPerSecond: number

  /** Minimum delay between requests in ms (default: 2000) */
  minDelayMs: number

  /** Maximum concurrent requests (default: 1) */
  maxConcurrent: number
}

/**
 * Default rate limit config - CONSERVATIVE
 * Start slow, increase per-retailer after proving stability.
 */
export const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  requestsPerSecond: 0.5,
  minDelayMs: 2000,
  maxConcurrent: 1,
}

// ═══════════════════════════════════════════════════════════════════════════════
// Robots.txt Policy Interface (§6.3)
// ═══════════════════════════════════════════════════════════════════════════════

export interface RobotsPolicy {
  /**
   * Check if URL is allowed by robots.txt.
   * Returns false if disallowed OR unavailable (fail-closed).
   */
  isAllowed(url: string): Promise<boolean>

  /**
   * Get crawl delay from robots.txt.
   */
  getCrawlDelay(domain: string): Promise<number | null>
}

// ═══════════════════════════════════════════════════════════════════════════════
// ScrapeAdapter Interface (§5.3)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Context provided to adapter methods.
 */
export interface ScrapeAdapterContext {
  sourceId: string
  retailerId: string
  runId: string
  targetId: string // scrape_targets.id
  now: Date
  logger: Logger
}

/**
 * Adapter interface for surgical scraping.
 * Each retailer implements this.
 *
 * Note: No getSeedUrls() or getNextPages() - URLs come from database.
 */
export interface ScrapeAdapter {
  /** Unique adapter identifier (e.g., 'sgammo') */
  readonly id: string

  /** Semver version (increment on extraction logic changes) */
  readonly version: string

  /** Domain this adapter handles (for rate limiting) */
  readonly domain: string

  /** Whether this adapter requires JS rendering */
  readonly requiresJsRendering: boolean

  /**
   * Extract offer from a single product page.
   * Returns explicit success/failure - never silent drops.
   *
   * Must be deterministic given the same HTML input.
   *
   * IMPORTANT: Return { ok: false, reason: 'OOS_NO_PRICE' } when:
   * - Page indicates out-of-stock AND price is not displayed
   * This is expected behavior, not a drift signal.
   */
  extract(html: string, url: string, ctx: ScrapeAdapterContext): ExtractResult

  /**
   * Normalize and validate the extracted offer.
   * Must return explicit status (ok/drop/quarantine).
   */
  normalize(offer: ScrapedOffer, ctx: ScrapeAdapterContext): NormalizeResult
}

// ═══════════════════════════════════════════════════════════════════════════════
// Adapter Registry Interface (§5.4)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Registry for scrape adapters.
 * Adapters must be explicitly registered; no auto-discovery.
 */
export interface AdapterRegistry {
  /** Register an adapter */
  register(adapter: ScrapeAdapter): void

  /** Get adapter by ID */
  get(adapterId: string): ScrapeAdapter | undefined

  /** List all registered adapter IDs */
  list(): string[]

  /** Check if adapter exists for domain */
  hasAdapterForDomain(domain: string): boolean
}

// ═══════════════════════════════════════════════════════════════════════════════
// Retry Policy (§6.1)
// ═══════════════════════════════════════════════════════════════════════════════

export interface RetryPolicy {
  maxAttempts: number // Default: 3
  initialDelayMs: number // Default: 1000
  maxDelayMs: number // Default: 30000
  backoffMultiplier: number // Default: 2
  retryableStatusCodes: number[] // Default: [429, 500, 502, 503, 504]
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  retryableStatusCodes: [429, 500, 502, 503, 504],
}

// ═══════════════════════════════════════════════════════════════════════════════
// Queue Types (§10.1)
// ═══════════════════════════════════════════════════════════════════════════════

export type ScrapeJobTrigger = 'SCHEDULED' | 'MANUAL' | 'RETRY' | 'RECHECK'

export interface ScrapeUrlJobData {
  targetId: string // scrape_targets.id
  url: string
  sourceId: string // For trust config, visibility
  retailerId: string // Derived from source, included for convenience
  adapterId: string
  runId: string
  priority: number
  trigger: ScrapeJobTrigger
}

// ═══════════════════════════════════════════════════════════════════════════════
// Queue Config (§8.1)
// ═══════════════════════════════════════════════════════════════════════════════

export interface QueueConfig {
  /** Maximum pending URLs per adapter (default: 1000) */
  maxPendingPerAdapter: number

  /** Maximum total pending URLs (default: 10000) */
  maxPendingTotal: number

  /** Maximum age for pending URL before cleanup (default: 24h) */
  maxAgeMs: number
}

export const DEFAULT_QUEUE_CONFIG: QueueConfig = {
  maxPendingPerAdapter: 1000,
  maxPendingTotal: 10000,
  maxAgeMs: 24 * 60 * 60 * 1000, // 24 hours
}

export interface EnqueueResult {
  status: 'accepted' | 'rejected'

  /** If rejected, when to retry */
  retryAfterMs?: number

  /** Reason for rejection */
  reason?: 'queue_full' | 'adapter_disabled' | 'rate_limited' | 'source_disabled'
}

// ═══════════════════════════════════════════════════════════════════════════════
// Drift Detection Types (§7)
// ═══════════════════════════════════════════════════════════════════════════════

export interface ScrapeRunMetrics {
  urlsAttempted: number
  urlsSucceeded: number
  urlsFailed: number
  offersExtracted: number
  offersValid: number
  offersDropped: number
  offersQuarantined: number
  zeroPriceCount: number
  oosNoPriceCount: number // Expected OOS with no price - don't count toward drift
}

export interface DerivedMetrics {
  /** urlsFailed / urlsAttempted */
  failureRate: number

  /** offersDropped / offersExtracted */
  dropRate: number

  /** offersValid / urlsAttempted */
  yieldRate: number
}

export interface DriftBaseline {
  /** 7-day rolling median failure rate */
  medianFailureRate: number

  /** 7-day rolling median yield rate */
  medianYieldRate: number

  /** Number of runs in baseline (min 3 required) */
  sampleSize: number

  /** Whether baseline is established */
  isEstablished: boolean
}

// ═══════════════════════════════════════════════════════════════════════════════
// Availability Mapping (§10.2)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Map scraped availability to prices.inStock boolean.
 * This affects alerts and visibility logic.
 *
 * IMPORTANT: UNKNOWN availability is dropped before this point (fail-closed).
 * This function only handles valid availability values.
 */
export function mapAvailabilityToInStock(availability: Availability): boolean {
  switch (availability) {
    case 'IN_STOCK':
      return true
    case 'OUT_OF_STOCK':
      return false
    case 'BACKORDER':
      return false // Treat as unavailable for alert/visibility purposes
    case 'UNKNOWN':
      // Should never reach here - UNKNOWN is dropped in validation
      throw new Error('UNKNOWN availability should be dropped before price write')
  }
}
