# ADR-022: Limited Discovery for Scrape Targets (CLI/Text-Only)

## Status
Accepted (Amended 2026-02-18)

## Context
Manual entry of product target URLs does not scale to thousands of URLs.
At the same time, v1 explicitly rejects site-wide crawling and adapter-driven
pagination. We need a controlled, low-risk way to discover candidate URLs
without turning the scraper framework into a crawler or weakening trust
guardrails.

This ADR introduces an optional, ops-run discovery step that only discovers
URLs and does **not** extract prices or product data. It keeps adapters focused
on single-page product extraction and preserves the surgical scraping model.

This ADR is amended to remove DB access from discovery. Discovery is now
strictly CLI/text-file output.

## Decision
Allow a **limited discovery** workflow for approved sources. Discovery is
**external to the scraper framework** and only produces URLs as local files.

Implementation location:
- Manual CLI only: `scripts/seeding/discover-scrape-targets.mjs`
- No BullMQ jobs, no cron, no autonomous scheduling
- No DB access (no reads, no writes)

Discovery may use:
- `sitemap.xml` (preferred)
- Explicitly allowlisted listing/catalog pages
- Allowlisted JSON listing endpoints when a site serves JS shells
- Optional pagination on allowlisted listing pages when links are present in HTML
  (e.g., `rel=next` or `page=` links), with strict caps
- Sitemap auto-discovery via `robots.txt` `Sitemap:` lines, with fallback to
  `/sitemap.xml` or `/sitemap_index.xml` when no sitemap is declared

Discovery must:
- Obey robots.txt (same policy as scraper); fail closed on ambiguity
- Use SSRF protections identical to the scraper fetcher
- Use conservative rate limits (default 0.5 req/sec) and explicit caps
- Output a summary and write discovered URLs to local text files only
- Avoid JS rendering, proxy rotation, or anti-bot evasion
- Only emit canonicalized URLs
- Dedupe discovered URLs within the run
- Record discovery provenance in output metadata using a structured
  tag: `discovery:<runId> method:<SITEMAP|LISTING|MIXED>`
- Validate candidate URLs against adapter-compatible patterns
- If pagination is used:
  - Only follow links on the same path as the allowlisted listing page
  - Only follow explicit `page=` links (no crawling category trees)
  - Enforce a per-listing page cap in addition to global URL caps

Discovery must **not**:
- Scrape prices or product data
- Paginate beyond explicit allowlists, page caps, or URL caps
- Run continuously or autonomously without ops control
- Read from or write to the database

## Alternatives Considered
- **Manual URL entry only**: Lowest risk, but not scalable.
- **Full crawler with pagination and auto-discovery**: High ToS/ops risk and
  conflicts with v1 surgical scraping constraints.
- **DB-seeded discovery**: Rejected to keep discovery deterministic, local, and
  operationally simple.

## Consequences
- **Technical**: Discovery remains a standalone CLI that emits files only.
  Scraper framework remains unchanged (single-page extraction only).
- **Operational**: Requires explicit operator review of output files before any
  downstream ingestion. Misuse increases ToS risk, so fail-closed controls are
  mandatory.
- **Product/Trust**: Improves coverage without changing consumer promises or
  visibility guardrails.

## Notes
- Discovery input is CLI-driven (explicit seed URLs and filters).
- Output is text-first and file-based (for example newline-delimited URL files
  plus run summary artifacts).
- Cap enforcement is fail-closed: if discovery exceeds `maxUrls`, abort.
- Pagination cap is enforced per listing run (CLI `--max-pages`, default 10 when `--paginate` is used).

Discovery is an ops-only URL discovery utility. It does not change scraper
adapter responsibilities or consumer visibility rules.
