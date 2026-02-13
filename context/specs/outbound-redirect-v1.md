# Outbound Redirect + Retailer Click Tracking (v1)

## Status
Draft

## Summary
Implement a centralized outbound redirect wrapper (`/out`) in the consumer app (`apps/web`) to route all retailer clicks, validate a signed outbound payload, and fire a GA4 event (`retailer_click`) on click. Preserve existing affiliate params and avoid adding new tracking params in v1.

This is a planning spec only. No implementation in this doc.

## Why
- Durable attribution for retailer click events.
- Centralized outbound URL handling and signed URL validation.
- Reduce open-redirect risk.
- Create a path for future affiliate tracking without breaking existing URLs.

## Scope
### In Scope
- Consumer app `apps/web` route handler: `GET /out`.
- Consumer UI outbound links routed through `/out`.
- GA4 event on retailer click (`retailer_click`), best-effort and non-blocking.
- Signed URL validation (HMAC) to prevent open redirects without a retailer allowlist.

### Out of Scope
- Marketing site (`apps/www`) redirect logic.
- `apps/www` is a marketing surface only and does not implement a `/search` route or search results UI.
- All “search” interactions in `apps/www` deep-link to the web app search at `APP_URL/search`.
- Confirmed link-out surfaces:
  - Homepage hero search box: `HeroSearch.tsx`
  - Homepage CTA to search: `page.tsx`
  - Category “Popular searches” links: `CategoryPageLayout.tsx`
  - JSON-LD SearchAction points to app search: `JsonLd.tsx`
  - Not-found/status pages linking to app search: `not-found.tsx`, `status/[code]/page.tsx`
  - Content CTAs to `/search?q=...`: `apps/www/content/**/*`
- Adding or inventing new affiliate params in v1.
- Purchase recommendations, verdicts, or deal language (ADR-006).
- Any client-trusted tier or eligibility logic (ADR-002).
- Auto-discovery of allowlisted retailers.
- Impression tracking (e.g., `product_impression`) deferred to v1.1.

## Assumptions
- The consumer app is `apps/web` (not `apps/www`) and owns product/search UI.
- Existing analytics wrapper `apps/web/lib/analytics.ts` is the integration point.
- Affiliate tracking helper in API exists but is not wired to web responses.

If any assumption is incorrect, stop and revise before implementation.

## Constraints (Trust + Safety)
- Fail closed on ambiguity (ADR-009).
- Prevent open redirect abuse via signed URL validation.
- Do not block navigation on analytics (best-effort only).
- Do not expand public promises or imply guarantees (00_public_promises.md).
- No DB calls or expensive operations before signature verification.

## Functional Requirements
### /out Route Handler
- Path: `GET /out`.
- Query params:
  - `u` (required): percent-encoded destination URL.
  - `sig` (required): HMAC signature of the canonical payload string (`u`, `rid`, `pid`, `pl`).
  - `rid` (optional): retailer id or key.
  - `pid` (optional): product id.
  - `pl` (optional): placement (e.g., `product_card`).
- Validation (order is mandatory; see ordering below):
  1. `u` must be present.
  2. `sig` must be present.
  3. `u` must be <= 4096 chars (raw query param length before decoding).
  4. Decode `u` once with try/catch; if decoding throws, return 400 immediately.
  5. `u` must not be an empty string after decoding.
  6. Build the canonical payload string using percent-encoded values and verify signature in constant time **before** URL parsing.
  7. Parsed URL must be absolute.
  8. URL parsing must use the platform URL constructor and reject relative URLs (e.g., `new URL(decoded)` with no base).
  9. Allowed schemes: `http:` and `https:` only.
  10. Reject `javascript:`, `data:`, `file:` and any non-http(s).
  11. Reject URLs with embedded credentials (e.g., `https://user:pass@example.com`).
- Response:
  - Valid: `302` redirect to final URL.
  - Invalid: `400` plain-text error. Do not redirect.
  - Response body MUST be a minimal static string (e.g., "Invalid outbound link") with no reflection of input.
  - Error responses MUST include `Content-Type: text/plain; charset=utf-8`.
  - Response MUST include `Cache-Control: no-store`.
  - Response MUST include `Referrer-Policy: no-referrer` on both `302` and `400` responses.
  - Use `302` only (no `301`, `308`, or `307`).
  - Do not include request query params in response headers.

