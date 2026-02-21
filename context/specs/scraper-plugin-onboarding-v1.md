# Spec: Scraper Plugin Onboarding v1

**Status:** Draft (implementation-ready planning)  
**Owner:** Engineering (Harvester)  
**Created:** February 19, 2026  
**Last Updated:** February 19, 2026  
**Depends on:** ADR-001, ADR-004, ADR-009, ADR-010, ADR-015, ADR-021, ADR-022  
**Related:** `context/specs/scraper-framework-01.md`, `context/reference/scraper-playbook.md`

---

## 1. Goal

Standardize scraper onboarding so a new ammo-site scraper can be added, validated, and operationalized without ad hoc code paths.

Target outcomes:

1. A single scraper plugin contract for all site implementations.
2. Repeatable CLI onboarding and validation workflow.
3. Fixture-first contract testing with deterministic outputs.
4. Audited source/retailer DB setup command (no direct SQL workflow).
5. Backward-compatible migration from current adapter architecture.

---

## 2. Non-Negotiable Constraints

All implementation work from this spec MUST preserve:

1. Fail-closed behavior for ambiguity and invalid state (ADR-009).
2. Append-only price fact behavior with corrections overlay semantics (ADR-004, ADR-015).
3. No routine ops dependency on production code changes or direct DB edits (ADR-010).
4. Existing singleton/lock-protected scheduling invariants (ADR-001).
5. SCRAPE guardrails (robots/ToS/allowlist/kill switch) and visibility policy (ADR-021, ADR-022).

---

## 3. Current Foundation to Reuse

Implementation should build on:

1. `apps/harvester/src/scraper/*` runtime pipeline (scheduler, worker, registry, writer).
2. Existing adapter implementations in `apps/harvester/src/scraper/adapters/*`.
3. Existing scripts:
   - `scripts/scraper/new-adapter.mjs`
   - `scripts/scraper/bootstrap.mjs`
   - `scripts/scraper/dry-run.mjs`
4. Existing DB setup pattern in `packages/db/register-*.ts`.
5. Existing audit table `admin_audit_logs` in `packages/db/schema.prisma`.
6. Existing shared metadata package `packages/scraper-registry`.
7. Existing scrape target management in `apps/admin/app/scrapers/actions.ts` (single + bulk target creation with audit logging).
8. Existing discovery script `scripts/seeding/discover-scrape-targets.mjs` (CLI/text-file output, no DB writes).
9. Existing harvester test runner (`vitest`) and scraper `ScrapedOffer` field semantics in `apps/harvester/src/scraper/types.ts`.

Do not replace these wholesale in one change; migrate incrementally.

---

## 4. Target Organization

Canonical scraper module path:

```text
apps/
  harvester/
    src/
      ingestion/
        scrape/
          types.ts
          registry.ts
          runtime/
            adapter-bridge.ts
          cli/
            index.ts
            commands/
              add.ts
              validate.ts
              test.ts
              smoke.ts
              db-add-retailer-source.ts
          kit/
            http.ts
            html.ts
            json.ts
            normalize.ts
            validate.ts
            fixtures.ts
          sites/
            <siteId>/
              manifest.ts
              fetch.ts
              extract.ts
              normalize.ts
              fixtures/
              tests/
                contract.test.ts
```

Compatibility during migration:

1. Keep `apps/harvester/src/scraper/*` functional.
2. Add bridge layer so legacy `ScrapeAdapter` can call plugin modules.
3. Migrate one site at a time; remove direct legacy paths only after parity.

---

## 5. Plugin Contract (Normative)

Each site MUST export a plugin object with these modules.

### 5.1 Manifest

```ts
export interface ScrapePluginManifest {
  id: string; // unique slug, e.g. 'brownells'
  name: string; // display name
  owner: string; // team/owner alias
  version: string; // semver, e.g. '1.0.0'
  mode: 'html' | 'json';
  baseUrls: string[]; // explicit domains/origins
  rateLimit?: {
    requestsPerSecond?: number;
    minDelayMs?: number;
    maxConcurrent?: number;
  };
}
```

Manifest rules:

1. `version` is required and is the authoritative source for `adapterVersion`.
2. `baseUrls` must be public HTTPS origins; private/reserved hosts are rejected at validate-time and runtime.
3. `rateLimit` values are hints and are clamped by framework guardrails:
   - `requestsPerSecond` max `2`
   - `minDelayMs` min `500`
   - `maxConcurrent` max `1`

### 5.2 Fetch

```ts
export interface ScrapePluginFetch {
  fetch(input: {
    url: string;
    mode: 'html' | 'json';
    headers?: Record<string, string>;
    timeoutMs?: number;
  }): Promise<{
    ok: boolean;
    statusCode?: number;
    body?: string;
    error?: string;
    durationMs: number;
  }>;
}
```

