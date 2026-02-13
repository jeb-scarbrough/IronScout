import { describe, it, expect } from 'vitest'
import { buildOutboundUrl } from '../outbound-url'
import { computeOutboundSignature, verifyOutboundSignature } from '../outbound-signing'

const TEST_SECRET = 'test-secret-key-for-outbound-url-tests!!'
const BASE_URL = 'https://app.ironscout.ai'

describe('buildOutboundUrl', () => {
  it('produces an absolute URL with /out path', () => {
    const payload = { u: 'https://retailer.com/product/123', rid: 'r1', pid: 'p1', pl: 'card' }
    const sig = computeOutboundSignature(payload, TEST_SECRET)
    const result = buildOutboundUrl({ baseUrl: BASE_URL, payload, sig })

    const parsed = new URL(result)
    expect(parsed.origin).toBe(BASE_URL)
    expect(parsed.pathname).toBe('/out')
  })

  it('includes u, sig, rid, pid, pl as query params', () => {
    const payload = { u: 'https://retailer.com', rid: 'r1', pid: 'p1', pl: 'card' }
    const sig = computeOutboundSignature(payload, TEST_SECRET)
    const result = buildOutboundUrl({ baseUrl: BASE_URL, payload, sig })

    const parsed = new URL(result)
    expect(parsed.searchParams.get('u')).toBe('https://retailer.com')
    expect(parsed.searchParams.get('sig')).toBe(sig)
    expect(parsed.searchParams.get('rid')).toBe('r1')
    expect(parsed.searchParams.get('pid')).toBe('p1')
    expect(parsed.searchParams.get('pl')).toBe('card')
  })

  it('omits optional params when empty', () => {
    const payload = { u: 'https://retailer.com' }
    const sig = computeOutboundSignature(payload, TEST_SECRET)
    const result = buildOutboundUrl({ baseUrl: BASE_URL, payload, sig })

    const parsed = new URL(result)
    expect(parsed.searchParams.get('u')).toBe('https://retailer.com')
    expect(parsed.searchParams.get('sig')).toBe(sig)
    expect(parsed.searchParams.has('rid')).toBe(false)
    expect(parsed.searchParams.has('pid')).toBe(false)
    expect(parsed.searchParams.has('pl')).toBe(false)
  })

  it('encodes the destination URL exactly once', () => {
    const destination = 'https://retailer.com/product?id=123&ref=iron'
    const payload = { u: destination, rid: 'r1' }
    const sig = computeOutboundSignature(payload, TEST_SECRET)
    const result = buildOutboundUrl({ baseUrl: BASE_URL, payload, sig })

    // Parse the URL and extract u — should decode to the original
    const parsed = new URL(result)
    const extractedU = parsed.searchParams.get('u')
    expect(extractedU).toBe(destination)
  })

  it('round-trips: build URL → extract params → verify signature', () => {
    const destination = 'https://midwayusa.com/product/456?tracking=abc'
    const payload = { u: destination, rid: 'midwayusa', pid: 'p_456', pl: '' }
    const sig = computeOutboundSignature(payload, TEST_SECRET)
    const outUrl = buildOutboundUrl({ baseUrl: BASE_URL, payload, sig })

    // Simulate what /out handler does: parse URL, extract params, verify
    const parsed = new URL(outUrl)
    const extractedU = parsed.searchParams.get('u')!
    const extractedSig = parsed.searchParams.get('sig')!
    const extractedRid = parsed.searchParams.get('rid') ?? ''
    const extractedPid = parsed.searchParams.get('pid') ?? ''
    const extractedPl = parsed.searchParams.get('pl') ?? ''

    const verified = verifyOutboundSignature(
      { u: extractedU, rid: extractedRid, pid: extractedPid, pl: extractedPl },
      extractedSig,
      TEST_SECRET
    )
    expect(verified).toBe(true)
  })

  it('handles URLs with special characters', () => {
    const destination = 'https://retailer.com/path?q=hello+world&tag=ammo%20brass'
    const payload = { u: destination }
    const sig = computeOutboundSignature(payload, TEST_SECRET)
    const result = buildOutboundUrl({ baseUrl: BASE_URL, payload, sig })

    const parsed = new URL(result)
    expect(parsed.searchParams.get('u')).toBe(destination)
  })
})
