import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { HttpFetcher } from '../fetch/http-fetcher.js'

describe('HttpFetcher', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    if (originalFetch) {
      globalThis.fetch = originalFetch
    }
  })

  it('blocks when robots policy disallows the URL', async () => {
    const robotsPolicy = {
      isAllowed: vi.fn().mockResolvedValue(false),
      getCrawlDelay: vi.fn().mockResolvedValue(null),
    }

    const fetchSpy = vi.fn()
    globalThis.fetch = fetchSpy

    const fetcher = new HttpFetcher({ robotsPolicy })
    const result = await fetcher.fetch('https://example.com/product')

    expect(result.status).toBe('robots_blocked')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('retries on retryable status codes', async () => {
    let callCount = 0
    const fetchSpy = vi.fn().mockImplementation(() => {
      callCount += 1
      if (callCount === 1) {
        return Promise.resolve(new Response('fail', { status: 500, statusText: 'Server Error' }))
      }
      return Promise.resolve(new Response('<html>ok</html>', { status: 200 }))
    })

    globalThis.fetch = fetchSpy

    const fetcher = new HttpFetcher({
      retryPolicy: {
        maxAttempts: 2,
        initialDelayMs: 1,
        maxDelayMs: 1,
        backoffMultiplier: 1,
        retryableStatusCodes: [500],
      },
    })

    const result = await fetcher.fetch('https://example.com/product')
    expect(result.status).toBe('ok')
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })
})
