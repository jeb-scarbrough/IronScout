# Brand Aliases v1 (Spec)

## Goal

Provide an admin-managed, auditable mapping from brand aliases to canonical brand
names to improve resolver match rates while preserving fail-closed behavior for
ambiguity and trust enforcement.

## Non-Goals

- No automated brand inference or AI-driven mapping.
- No consumer-facing changes.
- No changes to eligibility, tier enforcement, or visibility rules.
- No canonical brands table or brand IDs in v1.

## Scope

Applies to:
- Resolver normalization (brandNorm). Search unification is a downstream effect
  of resolver-level canonicalization.
- Admin-only tooling for alias management

Does not apply to:
- Ingestion filtering
- Product creation logic beyond improved fingerprint matching

## Data Model

Table: `brand_aliases`

Required fields:
- `id` (uuid, PK)
- `canonicalName` (text, required) - human-readable canonical brand
- `canonicalNorm` (text, required) - normalized canonical name
- `normalizationVersion` (int, required, default 1)
- `aliasName` (text, required) - alias string as entered
- `aliasNorm` (text, required) - normalized alias string
- `status` (enum: DRAFT | ACTIVE | DISABLED, default DRAFT)
- `createdAt`, `updatedAt` (timestamps)
- `createdBy`, `updatedBy` (admin email)
- `notes` (text, nullable)
- `sourceType` (enum: RETAILER_FEED | AFFILIATE_FEED | MANUAL)
- `sourceRef` (text, nullable) - feed name, partner id, or manual note
- `evidence` (json, nullable) - example product ids/rows that motivated the alias
- `disabledAt` (timestamp, nullable)
- `disabledBy` (admin user id, nullable)
- `disableReason` (text, nullable)

Constraints:
- Unique index on `aliasNorm` (one alias maps to one canonical)
- Index on `canonicalNorm` for lookup and reporting

Operational tracking (recommended):
- `brand_alias_applications_daily` (aliasId, date, count) for investigation and impact review.
  - Primary key: (aliasId, date)
  - Indexes: (date), (aliasId)
  - Retention: keep 90-180 days, then drop/roll up

v1 constraint:
- Canonical brand is represented as a normalized string only (no brand IDs).
Data invariants (write-time):
- Enforce `canonicalNorm = normalize(canonicalName)` on write.
- Enforce `normalizationVersion = CURRENT_VERSION` on write.
- Block empty `aliasNorm`.
- Block `aliasNorm` length < 2.
- Require allowlist for 2-3 character aliases (example: PMC, CCI, IMI, PPU).
- Block generic tokens via a configurable blocklist.
- Only add UNIQUE(`canonicalNorm`, `aliasNorm`) if scoped aliases are introduced later.
- Reject `aliasNorm == canonicalNorm`.
- Reject if `canonicalNorm` exists as `aliasNorm` in another ACTIVE row.
- Reject if `aliasNorm` exists as `canonicalNorm` in another ACTIVE row.
- Require `disableReason` when status transitions to DISABLED.

Normalization rules (shared with resolver):
- Unicode normalization (NFKD) + strip diacritics
- lowercase
- normalize ampersand to "and"
- strip trademark symbols (TM, R)
- strip common corporate suffix tokens (configurable list)
- collapse punctuation/separators to whitespace (slashes, pipes, hyphens)
- collapse repeated tokens and whitespace

Corporate suffix token list (initial):
- inc, incorporated, llc, ltd, co, corp, corporation, gmbh, sarl, sa, bv, nv

Generic token blocklist (initial):
- ammo, ammunition, bulk, sale, discount, special, new, best, premium (as standalone aliases)

Short alias allowlist (initial, code-configured in v1):
- PMC, CCI, IMI, PPU, CBC, WPA, TUL, HSM, HPR
Maintenance:
- Updating the allowlist requires a code deploy in v1.

## Resolver Integration

1. Normalize raw brand to `brandNorm`.
2. Look up `brand_aliases.aliasNorm = brandNorm` where `status = ACTIVE`.
3. Filter to rows with `normalizationVersion == CURRENT_VERSION`.
4. If found and `canonicalNorm` differs, set `brandNorm = canonicalNorm` and add `BRAND_ALIAS_APPLIED` to `rulesFired`.
5. If not found, keep normalized brand as-is.
6. Resolver behavior otherwise unchanged (UPC trust, ambiguity rules, etc.).

Failure handling:
- Alias lookup failure is **fail-open**: fall back to the original normalized brand.
- Emit `resolver_brand_alias_lookup_errors_total` and alert on sustained error rate.
- Fail-closed behavior still applies to resolver ambiguity and trust enforcement.

## Admin API (Admin-only)

Routes (suggested):
- `GET /admin/brand-aliases` (list + filters: status, canonicalName, aliasName)
- `POST /admin/brand-aliases` (create alias)
- `PATCH /admin/brand-aliases/:id` (update canonicalName, status, notes, sourceRef, evidence)
- `POST /admin/brand-aliases/:id/disable` (soft disable -> DISABLED)
- `POST /admin/brand-aliases/:id/activate` (DRAFT -> ACTIVE)
- `POST /admin/brand-aliases/cache/refresh` (force cache refresh)

All mutations must:
- require admin auth
- write audit logs
- enforce change-control rules (see below)

## Admin UI

New section in Admin portal: **Brand Aliases**

Features:
- Table list with filters (status, canonicalName, aliasName)
- Create alias form with validation and normalization preview
- DRAFT -> ACTIVE workflow
- Disable/Enable toggle
- Notes field for provenance or source
- Audit trail link per alias
- Impact preview: show count of recent feed rows matching aliasNorm (sampled)
- Threshold labels tied to change control (auto-activate <500/day, review 500+/day,
  auto-alert if 1000+ in first 24h)