Rules:

1. Use shared HTTP/robots/rate-limit primitives.
2. Do not bypass SSRF guards.
3. Do not guess fallback URLs outside `manifest.baseUrls`.

### 5.3 Extract

```ts
export interface RawScrapeOffer {
  title: string;
  price: string | number;
  availability: string;
  url: string;
  retailerSku?: string;
  retailerProductId?: string;
  upc?: string;
  brand?: string;
  caliber?: string;
  grainWeight?: string | number;
  roundCount?: string | number;
  caseMaterial?: string;
  bulletType?: string;
  loadType?: string;
  shellLength?: string;
  imageUrl?: string;
}

export interface ScrapePluginExtractResultOk {
  ok: true;
  rawOffers: RawScrapeOffer[]; // one or more offers from the page payload
}

export interface ScrapePluginExtractResultFail {
  ok: false;
  reason:
    | 'SELECTOR_NOT_FOUND'
    | 'PRICE_NOT_FOUND'
    | 'TITLE_NOT_FOUND'
    | 'PAGE_STRUCTURE_CHANGED'
    | 'BLOCKED_PAGE'
    | 'EMPTY_PAGE'
    | 'AMBIGUOUS_VARIANTS'
    | 'OOS_NO_PRICE';
  details?: string;
}
```

Extractor MUST:

1. Return explicit failure reasons; no silent null/undefined behavior.
2. Return every unambiguous variant in `rawOffers`.
3. Return `AMBIGUOUS_VARIANTS` when multiple offers exist but cannot be deterministically separated.

### 5.4 Normalize

```ts
export interface NormalizedScrapeOffer {
  sourceId: string;
  retailerId: string;
  url: string; // canonicalized
  title: string;
  priceCents: number;
  currency: 'USD';
  availability: 'IN_STOCK' | 'OUT_OF_STOCK' | 'BACKORDER' | 'UNKNOWN';
  observedAt: Date;
  identityKey: string;
  retailerSku?: string;
  retailerProductId?: string;
  upc?: string;
  brand?: string;
  caliber?: string;
  grainWeight?: number;
  roundCount?: number;
  caseMaterial?: string;
  bulletType?: string;
  loadType?: string;
  shellLength?: string;
  imageUrl?: string;
  costPerRoundCents?: number;
  shippingCents?: number | null;
  taxIncluded?: boolean;
  adapterVersion: string;
}
```

Normalizer MUST:

1. Convert prices to integer cents.
2. Canonicalize URL.
3. Normalize ammo fields (caliber/grain/pack) deterministically.
4. Compute `costPerRoundCents` in framework normalize kit (not per-site plugin) when `roundCount > 0` using `Math.round(priceCents / roundCount)`.
5. Compute `identityKey` in framework code (`kit/normalize.ts`), not site plugin code:
   - precedence: `retailerProductId` (`PID`) > `retailerSku` (`SKU`) > canonical URL hash (`URL`)
6. Fail/drop/quarantine explicitly on invalid data.

Identity key ownership:

1. Plugins provide candidate identity inputs (`retailerProductId`, `retailerSku`, `url`).
2. Framework computes `identityKey` exactly once and is authoritative.
3. Plugin-provided `identityKey` is disallowed to prevent per-site drift.

### 5.5 Provenance

Provenance fields are required at write-time and must be populated by the existing writer path:

1. `observedAt` (event time, from adapter context).
2. `ingestionRunType = 'SCRAPE'`.
3. `ingestionRunId` (run ID from scheduler/worker).
4. `adapterVersion = manifest.version`.

---

## 6. Registry Model

Single metadata source:

1. Extend `packages/scraper-registry/src/index.ts` to include plugin manifest fields.
2. Runtime registry in `apps/harvester/src/ingestion/scrape/registry.ts` resolves manifest to module paths.
3. Legacy `apps/harvester/src/scraper/adapters/index.ts` remains as compatibility entrypoint during migration.

Registry invariants:

1. Unique plugin `id`.
2. Unique base-domain ownership at registrable domain level (eTLD+1); no two plugins claim the same eTLD+1.
3. Explicit registration only (no directory auto-discovery).
4. `scraper validate` MUST cross-check runtime registry entries against `packages/scraper-registry`.

---

## 7. CLI Surface (Normative)

CLI command wrappers remain under `scripts/scraper/*` (repo convention).  
Command implementation logic lives under `apps/harvester/src/ingestion/scrape/cli/*`.

### 7.1 `scraper add`

Usage:

