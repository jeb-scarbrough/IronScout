-- ADR-015 Phase 1: Price History Immutability and Corrections Foundation
-- This migration adds the schema foundations for price corrections:
-- 1. observedAt timestamps for price provenance
-- 2. Run ignore fields for operational control
-- 3. price_corrections table for correction overlays
-- 4. Alert suppression fields for retroactive correction handling

-- ============================================================================
-- 1. Create new enums for price corrections
-- ============================================================================

-- Scope types for price corrections (precedence: PRODUCT > RETAILER > MERCHANT > SOURCE > AFFILIATE > FEED_RUN)
DO $$ BEGIN
  CREATE TYPE "PriceCorrectionScopeType" AS ENUM (
    'PRODUCT',
    'RETAILER',
    'MERCHANT',
    'SOURCE',
    'AFFILIATE',
    'FEED_RUN'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Actions for price corrections
DO $$ BEGIN
  CREATE TYPE "PriceCorrectionAction" AS ENUM (
    'IGNORE',
    'MULTIPLIER'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 2. Add observedAt to prices table
-- ============================================================================

-- Add observedAt column (defaults to createdAt for existing rows)
ALTER TABLE "prices" ADD COLUMN IF NOT EXISTS "observedAt" TIMESTAMPTZ;

-- Backfill observedAt from createdAt for existing rows
UPDATE "prices" SET "observedAt" = "createdAt" WHERE "observedAt" IS NULL;

-- Set default and make non-null
ALTER TABLE "prices" ALTER COLUMN "observedAt" SET DEFAULT now();
ALTER TABLE "prices" ALTER COLUMN "observedAt" SET NOT NULL;

-- Add index for observedAt
CREATE INDEX IF NOT EXISTS "prices_observedAt_idx" ON "prices"("observedAt");

COMMENT ON COLUMN "prices"."observedAt" IS 'ADR-015: When the price was observed at the source (not when written to DB). This is the canonical timestamp for correction matching and provenance.';

-- ============================================================================
-- 3. Add observedAt to pricing_snapshots table (only if table exists)
-- ============================================================================

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pricing_snapshots') THEN
    -- Add observedAt column (defaults to createdAt for existing rows)
    ALTER TABLE "pricing_snapshots" ADD COLUMN IF NOT EXISTS "observedAt" TIMESTAMPTZ;

    -- Backfill observedAt from createdAt for existing rows
    UPDATE "pricing_snapshots" SET "observedAt" = "createdAt" WHERE "observedAt" IS NULL;

    -- Set default and make non-null
    ALTER TABLE "pricing_snapshots" ALTER COLUMN "observedAt" SET DEFAULT now();
    ALTER TABLE "pricing_snapshots" ALTER COLUMN "observedAt" SET NOT NULL;

    -- Add index for observedAt
    CREATE INDEX IF NOT EXISTS "pricing_snapshots_observedAt_idx" ON "pricing_snapshots"("observedAt");

    COMMENT ON COLUMN "pricing_snapshots"."observedAt" IS 'ADR-015: When the price was observed at the source.';
  END IF;
END $$;

-- ============================================================================
-- 4. Add run ignore fields to executions table
-- ============================================================================

ALTER TABLE "executions" ADD COLUMN IF NOT EXISTS "ignoredAt" TIMESTAMPTZ;
ALTER TABLE "executions" ADD COLUMN IF NOT EXISTS "ignoredBy" TEXT;
ALTER TABLE "executions" ADD COLUMN IF NOT EXISTS "ignoredReason" TEXT;

CREATE INDEX IF NOT EXISTS "executions_ignoredAt_idx" ON "executions"("ignoredAt");

COMMENT ON COLUMN "executions"."ignoredAt" IS 'ADR-015: When set, prices from this run are excluded from consumer queries.';
COMMENT ON COLUMN "executions"."ignoredBy" IS 'Who ignored the run (admin user ID or ''system'').';
COMMENT ON COLUMN "executions"."ignoredReason" IS 'Reason for ignoring (e.g., ''bad_scrape_data'', ''duplicate_run'', ''test_run'').';

-- ============================================================================
-- 5. Add run ignore fields to affiliate_feed_runs table
-- ============================================================================

ALTER TABLE "affiliate_feed_runs" ADD COLUMN IF NOT EXISTS "ignoredAt" TIMESTAMPTZ;
ALTER TABLE "affiliate_feed_runs" ADD COLUMN IF NOT EXISTS "ignoredBy" TEXT;
ALTER TABLE "affiliate_feed_runs" ADD COLUMN IF NOT EXISTS "ignoredReason" TEXT;

CREATE INDEX IF NOT EXISTS "affiliate_feed_runs_ignoredAt_idx" ON "affiliate_feed_runs"("ignoredAt");

COMMENT ON COLUMN "affiliate_feed_runs"."ignoredAt" IS 'ADR-015: When set, prices from this run are excluded from consumer queries.';
COMMENT ON COLUMN "affiliate_feed_runs"."ignoredBy" IS 'Who ignored the run (admin user ID or ''system'').';
COMMENT ON COLUMN "affiliate_feed_runs"."ignoredReason" IS 'Reason for ignoring (e.g., ''bad_feed_data'', ''duplicate_run'', ''test_run'').';

-- ============================================================================
-- 6. Add run ignore fields to merchant_feed_runs table (only if table exists)
-- ============================================================================

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'merchant_feed_runs') THEN
    ALTER TABLE "merchant_feed_runs" ADD COLUMN IF NOT EXISTS "ignoredAt" TIMESTAMPTZ;
    ALTER TABLE "merchant_feed_runs" ADD COLUMN IF NOT EXISTS "ignoredBy" TEXT;
    ALTER TABLE "merchant_feed_runs" ADD COLUMN IF NOT EXISTS "ignoredReason" TEXT;

    CREATE INDEX IF NOT EXISTS "merchant_feed_runs_ignoredAt_idx" ON "merchant_feed_runs"("ignoredAt");

    COMMENT ON COLUMN "merchant_feed_runs"."ignoredAt" IS 'ADR-015: When set, prices from this run are excluded from consumer queries.';
    COMMENT ON COLUMN "merchant_feed_runs"."ignoredBy" IS 'Who ignored the run (admin user ID or ''system'').';
    COMMENT ON COLUMN "merchant_feed_runs"."ignoredReason" IS 'Reason for ignoring (e.g., ''bad_feed_data'', ''duplicate_run'', ''test_run'').';
  END IF;
END $$;

-- ============================================================================
-- 7. Create price_corrections table
-- ============================================================================

CREATE TABLE IF NOT EXISTS "price_corrections" (
  "id" TEXT NOT NULL,
  "scopeType" "PriceCorrectionScopeType" NOT NULL,
  "scopeId" TEXT NOT NULL,
  "startTs" TIMESTAMPTZ NOT NULL,
  "endTs" TIMESTAMPTZ NOT NULL,
  "action" "PriceCorrectionAction" NOT NULL,
  "value" DECIMAL(10, 4),
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "createdBy" TEXT NOT NULL,
  "revokedAt" TIMESTAMPTZ,
  "revokedBy" TEXT,
  "revokeReason" TEXT,

  CONSTRAINT "price_corrections_pkey" PRIMARY KEY ("id")
);

-- Add indexes for price_corrections
CREATE INDEX IF NOT EXISTS "price_corrections_scopeType_scopeId_idx" ON "price_corrections"("scopeType", "scopeId");
CREATE INDEX IF NOT EXISTS "price_corrections_startTs_endTs_idx" ON "price_corrections"("startTs", "endTs");
CREATE INDEX IF NOT EXISTS "price_corrections_revokedAt_idx" ON "price_corrections"("revokedAt");
CREATE INDEX IF NOT EXISTS "price_corrections_createdAt_idx" ON "price_corrections"("createdAt");

COMMENT ON TABLE "price_corrections" IS 'ADR-015: Corrections overlay for price history. Corrections are explicit, auditable overlays that modify how facts are interpreted. Facts (prices, pricing_snapshots) are never mutated; corrections change visibility/value at read time.';
COMMENT ON COLUMN "price_corrections"."scopeType" IS 'Scope type determines what entity the correction applies to.';
COMMENT ON COLUMN "price_corrections"."scopeId" IS 'ID of the scoped entity (productId, retailerId, merchantId, sourceId, affiliateId, or runId).';
COMMENT ON COLUMN "price_corrections"."startTs" IS 'Correction applies to prices where observedAt >= startTs.';
COMMENT ON COLUMN "price_corrections"."endTs" IS 'Correction applies to prices where observedAt < endTs.';
COMMENT ON COLUMN "price_corrections"."action" IS 'What action to take: IGNORE excludes prices, MULTIPLIER applies a factor.';
COMMENT ON COLUMN "price_corrections"."value" IS 'Value for MULTIPLIER action (e.g., 0.9 for 10% discount correction). Must be NULL for IGNORE action.';
COMMENT ON COLUMN "price_corrections"."revokedAt" IS 'Soft-revoke timestamp. Corrections are never deleted, only revoked.';

-- ============================================================================
-- 8. Add alert suppression fields
-- ============================================================================

ALTER TABLE "alerts" ADD COLUMN IF NOT EXISTS "suppressedAt" TIMESTAMPTZ;
ALTER TABLE "alerts" ADD COLUMN IF NOT EXISTS "suppressedBy" TEXT;
ALTER TABLE "alerts" ADD COLUMN IF NOT EXISTS "suppressedReason" TEXT;

CREATE INDEX IF NOT EXISTS "alerts_suppressedAt_idx" ON "alerts"("suppressedAt");

COMMENT ON COLUMN "alerts"."suppressedAt" IS 'ADR-015: When set, alert is hidden in UI and never re-fired.';
COMMENT ON COLUMN "alerts"."suppressedBy" IS 'Who suppressed the alert (admin user ID or ''system'').';
COMMENT ON COLUMN "alerts"."suppressedReason" IS 'Reason for suppression (e.g., ''run_ignored'', ''correction_applied'').';
