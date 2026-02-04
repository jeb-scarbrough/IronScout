# ADR-021: SCRAPE Consumer Visibility in v1 (Temporary)

## Status
Accepted — 2026-01-31

## Context

IronScout v1 originally scoped consumer pricing to affiliate feeds only.  
At launch time, affiliate data is not yet available, and the only viable source
of consumer pricing is surgical URL scraping (SCRAPE ingestion run type).

Shipping without any consumer pricing would violate the core product promise of
“current prices alongside historical context.” We need a controlled, explicit
exception that allows SCRAPE data to be consumer-visible while preserving trust
and operational safety.

## Decision

For v1, **SCRAPE data may be consumer-visible** as the initial pricing source,
until affiliate feeds are available. This is a temporary exception that must be
explicitly guarded and monitored.

SCRAPE visibility is **allowed only under strict guardrails** and must remain
removable without code changes.

## Guardrails (Required)

1. **Allowlist only**
   - Only explicitly approved sources/URLs are scraped.
   - New scrape targets require admin approval.

2. **Robots.txt + ToS compliance**
   - Robots rules honored; fail closed on ambiguity.
   - ToS approval recorded per source.

3. **SSRF protection**
   - Server-side fetches must block private/loopback/link-local/metadata hosts.
   - DNS rebinding protections required.

4. **Drift detection + auto-disable**
   - High failure rate or zero-price runs auto-disable adapters.
   - Disabled adapters must stop consumer visibility.

5. **Operational kill switch**
   - Scrape adapters and targets can be disabled without code changes.
   - Ambiguous state fails closed (ADR-009).

6. **Standard visibility + corrections**
   - Retailer eligibility predicate applies at query time (ADR-005).
   - Corrections overlay (ADR-015) applies to SCRAPE data the same as any source.

## Consequences

### Positive
- v1 can launch with real consumer pricing data.
- Trust boundary remains enforceable via guardrails.

### Negative
- Higher data quality risk vs affiliate feeds.
- Requires increased monitoring and quicker operational response.

## Scope Alignment

This ADR amends:
- `context/00_public_promises.md`
- `context/02_v1_scope_and_cut_list.md`
- `context/03_release_criteria.md`
- `context/reference/scraper-roadmap.md`
- `context/specs/scraper-framework-01.md`

## Sunset

When affiliate feeds are live and stable, review whether SCRAPE remains
consumer-visible or becomes supplemental only. This requires a follow-up ADR.
