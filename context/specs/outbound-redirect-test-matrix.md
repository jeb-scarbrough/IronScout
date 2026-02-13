# Outbound Redirect — Test Matrix

Required by `outbound-redirect-v1.md` §Test Plan.

## Route Handler Validation (Automated)

All items below are covered by `apps/web/app/out/__tests__/route.test.ts`.

| # | Case | Expected | Test |
|---|------|----------|------|
| 1 | Valid signed URL | 302 + correct Location | `redirects with 302 for a valid signed URL` |
| 2 | Invalid signature | 400 | `returns 400 for an invalid signature` |
| 3 | Missing `u` | 400 | `returns 400 when u is missing` |
| 4 | Missing `sig` | 400 | `returns 400 when sig is missing` |
| 5 | Invalid scheme (`javascript:`) | 400 | `returns 400 for javascript: scheme` |
| 6 | Empty `u` after decoding | 400 | `returns 400 when decoded u is empty` |
| 7 | Tampered `u` | 400 | `returns 400 when u has been tampered` |
| 8 | Tampered `rid` | 400 | `returns 400 when rid has been tampered` |
| 9 | Tampered `pid` | 400 | `returns 400 when pid has been tampered` |
| 10 | Tampered `pl` | 400 | `returns 400 when pl has been tampered` |
| 11 | `u` encoded length > 4096 | 400 | `returns 400 when raw (encoded) u exceeds 4096 characters` |
| 12 | Encoded > 4096, decoded < 4096 | 400 | `returns 400 when encoded u exceeds 4096 but decoded is shorter` |
| 13 | Embedded credentials | 400 | `returns 400 for URLs with embedded credentials` |
| 14 | Relative URL | 400 | `returns 400 for relative URLs` |
| 15 | `Referrer-Policy: no-referrer` on 302 | Header present | `redirects with 302 for a valid signed URL` |
| 16 | `Content-Type: text/plain` on 400 | Header present | `sets correct headers on 400 responses` |
| 17 | `Cache-Control: no-store` on both | Header present | Tests 1, 3, 16 |
| 18 | No double-decode | 302 preserves %XX | `preserves literal percent-sequences in URL` |
| 19 | Missing `OUTBOUND_LINK_SECRET` | 400 (fail-closed) | `returns 400 when OUTBOUND_LINK_SECRET is not configured` |

## Dual-Key Rotation (Automated)

Covered by `route.test.ts` and `packages/crypto/src/__tests__/outbound-signing.test.ts`.

| # | Case | Expected | Test |
|---|------|----------|------|
| 20 | Signed with current secret | 302 | `redirects with 302 for a valid signed URL` |
| 21 | Signed with previous secret | 302 | `accepts signature from previous secret during rotation` |
| 22 | Signed with neither secret | 400 | `returns 400 for an invalid signature` |
| 23 | `OUTBOUND_LINK_SECRET_PREVIOUS` unset | Only current accepted | `rejects previous-secret signature when OUTBOUND_LINK_SECRET_PREVIOUS is unset` |

## API Signing Path (Automated)

Covered by `packages/crypto/src/__tests__/outbound-signing.test.ts` and `apps/api/src/services/__tests__/outbound-url.test.ts`.

| # | Case | Expected | Test |
|---|------|----------|------|
| 24 | Deterministic output | Same payload+secret = same sig | `produces deterministic output` |
| 25 | `buildOutboundUrl` encoding | Correct query string | `builds correct URL with all parameters` |
| 26 | Round-trip sign → verify | Passes | `round-trip: generateOutUrl output verifies` |

## Browser Manual Verification (Pre-Launch)

These items require a running app and browser devtools. Execute once before launch.

| # | Case | How to Verify | Pass? |
|---|------|---------------|-------|
| 27 | Right-click "Open in new tab" works | Right-click any retailer price link on a product page → opens retailer site | |
| 28 | GA `retailer_click` event fires | Open devtools → Network tab → click retailer link → filter for `collect` requests → confirm `retailer_click` event name | |
| 29 | Disabled link when `out_url` missing | Set `OUTBOUND_LINK_SECRET=""` in API → reload product page → retailer links should be hidden/disabled | |
| 30 | No raw retailer URLs in page source | View page source on product page → search for retailer domains → only `/out?` URLs should appear | |
