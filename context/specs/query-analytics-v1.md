# Query Analytics Logging — v1 Spec

**Status:** Approved for v1 implementation
**Created:** 2026-02-05
**Related:** `mobile_price_check_v1_spec.md` (PriceCheckEvent privacy distinction), `ccpa.md` (DSAR handling)

---

## 1. Purpose

Log every successful search query and price check to the database for internal product analytics — understanding search patterns, zero-result queries, caliber demand, and informing future features like new Lenses.

This is an **internal analytics system**. No admin UI. Access via SQL queries only.

---

## 2. Scope

- Two new write-only tables: `search_query_logs` and `price_check_query_logs`
- Write-only = append + DSAR anonymization + retention purge (not strictly append-only)
- Fire-and-forget writes from route handlers (never block or fail user-facing responses)
- Only **successful** requests logged (error monitoring handled by application logger / observability stack)
- Linked to `userId` when authenticated, null for anonymous
- PII-safe: queries stored as normalized+redacted text; null when PII detected
- DSAR-compliant: user-linked fields anonymized on account deletion
- 1-year retention policy; automated purge job deferred to separate implementation

---

## 3. Privacy Model

### Relationship to PriceCheckEvent

The `mobile_price_check_v1_spec.md` defines a **PriceCheckEvent** with strict privacy rules:
- No individual-level persistence of raw `enteredPrice` in user-linked records
- Aggregation only for long-term storage
- No user linking after aggregation

**Internal analytics tables are intentionally different.** They:
- Store exact `pricePerRound` (no bucketing) linked to `userId`
- Retain user attribution for product intelligence
- Are governed by DSAR handling and operational policy, not PriceCheckEvent privacy rules

This is an accepted tradeoff: full attribution for internal analysis, with DSAR compliance as the privacy boundary.

### Query PII Handling

No raw query text is stored. Instead:

| Field | Description | Always stored? |
|-------|-------------|----------------|
| `queryHash` | SHA-256 of normalized query | Yes |
| `queryLength` | Character count of original query | Yes |
| `queryPiiFlag` | Boolean from `hasPii()` check | Yes |
| `queryNormRedacted` | Normalized + PII-redacted query text, max 250 chars | Only when `queryPiiFlag = false` |

PII detection uses regex patterns for email, phone, SSN, and ZIP code. When PII is detected, `queryNormRedacted` is set to NULL — no human-readable text stored.

Redaction functions are shared from `apps/api/src/lib/pii.ts` (extracted from lens telemetry).

### No parsedIntent Storage

The full `SearchIntent` object is **not stored**. It contains `originalQuery` and `keywords` fields derived from raw query text, which can leak PII even when `hasPii()` returns false.

Only scalar intent fields are stored: `intentCalibers`, `intentPurpose`, `intentBrands`, `intentConfidence`. These are structured data with no raw text.

### DSAR Anonymization

On account deletion (`finalizeAccountDeletion()`), the following fields are set to null/empty:
- `userId` → `null`
- `userAgent` → `null`
- `referrer` → `null`
- `gunLockerCalibers` → `[]`

Rows are preserved for aggregate analytics. `queryNormRedacted` is kept as-is (already PII-redacted).

### DSAR Export (Right to Know)

For active accounts, DSAR exports include:
- `search_query_logs`: `id`, `queryHash`, `queryLength`, `queryPiiFlag`, `queryNormRedacted`, `lensId`, `intentCalibers`, `resultCount`, `responseTimeMs`, `referrer`, `userAgent`, `gunLockerCalibers`, `createdAt`
- `price_check_query_logs`: `id`, `caliber`, `pricePerRound`, `classification`, `referrer`, `userAgent`, `gunLockerCalibers`, `createdAt`

### Retention

