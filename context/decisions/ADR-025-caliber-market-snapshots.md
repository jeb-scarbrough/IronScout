# ADR-025: Caliber Market Snapshots

## Status
Accepted

## Context
ADR-024 established `PERCENTILE_CONT(0.5)` as the canonical median definition and migrated three services to use it. However, each service still computes statistics on-the-fly from the raw `prices` table with its own 30-day trailing query. This creates three problems:

1. **No single source of truth.** Three services execute the same expensive query independently. If one service's query drifts (e.g., a missed filter), its median diverges silently.

2. **No persisted snapshot.** Public surfaces that need caliber-level market context (www caliber pages, LLM market summaries, future DaaS endpoints) have no table to read from. The www `ObservedMarketContextBlock` currently renders "not enough observations" because no data flows to it.

3. **No auditability.** On-the-fly computations leave no record of what the median was at a given point in time. Debugging median changes or verifying consistency across surfaces requires re-running queries against historical data.

---

## Decision

### Snapshot Table as System of Record

A `caliber_market_snapshots` table in Postgres is the canonical source of all public-facing caliber statistics. The table stores one `CURRENT` row per caliber per window size, with older rows flipped to `SUPERSEDED` (append-only lifecycle). `SUPERSEDED` rows are retained for auditability; old rows beyond 90 days may be pruned by a scheduled cleanup (this is a derived table, not primary history — ADR-004 append-only applies to `prices`, not to derived snapshots).

### Computation

