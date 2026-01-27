# E2E Testing Plan (v1) — Final

This document defines the v1 E2E testing strategy for IronScout.
It is scoped to v1 behavior and trust boundaries. It does not expand product scope.

References:
- `context/00_public_promises.md`
- `context/02_v1_scope_and_cut_list.md`
- `context/03_release_criteria.md`
- `context/04_pricing_and_tiers.md`
- `context/05_security_and_trust.md`
- ADRs: 001, 002, 003, 004, 005, 006, 007, 009, 015, 020 (and any ADRs referenced by specific specs)

---

## Guiding Principles

- v1 has no consumer tiering. All consumers get identical capabilities.
- Enforce trust boundaries server-side. Fail closed on ambiguity.
- Price history is append-only; corrections are overlays (ADR-015).
- Avoid recommendations or verdict language (ADR-006).
- Prefer deterministic, reliable tests over broad coverage.
- “Ship-ready” means: critical user journeys complete successfully AND browser health is clean (no actionable console/network failures).

---

## Test Layers (Not Tiers)

1) UI Smoke (fast)
- Basic UI flows on web/admin/merchant apps.
- Runs in development mode for speed and local dev parity.
- Not a v1 ship gate for merchant/admin unless a shared trust boundary is touched.

2) Full-Stack Trust E2E (slow, authoritative)
- Exercises API + DB + workers for trust-critical paths.
- Runs API with `NODE_ENV=production` to enforce conservative error behavior.
- Uses isolated DB/Redis.

3) Browser Health + Interaction E2E (ship gate for web)
- Explicitly validates:
  - DevTools Console warnings/errors triage
  - DevTools Network failures triage
  - All links / buttons / primary actions work
  - End-to-end flow completion, including all sign-up options present in the product

---

## Environment

- UI smoke:
  - Web/Admin/Merchant apps run in development mode.
- Trust E2E:
  - API runs with `NODE_ENV=production`.
  - Isolated Postgres + Redis.
  - Postgres database name: `ironscout_e2e`.
  - Redis connection uses local env config (e.g., `apps/api/.env`); do not log or commit credentials.
  - No queue prefix capability (explicitly not adding this).
  - Redis flush only in isolated nightly lane if needed.
- E2E auth bypass:
  - Allowed only in test environments.
  - CI check must fail if `NODE_ENV=production` and `E2E_AUTH_BYPASS=true`.

Browsers (for Browser Health lane):
- Supported ship browser: latest Chrome stable.
- Pin versions in CI runners where possible to reduce flake.

---

## Fixture Strategy

Hybrid approach:
- DB seeds for baseline graphs and trust-matrix state:
  - retailers, relationships, products, offers, price history windows.
- API-driven setup only when the API surface is the subject of the test:
  - saved-items CRUD
  - unsubscribe flows
  - admin actions (where applicable)
- DB-only for impossible/corrupt states to validate fail-closed behavior.
- Each suite uses unique ID prefixes (e.g., UUID run prefix).
- Do not share state between spec files.

---

## Time Control

- Use deterministic timestamps in fixtures (`observedAt`, `createdAt`).
- For cooldown/cadence checks, use explicit timestamp fixtures and bounded polling.
- For unit/integration tests, `vi.useFakeTimers()` + `vi.setSystemTime()` is allowed.
- E2E tests should avoid real sleeps; use wait-for-condition helpers.

---

## Browser Health Requirements (Ship Gate)

Applies to Browser Health + Interaction E2E lane (and optionally nightly).

### Console (required)
- Capture console output across the full journey (from landing through completion).
- Identify any WARN or ERROR.
- Severity policy:
  - BLOCKER: breaks flow, causes user-visible malfunction, undermines trust boundaries, or indicates security risk.
  - HIGH: likely to break under common conditions, data integrity risk, auth/session instability.
  - MED: non-breaking but indicates reliability debt or degraded experience.
  - POLISH: noisy but harmless (must be justified).
- Rules:
  - If fix is obvious and deterministic: specify the fix.
  - If fix requires decision/input: mark TODO and list after test run.
  - Do not ship with unknown-console-error-class items.

### Network (required)
- Capture failed requests: 4xx/5xx, CORS, timeouts, mixed content, blocked scripts, CSP issues.
- Rules:
  - BLOCKER if it impacts user-visible behavior, auth/session, trust boundaries, or retailer visibility enforcement.
  - HIGH if it risks correctness under common conditions.
  - Otherwise MED/POLISH based on impact.