```bash
pnpm scraper:add --site-id <siteId> --name "<display>" --mode html|json [--owner "<team>"] [--force]
```

Behavior:

1. Creates site folder and template files.
2. Adds plugin metadata entry.
3. Adds plugin registration entry.
4. Fails if existing site and no `--force`.

Exit codes:

1. `0` success.
2. `2` validation error (bad args, invalid site id).
3. `3` write conflict (site exists, registry collision).

### 7.2 `scraper validate`

Usage:

```bash
pnpm scraper:validate --site-id <siteId> [--strict]
```

Behavior:

1. Plugin contract shape validation.
2. Typecheck for harvester + scraper registry package.
3. Lint for plugin and shared scrape modules.
4. Fixture contract tests for specified site.
5. Cross-check runtime registry vs `packages/scraper-registry`.
6. Validate fixture metadata freshness (warn if fixture age > 90 days; fail in `--strict` if > 180 days).

Exit codes:

1. `0` success.
2. `4` contract/schema failure.
3. `5` typecheck/lint/test failure.

### 7.3 `scraper test`

Usage:

```bash
pnpm scraper:test --site-id <siteId>
```

Behavior:

1. Runs fixture-only contract tests.
2. Fails if network call is attempted.

Exit codes:

1. `0` success.
2. `6` fixture test failure.

### 7.4 `scraper smoke` (optional)

Usage:

```bash
pnpm scraper:smoke --site-id <siteId> --url-file <path> [--limit 10]
```

Behavior:

1. Uses existing dry-run flow (no writes by default).
2. Applies normal fetch policy and gates.
3. Intended for staging/manual verification.

### 7.5 `scraper db:add-retailer-source`

Usage:

```bash
pnpm scraper:db:add-retailer-source \
  --site-id <siteId> \
  --retailer-name "<name>" \
  --website "https://..." \
  --source-name "<name>" \
  --source-url "https://..." \
  [--scrape-config-file "<path-to-json>"] \
  [--scrape-config-json '{"customHeaders":{"Accept":"application/json"}}'] \
  [--scrape-config-merge deep|replace]
```

Behavior:

1. Upsert `retailers`.
2. Upsert `scrape_adapter_status`.
3. Upsert `sources` with safe defaults.
4. Upsert `source_trust_config`.
5. Optionally sets `sources.scrapeConfig` from file/json input.
6. `scrapeConfig` validates against shared schema before write; invalid config fails closed.
7. Insert `admin_audit_logs` entry including `oldValue` and `newValue` snapshots with `scrapeConfig`.
8. Single transaction, all-or-nothing.
9. `--scrape-config-file` and `--scrape-config-json` are mutually exclusive; passing both fails validation.
10. Command is idempotent by upsert semantics; safe to re-run after a failure.

`scrapeConfig` validation contract (v1):

1. Validation uses shared runtime schema in scrape kit/types (single source for CLI + runtime).
2. Known keys validated:
   - `fetcherType` (`http` only in v1)
   - `rateLimit.requestsPerSecond` (> 0)
   - `rateLimit.minDelayMs` (>= 0)
   - `rateLimit.maxConcurrent` (> 0)
   - `customHeaders` (string map)
3. `discovery` key is allowed as pass-through object for compatibility with existing discovery config.
4. Unknown top-level keys are allowed as pass-through in v1 but must be logged in command output.

Defaults:

1. `retailers.visibilityStatus = INELIGIBLE`.
2. `sources.scrapeEnabled = false`.
3. `sources.robotsCompliant = true`.
4. `source_trust_config.upcTrusted = false`.
5. `--scrape-config-merge` default is `deep`.

Rollback / correction path:

1. Incorrect onboarding is corrected through audited controls, not raw DB edits:
   - set `retailers.visibilityStatus = INELIGIBLE`
   - set `sources.scrapeEnabled = false`
   - set `scrape_adapter_status.enabled = false` or pause ingestion
2. No destructive delete workflow is required for v1 onboarding.

---

## 8. Scaffold Templates

`scraper add` creates these minimal files:

1. `manifest.ts` with id/name/owner/version/mode/baseUrls/rate limits.
2. `fetch.ts` with default shared fetch wrapper.
3. `extract.ts` returning explicit `ok` with `rawOffers[]` or explicit `reason`.
4. `normalize.ts` using shared canonicalization and validators.
5. `fixtures/` with placeholder fixture files and README guidance.
6. `fixtures/meta.json` with fixture capture metadata (`capturedAt`, `capturedFrom`, `notes`).
7. `tests/contract.test.ts` with deterministic baseline assertions.

Template test must include:

