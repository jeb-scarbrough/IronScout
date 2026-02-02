# ADR-022: Limited Discovery Seeding for Scrape Targets

## Status
Accepted

## Context
Manual entry of `scrape_targets` does not scale to thousands of product URLs.
At the same time, v1 explicitly rejects site-wide crawling and adapter-driven
pagination. We need a controlled, low-risk way to seed `scrape_targets` without
turning the scraper framework into a crawler or weakening trust guardrails.

This ADR introduces an optional, ops-run discovery step that only **seeds URLs**
and does **not** extract prices or product data. It keeps adapters focused on
single-page product extraction and preserves the surgical scraping model.

## Decision
Allow a **limited discovery seeding** workflow to populate `scrape_targets`
for approved sources. Discovery is **external to the scraper framework** and
only produces URLs.

Implementation location:
- Manual CLI only: `scripts/seeding/discover-scrape-targets.mjs`
- No BullMQ jobs, no cron, no autonomous scheduling

Discovery may use:
- `sitemap.xml` (preferred)
- Explicitly allowlisted listing/catalog pages
- Sitemap auto-discovery via `robots.txt` `Sitemap:` lines, with fallback to
  `/sitemap.xml` or `/sitemap_index.xml` when no sitemap is declared

Discovery must:
- Run only for sources with `scrapeEnabled = true`, `robotsCompliant = true`,
  `tosReviewedAt` set, `tosApprovedBy` set, and `adapterId` set
- Obey robots.txt (same policy as scraper); fail closed on ambiguity
- Use SSRF protections identical to the scraper fetcher
- Use conservative rate limits (default 0.5 req/sec) and explicit caps
- Output a summary before any DB writes and require explicit operator acceptance
- Avoid JS rendering, proxy rotation, or anti-bot evasion
- Only write canonicalized URLs into `scrape_targets`
- Dedupe by `(sourceId, canonicalUrl)` and never delete existing targets
- Record discovery provenance in `scrape_targets.notes` using a structured
  tag: `discovery:<runId> method:<SITEMAP|LISTING|MIXED>`
- Validate candidate URLs against adapter-compatible patterns

Discovery must **not**:
- Scrape prices or product data
- Paginate beyond explicit allowlists or caps
- Run continuously or autonomously without ops control

## Alternatives Considered
- **Manual URL entry only**: Lowest risk, but not scalable.
- **Full crawler with pagination and auto-discovery**: High ToS/ops risk and
  conflicts with v1 surgical scraping constraints.

## Consequences
- **Technical**: Adds a discovery script and a small amount of ops tooling.
  Scraper framework remains unchanged (single-page extraction only).
- **Operational**: Requires allowlist governance, rate limits, and audit notes.
  Misuse increases ToS risk, so fail-closed controls are mandatory.
- **Product/Trust**: Improves coverage without changing consumer promises or
  visibility guardrails.

## Notes
- Allowlist storage + caps live in `sources.scrapeConfig.discovery`:
  - `allowlist`: array of sitemap/listing seed URLs
  - `maxUrls`: integer cap (default 500 if unset)
  - CLI seeds must be a subset of allowlist when present
- Cap enforcement is fail-closed: if discovery exceeds `maxUrls`, abort.

Discovery seeding is an ops-only input path into `scrape_targets`. It does not
change scraper adapter responsibilities or consumer visibility rules.
