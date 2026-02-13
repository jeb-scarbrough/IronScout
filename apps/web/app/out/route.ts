/**
 * Outbound Redirect Handler — GET /out
 *
 * Validates a signed outbound URL and redirects the user to the destination.
 * Prevents open-redirect abuse via HMAC-SHA256 signature verification.
 *
 * @see context/specs/outbound-redirect-v1.md
 */

import { type NextRequest } from 'next/server'
import { verifyOutboundSignature } from '@ironscout/crypto'

const MAX_U_RAW_LENGTH = 4096

const REJECT_HEADERS = {
  'Content-Type': 'text/plain; charset=utf-8',
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
} as const

function reject(): Response {
  return new Response('Invalid outbound link', {
    status: 400,
    headers: REJECT_HEADERS,
  })
}

export async function GET(request: NextRequest): Promise<Response> {
  const params = request.nextUrl.searchParams

  // 1. u present
  // Note: searchParams.get() returns the decoded value (single decode).
  // Do NOT call decodeURIComponent again — that would double-decode.
  const decodedU = params.get('u')
  if (!decodedU) return reject()

  // 2. sig present
  const sig = params.get('sig')
  if (!sig) return reject()

  // 3. Raw u length ≤ 4096 (check percent-encoded form, not decoded).
  // Decoded URLs can be much shorter than their encoded form (e.g. non-ASCII
  // chars expand to %XX sequences). Re-encode to measure the wire length.
  if (encodeURIComponent(decodedU).length > MAX_U_RAW_LENGTH) return reject()

  // 4. Build canonical payload and verify signature BEFORE URL parsing.
  // computeOutboundSignature re-encodes decodedU with encodeURIComponent,
  // matching the API signing path (which also encodes the raw destination URL).
  const rid = params.get('rid') ?? ''
  const pid = params.get('pid') ?? ''
  const pl = params.get('pl') ?? ''

  const currentSecret = process.env.OUTBOUND_LINK_SECRET
  if (!currentSecret) return reject()

  const previousSecret = process.env.OUTBOUND_LINK_SECRET_PREVIOUS || undefined

  const valid = verifyOutboundSignature(
    { u: decodedU, rid, pid, pl },
    sig,
    currentSecret,
    previousSecret,
  )
  if (!valid) return reject()

  // 6. Parse URL — must be absolute (no base argument)
  let finalUrl: URL
  try {
    finalUrl = new URL(decodedU)
  } catch {
    return reject()
  }

  // 7. Scheme must be http or https
  if (finalUrl.protocol !== 'http:' && finalUrl.protocol !== 'https:') {
    return reject()
  }

  // 8. No embedded credentials
  if (finalUrl.username || finalUrl.password) {
    return reject()
  }

  // 9. Redirect
  return new Response(null, {
    status: 302,
    headers: {
      Location: finalUrl.toString(),
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
    },
  })
}
