import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { computeOutboundSignature, buildOutboundUrl } from '@ironscout/crypto'
import { NextRequest } from 'next/server'
import { GET } from '../route'

const TEST_SECRET = 'test-secret-for-outbound-route-handler!!'
const ALT_SECRET = 'alternate-secret-for-rotation-tests-here!'

function makeRequest(params: Record<string, string>): NextRequest {
  const url = new URL('https://app.ironscout.ai/out')
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  return new NextRequest(url)
}

function signUrl(
  u: string,
  opts?: { rid?: string; pid?: string; pl?: string; secret?: string },
): Record<string, string> {
  const rid = opts?.rid ?? ''
  const pid = opts?.pid ?? ''
  const pl = opts?.pl ?? ''
  const secret = opts?.secret ?? TEST_SECRET
  const sig = computeOutboundSignature({ u, rid, pid, pl }, secret)
  const params: Record<string, string> = { u, sig }
  if (rid) params.rid = rid
  if (pid) params.pid = pid
  if (pl) params.pl = pl
  return params
}

describe('GET /out', () => {
  const ORIGINAL_ENV = process.env

  beforeEach(() => {
    process.env = {
      ...ORIGINAL_ENV,
      OUTBOUND_LINK_SECRET: TEST_SECRET,
    }
  })

  afterEach(() => {
    process.env = ORIGINAL_ENV
  })

  // ── Happy path ──────────────────────────────────────────────────

  it('redirects with 302 for a valid signed URL', async () => {
    const params = signUrl('https://midwayusa.com/product/123', {
      rid: 'midway',
      pid: 'p_123',
    })
    const res = await GET(makeRequest(params))

    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe('https://midwayusa.com/product/123')
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    expect(res.headers.get('Referrer-Policy')).toBe('no-referrer')
  })

  // ── Missing required params ─────────────────────────────────────

  it('returns 400 when u is missing', async () => {
    const sig = computeOutboundSignature({ u: 'https://example.com' }, TEST_SECRET)
    const res = await GET(makeRequest({ sig }))

    expect(res.status).toBe(400)
    expect(await res.text()).toBe('Invalid outbound link')
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    expect(res.headers.get('Referrer-Policy')).toBe('no-referrer')
  })

  it('returns 400 when sig is missing', async () => {
    const res = await GET(makeRequest({ u: 'https://example.com' }))

    expect(res.status).toBe(400)
    expect(await res.text()).toBe('Invalid outbound link')
  })

  // ── URL validation ──────────────────────────────────────────────

  it('returns 400 when decoded u is empty', async () => {
    const params = signUrl('')
    const res = await GET(makeRequest(params))

    expect(res.status).toBe(400)
  })

  it('returns 400 when raw (encoded) u exceeds 4096 characters', async () => {
    const longUrl = 'https://example.com/' + 'a'.repeat(4090)
    const params = signUrl(longUrl)
    const res = await GET(makeRequest(params))

    expect(res.status).toBe(400)
  })

  it('returns 400 when encoded u exceeds 4096 but decoded is shorter', async () => {
    // Each non-ASCII char encodes to 6+ chars via encodeURIComponent (%XX%XX).
    // 700 × 'ä' = 700 decoded chars but 700 × '%C3%A4' = 4200 encoded chars (>4096).
    const nonAsciiUrl = 'https://example.com/' + 'ä'.repeat(700)
    expect(nonAsciiUrl.length).toBeLessThan(4096) // decoded is short
    expect(encodeURIComponent(nonAsciiUrl).length).toBeGreaterThan(4096) // encoded is long

    const params = signUrl(nonAsciiUrl)
    const res = await GET(makeRequest(params))

    expect(res.status).toBe(400)
  })

  it('returns 400 for malformed percent-encoding (%ZZ) — fails signature', async () => {
    // %ZZ is not valid percent-encoding. searchParams.set double-encodes it,
    // and the handler sees '%ZZbadencoding' as the decoded u value.
    // Fails because the signature doesn't match.
    const url = new URL('https://app.ironscout.ai/out')
    url.searchParams.set('u', '%ZZbadencoding')
    url.searchParams.set('sig', 'fakesig')
    const res = await GET(new NextRequest(url))

    expect(res.status).toBe(400)
  })

  // ── Signature validation ────────────────────────────────────────

  it('returns 400 for an invalid signature', async () => {
    const res = await GET(
      makeRequest({
        u: 'https://example.com',
        sig: 'not-a-valid-signature-at-all-nope',
      }),
    )

    expect(res.status).toBe(400)
  })

  it('returns 400 when u has been tampered', async () => {
    const params = signUrl('https://legitimate.com')
    params.u = 'https://evil.com'
    const res = await GET(makeRequest(params))

    expect(res.status).toBe(400)
  })

  it('returns 400 when rid has been tampered', async () => {
    const params = signUrl('https://example.com', { rid: 'original' })
    params.rid = 'tampered'
    const res = await GET(makeRequest(params))

    expect(res.status).toBe(400)
  })

  it('returns 400 when pid has been tampered', async () => {
    const params = signUrl('https://example.com', { pid: 'original' })
    params.pid = 'tampered'
    const res = await GET(makeRequest(params))

    expect(res.status).toBe(400)
  })

  it('returns 400 when pl has been tampered', async () => {
    const params = signUrl('https://example.com', { pl: 'card' })
    params.pl = 'tampered'
    const res = await GET(makeRequest(params))

    expect(res.status).toBe(400)
  })

  // ── Scheme / credential validation ──────────────────────────────

  it('returns 400 for javascript: scheme', async () => {
    const params = signUrl('javascript:alert(1)')
    const res = await GET(makeRequest(params))

    expect(res.status).toBe(400)
  })

  it('returns 400 for URLs with embedded credentials', async () => {
    const params = signUrl('https://user:pass@example.com/path')
    const res = await GET(makeRequest(params))

    expect(res.status).toBe(400)
  })

  it('returns 400 for relative URLs', async () => {
    const params = signUrl('/relative/path')
    const res = await GET(makeRequest(params))

    expect(res.status).toBe(400)
  })

  // ── Single-decode correctness ──────────────────────────────────

  it('preserves literal percent-sequences in URL (no double-decode)', async () => {
    // URL contains %20 as a literal part of the path (already encoded by the retailer).
    // Old bug: decodeURIComponent would double-decode %20→space, changing the redirect target.
    // Fix: searchParams.get() decodes once; we use the value directly.
    const destination = 'https://retailer.com/path%20name?q=100%25off'
    const params = signUrl(destination, { rid: 'r1', pid: 'p1' })
    const res = await GET(makeRequest(params))

    expect(res.status).toBe(302)
    // new URL(destination).toString() normalizes the URL
    expect(res.headers.get('Location')).toBe(new URL(destination).toString())
  })

  // ── Dual-key rotation ──────────────────────────────────────────

  it('accepts signature from previous secret during rotation', async () => {
    // Sign with the "old" secret
    const params = signUrl('https://midwayusa.com/product/789', {
      secret: ALT_SECRET,
    })

    // Current = TEST_SECRET, Previous = ALT_SECRET (the one we signed with)
    process.env.OUTBOUND_LINK_SECRET = TEST_SECRET
    process.env.OUTBOUND_LINK_SECRET_PREVIOUS = ALT_SECRET

    const res = await GET(makeRequest(params))
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe('https://midwayusa.com/product/789')
  })

  it('rejects previous-secret signature when OUTBOUND_LINK_SECRET_PREVIOUS is unset', async () => {
    // Sign with ALT_SECRET but only current (TEST_SECRET) is configured
    const params = signUrl('https://midwayusa.com/product/789', {
      secret: ALT_SECRET,
    })

    delete process.env.OUTBOUND_LINK_SECRET_PREVIOUS

    const res = await GET(makeRequest(params))
    expect(res.status).toBe(400)
  })

  // ── Fail-closed: missing secret ────────────────────────────────

  it('returns 400 when OUTBOUND_LINK_SECRET is not configured', async () => {
    delete process.env.OUTBOUND_LINK_SECRET

    const params = signUrl('https://midwayusa.com/product/123', { rid: 'midway' })
    const res = await GET(makeRequest(params))

    expect(res.status).toBe(400)
    expect(await res.text()).toBe('Invalid outbound link')
  })

  // ── End-to-end: API generateOutUrl → /out → 302 ───────────────

  it('round-trips a URL built by the API signing path through /out', async () => {
    // Simulate what apps/api/src/services/outbound-url.ts does:
    // 1. Build payload and sign with the same secret
    // 2. Construct the absolute out_url via buildOutboundUrl
    // 3. Feed that URL into the /out handler as if the browser navigated to it
    const destination = 'https://midwayusa.com/product/456?sku=ABC-123&ref=search'
    const rid = 'midway'
    const pid = 'p_456'
    const pl = '' // API sets pl=''

    const payload = { u: destination, rid, pid, pl }
    const sig = computeOutboundSignature(payload, TEST_SECRET)
    const outUrl = buildOutboundUrl({
      baseUrl: 'https://app.ironscout.ai',
      payload,
      sig,
    })

    // Parse the generated out_url and feed it directly to the handler
    const res = await GET(new NextRequest(outUrl))

    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe(destination)
  })

  // ── Response headers ────────────────────────────────────────────

  it('sets correct headers on 400 responses', async () => {
    const res = await GET(makeRequest({ u: 'https://example.com' }))

    expect(res.status).toBe(400)
    expect(res.headers.get('Content-Type')).toBe('text/plain; charset=utf-8')
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    expect(res.headers.get('Referrer-Policy')).toBe('no-referrer')
  })
})
