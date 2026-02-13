import { describe, it, expect } from 'vitest'
import {
  buildCanonicalPayload,
  computeOutboundSignature,
  verifyOutboundSignature,
} from '../outbound-signing'

const TEST_SECRET = 'test-secret-key-for-outbound-signing-32chars!'
const ALT_SECRET = 'alternate-secret-key-for-rotation-tests!!'

describe('buildCanonicalPayload', () => {
  it('includes all four keys in fixed order', () => {
    const result = buildCanonicalPayload({
      u: 'https://example.com',
      rid: 'retailer1',
      pid: 'p_123',
      pl: 'card',
    })
    expect(result).toBe(
      `u=${encodeURIComponent('https://example.com')}&rid=retailer1&pid=p_123&pl=card`
    )
  })

  it('uses empty strings for missing optional params', () => {
    const result = buildCanonicalPayload({ u: 'https://example.com' })
    expect(result).toBe(`u=${encodeURIComponent('https://example.com')}&rid=&pid=&pl=`)
  })

  it('percent-encodes values containing & to prevent delimiter collision', () => {
    const result = buildCanonicalPayload({
      u: 'https://example.com?foo=1&bar=2',
      rid: 'ret&ailer',
    })
    // The & inside u and rid must be encoded as %26
    expect(result).toContain('u=https%3A%2F%2Fexample.com%3Ffoo%3D1%26bar%3D2')
    expect(result).toContain('rid=ret%26ailer')
  })

  it('percent-encodes values containing = to prevent delimiter collision', () => {
    const result = buildCanonicalPayload({ u: 'https://example.com', rid: 'a=b' })
    expect(result).toContain('rid=a%3Db')
  })

  it('percent-encodes values containing %', () => {
    const result = buildCanonicalPayload({ u: 'https://example.com/%20path' })
    expect(result).toContain('u=https%3A%2F%2Fexample.com%2F%2520path')
  })

  it('all four keys always present even when all optional params omitted', () => {
    const result = buildCanonicalPayload({ u: '' })
    expect(result).toBe('u=&rid=&pid=&pl=')
    expect(result.split('&')).toHaveLength(4)
  })
})

describe('computeOutboundSignature', () => {
  it('produces deterministic output for identical inputs', () => {
    const payload = { u: 'https://example.com', rid: 'r1', pid: 'p1', pl: 'card' }
    const sig1 = computeOutboundSignature(payload, TEST_SECRET)
    const sig2 = computeOutboundSignature(payload, TEST_SECRET)
    expect(sig1).toBe(sig2)
  })

  it('produces base64url output without padding', () => {
    const sig = computeOutboundSignature({ u: 'https://example.com' }, TEST_SECRET)
    expect(sig).not.toContain('+')
    expect(sig).not.toContain('/')
    expect(sig).not.toContain('=')
    // HMAC-SHA256 base64url is 43 chars (256 bits / 6 bits per char, no padding)
    expect(sig).toHaveLength(43)
  })

  it('produces different signatures for different URLs', () => {
    const sig1 = computeOutboundSignature({ u: 'https://a.com' }, TEST_SECRET)
    const sig2 = computeOutboundSignature({ u: 'https://b.com' }, TEST_SECRET)
    expect(sig1).not.toBe(sig2)
  })

  it('produces different signatures for different secrets', () => {
    const payload = { u: 'https://example.com' }
    const sig1 = computeOutboundSignature(payload, TEST_SECRET)
    const sig2 = computeOutboundSignature(payload, ALT_SECRET)
    expect(sig1).not.toBe(sig2)
  })

  it('produces different signatures when rid differs', () => {
    const sig1 = computeOutboundSignature({ u: 'https://example.com', rid: 'a' }, TEST_SECRET)
    const sig2 = computeOutboundSignature({ u: 'https://example.com', rid: 'b' }, TEST_SECRET)
    expect(sig1).not.toBe(sig2)
  })
})