1. In-stock fixture case.
2. Out-of-stock fixture case.
3. Deterministic hash assertion.
4. Expected failure case (e.g. malformed page).
5. Multi-offer fixture case (or explicit `AMBIGUOUS_VARIANTS` assertion).

---

## 9. Bridge and Migration Plan

### 9.1 Bridge Layer

Add `adapter-bridge.ts` that adapts plugin modules to legacy `ScrapeAdapter` shape:

1. During migration bridge mode, legacy worker retains fetch ownership (`HttpFetcher` + robots + rate limit).
2. Bridge invokes plugin `extract` + `normalize` only; plugin `fetch.ts` is not called in this mode.
3. Plugin `fetch.ts` is still scaffolded and used by:
   - plugin-native runtime path (post-cutover)
   - `scraper smoke` command
4. Generated `fetch.ts` and `adapter-bridge.ts` must include comment headers explaining this to avoid dead-code confusion.

### 9.2 Site Migration Sequence

For each site:

1. Build plugin under `ingestion/scrape/sites/<siteId>`.
2. Run parity test against legacy adapter fixtures (same fixture corpus used by legacy adapter tests).
3. Flip registry binding to plugin-backed adapter bridge.
4. Keep legacy adapter files as wrappers until stabilization window is complete.
5. Legacy adapter wrapper removal target date: **June 30, 2026**. If not met, an ADR/doc update is required.

### 9.3 First Site

Brownells is the reference migration for this spec.
For parity, Brownells plugin mode in this spec is `html` (including JSON-LD extraction from page payload) unless a later change explicitly adds a `json` source path with equivalent fixture coverage.

---

## 10. Testing Strategy (Detailed)

### 10.1 Unit Tests

Scope:

1. `kit/http.ts` (retry, timeout, headers merge, blocked host guard).
2. `kit/html.ts` helpers.
3. `kit/json.ts` safe parse behavior.
4. `kit/normalize.ts` ammo normalization helpers.
5. `kit/validate.ts` required-field and fail-closed checks.
6. `kit/fixtures.ts` deterministic serializer + hash.

Requirements:

1. No network in unit tests.
2. Explicit edge-case coverage for ambiguous price/availability.
3. SSRF tests must include plugin `baseUrls` misuse attempts (private/reserved IPs).
4. Rate-limit clamp tests must prove manifest hints cannot bypass framework caps.
5. Contract test harness must disable outbound network access (`nock.disableNetConnect()` or equivalent).

### 10.2 Plugin Contract Tests (per site)

Every site plugin must pass fixture contract tests with:

1. Stable extraction and normalization output snapshots.
2. Required fields present and valid.
3. Price and availability normalization correctness.
4. Caliber/grain/roundCount normalization correctness.
5. Deterministic hash equality across repeated runs.
6. Deterministic `identityKey` equality across repeated runs with identical inputs.
7. Multi-offer page behavior (`rawOffers[]`) or explicit `AMBIGUOUS_VARIANTS`.

### 10.3 CLI Tests

Commands to test:

1. `add` creates expected files and registry updates.
2. `add` duplicate behavior with and without `--force`.
3. `validate` fail/success paths.
4. `test` enforces no-network fixture run.
5. `validate` cross-checks runtime registry against `packages/scraper-registry`.
6. `db:add-retailer-source` transaction and audit logging.
7. `db:add-retailer-source` validates/merges `scrapeConfig` as specified.

### 10.4 Integration Tests

Scope:

1. Plugin bridge works with existing worker/writer flow.
2. Provenance written as expected (`SCRAPE`, run ID).
3. Append-only behavior preserved (no update/delete on prices).
4. Scheduler behavior unchanged (no duplicate run semantics introduced).
5. Circuit-breaker behavior remains framework-owned and unaffected by plugin contract shape.
6. Bridge parity is field-level equivalence with explicit allowed differences:
   - `adapterVersion` string
   - ordering where order is not semantically relevant

### 10.5 Hashing and Idempotency Algorithm

Deterministic hash input:

1. Normalize object keys recursively sorted.
2. If hashing an array of offers, sort offers first by stable tuple:
   - `url` (ascending)
   - `retailerProductId ?? ''` (ascending)
   - `retailerSku ?? ''` (ascending)
3. Exclude non-deterministic fields unless fixed in test context.
4. Serialize with stable JSON stringifier.
5. Compute `SHA-256` over serialized string.

Test rule:

1. Same fixture + same fixed context timestamp -> identical hash.
2. Intentional field change -> hash must differ.

### 10.6 Fixture Freshness Policy

1. Every fixture set must include `fixtures/meta.json` with at least:
   - `capturedAt` (ISO timestamp)
   - `capturedFrom` (URL or source descriptor)
   - `capturedBy` (actor/tool)
   - `notes`
