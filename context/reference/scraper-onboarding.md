# Scraper Plugin Onboarding (v1)

This runbook covers onboarding a new site plugin under `apps/harvester/src/ingestion/scrape/sites/*`.

Scope:
- Plugin contract implementation (manifest/fetch/extract/normalize)
- Contract test + fixture setup
- Audited retailer/source setup SQL generation (text-only)
- Scrape target population through Admin bulk import

Guardrails:
- Fail closed on ambiguity (ADR-009)
- Preserve append-only price history behavior (ADR-004, ADR-015)
- Use audited operations, not direct DB edits (ADR-010)
- Keep SCRAPE guardrails enforced (ADR-021, ADR-022)

## Workflow

1. Scaffold or create plugin files under `apps/harvester/src/ingestion/scrape/sites/<siteId>/`.
2. Register plugin in:
`apps/harvester/src/ingestion/scrape/sites/index.ts`
`packages/scraper-registry/src/index.ts`
3. Add fixtures:
`fixtures/in-stock.(html|json)`
`fixtures/out-of-stock.(html|json)`
`fixtures/meta.json`
4. Add contract tests at:
`apps/harvester/src/ingestion/scrape/sites/<siteId>/tests/contract.test.ts`
5. Validate and test:
`pnpm scraper:validate --site-id <siteId>`
`pnpm scraper:test --site-id <siteId>`
6. Generate retailer/source setup SQL (text-only):
`pnpm scraper:db:add-retailer-source --site-id <siteId> --retailer-name "<name>" --website "https://..." --source-name "<name>" --source-url "https://..."`
7. Run the emitted SQL through the approved SQL execution workflow for the intended environment.
8. Populate scrape targets via Admin UI bulk import (`/scrapers`).

## Admin Bulk Import (Required Path)

Use Admin UI, Scrapers page, then Import Targets.

CSV requirements:
- required headers: `url,adapterId`
- one target URL per row
- `adapterId` must equal plugin `manifest.id`

Example CSV:

```csv
url,adapterId
https://www.brownells.com/ammunition/handgun-ammunition/blazer-brass-9mm-luger-handgun-ammo/,brownells
https://www.brownells.com/ammunition/shotgun-ammunition/top-gun-light-ammo-12-gauge-2-34-1-18-oz-8-shot/,brownells
```

## Definition Of Done (Per Site)

1. Plugin files exist under canonical path.
2. Manifest passes validation.
3. Contract tests pass with no network.
4. Deterministic hash assertions pass.
5. `pnpm scraper:validate --site-id <siteId>` passes.
6. `pnpm scraper:test --site-id <siteId>` passes.
7. Retailer/source setup SQL was generated via CLI and run via approved workflow in the intended environment.
8. Source remains disabled until explicit approval.
9. Targets were populated through Admin bulk import from discovery output.

## Rollback

Use audited controls:
- set `sources.scrapeEnabled = false`
- disable or pause adapter in Admin
- set retailer visibility to `INELIGIBLE` when needed

Do not use destructive or direct DB edit workflows for routine ops.
