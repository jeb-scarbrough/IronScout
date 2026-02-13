import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { verifyOutboundSignature } from '@ironscout/crypto'

vi.mock('../../config/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

import { generateOutUrl } from '../outbound-url'

describe('generateOutUrl', () => {
  const ORIGINAL_ENV = process.env

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  afterEach(() => {
    process.env = ORIGINAL_ENV
  })

  it('returns null when OUTBOUND_LINK_SECRET is not set', () => {
    delete process.env.OUTBOUND_LINK_SECRET
    expect(generateOutUrl('https://retailer.com/product/123')).toBeNull()
  })

  it('returns a signed URL when secret is configured', () => {
    process.env.OUTBOUND_LINK_SECRET = 'test-secret-for-outbound-url-service!!'
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.ironscout.ai'

    const result = generateOutUrl('https://retailer.com/product/123', 'ret1', 'prod1')
    expect(result).not.toBeNull()

    const parsed = new URL(result!)
    expect(parsed.pathname).toBe('/out')
    expect(parsed.searchParams.get('u')).toBe('https://retailer.com/product/123')
    expect(parsed.searchParams.get('rid')).toBe('ret1')
    expect(parsed.searchParams.get('pid')).toBe('prod1')
    expect(parsed.searchParams.has('sig')).toBe(true)
  })

  it('produces deterministic output for identical inputs', () => {
    process.env.OUTBOUND_LINK_SECRET = 'test-secret-for-outbound-url-service!!'
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.ironscout.ai'

    const a = generateOutUrl('https://retailer.com', 'r1', 'p1')
    const b = generateOutUrl('https://retailer.com', 'r1', 'p1')
    expect(a).toBe(b)
  })

  it('round-trips: generated URL verifies with the same secret', () => {
    const secret = 'test-secret-for-outbound-url-service!!'
    process.env.OUTBOUND_LINK_SECRET = secret
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.ironscout.ai'

    const result = generateOutUrl('https://midwayusa.com/product/456', 'midway', 'p_456')
    expect(result).not.toBeNull()

    const parsed = new URL(result!)
    const u = parsed.searchParams.get('u')!
    const sig = parsed.searchParams.get('sig')!
    const rid = parsed.searchParams.get('rid') ?? ''
    const pid = parsed.searchParams.get('pid') ?? ''
    const pl = parsed.searchParams.get('pl') ?? ''

    expect(verifyOutboundSignature({ u, rid, pid, pl }, sig, secret)).toBe(true)
  })

  it('omits rid, pid, pl from URL when caller provides no IDs', () => {
    process.env.OUTBOUND_LINK_SECRET = 'test-secret-for-outbound-url-service!!'
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.ironscout.ai'

    const result = generateOutUrl('https://retailer.com/product/1')
    expect(result).not.toBeNull()

    const parsed = new URL(result!)
    // Empty-string params are omitted from the URL by buildOutboundUrl
    // The /out handler defaults missing params to '' before verification
    expect(parsed.searchParams.has('rid')).toBe(false)
    expect(parsed.searchParams.has('pid')).toBe(false)
    expect(parsed.searchParams.has('pl')).toBe(false)
  })

  it('round-trips with no IDs: missing params default to empty for verification', () => {
    const secret = 'test-secret-for-outbound-url-service!!'
    process.env.OUTBOUND_LINK_SECRET = secret
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.ironscout.ai'

    const result = generateOutUrl('https://retailer.com/product/1')
    expect(result).not.toBeNull()

    const parsed = new URL(result!)
    const u = parsed.searchParams.get('u')!
    const sig = parsed.searchParams.get('sig')!
    const rid = parsed.searchParams.get('rid') ?? ''
    const pid = parsed.searchParams.get('pid') ?? ''
    const pl = parsed.searchParams.get('pl') ?? ''

    expect(verifyOutboundSignature({ u, rid, pid, pl }, sig, secret)).toBe(true)
  })

  it('uses NEXT_PUBLIC_APP_URL as base', () => {
    process.env.OUTBOUND_LINK_SECRET = 'test-secret-for-outbound-url-service!!'
    process.env.NEXT_PUBLIC_APP_URL = 'https://custom.ironscout.ai'

    const result = generateOutUrl('https://retailer.com')
    expect(result).not.toBeNull()

    const parsed = new URL(result!)
    expect(parsed.origin).toBe('https://custom.ironscout.ai')
  })
})