2. `scraper validate` warns when oldest fixture is over 90 days old.
3. `scraper validate --strict` fails when oldest fixture is over 180 days old.
4. Updating expected hash without fixture metadata update is treated as invalid in strict mode.
5. Fixture provenance should use real captured pages where legally permitted; synthetic fixtures are allowed only for edge/error cases and must be marked in metadata.

---

## 11. CI and Command Integration

Add top-level script wrappers:

1. `scraper:add`
2. `scraper:validate`
3. `scraper:test`
4. `scraper:smoke`
5. `scraper:db:add-retailer-source`

CI gate recommendation:

1. PR touching `ingestion/scrape/sites/*` must run:
   - `pnpm scraper:validate --site-id <changed-site>`
2. Full nightly can run all site validations.
3. Validation output must report:
   - registry parity status (runtime vs package)
   - fixture freshness status
4. PRs touching shared scrape runtime (`ingestion/scrape/kit/*`, shared types, or registry logic) must run full multi-site validation.

---

## 12. Delivery Phases with Acceptance Criteria

### Phase A: Contract + Registry + CLI scaffolding

Deliverables:

1. Plugin types and runtime registry.
2. CLI command handlers (`add`, `validate`, `test`).
3. Script wrappers.
4. Template generation.

Acceptance:

1. Can scaffold a new site with one command.
2. Can run contract validation on scaffold output.

### Phase B: Test harness + audited DB command

Deliverables:

1. Fixture contract harness and deterministic hash utilities.
2. `db:add-retailer-source` command with transaction + audit log.
3. CLI tests for failure modes.
4. Fixture freshness metadata and validator warnings.

Acceptance:

1. DB command creates expected rows and audit log.
2. Contract tests catch malformed outputs.
3. `scrapeConfig` can be set via CLI with schema validation and auditable diff.

### Phase C: Brownells migration + docs

Deliverables:

1. Brownells plugin migration through bridge.
2. Onboarding doc with Definition of Done checklist.
3. Updated command reference.
4. Onboarding doc explicitly covers scrape target population path (Admin UI bulk import from discovery output).

Acceptance:

1. Brownells plugin passes `scraper validate`.
2. Legacy behavior parity confirmed on fixture suite.
3. Brownells plugin parity includes deterministic identity key and optional pricing fields (`shippingCents`, `costPerRoundCents`) behavior.

---

## 13. Definition of Done (Per Site)

A site is done when all conditions are true:

1. Plugin files exist under canonical path.
2. Manifest passes schema checks.
3. Fixture contract tests pass.
4. Deterministic hash assertions pass.
5. `scraper validate --site-id <siteId>` passes.
6. `scraper test --site-id <siteId>` passes with no network.
7. DB setup done through audited CLI command.
8. Source remains disabled by default until explicit approval.
9. Scrape targets populated through audited path:
   - Admin UI bulk import (`/scrapers`) from discovery output file, or
   - future audited CLI import command if implemented.
10. For Admin CSV import, `adapterId` must equal plugin `manifest.id`; onboarding docs must include a ready-to-import CSV example (`url,adapterId`).
11. Fixture metadata freshness policy is passing for non-strict/strict mode used in CI.

---

## 14. Risks and Mitigations

1. Risk: dual architecture confusion.
   - Mitigation: explicit bridge-mode fetch ownership docs + legacy removal target date (June 30, 2026).
2. Risk: registry drift.
   - Mitigation: `scraper validate` cross-checks runtime and `packages/scraper-registry`.
3. Risk: weak/stale fixtures miss drift.
   - Mitigation: required fixture set plus `fixtures/meta.json` and freshness gates.
4. Risk: DB command misuse.
   - Mitigation: strict required args, safe defaults, schema validation, audit trail, transaction.
5. Risk: SSRF via bad plugin config.
   - Mitigation: runtime SSRF blocklist + manifest URL validation + explicit SSRF tests.
6. Risk: rate-limit bypass by aggressive manifest values.
   - Mitigation: framework clamps rate limits regardless of plugin hints.
7. Risk: identity key inconsistency across plugins.
   - Mitigation: framework-owned identity key computation only.
8. Risk: rollback friction for source setup.
   - Mitigation: document rollback path via audited Admin controls (`scrapeEnabled=false`, adapter pause/disable).

---

## 15. Out of Scope

1. Autonomous crawler behavior.
2. JS rendering expansion.
3. Guardrail relaxation.
4. Consumer promise changes.
5. Replacing scheduler architecture.

---

## 16. Decisions and Remaining Open Items

Resolved in this spec:

