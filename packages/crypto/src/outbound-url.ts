/**
 * Outbound URL Builder
 *
 * Constructs absolute outbound redirect URLs for the /out route handler.
 * Used by apps/api to build out_url in API responses.
 *
 * @see context/specs/outbound-redirect-v1.md
 */

import type { OutboundPayload } from './outbound-signing'

export interface BuildOutboundUrlOptions {
  /** Web app origin, e.g. "https://app.ironscout.ai" */
  baseUrl: string
  /** Outbound payload (u, rid, pid, pl) */
  payload: OutboundPayload
  /** Pre-computed HMAC signature */
  sig: string
}

/**
 * Build an absolute outbound redirect URL.
 *
 * @returns URL like "https://app.ironscout.ai/out?u=...&sig=...&rid=...&pid=...&pl=..."
 */
export function buildOutboundUrl(options: BuildOutboundUrlOptions): string {
  const { baseUrl, payload, sig } = options
  const url = new URL('/out', baseUrl)

  url.searchParams.set('u', payload.u)
  url.searchParams.set('sig', sig)

  if (payload.rid) {
    url.searchParams.set('rid', payload.rid)
  }
  if (payload.pid) {
    url.searchParams.set('pid', payload.pid)
  }
  if (payload.pl) {
    url.searchParams.set('pl', payload.pl)
  }

  return url.toString()
}