### Signature Canonicalization
- Signature input is a canonical payload string in fixed order with percent-encoded values: `u=<enc(decoded_u)>&rid=<enc(rid)>&pid=<enc(pid)>&pl=<enc(pl)>`.
- Missing values become empty strings.
- Only these known params are included, in this exact order.
- All four keys (`u`, `rid`, `pid`, `pl`) MUST always be present in the canonical payload string, even if empty.
- If additional analytics params are later added to `/out`, they MUST be incorporated into the canonical payload string in a fixed order or treated as untrusted and excluded from reporting.
- Each value MUST be encoded with `encodeURIComponent` before concatenation to prevent delimiter collisions (e.g., `%26` → `&`).
- `rid`, `pid`, and `pl` values are used exactly as received before encoding (no normalization or trimming).
- No normalization, no trailing-slash changes, no query sorting in v1.
- The string used to compute the signature MUST be byte-identical to the string used for verification.
- Signature input must be UTF-8 encoded before HMAC computation.
- Fragment identifiers (`#...`) are treated as part of the signed URL string and must be preserved exactly if present.
- Hostname must be evaluated as returned by the URL parser (punycode-normalized). No manual string parsing.

### Encoding Rule
- UI must encode the destination URL exactly once.
- `/out` must decode exactly once.
- Double-encoding or double-decoding is prohibited.

### Signature Verification Order
- Check `u` presence.
- Check `sig` presence.
- Check raw `u` length.
- Decode `u` once.
- Reject empty decoded `u`.
- Build canonical payload string using percent-encoded values.
- Verify signature (constant-time, before URL parsing).
- Only after signature passes: parse URL and validate scheme/credentials.

### Affiliate Tracking Handling
- v1 behavior: preserve existing URL as-is.
- Do not add or invent affiliate parameters.
- If a safe server-side helper is later exposed to web, it can be wired after an explicit decision.

### GA4 Click Event
- Event name: `retailer_click`.
- Best-effort, no await, no blocking navigation.
- Must be client-only and guarded: `typeof window !== 'undefined' && window.gtag`.
- Must not throw if analytics is unavailable or disabled.
- Do not call `preventDefault`; analytics must not alter navigation flow.
- Params only if available:
  - `search_query` (string, raw query if already available in the UI context).
  - `result_rank` (number, 1-based index in result list, where computed).
  - `results_count` (number, total results in list, where computed).
  - `retailer` (rid or retailer name or key).
  - `product_id` (pid).
  - `offer_id` or `listing_id` (string, if available).
  - `placement` (pl).
  - `destination_domain` (hostname derived from the decoded `u` query param in `out_url`, or from a trusted retailer hostname prop if already available; try/catch).
  - `caliber` (string, if already in props).
  - `category` (string, if already in props).
  - `price_total` (number, if available).
  - `price_per_round` (if available).
  - `in_stock` (if available).
- v1 attribution parameters are best-effort. Do not add new API fields solely for analytics.

### Optional Server Log
- Optional, non-blocking server-side log line in `/out` for click diagnostics.
- No PII; do not add if it creates new operational risk.
- Logging must not execute before signature verification.
- If enabled, log fields only:
  - timestamp
  - rid
  - pid
  - pl
  - destination hostname
  - request IP (only if policy allows)
- Do not log IP in local development unless explicitly enabled.
- Do not log full URLs if they may contain PII.
- Do not include request query params beyond explicitly allowed fields.

## Non-Functional Requirements
- Low latency for `/out`.
- No reliance on client-provided trust assertions.
- Safe error handling with minimal exposure.
- Replay risk accepted in v1 (no expiry in signature payload).
- Optional rate limiting may be added in a future revision.
- `/out` responses must not be cacheable (no-store).
- `/out` must execute in a server-only runtime (Node or Edge) with access to `OUTBOUND_LINK_SECRET`.

## Design
### Signed Outbound Links (HMAC)
New module: `packages/crypto/src/outbound-signing.ts` (exported by `@ironscout/crypto`, server-only).
- `computeOutboundSignature(payload: { u: string; rid?: string; pid?: string; pl?: string }, secret: string): string`
  - Uses `HMAC-SHA256`.
  - Signature format: base64url (no padding).
