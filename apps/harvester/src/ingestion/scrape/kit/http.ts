import { HttpFetcher } from '../../../scraper/fetch/http-fetcher.js'
import { RobotsPolicyImpl } from '../../../scraper/fetch/robots.js'
import { RedisRateLimiter } from '../../../scraper/fetch/rate-limiter.js'
import type { FetchResult } from '../../../scraper/types.js'
import type { ScrapePluginMode, ScrapePluginRateLimit } from '../types.js'

const MAX_REQUESTS_PER_SECOND = 2
const MIN_DELAY_MS = 500
const MAX_CONCURRENT = 1

const robots = new RobotsPolicyImpl()
const rateLimiter = new RedisRateLimiter({ robotsPolicy: robots })
const fetcher = new HttpFetcher({ robotsPolicy: robots })

export interface FetchWithPolicyInput {
  url: string
  mode: ScrapePluginMode
  baseUrls: string[]
  rateLimit?: ScrapePluginRateLimit
  headers?: Record<string, string>
  timeoutMs?: number
}

export interface FetchWithPolicyResult {
  ok: boolean
  statusCode?: number
  body?: string
  error?: string
  durationMs: number
}

function clampRateLimit(rateLimit?: ScrapePluginRateLimit): {
  requestsPerSecond: number
  minDelayMs: number
  maxConcurrent: number
} {
  return {
    requestsPerSecond: Math.min(MAX_REQUESTS_PER_SECOND, rateLimit?.requestsPerSecond ?? 0.5),
    minDelayMs: Math.max(MIN_DELAY_MS, rateLimit?.minDelayMs ?? MIN_DELAY_MS),
    maxConcurrent: Math.min(MAX_CONCURRENT, rateLimit?.maxConcurrent ?? 1),
  }
}

function isHostAllowed(url: string, baseUrls: string[]): boolean {
  let target: URL
  try {
    target = new URL(url)
  } catch {
    return false
  }

  const host = target.hostname.toLowerCase()
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host.startsWith('10.') ||
    host.startsWith('192.168.') ||
    host.startsWith('169.254.')
  ) {
    return false
  }

  return baseUrls.some(base => {
    try {
      const parsed = new URL(base)
      return parsed.hostname.toLowerCase() === host
    } catch {
      return false
    }
  })
}

function mapFetchResult(result: FetchResult): FetchWithPolicyResult {
  if (result.status === 'ok') {
    return {
      ok: true,
      statusCode: result.statusCode,
      body: result.html,
      durationMs: result.durationMs,
    }
  }

  return {
    ok: false,
    statusCode: result.statusCode,
    error: result.error ?? result.status,
    durationMs: result.durationMs,
  }
}

export async function fetchWithPolicy(input: FetchWithPolicyInput): Promise<FetchWithPolicyResult> {
  if (!isHostAllowed(input.url, input.baseUrls)) {
    return {
      ok: false,
      error: 'URL host is outside allowed base URLs or blocked by SSRF guard',
      durationMs: 0,
    }
  }

  const target = new URL(input.url)
  const limits = clampRateLimit(input.rateLimit)
  rateLimiter.setConfig(target.hostname.toLowerCase(), limits)
  await rateLimiter.acquire(target.hostname.toLowerCase())

  const result = await fetcher.fetch(input.url, {
    headers: input.headers,
    timeoutMs: input.timeoutMs,
  })
  return mapFetchResult(result)
}
