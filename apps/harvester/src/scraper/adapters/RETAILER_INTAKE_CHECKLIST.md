# Retailer Intake Checklist (Scraper Adapter)

Use this checklist for every new scraper target. All items are required unless marked optional.

## 1) Compliance and Allowlist (Blocking)

- [ ] ToS reviewed and approved (record approver + date)
- [ ] robots.txt reviewed (allowed paths documented)
- [ ] `sources.scrape_enabled = false` until approval complete
- [ ] `sources.robots_compliant = true` only after robots.txt check passes
- [ ] `sources.adapter_id` set to the new adapter ID
- [ ] `source_trust_config.upcTrusted = false` by default (raise only after validation)

## 2) Source + Target Setup

- [ ] Create `sources` row for the domain (sourceKind, retailerId, adapterId)
- [ ] Configure `scrape_config` (rate limit, headers, fetcher type)
- [ ] Add 10–20 initial URLs to `scrape_targets`
- [ ] Verify `scrape_targets.source_id` and `adapter_id` match the `sources` row

## 3) URL Sampling (Fixtures)

Capture HTML fixtures for:
- [ ] In-stock product page
- [ ] Out-of-stock product page (price visible)
- [ ] Out-of-stock product page (no price shown) → expect `OOS_NO_PRICE`
- [ ] Tiered pricing page (if applicable)
- [ ] Sale price page (if applicable)

Store fixtures in:
`apps/harvester/src/scraper/adapters/<retailer>/__tests__/fixtures/`

## 4) Selector Map

- [ ] Title selector
- [ ] Price selector
- [ ] Stock signals (in-stock, out-of-stock, backorder)
- [ ] SKU / product ID selectors (if available)
- [ ] UPC selector (if available)
- [ ] Image selector (optional)

## 5) Price Semantics

- [ ] Single selling price captured (not crossed-out list price)
- [ ] Tier rule: prefer qty=1 tier if present
- [ ] Ambiguous price → quarantine with `AMBIGUOUS_PRICE`
- [ ] Per-round price ignored (capture box price)

## 6) Availability Semantics

- [ ] IN_STOCK signal mapped correctly
- [ ] OUT_OF_STOCK signal mapped correctly
- [ ] BACKORDER signal mapped correctly
- [ ] UNKNOWN availability dropped with `UNKNOWN_AVAILABILITY`
- [ ] OOS with no price → `OOS_NO_PRICE` (drop, not drift)

## 7) Identity Signals

- [ ] `retailerProductId` selector (preferred)
- [ ] `retailerSku` selector (fallback)
- [ ] Identity key stable across runs (PID > SKU > URL hash)
- [ ] Canonical URL stored (tracking params removed)

## 8) Tests

- [ ] Adapter test suite passes
- [ ] Fixtures cover all edge cases above
- [ ] >90% of fixtures produce valid offers
- [ ] No UNKNOWN availability written

## 9) Operational Readiness

- [ ] Rate limit configured (default 0.5 req/sec)
- [ ] User-Agent header set (IronScout contact)
- [ ] Drift thresholds enabled (per spec)
- [ ] Runbook entry created for this retailer (if needed)

## 10) Launch Gate (Internal Only for v1)

- [ ] `sources.scrape_enabled = true` only after internal validation
- [ ] SCRAPE visibility guardrails confirmed in API and derived tables (ADR-021)
- [ ] Alerts verified for inStock transitions (staging only)