- 1-year retention for both tables
- Automated monthly purge job deletes rows older than 365 days
- Purge job implementation deferred to separate issue (first rows won't expire for 1 year)

---

## 4. Schema

### `search_query_logs`

| Column | Type | Notes |
|--------|------|-------|
| `id` | String @id @default(cuid()) | |
| `userId` | String? | No FK — plain string for DSAR anonymization |
| `queryHash` | String | SHA-256 of normalized query |
| `queryLength` | Int | Length of original query |
| `queryPiiFlag` | Boolean | `hasPii()` result |
| `queryNormRedacted` | String? | Normalized + redacted, max 250 chars; NULL when PII detected |
| `lensId` | String? | From `result.lens?.id` (resolved/applied lens) |
| `sortBy` | String? | |
| `page` | Int | |
| `intentCalibers` | String[] | |
| `intentPurpose` | String? | |
| `intentBrands` | String[] | |
| `intentConfidence` | Decimal? @db.Decimal(3, 2) | |
| `filtersApplied` | Json? | |
| `resultCount` | Int | From `pagination.total` |
| `returnedCount` | Int | From `products.length` |
| `vectorSearchUsed` | Boolean | |
| `responseTimeMs` | Int | From `searchMetadata.processingTimeMs` |
| `timingBreakdown` | Json? | From `searchMetadata.timing` |
| `isAuthenticated` | Boolean | |
| `gunLockerCalibers` | String[] | |
| `referrer` | String? | |
| `userAgent` | String? | Truncated to 200 chars |
| `createdAt` | DateTime @default(now()) | |

**Indexes:** `createdAt`, `[userId, createdAt]`, `queryHash`, GIN on `intentCalibers`

### `price_check_query_logs`

| Column | Type | Notes |
|--------|------|-------|
| `id` | String @id @default(cuid()) | |
| `userId` | String? | No FK — plain string for DSAR anonymization |
| `caliber` | String | |
| `pricePerRound` | Decimal @db.Decimal(10, 4) | Exact entered price — no bucketing |
| `brand` | String? | |
| `grain` | Int? | Matches API validation (z.number().int()) |
| `roundCount` | Int? | |
| `caseMaterial` | String? | |
| `bulletType` | String? | |
| `classification` | String? | LOWER / TYPICAL / HIGHER / INSUFFICIENT_DATA |
| `pricePointCount` | Int? | |
| `daysWithData` | Int? | |
| `medianPrice` | Decimal? @db.Decimal(10, 4) | |
| `isAuthenticated` | Boolean | |
| `gunLockerCalibers` | String[] | |
| `referrer` | String? | |
| `userAgent` | String? | Truncated to 200 chars |
| `createdAt` | DateTime @default(now()) | |

**Indexes:** `createdAt`, `[userId, createdAt]`, `[caliber, createdAt]`

---

## 5. Service Design

### `apps/api/src/services/query-analytics.ts`

Two public functions, both fire-and-forget:

```ts
logSearchQuery(data): void   // calls prisma.search_query_logs.create() in .catch() wrapper
logPriceCheckQuery(data): void  // calls prisma.price_check_query_logs.create() in .catch() wrapper
```

Both:
- Fetch Gun Locker calibers via `getUserCalibers(userId)` when authenticated
- Truncate `userAgent` to 200 chars
- Never throw — all errors caught and logged via `log.warn()`

### PII Utils — `apps/api/src/lib/pii.ts`

Extracted from `apps/api/src/services/lens/telemetry.ts` (currently private functions):
- `hashQuery(query)` — SHA-256 of normalized query
- `normalizeQuery(query)` — lowercase, trim, collapse whitespace
- `hasPii(query)` — regex check for email, phone, SSN, ZIP
- `redactPii(query)` — replace PII patterns with `[EMAIL]`, `[PHONE]`, etc.

Distinct from `apps/api/src/lib/redact.ts` (allowlist-based deep object redaction for structured logging).

---

## 6. Route Integration

### Search route (`apps/api/src/routes/search.ts`)

After `aiSearch()` returns successfully, before `res.json()`:
- Extract userId via `getAuthenticatedUserId(req)`
- Call `void logSearchQuery(...)` with:
  - Original query string (for PII processing — not stored raw)
  - `result.lens?.id ?? null` for lensId
  - `pagination.total` for resultCount, `products.length` for returnedCount
  - `searchMetadata.processingTimeMs` for responseTimeMs
  - `searchMetadata.timing` for timingBreakdown
  - Scalar intent fields from result
  - Request headers for referrer/userAgent

### Price-check route (`apps/api/src/routes/price-check.ts`)

After `checkPrice()` returns successfully, before `res.json()`:
- Call `void logPriceCheckQuery(...)` with request params + result fields
- Comment block clarifying: PriceCheckEvent (spec §Intent Signal) is privacy-restricted consumer telemetry; internal analytics tables are user-linked and governed by DSAR/ops policy

---

## 7. Implementation Checklist

| Step | File | Action |
|------|------|--------|
| 1 | `apps/api/src/lib/pii.ts` | Create — extract PII utils from lens telemetry |
| 2 | `apps/api/src/services/lens/telemetry.ts` | Modify — import from shared pii module |
| 3 | `packages/db/schema.prisma` | Modify — add 2 models |
| 4 | `packages/db/migrations/…` | Create — additive migration |
| 5 | `apps/api/src/services/query-analytics.ts` | Create — logging service |
| 6 | `apps/api/src/routes/search.ts` | Modify — wire logSearchQuery |
| 7 | `apps/api/src/routes/price-check.ts` | Modify — wire logPriceCheckQuery + comment |
| 8 | `apps/api/src/services/account-deletion.ts` | Modify — DSAR anonymization |
| 9 | `context/operations/runbooks/ccpa.md` | Modify — DSAR checklist |
| 10 | `context/operations/02_monitoring_and_observability.md` | Modify — retention policy |
| 11 | Account deletion tests | Add — anonymization assertion |

---

## 8. Verification

1. `pnpm --filter @ironscout/db db:generate` — Prisma client generates without errors
2. `pnpm --filter @ironscout/api test -- --run` — all API tests pass (including lens telemetry after PII extraction)
3. Manual: POST to `/api/search/semantic` and `/api/price-check`, query new tables to confirm rows written
4. Verify `queryNormRedacted` is NULL when `queryPiiFlag = true`
5. Verify account deletion nullifies `userId`, `userAgent`, `referrer`, `gunLockerCalibers` in both tables

---

## 9. Deferred Work

- **Retention purge job**: Monthly scheduled job deleting rows > 365 days. Singleton-safe. Separate GitHub issue, target v1.1.
- **Additional scalar intent fields**: `grainWeights`, `caseMaterials`, `minPrice`, `maxPrice` can be added as explicit columns if needed for analytics.
- **Admin UI for analytics**: Not in scope. SQL-only access for v1.
