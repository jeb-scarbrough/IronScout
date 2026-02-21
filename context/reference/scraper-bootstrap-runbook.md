# Scraper Bootstrap Runbook (CLI + UI Handoff)

This runbook documents the `pnpm scraper:bootstrap` flow for scraper adapter onboarding with:

1. CLI discovery (text-file only)
2. CLI adapter validation
3. CLI smoke test
4. UI handoff outputs (CSV + suggested scrape config)

This flow is intended to keep DB writes in approved admin workflows while still giving operators repeatable CLI validation.

## Guardrails

- Discovery is CLI/text-file only (no DB reads/writes).
- Validation and smoke must pass before UI onboarding.
- Fail closed on ambiguity and bad extraction behavior.
- Keep source disabled until approval gates are complete.

## Prerequisites

1. Adapter identifiers chosen:
- `adapterId` (e.g., `brownells`)
- `domain` (e.g., `brownells.com`)

2. Discovery inputs prepared:
- one or more `--sitemap` and/or `--listing` URLs
- URL matcher: `--product-path-prefix` and/or `--product-url-regex`

3. Harvester build available for smoke:
```bash
pnpm --filter @ironscout/harvester build
```

## Primary Command

```bash
pnpm scraper:bootstrap \
  --id <adapterId> \
  --domain <domain> \
  --source-url "https://www.example.com/path/" \
  --sitemap "https://www.example.com/sitemap.xml" \
  --product-path-prefix "/ammunition/" \
  --smoke-limit 100 \
  --scrape-config-json '{"fetcherType":"http","customHeaders":{"Accept":"text/html"}}'
```

## What Bootstrap Does

1. Scaffolds adapter via `scraper:new`.
2. Runs discovery and writes discovered URLs to a text file.
3. Runs `scraper:validate --site-id <adapterId>`.
4. Runs `scraper:smoke --site-id <adapterId> --url-file <generated urls.txt> [--limit N]`.
5. Generates UI handoff artifacts under `tmp/scraper-bootstrap/<adapterId>-<timestamp>/`:
- `urls.txt`
- `targets-import.csv` (`url,adapterId`)
- `scrape-config.suggested.json`

6. Prints a final UI checklist with artifact paths.

## UI Completion Steps (Admin)

1. Create or verify Retailer.
2. Create or verify Source with adapter id.
3. Set/verify source trust config.
4. Apply scrape config from `scrape-config.suggested.json` if needed.
5. Import targets from `targets-import.csv` in Admin `/scrapers`.
6. Keep source disabled until approval gates are complete.
7. Enable source/adapter for controlled initial run.

## Common Flags

- `--skip-validate`: skip validate step
- `--skip-smoke`: skip smoke step
- `--smoke-limit 20`: cap smoke sample size
- `--skip-dry-run`: run discovery without `--dry-run` label (still text-only)
- `--dont-verify-pdp`: disable PDP verification in discovery (not recommended)
- `--scrape-config-json '{...}'`: override suggested config output

## Failure Handling

If validation fails:
- bootstrap exits non-zero
- fix adapter contract issues, then rerun

If smoke fails:
- bootstrap exits non-zero
- inspect smoke output (`FETCH`, `EXTRACT`, `DROP`, `QUAR` reasons), fix adapter, rerun

If discovery returns zero URLs:
- validate can still run
- smoke is skipped
- UI artifacts are still produced with an empty target list

## Minimal Repeat Loop

```bash
pnpm scraper:validate --site-id <adapterId>
pnpm scraper:smoke --site-id <adapterId> --url-file <urls.txt> --limit 20
```

Re-run bootstrap after fixes to regenerate fresh artifacts for UI import.
