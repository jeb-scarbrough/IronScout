-- ADR-025: Caliber Market Snapshots
-- Precomputed caliber-level market statistics as single source of truth

-- Lifecycle enum
CREATE TYPE "CaliberSnapshotStatus" AS ENUM ('CURRENT', 'SUPERSEDED');

-- Snapshot table
CREATE TABLE "caliber_market_snapshots" (
  "id"                    TEXT NOT NULL,
  "caliber"               TEXT NOT NULL,
  "windowDays"            INTEGER NOT NULL,
  "windowStart"           TIMESTAMPTZ NOT NULL,
  "windowEnd"             TIMESTAMPTZ NOT NULL,
  "median"                DECIMAL(10,6),
  "p25"                   DECIMAL(10,6),
  "p75"                   DECIMAL(10,6),
  "min"                   DECIMAL(10,6),
  "max"                   DECIMAL(10,6),
  "sampleCount"           INTEGER NOT NULL,
  "daysWithData"          INTEGER NOT NULL,
  "productCount"          INTEGER NOT NULL,
  "retailerCount"         INTEGER NOT NULL,
  "computedAt"            TIMESTAMPTZ NOT NULL,
  "computationVersion"    TEXT NOT NULL,
  "computationDurationMs" INTEGER,
  "status"                "CaliberSnapshotStatus" NOT NULL DEFAULT 'CURRENT',
  "createdAt"             TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY ("id")
);

-- One CURRENT snapshot per caliber per window size (partial unique index)
CREATE UNIQUE INDEX "caliber_market_snapshots_current_idx"
  ON "caliber_market_snapshots" ("caliber", "windowDays")
  WHERE "status" = 'CURRENT';

-- Query by status (e.g., find all CURRENT rows)
CREATE INDEX "caliber_market_snapshots_status_idx"
  ON "caliber_market_snapshots" ("status");

-- Query by computation time (staleness checks)
CREATE INDEX "caliber_market_snapshots_computed_at_idx"
  ON "caliber_market_snapshots" ("computedAt");

-- ADR-025 merge-blocking CHECK constraint:
-- Prevents LN(<=0) crash in snapshot computation SQL.
-- Pre-migration audit: SELECT id, value FROM price_corrections WHERE action = 'MULTIPLIER' AND (value IS NULL OR value <= 0);
ALTER TABLE "price_corrections" ADD CONSTRAINT "price_corrections_multiplier_value_positive"
  CHECK (action != 'MULTIPLIER' OR (value IS NOT NULL AND value > 0));