- `verifyOutboundSignature(payload: { u: string; rid?: string; pid?: string; pl?: string }, sig: string, currentSecret: string, previousSecret?: string): boolean`
  - Recomputes signature and compares in constant time.

Notes:
- The secret MUST NOT be exposed client-side (no `NEXT_PUBLIC_*`).
- apps/web MUST NOT sign outbound URLs; it only consumes `out_url` from the API and verifies signatures in `/out`.
- `OUTBOUND_LINK_SECRET` must be available in both `apps/api` (signing) and `apps/web` (verification) server runtimes and must be identical across deployments.
- Constant-time compare MUST use a runtime-provided function (e.g., `crypto.timingSafeEqual`).
- Signature buffers must be equal-length byte arrays before comparison; mismatched lengths fail immediately.
- Dual-key verification is supported for rotation:
  - Signing uses `OUTBOUND_LINK_SECRET` (current).
  - Verification accepts `OUTBOUND_LINK_SECRET` and optional `OUTBOUND_LINK_SECRET_PREVIOUS`.

### Outbound URL Builder
New module: `packages/crypto/src/outbound-url.ts` (exported by `@ironscout/crypto`, server-only).
- `buildOutboundUrl({ baseUrl, payload, sig }): string`
  - `baseUrl` is the web app origin.
  - `payload` includes `u`, `rid`, `pid`, `pl`.
  - Adds `u`, `sig`, `rid`, `pid`, `pl` via `encodeURIComponent`.
- API responses that include outbound destinations MUST provide `out_url` per offer/price row.
- apps/web uses `offer.out_url` as the href for all outbound clicks.
- `out_url` must be an absolute URL built from `NEXT_PUBLIC_APP_URL` (e.g., `https://app.ironscout.ai`).
- API config must include `NEXT_PUBLIC_APP_URL` and use it when building `out_url`.

### API Endpoints Requiring out_url
- Search results endpoint.
- Product detail endpoint.
- Dashboard/watchlist endpoint(s) that return offers/prices.
- Any endpoint returning offer/price rows with a `url` field.

### Route Handler
New file: `apps/web/app/out/route.ts`.
- Parse `u`, `rid`, `pid`, `pl`.
- Parse `sig`.
- Validate as per requirements.
- Return a manual `Response` with `302` and explicit headers (`Location`, `Cache-Control: no-store`, `Referrer-Policy: no-referrer`).

### UI Wiring
- `apps/web/components/products/product-card.tsx`
  - Replace direct `href={lowestPrice.url}` with `href={lowestPrice.out_url}`.
  - Add `onClick` for GA event.
- `apps/web/components/products/product-details.tsx`
  - Replace direct links for lowest price CTA and per-retailer view links with `out_url`.
  - Add click analytics.
- `apps/web/components/results/result-card.tsx`
  - Replace `window.open(retailerUrl, ...)` with `window.open(out_url, ...)`.
  - Fire `retailer_click` before opening.
- `apps/web/components/results/result-row.tsx`
  - Same as `result-card.tsx`.
- `apps/web/components/results/retailer-panel.tsx`
  - Replace `window.open(retailer.url, ...)` with `window.open(retailer.out_url, ...)`.
  - Fire `retailer_click`.
- `apps/web/components/dashboard/molecules/product-card.tsx`
  - Replace `window.open(item.url, ...)` with `window.open(item.out_url, ...)`.
  - Fire `retailer_click`.
- Preserve default browser behaviors (cmd/ctrl-click, right-click open in new tab).
- Do not force navigation patterns beyond existing behavior.
- If `out_url` is missing, hide or disable the outbound link. Do not render a broken link and do not fall back to a direct retailer URL.

### Surface Audit Requirement
- Implementation must include a repo-wide search for:
  - `href=` linking to external URLs in `apps/web`
  - `window.open(` usage in `apps/web`
- All outbound retailer links must route through `/out`.
- Add a CI check (simple grep/script) to prevent direct external retailer URLs.

### Analytics Integration
- Add `trackRetailerClick` helper to `apps/web/lib/analytics.ts`.
- Hard cutover: replace all `trackAffiliateClick` calls with `trackRetailerClick` in the same PR.
- Deprecate `trackAffiliateClick` by refactoring it to emit **only** `retailer_click`, or remove it entirely.
- `retailer_click` is the only outbound click event. No legacy event names should be emitted.
- Pre-launch: no GA event migration required.