A BullMQ job in the Harvester computes snapshots for all canonical calibers (excluding 'Other') every 6 hours. The computation uses the daily-best CTE and full ADR-015/005/021 corrections overlay established in ADR-024, with two deliberate hardening changes: (1) `pc.value > 0` guards on multiplier subqueries to prevent `LN(<=0)` crashes, and (2) `LOWER(p.caliber) = ANY(aliases)` for precise caliber matching (same as `price-check.ts`, stricter than ADR-024's ILIKE). This is a **hardened variant** of ADR-024's query, not an identical copy. The `pc.value > 0` guard adds safety without changing results (invalid multipliers don't exist in practice). The alias matching is stricter and may exclude rows that ADR-024's ILIKE would match (e.g., un-normalized caliber strings) — this is intentional for an authoritative snapshot.

Each snapshot row records:
- **Statistics**: median, p25, p75 (via SQL `PERCENTILE_CONT`, null when `sampleCount < 5`); min, max (always populated when any in-bounds data exists, i.e. at least one daily-best row passes the `> 0 AND < 10` sanity filter)
- **Coverage**: sampleCount, daysWithData, productCount, retailerCount
- **Audit**: windowStart, windowEnd, computedAt, computationVersion, computationDurationMs

### Publishability Thresholds

Two thresholds apply:
- **Computation threshold** (5 daily-best data points): Below this, `PERCENTILE_CONT` is not computed (median, p25, p75 are null). min/max are returned when any in-bounds data exists (at least one daily-best row passes the sanity filter) — they are simple extremes that don't require statistical mass. Matches ADR-024.
- **Display threshold** (15 data points): The `ObservedMarketContextBlock` requires `sampleCount >= 15` to render a price summary. This is a UI decision, not a data decision — the snapshot stores the real count regardless.

### Consumer Contract

All public display surfaces that present **caliber-level market statistics** (www caliber pages, LLM market summaries, DaaS) MUST read from the snapshot table (directly or via API). They MUST NOT compute their own caliber medians from raw price data.

**Contract versioning policy**: `schemaVersion` is incremented only for breaking response-shape changes; additive fields are allowed within the same major version. `computationVersion` is independent and MUST be incremented when computation logic or methodology changes without a breaking shape change.

**Exempted service** (computes ad-hoc statistics for **product-level** purposes, not caliber-level summaries):
- `price-signal-index.ts` — computes per-product `relativePricePct` and `contextBand` for search results. These are product-level comparisons against a caliber baseline, not caliber summaries shown to users as "the 9mm median." Exempt because the median is used as a comparison reference, not presented as the caliber statistic.

**Temporary exception** (violates the contract, tracked for migration):
- `price-check.ts` — computes per-caliber stats and presents them to users as caliber-level market context. This IS a caliber-level summary and SHOULD read from the snapshot. **Must be migrated to snapshot in v1.1.** Until then, its output may diverge slightly from the snapshot due to the ILIKE vs ANY matching difference.

The distinction: if a surface labels a number as "the median for [caliber]" it MUST come from the snapshot. If it uses a median internally as a comparison baseline for a specific product, it may compute ad-hoc.

The API exposes:
- `GET /api/market-snapshots/calibers` — all current snapshots
- `GET /api/market-snapshots/calibers/:caliber` — single caliber

Responses are cached in Redis (5-minute TTL) and include `Cache-Control: public, max-age=300, stale-while-revalidate=600`.

### Window Boundary Definition

v1 supports a single window: 30-day trailing. The schema includes a `windowDays` column so future windows (7-day, 90-day) can be added without schema changes.

**At the start of each computation run**, the code captures:
```
windowEnd   = NOW()                              -- frozen at computation start
windowStart = windowEnd - INTERVAL '30 days'
```

The SQL query enforces a **half-open interval**: `observedAt >= windowStart AND observedAt < windowEnd`. Both bounds are stored on the snapshot row and are immutable. This guarantees that a snapshot is reproducible: re-running the same query with the same `windowStart` and `windowEnd` against the same price data will produce the same result, regardless of when the query runs. If `windowEnd` were omitted from the filter, late-arriving data could retroactively change what a stored snapshot "should have" computed.

---

## Table Schema

```sql
-- Lifecycle enum (matches codebase convention: all status columns use Postgres enums)
CREATE TYPE "CaliberSnapshotStatus" AS ENUM ('CURRENT', 'SUPERSEDED');

CREATE TABLE "caliber_market_snapshots" (
  "id"                    TEXT NOT NULL,           -- Prisma generates cuid() client-side
  "caliber"               TEXT NOT NULL,           -- canonical CaliberValue (e.g. '9mm', '.45 ACP')
  "windowDays"            INTEGER NOT NULL,        -- 30 for v1
  "windowStart"           TIMESTAMPTZ NOT NULL,
  "windowEnd"             TIMESTAMPTZ NOT NULL,

  -- Statistics (SQL PERCENTILE_CONT per ADR-024).
  -- median/p25/p75: null when sampleCount < 5. min/max: null when sampleCount = 0 (no in-bounds data).
  "median"                DECIMAL(10,6),
  "p25"                   DECIMAL(10,6),
  "p75"                   DECIMAL(10,6),
  "min"                   DECIMAL(10,6),
  "max"                   DECIMAL(10,6),

  -- Coverage
  "sampleCount"           INTEGER NOT NULL,        -- count of (product, day) minima in daily_best
  "daysWithData"          INTEGER NOT NULL,         -- COUNT(DISTINCT day)
  "productCount"          INTEGER NOT NULL,         -- COUNT(DISTINCT product_id)
  "retailerCount"         INTEGER NOT NULL,         -- COUNT(DISTINCT retailer_id) from qualifying_prices

  -- Audit
  "computedAt"            TIMESTAMPTZ NOT NULL,
  "computationVersion"    TEXT NOT NULL,            -- e.g. 'v1'
  "computationDurationMs" INTEGER,

  -- Lifecycle
  "status"                "CaliberSnapshotStatus" NOT NULL DEFAULT 'CURRENT',
  "createdAt"             TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY ("id")
);

-- One CURRENT snapshot per caliber per window size
CREATE UNIQUE INDEX "caliber_market_snapshots_current_idx"
  ON "caliber_market_snapshots" ("caliber", "windowDays")
  WHERE "status" = 'CURRENT';

CREATE INDEX "caliber_market_snapshots_status_idx"
  ON "caliber_market_snapshots" ("status");

CREATE INDEX "caliber_market_snapshots_computed_at_idx"
  ON "caliber_market_snapshots" ("computedAt");
```

### Schema Design Rationale
- **No SQL DEFAULT on `id`**: Prisma generates `cuid()` client-side (matches 37/38 models in the schema). No `gen_random_uuid()` fallback — Prisma is the only writer.
- **`CaliberSnapshotStatus` enum**: Matches codebase convention (all status columns use Postgres enums, zero free-text status columns). Prevents typos from bypassing the partial unique index.
- **DECIMAL(10,6)** for price-per-round: 6 decimal places handles sub-cent precision like $0.001234
- **Partial unique index** on `(caliber, windowDays) WHERE status = 'CURRENT'`: enforces exactly one current snapshot per caliber per window at the database level
- **Nullable statistics**: calibers with `sampleCount < 5` get null median/p25/p75 (per ADR-024 `INSUFFICIENT_DATA` rule). min/max are populated whenever `sampleCount >= 1` (i.e., at least one in-bounds daily-best row exists). If all qualifying prices fall outside sanity bounds, `sampleCount = 0` and all stats are null.
- **`sampleCount`**: count of `(product, day)` minima in `daily_best` — NOT raw price observations. See "Sample Count Semantics" below.
- **`productCount`**: count of distinct products contributing at least one bounded daily-best data point — NOT all products matching the caliber alias. Products with only out-of-bounds prices (<=0 or >=10 per round) are excluded.
- **`retailerCount`**: counted from qualifying price observations (pre-daily-best aggregation), not from daily-best rows. Answers "how many retailers contributed data."
- **`status` enum**: old snapshots become `SUPERSEDED` rather than overwritten or deleted in normal operation. `SUPERSEDED` rows beyond 90 days may be pruned (this is a derived table, not primary history — ADR-004 append-only applies to `prices`, not snapshots).
- **`computationVersion`**: bumped whenever the query logic changes, enabling before/after comparison for debugging median drift

### Prisma Model

```prisma
enum CaliberSnapshotStatus {
  CURRENT
  SUPERSEDED
}

model caliber_market_snapshots {
  id                    String                 @id @default(cuid())
  caliber               String
  windowDays            Int
  windowStart           DateTime
  windowEnd             DateTime
  median                Decimal?               @db.Decimal(10, 6)
  p25                   Decimal?               @db.Decimal(10, 6)
  p75                   Decimal?               @db.Decimal(10, 6)
  min                   Decimal?               @db.Decimal(10, 6)
  max                   Decimal?               @db.Decimal(10, 6)
  sampleCount           Int
  daysWithData          Int
  productCount          Int
  retailerCount         Int
  computedAt            DateTime
  computationVersion    String
  computationDurationMs Int?
  status                CaliberSnapshotStatus  @default(CURRENT)
  createdAt             DateTime               @default(now())

  @@index([status])
  @@index([computedAt])
  @@map("caliber_market_snapshots")
}
```

Note: the partial unique index must be created via raw SQL in the migration (Prisma does not support `WHERE` clauses on unique indexes).

---

## SQL Query Design

The snapshot computation uses a three-CTE query. `qualifying_prices` captures all valid observations (with retailer identity for `retailerCount`), `daily_best` collapses to one row per product per day (the distribution for PERCENTILE_CONT), and `coverage` counts distinct retailers and products.

```sql
WITH qualifying_prices AS (
  -- All qualifying price observations with full ADR-015 corrections overlay
  SELECT
    p.id AS product_id,
    pr."retailerId",
    DATE_TRUNC('day', pr."observedAt" AT TIME ZONE 'UTC') AS day,
    MIN(
      (pr.price * COALESCE((
        SELECT CASE WHEN COUNT(*) = 0 THEN 1.0
                    ELSE EXP(SUM(LN(pc.value))) END
        -- Note: >2 multipliers are excluded by the separate COUNT<=2 filter below.
        -- Do NOT add a >2 branch here that returns NULL — COALESCE would convert it
        -- to 1.0, silently reverting to "no correction" instead of excluding the price.
        FROM price_corrections pc
        WHERE pc."revokedAt" IS NULL AND pc.action = 'MULTIPLIER'
          AND pc.value > 0                                     -- guard against LN(<=0) error
          AND pr."observedAt" >= pc."startTs" AND pr."observedAt" < pc."endTs"
          AND (
            (pc."scopeType" = 'PRODUCT'  AND pc."scopeId"::text = p.id::text) OR
            (pc."scopeType" = 'RETAILER' AND pc."scopeId"::text = r.id::text) OR
            (pc."scopeType" = 'SOURCE'   AND pc."scopeId" = pr."sourceId") OR
            (pc."scopeType" = 'AFFILIATE' AND pc."scopeId" = pr."affiliateId") OR
            (pc."scopeType" = 'FEED_RUN' AND pr."ingestionRunId" IS NOT NULL
                                          AND pc."scopeId" = pr."ingestionRunId")
          )
      ), 1.0)) / p."roundCount"
    ) AS price_per_round
  FROM products p
  JOIN product_links pl ON pl."productId" = p.id
  JOIN prices pr ON pr."sourceProductId" = pl."sourceProductId"
  JOIN retailers r ON r.id = pr."retailerId"
  LEFT JOIN merchant_retailers mr ON mr."retailerId" = r.id AND mr.status = 'ACTIVE'
  LEFT JOIN affiliate_feed_runs afr ON afr.id = pr."affiliateFeedRunId"
  LEFT JOIN sources s ON s.id = pr."sourceId"
  LEFT JOIN scrape_adapter_status sas ON sas."adapterId" = s."adapterId"
  WHERE LOWER(p.caliber) = ANY($1::text[])              -- caliber aliases array
    AND p."roundCount" IS NOT NULL AND p."roundCount" > 0
    AND pl.status IN ('MATCHED', 'CREATED')             -- ADR-019
    AND pr."inStock" = true
    AND pr."observedAt" >= $2                            -- windowStart (inclusive)
    AND pr."observedAt" < $3                             -- windowEnd   (exclusive, half-open interval)
    AND r."visibilityStatus" = 'ELIGIBLE'               -- ADR-005
    AND (mr.id IS NULL OR (mr."listingStatus" = 'LISTED' AND mr.status = 'ACTIVE'))  -- ADR-005
    AND (pr."affiliateFeedRunId" IS NULL OR afr."ignoredAt" IS NULL)                 -- ADR-015
    -- ADR-015: Exclude prices with active IGNORE corrections
    AND NOT EXISTS (
      SELECT 1 FROM price_corrections pc
      WHERE pc."revokedAt" IS NULL AND pc.action = 'IGNORE'
        AND pr."observedAt" >= pc."startTs" AND pr."observedAt" < pc."endTs"
        AND (
          (pc."scopeType" = 'PRODUCT'  AND pc."scopeId"::text = p.id::text) OR
          (pc."scopeType" = 'RETAILER' AND pc."scopeId"::text = r.id::text) OR
          (pc."scopeType" = 'SOURCE'   AND pc."scopeId" = pr."sourceId") OR
          (pc."scopeType" = 'AFFILIATE' AND pc."scopeId" = pr."affiliateId") OR
          (pc."scopeType" = 'FEED_RUN' AND pr."ingestionRunId" IS NOT NULL
                                        AND pc."scopeId" = pr."ingestionRunId")
        )
    )
    -- ADR-015: Max 2 MULTIPLIER corrections
    -- Mirror pc.value > 0 here for defense-in-depth (matches the product subquery).
    -- If the CHECK constraint ships, this is redundant but harmless.
    AND (
      SELECT COUNT(*)
      FROM price_corrections pc
      WHERE pc."revokedAt" IS NULL AND pc.action = 'MULTIPLIER'
        AND pc.value > 0
        AND pr."observedAt" >= pc."startTs" AND pr."observedAt" < pc."endTs"
        AND (
          (pc."scopeType" = 'PRODUCT'  AND pc."scopeId"::text = p.id::text) OR
          (pc."scopeType" = 'RETAILER' AND pc."scopeId"::text = r.id::text) OR
          (pc."scopeType" = 'SOURCE'   AND pc."scopeId" = pr."sourceId") OR
          (pc."scopeType" = 'AFFILIATE' AND pc."scopeId" = pr."affiliateId") OR
          (pc."scopeType" = 'FEED_RUN' AND pr."ingestionRunId" IS NOT NULL
                                        AND pc."scopeId" = pr."ingestionRunId")
        )
    ) <= 2
    -- ADR-021: SCRAPE guardrails
    AND (
      pr."ingestionRunType" IS NULL
      OR pr."ingestionRunType" != 'SCRAPE'
      OR (
        pr."ingestionRunType" = 'SCRAPE'
        AND s."adapterId" IS NOT NULL
        AND s."robotsCompliant" = true
        AND s."tosReviewedAt" IS NOT NULL
        AND s."tosApprovedBy" IS NOT NULL
        AND sas."enabled" = true
      )
    )
  GROUP BY p.id, pr."retailerId",
           DATE_TRUNC('day', pr."observedAt" AT TIME ZONE 'UTC')
),
daily_best AS (
  -- One row per product per day: lowest corrected price-per-round
  SELECT product_id, day, MIN(price_per_round) AS price_per_round
  FROM qualifying_prices
  WHERE price_per_round > 0 AND price_per_round < 10    -- sanity bounds
  GROUP BY product_id, day
),
coverage AS (
  -- Distinct retailers and products from qualifying observations.
  -- INVARIANT: This is an aggregate without GROUP BY, so it always returns exactly
  -- one row (with zeros when empty). The CROSS JOIN below depends on this. Do NOT
  -- add a GROUP BY here — it would break the "always 1 row" guarantee.
  SELECT
    COUNT(DISTINCT product_id)::int  AS product_count,
    COUNT(DISTINCT "retailerId")::int AS retailer_count
  FROM qualifying_prices
  WHERE price_per_round > 0 AND price_per_round < 10
),
stats AS (
  -- Aggregate over daily_best. If daily_best is empty, this still returns exactly
  -- one row (aggregate without GROUP BY), with COUNT(*)=0 and all other aggs NULL.
  SELECT
    CASE WHEN COUNT(*) >= 5
      THEN PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY db.price_per_round) END AS median,
    CASE WHEN COUNT(*) >= 5
      THEN PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY db.price_per_round) END AS p25,
    CASE WHEN COUNT(*) >= 5
      THEN PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY db.price_per_round) END AS p75,
    MIN(db.price_per_round) AS min,
    MAX(db.price_per_round) AS max,
    COUNT(*)::int                AS "sampleCount",
    COUNT(DISTINCT db.day)::int  AS "daysWithData"
  FROM daily_best db
)
-- Both stats and coverage are guaranteed exactly-one-row CTEs (aggregates without
-- GROUP BY), so this CROSS JOIN always produces exactly one result row — even when
-- daily_best and qualifying_prices are both empty.
SELECT
  s.median, s.p25, s.p75, s.min, s.max,
  s."sampleCount", s."daysWithData",
  c.product_count  AS "productCount",
  c.retailer_count AS "retailerCount"
FROM stats s
CROSS JOIN coverage c
```

### Query Design Notes
- **Two-stage price compression**: `qualifying_prices` groups by `(product_id, retailerId, day)` and takes `MIN(corrected_price_per_round)` within each group — collapsing multiple observations from the same retailer for the same product on the same day to the cheapest. `daily_best` then groups by `(product_id, day)` and takes `MIN` across retailers, producing one best-available price per product per day. This is the distribution `PERCENTILE_CONT` operates on. `qualifying_prices` preserves retailer identity so the `coverage` CTE can count distinct retailers.
- **`coverage` counts from `qualifying_prices`** not `daily_best` — after daily-best, retailer identity is collapsed, so `retailerCount` must come from the pre-collapsed CTE
- **`CASE WHEN COUNT(*) >= 5`** — gates percentile computation; percentiles (median, p25, p75) are null below threshold. min/max are returned when any in-bounds data exists (`sampleCount >= 1`). All stats are null when `sampleCount = 0`. `sampleCount` itself is always returned (per ADR-024 pattern).
- **Alias matching uses `LOWER(p.caliber) = ANY($1::text[])`** — precise matching (same as `price-check.ts`), not ILIKE substring matching. **Assumption**: `products.caliber` is normalized at ingestion time (via `normalizeCaliber` in `ammo-utils.ts`) to one of the 27 canonical values. Variants like "9mm +P" or "9mm Luger +P" will NOT match unless included in the alias list. If un-normalized caliber strings exist in production data, they cause silent undercounting. Validate with: `SELECT DISTINCT caliber FROM products WHERE LOWER(caliber) NOT IN (SELECT unnest($1::text[])) AND caliber != 'Other'` before first run.
- **Half-open window `>= windowStart AND < windowEnd`** — both bounds are enforced in the query. `windowEnd` is frozen at computation start. This ensures the snapshot is reproducible: re-running with the same bounds against the same data produces the same result, regardless of when the re-run happens.
- **FEED_RUN scope matching**: v1 matches on `ingestionRunId` only, without checking `ingestionRunType`, consistent with all existing correction-consuming services. **Assumption**: all production `ingestionRunId` values are cuid (globally unique), and FEED_RUN corrections are affiliate-feed-run-only. **Guardrail (merge-blocking)**: add an app-level assert in all ingestion code paths that `ingestionRunId` is cuid-format when non-null. Non-cuid constants (e.g., `backfill-legacy`) MUST NOT be used going forward — use a fresh cuid per backfill run instead. The PR must not merge until the assert exists in code and passes in the test suite. **Trigger for change**: if FEED_RUN corrections expand beyond affiliate feed runs, migrate all services to `(ingestionRunType, ingestionRunId)` compound matching.
- **Sanity bounds `> 0 AND < 10`** — excludes $0 free-shipping artifacts and clearly erroneous $10+/round prices
- **roundCount assumed correct**: per-round normalization divides by `p.roundCount`. If roundCount is wrong (common with ecommerce pack/variation misparses), the per-round price is wrong. Corrections overlay adjusts price only, not roundCount. Packaging/count errors must be fixed upstream in product data or the resolver.
- **`affiliateId` vs `affiliateFeedRunId`**: these are separate dimensions on the `prices` row. `pr.affiliateId` identifies the affiliate network and is used for `AFFILIATE` scope corrections. `pr.affiliateFeedRunId` identifies the specific feed run and is used for the ignored-run check (`afr."ignoredAt" IS NULL`). `FEED_RUN` scope corrections match on `pr.ingestionRunId`, which is the run ID regardless of ingestion type.
- **MULTIPLIER `pc.value` validity**: `LN(pc.value)` requires `value > 0`. Multiplier values are validated at creation time in the admin correction form. The SQL guards with `AND pc.value > 0` in both the multiplier product subquery and the multiplier count subquery (defense-in-depth). **Merge-blocking**: add a DB constraint `CHECK (action != 'MULTIPLIER' OR value > 0)` to `price_corrections` in the migration. This prevents validation regressions from crashing the computation. The PR must not merge until this constraint exists in the migration SQL and passes against the dev database. **Rollout safety**: before applying the constraint, run the pre-migration audit query: `SELECT id, value FROM price_corrections WHERE action = 'MULTIPLIER' AND (value IS NULL OR value <= 0)`. If any rows exist, remediate before migration (either revoke the invalid corrections or update their values). The migration MUST fail-fast if bad rows exist — do NOT use `NOT VALID` to defer validation, as that would leave the invariant unenforced.

---

## Harvester Module

### File Structure

New module: `apps/harvester/src/calibersnapshot/` following the `currentprice/` pattern exactly.

```
calibersnapshot/
  compute.ts      — SQL computation + transactional DB write
  worker.ts       — BullMQ worker (concurrency: 1)
  scheduler.ts    — Cron scheduler (every 6 hours, env override)
  index.ts        — Module exports (start/stop functions)
```

### Computation Flow (`compute.ts`)

```
computeCaliberSnapshots(windowDays, version)
  → windowEnd   = NOW()                     -- frozen ONCE at run start, shared by ALL calibers
  → windowStart = windowEnd - INTERVAL windowDays days
  -- INVARIANT: windowStart and windowEnd are computed once and reused for every caliber
  -- in the run. This ensures all snapshots from a single run share identical time bounds,
  -- making cross-caliber comparisons valid and debugging reproducible.
  → for each CANONICAL_CALIBER (excluding 'Other'):
      1. getCaliberAliases(caliber) → aliases[]
      2. Run snapshot SQL with (aliases, windowStart, windowEnd)
      3. In a SINGLE transaction:
         UPDATE caliber_market_snapshots SET status = 'SUPERSEDED'
           WHERE caliber = $1 AND "windowDays" = $2 AND status = 'CURRENT'
         INSERT new row with status = 'CURRENT'
         -- INVARIANT: UPDATE + INSERT must be in one transaction. In READ COMMITTED,
         -- other sessions see the old CURRENT until commit. If separated into two
         -- transactions, readers can briefly see zero CURRENT rows.
         -- CONCURRENCY: If two jobs race for the same caliber+windowDays, the
         -- partial unique index causes a unique violation on the INSERT. The loser
         -- MUST catch the unique violation and retry (re-read, re-SUPERSEDE, re-INSERT).
         -- BullMQ concurrency=1 prevents this in normal operation; the retry handles
         -- edge cases (manual trigger overlapping with scheduled job).
  → return { calibersProcessed, calibersWithData, calibersInsufficient, totalDurationMs }
```

### Shared Caliber Aliases (`packages/db/calibers.ts`)

`getCaliberAliases()` currently lives in `apps/api/src/services/price-check.ts:283`. The harvester cannot import from the API app.

Extract to `packages/db/calibers.ts` exporting:
- `CANONICAL_CALIBERS` (27-entry array, currently in `gun-locker.ts`)
- `CALIBER_ALIASES` (Record mapping)
- `getCaliberAliases(caliber): string[]`
- `CaliberValue` type

Then update `price-check.ts` and `gun-locker.ts` to import from the shared package. Eliminates the alias duplication between these two files.

### Worker (`worker.ts`)

```typescript
interface CaliberSnapshotJobData {
  trigger: 'SCHEDULED' | 'MANUAL'
  triggeredBy: string
  correlationId: string
  windowDays: number  // 30 for v1
}
```

- Concurrency: 1 (one job covers all 26 calibers)
- Retries: 3, exponential backoff (5s, 15s, 45s)
- Event handlers: completed, failed, error (same pattern as `currentprice/worker.ts`)

### Scheduler (`scheduler.ts`)

- Cron: `0 */6 * * *` (every 6 hours)
- Env override: `CALIBER_SNAPSHOT_CRON`
- Gated by `harvesterSchedulerEnabled` (ADR-001 singleton guard)
- BullMQ repeatable job pattern

### Queue Registration (`config/queues.ts`)

- `QUEUE_NAMES.CALIBER_SNAPSHOT = 'caliber-snapshot'`
- `CaliberSnapshotJobData` interface
- `caliberSnapshotQueue` instance
- `enqueueCaliberSnapshot()` function

### Harvester Startup (`worker.ts`)

- Import start/stop from `./calibersnapshot`
- Start worker unconditionally (processes scheduled + manual jobs)
- Start scheduler under `harvesterSchedulerEnabled` guard (same block as currentprice, lines 307-320)
- Add to shutdown handler (lines 366-387)

### Structured Logging (`config/logger.ts`)

Add `calibersnapshot` child logger. Events:

| Event | When |
|-------|------|
| `CALIBER_SNAPSHOT_JOB_START` | Full computation run begins |
| `CALIBER_SNAPSHOT_CALIBER_COMPUTED` | Single caliber done (caliber, sampleCount, median, durationMs, droppedByBounds) |
| `CALIBER_SNAPSHOT_CALIBER_INSUFFICIENT` | Single caliber, sampleCount < 5 |
| `CALIBER_SNAPSHOT_JOB_COMPLETE` | Full run done (calibersProcessed, calibersWithData, totalDurationMs) |
| `CALIBER_SNAPSHOT_JOB_ERROR` | Full run failed |

**Bounds instrumentation**: Each per-caliber computation MUST log `droppedByBounds` — the count of `qualifying_prices` rows excluded by the `price_per_round > 0 AND price_per_round < 10` sanity filter. This is computed as `COUNT(*) FROM qualifying_prices WHERE price_per_round <= 0 OR price_per_round >= 10` for the caliber. If `droppedByBounds` is consistently high for a caliber, the bounds may need recalibration or the corrections overlay may have a bug producing erroneous prices.

---

## API Endpoint

### Routes

New file: `apps/api/src/routes/market-snapshots.ts`

```
GET /api/market-snapshots/calibers       → All current snapshots (26 calibers)
GET /api/market-snapshots/calibers/:caliber → Single caliber (URL-encoded CaliberValue)
```

Both endpoints are public (no auth required). ADR-006: response is purely descriptive, no recommendations.

Register in `apps/api/src/app.ts`:
```typescript
import { marketSnapshotsRouter } from './routes/market-snapshots'
app.use('/api/market-snapshots', marketSnapshotsRouter)
```

### Response Contract

```typescript
// GET /api/market-snapshots/calibers
interface CaliberSnapshotsResponse {
  snapshots: CaliberSnapshotPublic[]
  meta: {
    windowDays: number
    statBasis: 'dailyBestObserved'   // what the distribution represents (see below)
    computedAt: string | null        // ISO timestamp of newest snapshot
    calibersWithData: number
    totalCalibers: number
  }
}

// GET /api/market-snapshots/calibers/:caliber → CaliberSnapshotPublic | 404
interface CaliberSnapshotPublic {
  caliber: string                    // canonical CaliberValue
  windowDays: number
  statBasis: 'dailyBestObserved'     // see "Sample Count Semantics" section
  statLabel: string                  // human-readable label, e.g. 'Observed daily-best price per round'
  median: number | null              // null when sampleCount < 5
  p25: number | null                 // null when sampleCount < 5
  p75: number | null                 // null when sampleCount < 5
  min: number | null                 // null when sampleCount = 0 (no in-bounds data)
  max: number | null                 // null when sampleCount = 0 (no in-bounds data)
  sampleCount: number                // count of (product, day) minima — NOT raw observations
  daysWithData: number               // UTC calendar days with at least one data point
  productCount: number               // products contributing bounded daily-best data (not all matched)
  retailerCount: number              // retailers with qualifying observations (pre-daily-best)
  computedAt: string                 // ISO timestamp
  dataStatus: 'SUFFICIENT' | 'INSUFFICIENT_DATA'  // renamed from 'status' to avoid collision with DB lifecycle status
}
```

`dataStatus` is derived at response time: `sampleCount >= 5 ? 'SUFFICIENT' : 'INSUFFICIENT_DATA'`. Named `dataStatus` (not `status`) to avoid confusion with the DB lifecycle column (`CURRENT`/`SUPERSEDED`), which is never exposed in the API.

**Important**: `dataStatus = 'SUFFICIENT'` means percentiles are computed (>= 5 samples). It does NOT mean the data is suitable for all display contexts. The www `ObservedMarketContextBlock` requires `sampleCount >= 15` to render. LLM consumers also use the 15-sample threshold (see LLM Consumer Rules). Consumers MUST check `sampleCount` directly for their own display thresholds — `dataStatus` only indicates whether the statistics fields are non-null.

**Decimal serialization**: The database stores `DECIMAL(10,6)` but the API returns JSON `number`. Define a shared helper `formatDecimal6(value: Prisma.Decimal | null): number | null` that handles null-safety and calls `.toFixed(6)` on the Prisma `Decimal` object (not on a JS number). Use this for all decimal fields in the response. Add a route test asserting all numeric fields have at most 6 decimal places.

### Sample Count Semantics

**`statBasis: 'dailyBestObserved'`** — the distribution underlying all statistics is *daily-best observed prices*, not all observed prices.

- Each data point = MIN(corrected price-per-round) for one product on one UTC calendar day, across all qualifying retailers.
- `sampleCount` = number of such `(product, day)` minima. This is NOT the number of raw price observations or unique offers.
- The resulting median is "median of daily-best offers observed" — it reflects the best price a buyer could have found each day, not the typical listed price.
- This systematically skews lower than an all-observations median, especially when one retailer runs frequent promotions.
- UI copy, LLM prompts, and API documentation MUST label this accurately: "observed daily-best median" or similar. Do NOT label as "market median" without qualification.
- **"Daily" means UTC calendar day.** `daysWithData` and daily-best grouping use `DATE_TRUNC('day', ... AT TIME ZONE 'UTC')`. This is consistent across all services but can be counterintuitive for US time zones. Do not "fix" this by switching to local time — UTC is the canonical boundary.

### Caching

Redis cache following `market-deals.ts` pattern:
- Keys: `market-snapshots:calibers:all`, `market-snapshots:calibers:{caliber}`
- TTL: 300 seconds (5 min — snapshots update every 6 hours, so 5 min is more than fresh)
- HTTP header: `Cache-Control: public, max-age=300, stale-while-revalidate=600`

**IMPORTANT (ADR-006):** This route is public and impersonal. `Cache-Control: public` means responses are shared across all callers. Do NOT add user-specific data (e.g., gun locker matches, personalized alerts) to this endpoint. Any personalization would become a security leak via the shared cache.

### LLM Consumer Rules (Fail-Closed)

When an LLM (ai-search, market summaries, or any future AI surface) consumes snapshot data, it MUST fail closed:

1. **Insufficient data**: If `sampleCount < 15` or `dataStatus = 'INSUFFICIENT_DATA'`, the model MUST state that insufficient data is available. It MUST NOT summarize market direction, trends, or price levels from the snapshot.
2. **Stale data**: If `computedAt` is older than 12 hours, the model MUST note the data may be stale and include the last-computed timestamp. It MUST NOT present stale statistics as current market conditions.
3. **Labeling**: The model MUST describe statistics as "observed daily-best median" or equivalent qualified language. It MUST NOT use "market price", "average price", or other unqualified terms that imply comprehensive coverage (per ADR-006, ADR-003).
4. **No extrapolation**: The model MUST NOT infer trends, predict future prices, or compare across time periods from a single snapshot. Snapshots are point-in-time observations, not time series.

These rules are enforced via system prompt instructions for AI consumers. Violation of rules 1-3 is a data integrity bug; violation of rule 4 is an ADR-003/ADR-006 compliance bug.

**CI enforcement**: Define a shared prompt fragment (e.g., `SNAPSHOT_CONSUMER_GUARDS` in a constants file) containing the required guard instructions (insufficient data handling, "observed daily-best" labeling, staleness check). Any prompt template consuming snapshot data MUST include this fragment by reference (import), not by copy-pasting the text. The CI test then verifies: (1) every prompt file that references `/api/market-snapshots` or imports snapshot types also imports `SNAPSHOT_CONSUMER_GUARDS`, and (2) the fragment itself contains the required guard phrases. This is more robust than scanning for paraphrases — the fragment is the contract, and inclusion is binary.

### CORS

`https://www.ironscout.ai` is already in `allowedOrigins` at `apps/api/src/app.ts:94`. No CORS changes needed. For local dev, `https://www.local.ironscout.ai` must be in `CORS_ORIGINS` env var.

---

## Web App Integration

### Constraint: `apps/www` is `output: 'export'` (Fully Static)

The www marketing site builds to static HTML files. No server rendering, no ISR, no request-time data fetching. The only way to get dynamic snapshot data onto caliber pages is **client-side fetch after hydration**.

### ObservedMarketContextBlock → Client Component

Convert `apps/www/components/ObservedMarketContextBlock.tsx` from a server component (receives all props including data) to a client component that fetches data on mount.

**New props:**
```typescript
'use client'

interface ObservedMarketContextBlockProps {
  caliberLabel: string
  caliberSlug: string       // URL slug → mapped to CaliberValue
  apiBaseUrl: string        // from NEXT_PUBLIC_API_URL env var
}
```

**Slug-to-CaliberValue mapping** (14 entries matching `apps/www/content/calibers/`):

| Slug | CaliberValue |
|------|-------------|
| `9mm` | `9mm` |
| `556-nato` | `.223/5.56` |
| `308-winchester` | `.308/7.62x51` |
| `22-lr` | `.22 LR` |
| `45-acp` | `.45 ACP` |
| `300-blackout` | `.300 AAC Blackout` |
| `30-06-springfield` | `.30-06` |
| `65-creedmoor` | `6.5 Creedmoor` |
| `223-remington` | `.223/5.56` |
| `762x39` | `7.62x39` |
| `380-acp` | `.380 ACP` |
| `40-sw` | `.40 S&W` |
| `10mm-auto` | `10mm Auto` |
| `12-gauge` | `12ga` |

Note: `556-nato` and `223-remington` both map to `.223/5.56` — same snapshot row, different pages.

This mapping MUST live in `packages/db/calibers.ts` (alongside `CALIBER_ALIASES`) or a sibling `packages/db/caliber-slugs.ts`, not hardcoded in the www component. Centralizing prevents drift when caliber pages are added or renamed, and makes the mapping testable.

**Behavior:**
1. Static render: shows a neutral loading skeleton ("Loading market context...") that reserves the final component height. Only show "not enough observations" after the fetch confirms insufficient data. This avoids briefly lying to the user (claiming no data when data may exist) while preserving fail-closed semantics.
2. On mount: `fetch(${apiBaseUrl}/api/market-snapshots/calibers/${encodeURIComponent(caliberValue)})`
3. On success with `sampleCount >= 15`: render stats (existing formatting logic)
4. On failure or insufficient data: remain in placeholder state (fail closed, per ADR-009)
5. No explicit retry on failure — degrade gracefully. HTTP caching with `stale-while-revalidate` may serve stale responses while revalidating in the background, which is acceptable.

### Caliber Page Updates

In `apps/www/app/caliber/[slug]/page.tsx` (lines 120-127), change from passing all nulls to passing slug + API URL:

```tsx
// Before (current)
observedMarketContext={{
  caliberLabel,
  lastUpdated: null, sampleCount: null, median: null, min: null, max: null,
}}

// After
observedMarketContext={{
  caliberLabel,
  caliberSlug: slug,
  apiBaseUrl: process.env.NEXT_PUBLIC_API_URL || 'https://api.ironscout.ai',
}}
```

Same change in `apps/www/app/caliber/[slug]/[type]/page.tsx`.

Update `apps/www/components/MarketingMarkdownPage.tsx` to accept the new props shape.

### JSON-LD (Deferred to v1.1)

The `@type: Dataset` JSON-LD block on caliber pages is server-rendered static HTML. Injecting dynamic snapshot data requires either a build-time data pipeline or dropping static export. Not worth the architectural change for v1. The Dataset schema is valid without dynamic values.

---

## Alternatives Considered

**Materialized view**: Rejected. Postgres materialized views cannot be refreshed transactionally alongside the `CURRENT`/`SUPERSEDED` lifecycle, and they lack audit columns (computedAt, computationVersion) needed for debugging.

**Redis-only cache**: Rejected. Redis is volatile. The snapshot must survive restarts and be queryable for auditing. Redis may cache reads from the table, but the table is the system of record.

**Reuse `current_visible_prices`**: Rejected. That table holds a 7-day lookback only and does not store per-round prices or caliber-level aggregates. The 30-day window requires querying the raw `prices` table with corrections overlay.

**Compute on every API request**: Rejected. The daily-best + corrections overlay query is expensive. A 6-hour precomputation amortizes cost and guarantees identical numbers for all snapshot-consuming surfaces.

**ISR / SSR for www**: Rejected. The www app is `output: 'export'` (fully static). Switching to ISR/SSR requires removing the static export config, changing the deployment model, and adding server infrastructure. Client-side fetch accomplishes the same goal within the existing architecture.

---

## Risks and Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Caliber alias drift** between shared package and product data | HIGH | Single source in `packages/db/calibers.ts`. `computationVersion` tracks query changes. |
| **Query performance** (30-day window, corrections overlay, 26 calibers) | MEDIUM | Each caliber runs independently. Profile on staging. If slow, batch into single query with `GROUP BY caliber`. 6-hour schedule gives ample headroom. |
| **Static export + client fetch = content flash** | LOW | Static render shows neutral loading skeleton. Data populates after hydration. Skeleton reserves final component height to minimize layout shift. |
| **Schema drift** blocking migration | MEDIUM | Manual migration SQL + `prisma generate`. Do not run `prisma migrate dev`. |
| **Stale snapshot** if scheduler dies | MEDIUM | API includes `computedAt` in response. Monitoring query flags > 12 hours stale. |
| **Timezone/day-boundary** correctness | LOW | All queries use `AT TIME ZONE 'UTC'` for day truncation (same as existing services). |
| **Partial retailer coverage** | LOW | Fail closed: `sampleCount < 5 → null stats`. Display threshold is higher at 15. |
| **CORS for local dev** | LOW | `www.local.ironscout.ai` must be in `CORS_ORIGINS` env var. |

---

## Test Plan

### T1: Computation Tests (`apps/harvester/src/calibersnapshot/__tests__/compute.test.ts`)

| Test | Verifies |
|------|----------|
| Sufficient data (>= 5 samples) | median, p25, p75, min, max all populated |
| Insufficient data (1-4 samples) | median/p25/p75 null, min/max populated, sampleCount accurate |
| Zero data | sampleCount = 0, all stats null |
| Window boundary: observedAt == windowStart | included (>= is inclusive) |
| Window boundary: observedAt == windowEnd | excluded (< is exclusive) |
| IGNORE corrections | excluded prices |
| MULTIPLIER corrections | adjusted prices |
| >2 multipliers on single price | price excluded |
| INELIGIBLE retailer | excluded |
| UNLISTED merchant | excluded |
| Ignored feed run | excluded |
| Disabled scrape adapter | excluded |
| Price sanity bounds | price_per_round <= 0 or >= 10 excluded |
| Superseded lifecycle | old CURRENT flips to SUPERSEDED on new insert |
| CURRENT uniqueness after commit | exactly one CURRENT row per caliber per windowDays |
| Zero data returns one row | query returns exactly one row with sampleCount=0, all stats null |
| Determinism | same inputs produce same outputs |
| retailerCount accuracy | counts from qualifying_prices, not daily_best |

### T2: API Route Tests (`apps/api/src/routes/__tests__/market-snapshots.test.ts`)

| Test | Verifies |
|------|----------|
| GET /calibers returns all current | snapshot array + meta shape |
| GET /calibers/:caliber returns single | correct shape, matching caliber |
| Unknown caliber returns 404 | error response |
| Redis cache hit | cached response returned without DB query |
| Response shape contract | TypeScript interface match |
| No recommendation language | ADR-006 compliance scan |

### T2.5: LLM Consumer Contract Test

Verifies the shared-fragment approach for LLM prompt guard enforcement:

1. **Fragment exists**: `SNAPSHOT_CONSUMER_GUARDS` constant is defined and contains the required guard phrases ("insufficient data", "observed daily-best", `computedAt`).
2. **All consumers import it**: Every prompt file that references `/api/market-snapshots` or imports snapshot types also imports `SNAPSHOT_CONSUMER_GUARDS`. This is a binary check (import present or not), not a fragile string scan for paraphrases.
3. **No stale copies**: No prompt file contains inline copies of the guard text (grep for key phrases outside the fragment file — if found, the consumer is copy-pasting instead of importing).

Fails the build if any consumer bypasses the shared fragment. Lives alongside the T2 route tests.

### T3: Component Tests

| Test | Verifies |
|------|----------|
| Initial render shows loading skeleton | Neutral skeleton visible, NOT "not enough observations" |
| Fetch success with sampleCount >= 15 | stats rendered |
| Fetch success with sampleCount < 15 | placeholder remains |
| Fetch success with insufficient data | "not enough observations" shown (post-fetch, not pre-fetch) |
| Fetch failure | loading skeleton remains, no error UI |

### T4: Merge Gate Tests

Three automated tests that enforce the merge-blocking requirements. PR cannot merge if any fail.

| Test | What it asserts | Fails if |
|------|-----------------|----------|
| **CHECK constraint exists** | Migration SQL contains `CHECK (action != 'MULTIPLIER' OR value > 0)` on `price_corrections` | Constraint is missing from migration file |
| **cuid ingestion assert exists** | All production ingestion code paths (`affiliate/worker.ts`, `scrape/worker.ts`, future ingestion entry points) call a `assertCuidFormat(ingestionRunId)` guard before writing to `prices` | Assert is absent from any ingestion code path |
| **Constraint is live** | Integration test inserts a `MULTIPLIER` correction with `value = 0` and asserts a DB constraint violation error | CHECK constraint was not applied to the database |

The first two are static/structural tests (grep the codebase). The third is a runtime integration test against the dev database.

---

## Consequences

### Technical
- New `caliber_market_snapshots` table with partial unique index enforcing one CURRENT row per caliber per window
- New `apps/harvester/src/calibersnapshot/` module (compute, worker, scheduler) following the `currentprice/` pattern
- Caliber alias mapping extracted to `packages/db/calibers.ts` (shared between harvester and API)
- New API route `GET /api/market-snapshots/calibers[/:caliber]`
- `ObservedMarketContextBlock` converted from server component to client component with fetch (www is `output: 'export'`, no SSR)

### Operational
- Snapshot computation runs every 6 hours under `harvesterSchedulerEnabled` guard (ADR-001)
- Staleness monitored via `computedAt` — alert if > 12 hours stale
- `computationVersion` tracks query changes for debugging median drift
- **Retention**: `SUPERSEDED` rows older than 90 days may be pruned without affecting consumers (this is a derived table — ADR-004 append-only applies to `prices`, not snapshots). Only `CURRENT` rows are read at query time. Retention is not enforced automatically in v1 — add a scheduled cleanup if row count warrants it.
- **Scale assumption**: The corrections overlay (3 correlated subqueries per row) assumes < 1,000 active corrections at any time. **Plan B trigger**: if a full 26-caliber run exceeds 120 seconds or any single caliber exceeds 10 seconds, switch to a single-pass query grouped by caliber alias mapping (one query covering all calibers with `GROUP BY caliber`). The 6-hour schedule gives ample headroom even at current Plan A speed.

### Product / Trust
- www caliber pages display real observed market data for calibers meeting the 15-sample display threshold (others continue to show "not enough observations" — but now truthfully, based on actual data rather than missing plumbing)
- LLM market summaries backed by a single precomputed, auditable source
- All snapshot-consuming surfaces citing caliber statistics return identical numbers (`price-check.ts` remains a temporary exception until v1.1 migration)
- JSON-LD dynamic injection deferred to v1.1 (static export constraint)

---

## Implementation Decisions Forced by Repo

1. **Alias matching uses `LOWER(p.caliber) = ANY(aliases)` not `ILIKE`** — matches `price-check.ts` (precise) rather than `price-signal-index.ts` (substring). More correct for an authoritative snapshot.

2. **www is `output: 'export'` (fully static)** — cannot use ISR/SSR. Client-side fetch is the only option without changing the build architecture.

3. **Caliber aliases must be extracted to shared package** — the harvester cannot import from the API app. `packages/db/calibers.ts` is the natural home.

4. **Snapshot schedule is 6 hours, not 5 minutes** — the 30-day window changes slowly. 6h gives ample freshness without unnecessary load. Env var override available.

5. **`retailerCount` uses pre-daily-best aggregation** — after daily-best, retailer identity is collapsed. Counting from qualifying_prices gives the true contributing retailer count.

6. **JSON-LD dynamic injection deferred to v1.1** — requires either build-time pipeline or dropping static export.

7. **'Other' caliber excluded** — catch-all bucket where median computation is meaningless.

---

## Files Summary

### Created
| File | Purpose |
|------|---------|
| `packages/db/prisma/migrations/…/migration.sql` | CREATE TABLE + indexes |
| `packages/db/calibers.ts` | Shared caliber aliases + types |
| `apps/harvester/src/calibersnapshot/compute.ts` | SQL computation + DB write |
| `apps/harvester/src/calibersnapshot/worker.ts` | BullMQ worker |
| `apps/harvester/src/calibersnapshot/scheduler.ts` | Cron scheduler |
| `apps/harvester/src/calibersnapshot/index.ts` | Module exports |
| `apps/api/src/routes/market-snapshots.ts` | API endpoint |

### Modified
| File | Change |
|------|--------|
| `packages/db/schema.prisma` | Add caliber_market_snapshots model |
| `packages/db/index.ts` | Export calibers module |
| `apps/harvester/src/config/queues.ts` | Add queue + job type |
| `apps/harvester/src/config/logger.ts` | Add child logger |
| `apps/harvester/src/worker.ts` | Register worker + scheduler in startup/shutdown |
| `apps/api/src/app.ts` | Register market-snapshots route |
| `apps/api/src/services/price-check.ts` | Import aliases from shared package |
| `apps/api/src/services/gun-locker.ts` | Import CANONICAL_CALIBERS from shared package |
| `apps/www/components/ObservedMarketContextBlock.tsx` | Rewrite as client component with fetch |
| `apps/www/components/MarketingMarkdownPage.tsx` | Update props type |
| `apps/www/app/caliber/[slug]/page.tsx` | Pass slug + apiBaseUrl |
| `apps/www/app/caliber/[slug]/[type]/page.tsx` | Same |

---

## Monitoring

### Staleness Check Query
```sql
SELECT caliber, "sampleCount", median, "computedAt",
       EXTRACT(EPOCH FROM (NOW() - "computedAt")) / 3600 AS hours_stale
FROM caliber_market_snapshots
WHERE status = 'CURRENT' AND "windowDays" = 30
ORDER BY caliber;
```

Alert if any row has `hours_stale > 12`.

### Consistency Spot-Check

After deployment, compare for each caliber:
- `caliber_market_snapshots.median` (snapshot)
- Live `PERCENTILE_CONT` from `price-signal-index.ts` cache

Should be identical within floating-point tolerance when computed at the same time.

---

## Required Supporting Indexes

The snapshot query relies on these existing indexes. If any are missing, per-caliber query time will degrade:

| Table | Index | Used By |
|-------|-------|---------|
| `prices` | `(sourceProductId, observedAt)` or composite including `inStock` | `qualifying_prices` WHERE + JOIN |
| `product_links` | `(sourceProductId, status)` | JOIN to products |
| `price_corrections` | `(action, revokedAt)` or composite with `scopeType` | All 3 correction subqueries |
| `retailers` | `(visibilityStatus)` | ADR-005 filter |
| `merchant_retailers` | `(retailerId, status)` | ADR-005 LEFT JOIN |

Verify these exist before first production run. Add any missing indexes in the migration.

---

## Notes
- The daily-best primitive and corrections overlay derive from ADR-024's definition with deliberate hardening (pc.value > 0 guards, precise alias matching). This ADR adds persistence and scheduling, not a new computation model
- `price-signal-index.ts` is permanently exempted (product-level comparisons, not caliber summaries). `price-check.ts` is a temporary exception — it computes user-facing caliber stats ad-hoc and must be migrated to read from snapshots in v1.1 (see Consumer Contract)
- References: ADR-024 (canonical median), ADR-015 (corrections overlay), ADR-005 (retailer visibility), ADR-019 (product resolver), ADR-021 (scrape guardrails), ADR-006 (no recommendations), ADR-001 (singleton scheduler), ADR-004 (append-only), ADR-009 (fail closed)