1. `identityKey` ownership: framework-owned (`kit/normalize.ts`) with precedence `PID > SKU > URL hash`.
2. Bridge fetch behavior: legacy worker owns fetch during migration; plugin fetch is used for smoke/plugin-native path.
3. `NormalizedScrapeOffer` includes `shippingCents` and `costPerRoundCents`.
4. `db:add-retailer-source` supports `scrapeConfig` write and audited diff logging.
5. Test runner for scaffolded scraper tests is `vitest` (matches current harvester).
6. Circuit breaker ownership remains in framework worker layer, not plugin contract.
7. Brownells migration mode for parity is `html` in v1.
8. Multi-variant extraction is supported via `rawOffers[]`.
9. Plugin code changes are restart-required in v1 (no hot-swap registry behavior).
10. New adapter drift/error budget defaults follow existing framework thresholds:
    - alert at >50% failure in batch (minimum sample size 20)
    - auto-disable on consecutive failing batches per current scheduler policy
11. Plugin dependencies should be minimal and prefer shared `kit/*`; any new third-party dependency requires explicit review.

Remaining open items:

1. Wrapper implementation technology:
   - Keep `scripts/scraper/*.mjs` wrappers calling TS modules (recommended).
2. Whether `scraper validate` should support multi-site mode (`--all`) in v1.

---

## 17. File-by-File Implementation Plan

This section defines the expected initial file changes for implementation PRs.

### 17.1 Phase A (Contract + Registry + CLI)

Core types and registry:

1. Add `apps/harvester/src/ingestion/scrape/types.ts`.
2. Add `apps/harvester/src/ingestion/scrape/registry.ts`.
3. Add `apps/harvester/src/ingestion/scrape/runtime/adapter-bridge.ts`.
4. Extend `packages/scraper-registry/src/index.ts` for plugin metadata (additive, backward-compatible).

CLI command modules:

1. Add `apps/harvester/src/ingestion/scrape/cli/index.ts`.
2. Add `apps/harvester/src/ingestion/scrape/cli/commands/add.ts`.
3. Add `apps/harvester/src/ingestion/scrape/cli/commands/validate.ts`.
4. Add `apps/harvester/src/ingestion/scrape/cli/commands/test.ts`.
5. Add `apps/harvester/src/ingestion/scrape/cli/commands/smoke.ts`.
6. Add `apps/harvester/src/ingestion/scrape/cli/commands/db-add-retailer-source.ts`.

Shared utilities:

1. Add `apps/harvester/src/ingestion/scrape/kit/http.ts`.
2. Add `apps/harvester/src/ingestion/scrape/kit/html.ts`.
3. Add `apps/harvester/src/ingestion/scrape/kit/json.ts`.
4. Add `apps/harvester/src/ingestion/scrape/kit/normalize.ts`.
5. Add `apps/harvester/src/ingestion/scrape/kit/validate.ts`.
6. Add `apps/harvester/src/ingestion/scrape/kit/fixtures.ts`.

Script wrappers:

1. Add `scripts/scraper/add.mjs`.
2. Add `scripts/scraper/validate.mjs`.
3. Add `scripts/scraper/test.mjs`.
4. Add `scripts/scraper/smoke.mjs`.
5. Add `scripts/scraper/db-add-retailer-source.mjs`.

Top-level scripts:

1. Update root `package.json`:
   - `scraper:add`
   - `scraper:validate`
   - `scraper:test`
   - `scraper:smoke`
   - `scraper:db:add-retailer-source`

Compatibility wiring:

1. Update `apps/harvester/src/scraper/adapters/index.ts` to support plugin-backed adapters via bridge.
2. Keep existing adapter exports functional.

### 17.2 Phase B (Testing + Audited DB command)

Tests:

1. Add `apps/harvester/src/ingestion/scrape/kit/__tests__/*.test.ts`.
2. Add CLI tests under `apps/harvester/src/ingestion/scrape/cli/__tests__/*.test.ts`.
3. Add bridge integration tests under `apps/harvester/src/ingestion/scrape/runtime/__tests__/*.test.ts`.

DB command implementation:

1. Use Prisma transaction in command module.
2. Ensure `admin_audit_logs` write includes:
   - actor identifier
   - action string
   - resource and IDs
   - old/new value payload (where available)
3. Add dry-run mode for validation-only execution.
4. Add `scrapeConfig` parser/validator in command path with:
   - input from `--scrape-config-file` or `--scrape-config-json`
   - merge mode (`deep` default, `replace` optional)

### 17.3 Phase C (Brownells migration + docs)

Brownells plugin:

