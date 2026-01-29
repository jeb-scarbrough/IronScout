/**
 * HTTP Fetcher Implementation
 *
 * Per scraper-framework-01 spec v0.5 §5.2, §6.1
 *
 * Uses native fetch API for HTTP requests.
 * Supports timeout, size limits, retries, and proper User-Agent.
 */

import { createHash } from 'crypto'
import type { Fetcher, FetchOptions, FetchResult, RetryPolicy, RobotsPolicy } from '../types.js'
import { DEFAULT_FETCH_HEADERS, DEFAULT_FETCH_OPTIONS, DEFAULT_RETRY_POLICY } from '../types.js'

export interface HttpFetcherOptions {
  /** Retry policy for transient failures */
  retryPolicy?: RetryPolicy

  /** Robots.txt policy checker (optional) */
  robotsPolicy?: RobotsPolicy
}

/**
 * HTTP-based fetcher using native fetch.
 * Default implementation for v1.
 */
export class HttpFetcher implements Fetcher {
  private readonly retryPolicy: RetryPolicy
  private readonly robotsPolicy?: RobotsPolicy

  constructor(options: HttpFetcherOptions = {}) {
    this.retryPolicy = options.retryPolicy ?? DEFAULT_RETRY_POLICY
    this.robotsPolicy = options.robotsPolicy
  }

  /**
   * Fetch a URL and return the HTML content.
   */
  async fetch(url: string, options?: FetchOptions): Promise<FetchResult> {
    const startTime = Date.now()
    const opts = { ...DEFAULT_FETCH_OPTIONS, ...options }

    // Check robots.txt if policy is configured
    if (this.robotsPolicy) {
      const allowed = await this.robotsPolicy.isAllowed(url)
      if (!allowed) {
        return {
          status: 'robots_blocked',
          durationMs: Date.now() - startTime,
          error: 'URL disallowed by robots.txt',
        }
      }
    }

    // Merge headers
    const headers = {
      ...DEFAULT_FETCH_HEADERS,
      ...(opts.headers ?? {}),
    }

    let lastError: Error | null = null

    // Retry loop
    for (let attempt = 1; attempt <= this.retryPolicy.maxAttempts; attempt++) {
      try {
        const result = await this.fetchOnce(url, headers, opts, startTime)

        // Check if we should retry based on status code
        if (
          result.status === 'error' &&
          result.statusCode &&
          this.retryPolicy.retryableStatusCodes.includes(result.statusCode) &&
          attempt < this.retryPolicy.maxAttempts
        ) {
          const delay = Math.min(
            this.retryPolicy.initialDelayMs * Math.pow(this.retryPolicy.backoffMultiplier, attempt - 1),
            this.retryPolicy.maxDelayMs
          )
          await this.sleep(delay)
          continue
        }

        return result
      } catch (error) {
        lastError = error as Error

        // Retry on network errors
        if (attempt < this.retryPolicy.maxAttempts) {
          const delay = Math.min(
            this.retryPolicy.initialDelayMs * Math.pow(this.retryPolicy.backoffMultiplier, attempt - 1),
            this.retryPolicy.maxDelayMs
          )
          await this.sleep(delay)
          continue
        }
      }
    }

    // All retries exhausted
    return {
      status: 'error',
      durationMs: Date.now() - startTime,
      error: lastError?.message ?? 'Unknown error after retries',
    }
  }

  /**
   * Single fetch attempt (no retries).
   */
  private async fetchOnce(
    url: string,
    headers: Record<string, string>,
    opts: FetchOptions,
    startTime: number
  ): Promise<FetchResult> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), opts.timeoutMs)

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
        redirect: 'follow',
      })

      clearTimeout(timeoutId)

      // Check for blocked responses (403, 503 with captcha indicators)
      if (response.status === 403 || response.status === 503) {
        const text = await response.text()
        if (this.looksLikeBlockedPage(text)) {
          return {
            status: 'blocked',
            statusCode: response.status,
            durationMs: Date.now() - startTime,
            error: 'Request blocked (captcha or access denied)',
          }
        }
      }

      // Check for non-success status codes
      if (!response.ok) {
        return {
          status: 'error',
          statusCode: response.status,
          durationMs: Date.now() - startTime,
          error: `HTTP ${response.status}: ${response.statusText}`,
        }
      }

      // Check content length header for early size check
      const contentLength = response.headers.get('content-length')
      if (contentLength && parseInt(contentLength, 10) > (opts.maxSizeBytes ?? Infinity)) {
        return {
          status: 'too_large',
          statusCode: response.status,
          durationMs: Date.now() - startTime,
          error: `Response too large: ${contentLength} bytes`,
        }
      }

      // Read body with size limit
      const html = await this.readBodyWithLimit(response, opts.maxSizeBytes ?? DEFAULT_FETCH_OPTIONS.maxSizeBytes!)
      if (html === null) {
        return {
          status: 'too_large',
          statusCode: response.status,
          durationMs: Date.now() - startTime,
          error: 'Response exceeded size limit',
        }
      }

      // Compute content hash
      const contentHash = createHash('sha256').update(html).digest('hex').slice(0, 32)

      return {
        status: 'ok',
        statusCode: response.status,
        html,
        contentHash,
        durationMs: Date.now() - startTime,
      }
    } catch (error) {
      clearTimeout(timeoutId)

      if ((error as Error).name === 'AbortError') {
        return {
          status: 'timeout',
          durationMs: Date.now() - startTime,
          error: `Request timed out after ${opts.timeoutMs}ms`,
        }
      }

      throw error
    }
  }

  /**
   * Read response body with size limit.
   * Returns null if size exceeds limit.
   */
  private async readBodyWithLimit(response: Response, maxBytes: number): Promise<string | null> {
    const reader = response.body?.getReader()
    if (!reader) {
      return ''
    }

    const chunks: Uint8Array[] = []
    let totalSize = 0

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        totalSize += value.length
        if (totalSize > maxBytes) {
          reader.cancel()
          return null
        }

        chunks.push(value)
      }

      const decoder = new TextDecoder('utf-8')
      return decoder.decode(Buffer.concat(chunks))
    } finally {
      reader.releaseLock()
    }
  }

  /**
   * Heuristic check for blocked/captcha pages.
   */
  private looksLikeBlockedPage(html: string): boolean {
    const lowerHtml = html.toLowerCase()
    const blockIndicators = [
      'captcha',
      'recaptcha',
      'hcaptcha',
      'challenge-form',
      'challenge-running',
      'cf-browser-verification',
      'please verify you are a human',
      'access denied',
      'blocked',
      'bot detection',
      'rate limit',
    ]

    return blockIndicators.some(indicator => lowerHtml.includes(indicator))
  }

  /**
   * Sleep helper for retry delays.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
