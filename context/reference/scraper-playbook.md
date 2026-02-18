# Scraper Feed Playbook

This playbook turns a new scraper feed into a repeatable workflow.
It follows ADR-021 (SCRAPE guardrails) and ADR-022 (CLI/text-only discovery).

Guiding principles:
- Fail closed on ambiguity (ADR-009)
- No adapter-driven crawling (ADR-022)
- No JS rendering unless a new ADR approves it

---

## Workflow Overview

1) Intake + approval gates
2) Scaffold adapter
3) Register adapter (do this immediately after scaffold)
4) Implement selectors + fixtures + tests
5) Create/update source + trust config
6) Discovery seed (optional)
7) Dry run (no writes)
8) Enable + monitor

---

## 1) Intake + Approval Gates

Collect:
- 2-3 product URLs (in-stock and out-of-stock)
- 1 listing URL or sitemap URL
- Any JSON endpoints if the site serves a JS shell
- Expected product path prefix (e.g., `/ammo/`)

Approval gates (must be recorded before consumer visibility):
- `sources.scrapeEnabled = true`
- `sources.robotsCompliant = true`
- `sources.tosReviewedAt` set
- `sources.tosApprovedBy` set
- `scrape_adapter_status.enabled = true`
- `scrape_adapter_status.ingestionPaused = false`

If any gate is missing, do not scrape (fail closed).

Environment:
- `DATABASE_URL` must be set (or present in repo `.env`) before running `scraper:dry-run`.
- `scraper:discover` is CLI/text-file only and does not require DB access.

---

## 2) Scaffold Adapter

Single entry point (recommended):

```bash
pnpm scraper:bootstrap --id <adapterId> --domain <domain>
```

This runs `scraper:new` (scaffold + auto-register + guided setup) and then offers discovery prompts.
Discovery runs in CLI/text-file mode only (no DB writes).
Bootstrap saves your last answers to `.ironscout/scraper/<adapterId>.json` so you can reuse or edit them on the next run.

Use the template directly (this auto-registers the adapter in the registry and can run a guided setup prompt):

```bash
pnpm scraper:new --id <adapterId> --domain <domain> --version 0.1.0
```

How to pick `adapterId`:
- It is a short, lowercase slug you choose (e.g., `primaryarms`, `sgammo`, `lucky-gunner`).
- It must match the adapter folder name and the value stored in `sources.adapterId`.
- It is also the key used in `apps/harvester/src/scraper/adapters/index.ts`.
- If you want to skip auto-registration, pass `--no-register`.

This creates:
- `apps/harvester/src/scraper/adapters/<adapterId>/adapter.ts`
- `selectors.ts`, `README.md`, tests + fixtures

---

## 3) Register Adapter (Immediately After Scaffold)

Add the adapter to:

- `apps/harvester/src/scraper/adapters/index.ts`

Then build the harvester so the dry-run script can load compiled adapters:

```bash
pnpm --filter @ironscout/harvester build
```

---

## 4) Implement Selectors + Fixtures + Tests

Checklist:
- Update `selectors.ts` with tight CSS selectors
- Replace fixtures with real HTML/JSON snapshots
- Update `adapter.ts` parsing logic as needed
- Remove `.skip` in `__tests__/adapter.test.ts`

The guided setup now prints:
- An extraction strategy hint (HTML vs JSON API vs JSON-LD) based on the fixture.
- Selector samples so you can verify each selector resolves the expected text/attribute.
If JSON-LD or JSON API is detected, the guided setup will offer to skip HTML selector setup so you can focus on adapter parsing logic instead.

If you want help here, send one in-stock URL and one out-of-stock URL and we can fill selectors + test expectations for you.

Tests should cover:
- In-stock page
- Out-of-stock page (with or without price)
- Any sale price variants

---

## 5) Source + Trust Config

Create or update:
- `retailers` entry
- `sources` entry
- `scrape_adapter_status` entry
- `source_trust_config` (e.g., `upcTrusted=false` by default)

If you need a scripted setup, add `packages/db/register-<retailer>.ts`.

Scrape config tips:
- Use `scrapeConfig.customHeaders` when JSON endpoints require Accept headers

---

## 6) Discovery Seed (Optional, ADR-022)

Discovery only discovers candidate URLs and writes a local text file. It does not scrape prices and does not write to DB.

```bash
pnpm scraper:discover --source-url <url> --listing <url> --product-path-prefix /ammo/ --dry-run
pnpm scraper:discover --domain <domain> --sitemap <url> --product-url-regex "<regex>"
```

If the site is a JS shell, use a JSON listing endpoint and `targetUrlTemplate`.

---

## 7) Dry Run (No Writes)

Run a small sample to validate extraction and normalization:

```bash
pnpm scraper:dry-run --source-id <sourceId> --limit 10
```

If gates are not approved yet (local only):

```bash
pnpm scraper:dry-run --source-id <sourceId> --allow-unapproved
```

---

## 8) Enable + Monitor

Enable scraping only after:
- Adapter tests pass
- Dry run shows expected results
- Gates are approved

Monitor:
- `scrape_runs` metrics
- `scrape_adapter_status` failure counts
- Drift detector auto-disable events

Rollback plan:
- Set `scrape_adapter_status.enabled = false` or `ingestionPaused = true`
- Set `sources.scrapeEnabled = false`

---

## Quick Go/No-Go Checks

Go live only if:
- Extract success rate is acceptable on dry run
- No ambiguous price signals
- Robots + ToS gates are approved
- Adapter is registered and enabled

No-go if:
- Extraction fails on known fixtures
- Price parsing is ambiguous
- Robots.txt blocks target paths

---

## Notes

- Keep adapters thin (single page extraction only)
- No pagination inside adapters (ADR-022)
- No recommendations or deal scores (ADR-006)
- Always fail closed on ambiguity (ADR-009)