### Output (required)
- Consolidated “Browser QA TODOs” list at end of test report:
  - What observed
  - Where (route + step)
  - Evidence (console line / network request)
  - What’s needed to close (decision, credential, repro steps)
  - Owner

---

## Interaction Coverage (Ship Gate for Web)

Must validate in at least one environment designated “release candidate”.

### Links
- Test all links on relevant surfaces:
  - internal navigation
  - external retailer click-through links (verify behavior; no guarantee language)
- Assert:
  - correct destination
  - no 404/500
  - no redirect loops
  - correct target (same tab/new tab) per spec

### Buttons / actions
- Test all buttons and primary actions on covered surfaces:
  - clicks, keyboard activation (Enter/Space), focus order is not broken
  - menus/drawers/modals: open/close; escape behavior; backdrop click if supported
  - forms: validation, submit, error recovery

### Flow paths (required)
- Test all supported flow paths end-to-end, including all sign-up options present in the product:
  - Sign-up: each provider + email/password if applicable
  - Sign-in + sign-out
  - Password reset (if shipped in v1)
  - Core consumer loop: Search → Product → Save → Saved Items/Dashboard → Retailer click (as applicable)
- If any path cannot be executed (missing credentials, provider sandbox, environment mismatch):
  - Mark TODO with exact inputs needed
Notes for execution:
- Google sign-up uses a designated test account stored out-of-band (do not commit credentials).
- Email sign-up: create a new account per run.

---

## Trust-Critical E2E Coverage

### Retailer Visibility (ADR-005 + ADR-009)

Test matrix must include:
- ELIGIBLE + no `merchant_retailers` row -> expected visibility per current code.
- ELIGIBLE + ACTIVE/LISTED -> visible.
- ELIGIBLE + ACTIVE/UNLISTED -> hidden.
- ELIGIBLE + all SUSPENDED -> visible (crawl-only).
- INELIGIBLE -> hidden.
- Missing/duplicate relationship rows -> fail closed (empty).

### Append-Only + Corrections (ADR-004 + ADR-015)

- Price facts: no UPDATE/DELETE.
- IGNORE correction excludes from hot paths without deleting rows.
- MULTIPLIER correction adjusts visiblePrice in derived table.
- MULTIPLIER stacking limit: >2 makes event invisible.
- Correction revoke triggers recompute and restores visibility.
- Cold paths (admin/debug) can still see ignored records.

### Alert Correctness (ADR-015)

Canonical test:
- seed saved item + eligible offer
- trigger price-drop alert
- apply IGNORE to ingestion run
- assert:
  - current price recomputed deterministically
  - alert marked suppressed
  - no re-fire on subsequent evaluations

Additional alert cases:
- ineligible mid-watch -> alerts stop
- exact threshold -> triggers
- user unsubscribes -> no further alerts
- cooldown/dedupe enforcement
Alert evaluation trigger:
- Use BullMQ enqueue path; do not add a new admin endpoint.

### AI Assistive Safety (ADR-003 + ADR-006)

- Search works when AI is unavailable (e.g., `OPENAI_API_KEY` unset).
- AI explanations are removable without breaking core functionality.
- No prescriptive language in AI-generated content.
- No internal-only fields leaked in consumer payloads.

### Server-Side Enforcement (ADR-002 + ADR-007 guardrail)

- Client headers like `X-Tier`, `X-Admin`, `X-Retailer-Eligible` have no effect.
- Anon requests to protected endpoints return 401:
  - `GET /api/saved-items`
  - `POST /api/saved-items/:productId`
  - `DELETE /api/saved-items/:productId`
  - `GET /api/gun-locker`
  - `POST /api/gun-locker`

### Scheduler Singleton (ADR-001)

- Start two schedulers concurrently:
  - assert exactly one run row per schedule window
  - assert no duplicate ingestionRunId/provenance collisions
- Chaos variant (nightly):
  - scheduler dies mid-run; restart does not double-create runs
  - workers resume or fail closed

### Current Price Lookback

- Set `CURRENT_PRICE_LOOKBACK_DAYS` explicitly in trust runs.
- Verify prices outside lookback return NULL current price (ADR-015).

### Error Leakage (ADR-009)

