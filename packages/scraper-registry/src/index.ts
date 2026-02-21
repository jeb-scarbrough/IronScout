/**
 * Scraper adapter registry metadata shared across apps.
 */

export type ScraperPluginMode = 'html' | 'json'

export interface ScraperPluginRateLimit {
  requestsPerSecond?: number
  minDelayMs?: number
  maxConcurrent?: number
}

export interface ScraperRegistryEntry {
  id: string
  name: string
  domain: string
  productPathPattern: string
  owner: string
  mode: ScraperPluginMode
  version: string
  baseUrls: string[]
  rateLimit?: ScraperPluginRateLimit
}

export const KNOWN_ADAPTERS = [
  // __KNOWN_ADAPTERS_INSERT__
  {
    id: 'brownells',
    name: 'Brownells',
    domain: 'brownells.com',
    productPathPattern: '/ammunition/',
    owner: 'harvester',
    mode: 'html',
    version: '1.0.0',
    baseUrls: ['https://www.brownells.com'],
  },
  {
    id: 'midwayusa',
    name: 'MidwayUSA',
    domain: 'midwayusa.com',
    productPathPattern: '/product/',
    owner: 'harvester',
    mode: 'html',
    version: '1.0.0',
    baseUrls: ['https://www.midwayusa.com'],
  },
  {
    id: 'primaryarms',
    name: 'Primary Arms',
    domain: 'primaryarms.com',
    productPathPattern: '/product/',
    owner: 'harvester',
    mode: 'json',
    version: '1.0.0',
    baseUrls: ['https://www.primaryarms.com'],
  },
  {
    id: 'sgammo',
    name: 'SGAmmo',
    domain: 'sgammo.com',
    productPathPattern: '/product/',
    owner: 'harvester',
    mode: 'html',
    version: '1.0.0',
    baseUrls: ['https://www.sgammo.com'],
    rateLimit: {
      requestsPerSecond: 0.5,
      minDelayMs: 500,
      maxConcurrent: 1,
    },
  },
] as const satisfies readonly ScraperRegistryEntry[]

export type KnownAdapter = (typeof KNOWN_ADAPTERS)[number]