1. Add `apps/harvester/src/ingestion/scrape/sites/brownells/manifest.ts`.
2. Add `apps/harvester/src/ingestion/scrape/sites/brownells/fetch.ts`.
3. Add `apps/harvester/src/ingestion/scrape/sites/brownells/extract.ts`.
4. Add `apps/harvester/src/ingestion/scrape/sites/brownells/normalize.ts`.
5. Add `apps/harvester/src/ingestion/scrape/sites/brownells/fixtures/*`.
6. Add `apps/harvester/src/ingestion/scrape/sites/brownells/tests/contract.test.ts`.

Legacy wrapper:

1. Update `apps/harvester/src/scraper/adapters/brownells/adapter.ts` to delegate to plugin bridge.
2. Keep old tests passing while adding contract tests.

Docs:

1. Add `context/reference/scraper-onboarding.md`.
2. Update `context/reference/commands.md` with new commands and examples.
3. Update onboarding doc with scrape-target population path via Admin UI bulk import.

---

## 18. Test Case Matrix (Initial)

Test IDs below are mandatory baseline coverage for v1 implementation.

### 18.1 Kit Tests

1. `KIT-HTTP-001`: timeout handling returns explicit failure object.
2. `KIT-HTTP-002`: retry policy retries only retryable statuses.
3. `KIT-HTTP-003`: blocked/private hosts are rejected (SSRF guard).
4. `KIT-HTTP-004`: manifest `baseUrls` with private/reserved hosts fail validation.
5. `KIT-HTTP-005`: framework clamps aggressive rateLimit hints to safe caps.
6. `KIT-JSON-001`: malformed JSON returns safe parse failure (no throw leak).
7. `KIT-NORM-001`: price parsing to cents is deterministic.
8. `KIT-NORM-002`: caliber normalization canonicalizes known aliases.
9. `KIT-NORM-003`: grain and round count extraction deterministic.
10. `KIT-NORM-004`: identity key precedence `PID > SKU > URL hash` is deterministic.
11. `KIT-VAL-001`: unknown availability fails closed.
12. `KIT-FIX-001`: stable serializer produces same output order.
13. `KIT-FIX-002`: identical normalized input produces identical hash.
14. `KIT-FIX-003`: fixture freshness metadata validation (90/180 day thresholds).

### 18.2 CLI Tests

1. `CLI-ADD-001`: scaffold creates full site tree.
2. `CLI-ADD-002`: duplicate site without `--force` fails.
3. `CLI-ADD-003`: invalid site id format fails validation.
4. `CLI-VAL-001`: validate fails on missing manifest fields.
5. `CLI-VAL-002`: validate runs typecheck/lint/test command chain.
6. `CLI-TEST-001`: test command runs fixture tests only.
7. `CLI-TEST-002`: network call attempted in contract test fails run.
8. `CLI-DB-001`: db command creates/updates required rows in one transaction.
9. `CLI-DB-002`: db command writes `admin_audit_logs` entry.
10. `CLI-DB-003`: db command defaults to safe flags (`INELIGIBLE`, `scrapeEnabled=false`).
11. `CLI-DB-004`: db command applies `scrapeConfig` from JSON/file and validates schema.
12. `CLI-VAL-003`: validate fails on runtime registry/package registry mismatch.

### 18.3 Plugin Contract Tests (Per Site)

1. `SITE-CONTRACT-001`: in-stock fixture yields `ok` normalized offer.
2. `SITE-CONTRACT-002`: OOS fixture without usable price yields explicit OOS behavior.
3. `SITE-CONTRACT-003`: malformed fixture yields explicit extract failure reason.
4. `SITE-CONTRACT-004`: normalized output includes required fields.
5. `SITE-CONTRACT-005`: normalized output hash stable across repeated runs.
6. `SITE-CONTRACT-006`: changed fixture input changes output hash.
7. `SITE-CONTRACT-007`: multi-variant fixture yields deterministic `rawOffers[]` ordering or explicit `AMBIGUOUS_VARIANTS`.
8. `SITE-CONTRACT-008`: normalized offer includes/omits `shippingCents` and `costPerRoundCents` deterministically.

### 18.4 Integration Tests

1. `INT-BRIDGE-001`: plugin bridge feeds legacy worker extract/normalize flow.
2. `INT-WRITE-001`: price writes remain append-only.
3. `INT-WRITE-002`: written prices include SCRAPE provenance fields.
4. `INT-SCHED-001`: scheduler dedupe/lock behavior unchanged.
5. `INT-GUARD-001`: source disabled/robots non-compliant state prevents scraping.
6. `INT-BRIDGE-002`: bridge mode does not invoke plugin `fetch.ts`.
7. `INT-BRIDGE-003`: smoke/plugin-native path invokes plugin `fetch.ts`.
8. `INT-CB-001`: circuit-breaker behavior unchanged with plugin bridge in place.