- Impact estimation: on DRAFT creation, scan last 7 days of feed data for
  aliasNorm matches and display estimated daily impact before activation
  (source: `source_products.brand` normalized).

UX constraints:
- Conservative copy (no guarantees or recommendations)
- Admin-only visibility

## Observability

Metrics (optional but recommended):
- `resolver_brand_alias_hits_total` (counter)
- `resolver_brand_alias_misses_total` (counter)
- `resolver_brand_alias_lookup_errors_total` (counter)
- `resolver_brand_alias_cache_age_seconds` (gauge)

Logs:
- `BRAND_ALIAS_APPLIED` with aliasNorm + canonicalNorm (no high-cardinality IDs)

Caching:
- Option A (preferred): preload ACTIVE aliases into memory with periodic refresh (e.g., 60s).
- Option B: cache hits and misses with TTL.

Failure semantics:
- On lookup timeout or DB error: fallback to original brandNorm and emit `resolver_brand_alias_lookup_errors_total`.
- Alert if lookup errors exceed threshold for sustained period.

Cache safety:
- Emit `resolver_brand_alias_cache_age_seconds` (gauge).
- Provide admin-only cache refresh/invalidate endpoint for emergencies.
- Alert if cache age exceeds 300s.
- Activation and disable mutations publish an invalidation event; resolver
  instances refresh within 5s (configurable). Admin API returns immediately.

Impact tracking:
- Maintain daily application counts per alias (aliasId, date, count) for investigations.
- Estimated daily impact for pre-activation decisions is derived from the last
  7 days of `source_products` where normalize(brand) == aliasNorm, using
  `source_products.createdAt` for the time window.
  - Impact estimation is a background/admin task; it may run async and is not a hot path.

Change control:
- No in-place remap of ACTIVE mappings. Use replace: DISABLE old, CREATE new.
- Two-person approval is not required in v1; revisit if impact thresholds or admin surface grow.
- Impact thresholds:
  - Below 500 daily matches: auto-activate if validation rules pass.
  - 500+ daily matches: queue for review (high-impact change).
  - 1000+ products within first 24h after activation: auto-alert for spot check.
- Auto-activation criteria (all must pass):
  - `sourceType` is AFFILIATE_FEED or RETAILER_FEED.
  - `aliasNorm` length >= 4.
  - `aliasNorm` not on generic blocklist.
  - `canonicalNorm` exists in `products.brandNorm` OR in another ACTIVE row
    (as a canonical target).
  - Estimated daily impact < 500.
  - Fail closed if canonical existence lookup fails (no auto-activate on DB errors).
- Feature flag for applying aliases in resolver.
- Feature flag name: `RESOLVER_BRAND_ALIASES_ENABLED` (default false for rollout).
- Block re-activation when `disableReason` indicates rejection (admin must create a new alias).
- canonicalName changes are only allowed while status is DRAFT. ACTIVE rows must be
  DISABLED and recreated.
- Status transitions:
  - DRAFT -> ACTIVE: via /activate.
  - DRAFT -> DISABLED: allowed (abandon draft).
  - ACTIVE -> DISABLED: via /disable (requires disableReason).
  - DISABLED -> ACTIVE: blocked if disableReason indicates rejection; otherwise via /activate.
  - DISABLED -> DRAFT: not allowed.
Rejection detection:
- `disableReason` starting with "REJECTED:" blocks re-activation.
- Admin UI enforces this prefix when disabling with rejection intent.
- Disable semantics:
  - Disabling an alias affects future resolver runs only.
  - Existing products retain their resolved brandNorm until re-ingested.
  - No automatic reprocessing of historical products on alias changes in v1.
  - To force consistency, trigger re-ingestion of affected retailers/feeds.

## Backfill & Migration Plan

1. Seed table with existing in-code alias mappings.
2. Remove in-code alias map after rollout.
3. Add regression tests:
   - alias applied
   - alias disabled
   - alias table unavailable (falls back safely)
   - DRAFT aliases do not apply
   - normalizationVersion mismatch ignored
   - cache age alert fires when stale >300s (if alerting is wired)
4. Normalization version upgrade (500k+ scale):
   - Bump CURRENT_VERSION in code and deploy.
   - Resolver filters to new version; aliases degrade gracefully until migrated.
   - Run batched migration: 10k rows per batch, 1s delay between batches.
   - Monitor `resolver_brand_alias_misses_total` during migration (expected spike).
   - Alert if migration incomplete after 1 hour.
   - Rollback: revert code only (old version rows remain valid; no data migration needed).

## Future Migration Guardrails (CanonicalBrandId-ready)

Design must not block adding `canonicalBrandId` later. Guardrails:
- Preserve `canonicalName` + `canonicalNorm` even after IDs are introduced (needed for rollback and audits).
- Keep `normalizationVersion` on `brand_aliases` and bump when normalization rules change.
- When `canonicalBrandId` is introduced:
  - Add nullable `canonicalBrandId` to `brand_aliases` first (no behavior change).
  - Backfill IDs by mapping `canonicalNorm` to the new canonical brand table.
  - Dual-write: set both `canonicalNorm` and `canonicalBrandId` on create/update.
  - Dual-read (feature flag): prefer `canonicalBrandId` when present, fallback to `canonicalNorm`.
  - Do not remove `canonicalNorm` until at least one full rollback cycle completes.

## Security & Trust

- Admin-only access
- Audit logging for all mutations
- No client-side trust for alias mapping

## Acceptance Criteria

- Resolver uses alias table for brand normalization.
- Admin can create/disable aliases without code deploy.
- Resolver remains deterministic and fail-closed on ambiguity.
- Normalization handles common feed noise deterministically.