describe('verifyOutboundSignature', () => {
  const payload = { u: 'https://example.com/product/123', rid: 'midway', pid: 'p_abc', pl: '' }

  it('returns true for valid signature', () => {
    const sig = computeOutboundSignature(payload, TEST_SECRET)
    expect(verifyOutboundSignature(payload, sig, TEST_SECRET)).toBe(true)
  })

  it('returns false for wrong secret', () => {
    const sig = computeOutboundSignature(payload, TEST_SECRET)
    expect(verifyOutboundSignature(payload, sig, ALT_SECRET)).toBe(false)
  })

  it('returns false for tampered u', () => {
    const sig = computeOutboundSignature(payload, TEST_SECRET)
    expect(
      verifyOutboundSignature({ ...payload, u: 'https://evil.com' }, sig, TEST_SECRET)
    ).toBe(false)
  })

  it('returns false for tampered rid', () => {
    const sig = computeOutboundSignature(payload, TEST_SECRET)
    expect(
      verifyOutboundSignature({ ...payload, rid: 'evil' }, sig, TEST_SECRET)
    ).toBe(false)
  })

  it('returns false for tampered pid', () => {
    const sig = computeOutboundSignature(payload, TEST_SECRET)
    expect(
      verifyOutboundSignature({ ...payload, pid: 'evil' }, sig, TEST_SECRET)
    ).toBe(false)
  })

  it('returns false for tampered pl', () => {
    const sig = computeOutboundSignature(payload, TEST_SECRET)
    expect(
      verifyOutboundSignature({ ...payload, pl: 'evil' }, sig, TEST_SECRET)
    ).toBe(false)
  })

  it('returns false for garbage signature', () => {
    expect(verifyOutboundSignature(payload, 'not-a-valid-sig', TEST_SECRET)).toBe(false)
  })

  it('returns false for empty signature', () => {
    expect(verifyOutboundSignature(payload, '', TEST_SECRET)).toBe(false)
  })

  it('returns false for signature of different length', () => {
    expect(verifyOutboundSignature(payload, 'short', TEST_SECRET)).toBe(false)
  })

  // Dual-key rotation
  it('verifies against previousSecret when currentSecret fails', () => {
    const sig = computeOutboundSignature(payload, TEST_SECRET)
    // Current=ALT (wrong), previous=TEST (correct)
    expect(verifyOutboundSignature(payload, sig, ALT_SECRET, TEST_SECRET)).toBe(true)
  })

  it('prefers currentSecret over previousSecret', () => {
    const sig = computeOutboundSignature(payload, TEST_SECRET)
    // Current=TEST (correct), previous=ALT
    expect(verifyOutboundSignature(payload, sig, TEST_SECRET, ALT_SECRET)).toBe(true)
  })

  it('returns false when neither secret matches', () => {
    const sig = computeOutboundSignature(payload, 'completely-different-secret-xxxxx')
    expect(verifyOutboundSignature(payload, sig, TEST_SECRET, ALT_SECRET)).toBe(false)
  })

  it('works without previousSecret (single-key mode)', () => {
    const sig = computeOutboundSignature(payload, TEST_SECRET)
    expect(verifyOutboundSignature(payload, sig, TEST_SECRET)).toBe(true)
    expect(verifyOutboundSignature(payload, sig, ALT_SECRET)).toBe(false)
  })

  // Missing optional params
  it('signs and verifies with all optional params missing', () => {
    const minimal = { u: 'https://example.com' }
    const sig = computeOutboundSignature(minimal, TEST_SECRET)
    expect(verifyOutboundSignature(minimal, sig, TEST_SECRET)).toBe(true)
  })

  // Unicode and special characters
  it('handles unicode in URL', () => {
    const p = { u: 'https://example.com/path?q=日本語' }
    const sig = computeOutboundSignature(p, TEST_SECRET)
    expect(verifyOutboundSignature(p, sig, TEST_SECRET)).toBe(true)
  })

  it('handles fragment identifiers in URL', () => {
    const p = { u: 'https://example.com/page#section-2' }
    const sig = computeOutboundSignature(p, TEST_SECRET)
    expect(verifyOutboundSignature(p, sig, TEST_SECRET)).toBe(true)
    // Fragment changes should invalidate
    const altered = { u: 'https://example.com/page#section-3' }
    expect(verifyOutboundSignature(altered, sig, TEST_SECRET)).toBe(false)
  })
})
