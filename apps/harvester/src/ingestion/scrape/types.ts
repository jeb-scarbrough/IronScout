import type { Availability, ScrapedOffer } from '../../scraper/types.js'

export type ScrapePluginMode = 'html' | 'json'

export interface ScrapePluginRateLimit {
  requestsPerSecond?: number
  minDelayMs?: number
  maxConcurrent?: number
}

export interface ScrapePluginManifest {
  id: string
  name: string
  owner: string
  version: string
  mode: ScrapePluginMode
  baseUrls: string[]
  rateLimit?: ScrapePluginRateLimit
}

export interface RawScrapeOffer {
  title: string
  price: string | number
  availability: string
  url: string
  retailerSku?: string
  retailerProductId?: string
  upc?: string
  brand?: string
  caliber?: string
  grainWeight?: string | number
  roundCount?: string | number
  caseMaterial?: string
  bulletType?: string
  loadType?: string
  shellLength?: string
  imageUrl?: string
  shippingCents?: number | null
  taxIncluded?: boolean
}

export type ScrapePluginExtractFailReason =
  | 'SELECTOR_NOT_FOUND'
  | 'PRICE_NOT_FOUND'
  | 'TITLE_NOT_FOUND'
  | 'PAGE_STRUCTURE_CHANGED'
  | 'BLOCKED_PAGE'
  | 'EMPTY_PAGE'
  | 'AMBIGUOUS_VARIANTS'
  | 'OOS_NO_PRICE'

export type ScrapePluginExtractResult =
  | { ok: true; rawOffers: RawScrapeOffer[] }
  | { ok: false; reason: ScrapePluginExtractFailReason; details?: string }

export interface NormalizedScrapeOffer extends ScrapedOffer {
  adapterVersion: string
  shippingCents?: number | null
  costPerRoundCents?: number
  taxIncluded?: boolean
}

export type NormalizeStatus = 'ok' | 'drop' | 'quarantine'

export type NormalizeResult =
  | { status: 'ok'; offer: NormalizedScrapeOffer }
  | { status: 'drop' | 'quarantine'; reason: string }

export interface NormalizeInput {
  sourceId: string
  retailerId: string
  observedAt: Date
  rawOffer: RawScrapeOffer
  manifest: ScrapePluginManifest
}

export interface ScrapePluginFetchInput {
  url: string
  mode: ScrapePluginMode
  headers?: Record<string, string>
  timeoutMs?: number
}

export interface ScrapePluginFetchResult {
  ok: boolean
  statusCode?: number
  body?: string
  error?: string
  durationMs: number
}

export interface ScrapeSitePlugin {
  manifest: ScrapePluginManifest
  fetchRaw: (input: ScrapePluginFetchInput) => Promise<ScrapePluginFetchResult>
  extractRaw: (payload: string, url: string) => ScrapePluginExtractResult
  normalizeRaw: (input: NormalizeInput) => NormalizeResult
}

export interface SitePluginRegistration {
  manifest: ScrapePluginManifest
  load: () => Promise<ScrapeSitePlugin>
}
