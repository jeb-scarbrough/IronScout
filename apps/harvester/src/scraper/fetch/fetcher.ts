/**
 * Fetcher Interface
 *
 * Per scraper-framework-01 spec v0.5 §5.2
 *
 * Abstraction over HTTP fetching to allow swapping implementations
 * (e.g., native fetch, axios, Playwright for JS rendering).
 */

import type { Fetcher, FetchOptions, FetchResult } from '../types.js'

export type { Fetcher, FetchOptions, FetchResult }