---

## 19. Scaffold Template Contents (Initial)

The following templates are initial generated content targets for `scraper add`.

### 19.1 `manifest.ts`

```ts
import type { ScrapePluginManifest } from '../../types.js'

export const manifest: ScrapePluginManifest = {
  id: '__SITE_ID__',
  name: '__SITE_NAME__',
  owner: '__OWNER__',
  version: '0.1.0',
  mode: '__MODE__',
  baseUrls: ['https://__DOMAIN__'],
  rateLimit: {
    requestsPerSecond: 0.5,
    minDelayMs: 500,
    maxConcurrent: 1,
  },
}
```

### 19.2 `fetch.ts`

```ts
import { fetchWithPolicy } from '../../kit/http.js'
import { manifest } from './manifest.js'

export async function fetchRaw(url: string) {
  // Note: bridge mode uses legacy fetcher during migration.
  // This fetch is used by plugin-native runtime and scraper smoke.
  return fetchWithPolicy({
    url,
    mode: manifest.mode,
    baseUrls: manifest.baseUrls,
    rateLimit: manifest.rateLimit,
  })
}
```

### 19.3 `extract.ts`

```ts
import type { ScrapePluginExtractResultFail, ScrapePluginExtractResultOk } from '../../types.js'

export function extractRaw(payload: string): ScrapePluginExtractResultOk | ScrapePluginExtractResultFail {
  if (!payload || payload.trim().length === 0) {
    return { ok: false, reason: 'EMPTY_PAGE' }
  }

  // TODO: site-specific extraction logic
  return {
    ok: true,
    rawOffers: [
      // TODO: replace with real extraction
      // Keep deterministic order when returning multiple offers
    ],
  }
}
```

### 19.4 `normalize.ts`

```ts
import { normalizeOffer, validateNormalizedOffer } from '../../kit/normalize.js'
import type { NormalizedScrapeOffer } from '../../types.js'
import { manifest } from './manifest.js'

export function normalizeRaw(input: {
  sourceId: string
  retailerId: string
  observedAt: Date
  rawOffer: Record<string, unknown>
}): { status: 'ok'; offer: NormalizedScrapeOffer } | { status: 'drop' | 'quarantine'; reason: string } {
  const normalized = normalizeOffer({
    ...input,
    adapterVersion: manifest.version,
  })
  const validation = validateNormalizedOffer(normalized)
  if (!validation.ok) {
    return { status: validation.status, reason: validation.reason }
  }
  return { status: 'ok', offer: normalized }
}
```

### 19.5 `tests/contract.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { extractRaw } from '../extract.js'
import { normalizeRaw } from '../normalize.js'
import { deterministicHash } from '../../../kit/fixtures.js'

describe('__SITE_ID__ contract', () => {
  it('in-stock fixture is stable', () => {
    const payload = readFileSync(join(__dirname, '../fixtures/in-stock.html'), 'utf8')
    const extracted = extractRaw(payload)
    expect(extracted.ok).toBe(true)
    if (!extracted.ok) return
    expect(extracted.rawOffers.length).toBeGreaterThan(0)

    const normalized = extracted.rawOffers.map((rawOffer) =>
      normalizeRaw({
        sourceId: 'test-source',
        retailerId: 'test-retailer',
        observedAt: new Date('2026-01-01T00:00:00.000Z'),
        rawOffer,
      })
    )

    expect(normalized.every((r) => r.status === 'ok')).toBe(true)
    const okOffers = normalized.filter((r) => r.status === 'ok').map((r) => r.offer)
    expect(deterministicHash(okOffers)).toBe('__EXPECTED_HASH__')
  })
})
```

### 19.6 `fixtures/README.md`

```md
# Fixtures

Required:
- in-stock fixture
- out-of-stock fixture
- one malformed/edge fixture
- meta.json with capturedAt/capturedFrom/capturedBy/notes

Rules:
- no live network in contract tests
- fixture outputs must be deterministic
- update expected hash only when normalization behavior intentionally changes
```

---

## 20. PR Breakdown Plan

Recommended pull-request sequence:

1. PR-1: Types/registry/kit + CLI skeleton + script wrappers.
2. PR-2: contract test harness + CLI tests + db:add-retailer-source command.
3. PR-3: Brownells plugin migration + bridge wiring + docs updates.

Each PR must include:

1. explicit changed-file checklist,
2. command output examples for verification,
3. trust invariant validation notes (fail-closed, append-only, scheduler safety).
4. if touching registry files, include merge-conflict handling note (sorted inserts or codegen update step).