## Examples
- Valid:
  - `/out?u=https%3A%2F%2Fmidwayusa.com%2Fproduct%2F123&sig=<HMAC>&rid=midwayusa&pid=p_123&pl=product_card`
  - Redirects to `https://midwayusa.com/product/123`
- Invalid scheme:
  - `/out?u=javascript%3Aalert(1)&sig=<HMAC>`
  - Responds `400` plain text
- Invalid signature:
  - `/out?u=https%3A%2F%2Fexample.com%2Fphish&sig=bad`
  - Responds `400` plain text

## Acceptance Criteria
1. `/out` rejects requests with missing or invalid `sig` and non-http(s) schemes with `400`.
2. All retailer click paths route through `/out`.
3. `retailer_click` event fires on click, best-effort, without blocking.
4. Existing URL query params are preserved; no new affiliate params are added.
5. Open redirect abuse is prevented via signed URL validation (no allowlist required).
6. No direct external retailer links remain in `apps/web` after rollout.
7. Tampering with `rid`, `pid`, or `pl` invalidates the signature and returns `400`.

## Test Plan (Minimum)
- If route handler tests exist, add unit coverage for signature validation and scheme checks.
- Manual test matrix (required):
  - Valid signed URL → `302`
  - Invalid signature → `400`
  - Missing `u` → `400`
  - Missing `sig` → `400`
  - Invalid scheme → `400`
  - Empty `u` after decoding (e.g., `u=&sig=...`) → `400`
  - Tampered `u` → `400`
  - Tampered `rid`/`pid`/`pl` → `400`
  - `u` length > 4096 → `400`
  - Embedded credentials (e.g., `u=https%3A%2F%2Fuser%3Apass%40example.com`) → `400`
  - Right-click open in new tab works
  - GA event fires in dev console
  - `Referrer-Policy: no-referrer` on redirect response
  - `Content-Type: text/plain; charset=utf-8` on 400 responses
- Dual-key rotation tests (required):
  - Valid request signed with `OUTBOUND_LINK_SECRET` → `302`
  - Valid request signed with `OUTBOUND_LINK_SECRET_PREVIOUS` → `302`
  - Invalid request signed with neither secret → `400`
  - Behavior when `OUTBOUND_LINK_SECRET_PREVIOUS` is unset
- API signing path tests (required):
  - `computeOutboundSignature` deterministic output for identical payload+secret
  - `buildOutboundUrl` encodes payload and signature correctly
  - Round-trip: API signs → `/out` verifies → `302`
  - API responses include `out_url` for all required endpoints
- Run `pnpm lint` and `pnpm typecheck` in `apps/web`.

## Decisions (Confirmed)
- `/out` implemented only in `apps/web`.
- `apps/www` remains marketing-only (no redirect logic).
- Affiliate rewriting deferred in v1.
- No static retailer allowlist in v1; use signed URL validation (HMAC).
- Signature covers full payload (`u`, `rid`, `pid`, `pl`) using the canonical payload string.
- Signing occurs in `apps/api`; `apps/web` MUST NOT compute signatures.
- API responses provide `out_url` for each outbound destination (SSR and CSR).
- `out_url` is absolute and built with `NEXT_PUBLIC_APP_URL`.
- No `/api/sign` endpoint in v1.
- Signature does not include expiry in v1 (replay risk accepted).
- Signature format is base64url without padding.
- Dual-key verification supported for rotation.
- Env var names: `OUTBOUND_LINK_SECRET` (current), optional `OUTBOUND_LINK_SECRET_PREVIOUS`.
- GA event migration is a hard cutover: `retailer_click` is canonical and `affiliate_click` is deprecated.
- `retailer_click` is the only outbound click event; no legacy event names are emitted.
- `/out` responses always include `Referrer-Policy: no-referrer` and `Cache-Control: no-store`.

## Failure Mode Expectations
- If `/out` rejects a link, the user receives a 400 page.
- This is acceptable in v1 and signals tampering or invalid link.
- Do not fallback to direct retailer URL under any circumstance.

## Open Questions
1. Should signed URLs include an expiry timestamp (`exp`) to reduce replay window post-v1?
2. Should affiliate tracking helper be exposed to web via API for click-time URL generation post-v1?
3. If affiliate tracking uses third-party redirect domains, should those domains be allowlisted?