- Fail-closed errors are conservative:
  - no stack traces
  - no internal IDs or SQL fragments
  - stable error shape (match patterns, not full string)

---

## UI Smoke Coverage

- Web:
  - sign-in page loads
  - search results show E2E mock data
  - save/remove watchlist item
- Admin:
  - sign-in page loads
  - merchants list loads; search input works
  - create/edit merchant flow
- Merchant:
  - internal tooling smoke only (not v1 ship gate)
  - add comment in test file: "INTERNAL ONLY"
- Negative auth flow:
  - expired/invalid token redirects or returns 401 cleanly

---

## Release Criteria Mapping (03_release_criteria.md)

Each criterion must map to a concrete E2E spec and test name.
Use ADR-prefixed naming for traceability.

Example mapping table (expand as tests are added):

| Release Criterion | E2E Spec | Test Name |
| --- | --- | --- |
| Retailer visibility predicate enforced | `e2e/trust/ADR005-visibility.spec.ts` | `eligible_listed_visible` |
| Ineligible retailers never appear | `e2e/trust/ADR005-visibility.spec.ts` | `ineligible_hidden` |
| Affiliate ingestion idempotent | `e2e/harvester/ADR001-ingestion-idempotent.spec.ts` | `same_run_no_dup` |
| Alerts only from eligible inventory | `e2e/trust/ADR015-alerts.spec.ts` | `ineligible_no_alert` |
| Scheduler singleton | `e2e/harvester/ADR001-scheduler-singleton.spec.ts` | `only_one_run_created` |
| AI output conservative | `e2e/trust/ADR003-ai-language.spec.ts` | `no_prescriptive_text` |
| Fail closed on ambiguity | `e2e/trust/ADR009-fail-closed.spec.ts` | `ambiguous_visibility_denied` |
| Canonical grouping stable | `e2e/trust/ADR019-canonical-grouping.spec.ts` | `deterministic_grouping` |
| Prices tied to source + timestamp | `e2e/trust/ADR015-price-provenance.spec.ts` | `price_has_source_and_observedAt` |
| Admin actions audited | `e2e/admin/ADR010-audit-trail.spec.ts` | `admin_action_logged` |
| Web ship browser health clean | `e2e/web/BROWSER-health.spec.ts` | `no_console_or_network_blockers` |
| All web sign-up options work | `e2e/web/AUTH-signup-options.spec.ts` | `each_provider_completes_signup` |
| All primary actions operable | `e2e/web/INTERACTION-primary-actions.spec.ts` | `no_dead_buttons_or_links` |

---

## Execution Matrix

PR gate (deterministic, zero retries):
- UI smoke
- `ADR005-visibility.spec.ts::eligible_listed_visible`
- `ADR009-fail-closed.spec.ts::ambiguous_visibility_denied`
- `BROWSER-health.spec.ts::no_console_or_network_blockers` (web only, release surfaces)
- Optional guardrail: `ADR001-ingestion-idempotent.spec.ts::same_run_no_dup`

Nightly (1 retry max, track flake per test):
- full ingestion -> current price -> alerts -> correction/ignore -> recompute -> suppression
- scheduler singleton + chaos variant
- full browser health run across main journeys

Pre-release (no retries, 100% pass):
- full trust suite
- full browser health + interaction suite
- derived-table missing/stale behavior test (conservative empty states)

---

## Helper Utilities (E2E)

Shared helpers (suggested):
- `assertNoIneligibleRetailers(response)`
- `assertNoPrescriptiveLanguage(text)`
- `assertAppendOnly(before, after)`
- `assertConservativeError(resp)`
- `waitForJobCompletion(queueName, correlationId, timeoutMs)`
- `waitForDerivedRow(productId, timeoutMs)`
- `collectConsoleAndAssert(severityPolicy)`
- `collectNetworkFailuresAndAssert(severityPolicy)`
- `assertAllLinksResolvable(page, scopeSelector?)`

---

## Non-Goals

- No queue prefix capability additions.
- No expansion of merchant portal features.
- No recommendation or deal language in tests or fixtures.

---

## Notes

- API trust E2E should run with `NODE_ENV=production` to validate conservative errors.
- UI smoke remains in development mode for speed.
- If a test cannot be deterministic, remove it or move it to nightly.
- If browser health produces new WARN/ERRORs, they must be triaged with severity and either fixed or explicitly TODO’d with an owner before pre-release.
