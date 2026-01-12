-- Migration: Rename merchant_* feed tables to retailer_*
-- Per Merchant-and-Retailer-Reference.md: Feeds/Sources belong to Retailers
--
-- This migration:
-- 1. Adds retailerId column (populated via merchant_retailers lookup)
-- 2. Renames tables from merchant_* to retailer_*
-- 3. Drops old merchantId columns
-- 4. Updates indexes and foreign keys

-- ============================================================================
-- Part 1: Add retailerId to merchant_feeds and populate via merchant_retailers
-- ============================================================================

-- Add retailerId column
ALTER TABLE "merchant_feeds" ADD COLUMN IF NOT EXISTS "retailerId" TEXT;

-- Populate retailerId from merchant_retailers (V1: 1 merchant = 1 retailer)
UPDATE "merchant_feeds" mf
SET "retailerId" = mr."retailerId"
FROM "merchant_retailers" mr
WHERE mf."merchantId" = mr."merchantId";

-- For any feeds without a retailer mapping, we need to handle them
-- Log warning for unmapped feeds (these would be orphaned)
DO $$
DECLARE
  unmapped_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO unmapped_count FROM "merchant_feeds" WHERE "retailerId" IS NULL;
  IF unmapped_count > 0 THEN
    RAISE WARNING 'Found % merchant_feeds without retailer mapping - these will be orphaned', unmapped_count;
  END IF;
END $$;

-- Make retailerId NOT NULL (after population)
-- Only if all rows have been populated
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "merchant_feeds" WHERE "retailerId" IS NULL) THEN
    ALTER TABLE "merchant_feeds" ALTER COLUMN "retailerId" SET NOT NULL;
  END IF;
END $$;

-- Drop old merchantId column and its index
DROP INDEX IF EXISTS "merchant_feeds_merchantId_idx";
ALTER TABLE "merchant_feeds" DROP CONSTRAINT IF EXISTS "merchant_feeds_merchantId_fkey";
ALTER TABLE "merchant_feeds" DROP COLUMN IF EXISTS "merchantId";

-- ============================================================================
-- Part 2: Add retailerId to merchant_feed_runs and populate
-- ============================================================================

ALTER TABLE "merchant_feed_runs" ADD COLUMN IF NOT EXISTS "retailerId" TEXT;

UPDATE "merchant_feed_runs" mfr
SET "retailerId" = mr."retailerId"
FROM "merchant_retailers" mr
WHERE mfr."merchantId" = mr."merchantId";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "merchant_feed_runs" WHERE "retailerId" IS NULL) THEN
    ALTER TABLE "merchant_feed_runs" ALTER COLUMN "retailerId" SET NOT NULL;
  END IF;
END $$;

DROP INDEX IF EXISTS "merchant_feed_runs_merchantId_idx";
ALTER TABLE "merchant_feed_runs" DROP COLUMN IF EXISTS "merchantId";

-- ============================================================================
-- Part 3: Add retailerId to merchant_feed_test_runs and populate
-- ============================================================================

ALTER TABLE "merchant_feed_test_runs" ADD COLUMN IF NOT EXISTS "retailerId" TEXT;

UPDATE "merchant_feed_test_runs" mftr
SET "retailerId" = mr."retailerId"
FROM "merchant_retailers" mr
WHERE mftr."merchantId" = mr."merchantId";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "merchant_feed_test_runs" WHERE "retailerId" IS NULL) THEN
    ALTER TABLE "merchant_feed_test_runs" ALTER COLUMN "retailerId" SET NOT NULL;
  END IF;
END $$;

DROP INDEX IF EXISTS "merchant_feed_test_runs_merchantId_idx";
ALTER TABLE "merchant_feed_test_runs" DROP COLUMN IF EXISTS "merchantId";

-- ============================================================================
-- Part 4: Add retailerId to merchant_skus and populate
-- ============================================================================

ALTER TABLE "merchant_skus" ADD COLUMN IF NOT EXISTS "retailerId" TEXT;

UPDATE "merchant_skus" ms
SET "retailerId" = mr."retailerId"
FROM "merchant_retailers" mr
WHERE ms."merchantId" = mr."merchantId";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "merchant_skus" WHERE "retailerId" IS NULL) THEN
    ALTER TABLE "merchant_skus" ALTER COLUMN "retailerId" SET NOT NULL;
  END IF;
END $$;

DROP INDEX IF EXISTS "merchant_skus_merchantId_idx";
ALTER TABLE "merchant_skus" DROP COLUMN IF EXISTS "merchantId";

-- ============================================================================
-- Part 5: Rename tables
-- ============================================================================

ALTER TABLE "merchant_feeds" RENAME TO "retailer_feeds";
ALTER TABLE "merchant_feed_runs" RENAME TO "retailer_feed_runs";
ALTER TABLE "merchant_feed_test_runs" RENAME TO "retailer_feed_test_runs";
ALTER TABLE "merchant_skus" RENAME TO "retailer_skus";

-- ============================================================================
-- Part 6: Create new indexes with correct names
-- ============================================================================

-- retailer_feeds
CREATE INDEX IF NOT EXISTS "retailer_feeds_retailerId_idx" ON "retailer_feeds"("retailerId");

-- retailer_feed_runs
CREATE INDEX IF NOT EXISTS "retailer_feed_runs_retailerId_idx" ON "retailer_feed_runs"("retailerId");
CREATE INDEX IF NOT EXISTS "retailer_feed_runs_feedId_idx" ON "retailer_feed_runs"("feedId");
CREATE INDEX IF NOT EXISTS "retailer_feed_runs_feedId_status_startedAt_idx" ON "retailer_feed_runs"("feedId", "status", "startedAt");

-- retailer_feed_test_runs
CREATE INDEX IF NOT EXISTS "retailer_feed_test_runs_retailerId_idx" ON "retailer_feed_test_runs"("retailerId");
CREATE INDEX IF NOT EXISTS "retailer_feed_test_runs_feedId_idx" ON "retailer_feed_test_runs"("feedId");
CREATE INDEX IF NOT EXISTS "retailer_feed_test_runs_startedAt_idx" ON "retailer_feed_test_runs"("startedAt");

-- retailer_skus
CREATE INDEX IF NOT EXISTS "retailer_skus_retailerId_idx" ON "retailer_skus"("retailerId");
CREATE INDEX IF NOT EXISTS "retailer_skus_feedId_idx" ON "retailer_skus"("feedId");
CREATE INDEX IF NOT EXISTS "retailer_skus_canonicalSkuId_idx" ON "retailer_skus"("canonicalSkuId");
CREATE INDEX IF NOT EXISTS "retailer_skus_rawUpc_idx" ON "retailer_skus"("rawUpc");
CREATE INDEX IF NOT EXISTS "retailer_skus_rawSku_idx" ON "retailer_skus"("rawSku");
CREATE INDEX IF NOT EXISTS "retailer_skus_mappingConfidence_idx" ON "retailer_skus"("mappingConfidence");
CREATE INDEX IF NOT EXISTS "retailer_skus_needsReview_idx" ON "retailer_skus"("needsReview");

-- ============================================================================
-- Part 7: Add foreign key constraints
-- ============================================================================

-- retailer_feeds → retailers
ALTER TABLE "retailer_feeds"
  ADD CONSTRAINT "retailer_feeds_retailerId_fkey"
  FOREIGN KEY ("retailerId") REFERENCES "retailers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- retailer_feed_runs → retailer_feeds
ALTER TABLE "retailer_feed_runs" DROP CONSTRAINT IF EXISTS "merchant_feed_runs_feedId_fkey";
ALTER TABLE "retailer_feed_runs"
  ADD CONSTRAINT "retailer_feed_runs_feedId_fkey"
  FOREIGN KEY ("feedId") REFERENCES "retailer_feeds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- retailer_feed_test_runs → retailer_feeds
ALTER TABLE "retailer_feed_test_runs" DROP CONSTRAINT IF EXISTS "merchant_feed_test_runs_feedId_fkey";
ALTER TABLE "retailer_feed_test_runs"
  ADD CONSTRAINT "retailer_feed_test_runs_feedId_fkey"
  FOREIGN KEY ("feedId") REFERENCES "retailer_feeds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- retailer_skus → retailers
ALTER TABLE "retailer_skus"
  ADD CONSTRAINT "retailer_skus_retailerId_fkey"
  FOREIGN KEY ("retailerId") REFERENCES "retailers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- retailer_skus → retailer_feeds (nullable)
ALTER TABLE "retailer_skus" DROP CONSTRAINT IF EXISTS "merchant_skus_feedId_fkey";
ALTER TABLE "retailer_skus"
  ADD CONSTRAINT "retailer_skus_feedId_fkey"
  FOREIGN KEY ("feedId") REFERENCES "retailer_feeds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- Part 8: Update quarantined_records (keep table name, change column)
-- ============================================================================

ALTER TABLE "quarantined_records" ADD COLUMN IF NOT EXISTS "retailerId" TEXT;

UPDATE "quarantined_records" qr
SET "retailerId" = mr."retailerId"
FROM "merchant_retailers" mr
WHERE qr."merchantId" = mr."merchantId";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "quarantined_records" WHERE "retailerId" IS NULL AND "merchantId" IS NOT NULL) THEN
    ALTER TABLE "quarantined_records" ALTER COLUMN "retailerId" SET NOT NULL;
  END IF;
END $$;

DROP INDEX IF EXISTS "quarantined_records_merchantId_idx";
ALTER TABLE "quarantined_records" DROP COLUMN IF EXISTS "merchantId";
CREATE INDEX IF NOT EXISTS "quarantined_records_retailerId_idx" ON "quarantined_records"("retailerId");

-- Update FK to retailer_feeds
ALTER TABLE "quarantined_records" DROP CONSTRAINT IF EXISTS "quarantined_records_feedId_fkey";
ALTER TABLE "quarantined_records"
  ADD CONSTRAINT "quarantined_records_feedId_fkey"
  FOREIGN KEY ("feedId") REFERENCES "retailer_feeds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- Part 9: Update feed_corrections (keep table name, change column)
-- ============================================================================

ALTER TABLE "feed_corrections" ADD COLUMN IF NOT EXISTS "retailerId" TEXT;

UPDATE "feed_corrections" fc
SET "retailerId" = mr."retailerId"
FROM "merchant_retailers" mr
WHERE fc."merchantId" = mr."merchantId";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "feed_corrections" WHERE "retailerId" IS NULL AND "merchantId" IS NOT NULL) THEN
    ALTER TABLE "feed_corrections" ALTER COLUMN "retailerId" SET NOT NULL;
  END IF;
END $$;

DROP INDEX IF EXISTS "feed_corrections_merchantId_idx";
ALTER TABLE "feed_corrections" DROP COLUMN IF EXISTS "merchantId";
CREATE INDEX IF NOT EXISTS "feed_corrections_retailerId_idx" ON "feed_corrections"("retailerId");

-- Update FK to retailer_feeds
ALTER TABLE "feed_corrections" DROP CONSTRAINT IF EXISTS "feed_corrections_feedId_fkey";
ALTER TABLE "feed_corrections"
  ADD CONSTRAINT "feed_corrections_feedId_fkey"
  FOREIGN KEY ("feedId") REFERENCES "retailer_feeds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- Part 10: Rename merchantSkuHash to retailerSkuHash in retailer_skus
-- ============================================================================

ALTER TABLE "retailer_skus" RENAME COLUMN "merchantSkuHash" TO "retailerSkuHash";

-- Update unique constraint
ALTER TABLE "retailer_skus" DROP CONSTRAINT IF EXISTS "merchant_skus_merchantId_merchantSkuHash_key";
ALTER TABLE "retailer_skus"
  ADD CONSTRAINT "retailer_skus_retailerId_retailerSkuHash_key"
  UNIQUE ("retailerId", "retailerSkuHash");

-- ============================================================================
-- Part 11: Rename merchantSkuId to retailerSkuId in merchant_insights
-- ============================================================================

ALTER TABLE "merchant_insights" RENAME COLUMN "merchantSkuId" TO "retailerSkuId";

-- Update FK
ALTER TABLE "merchant_insights" DROP CONSTRAINT IF EXISTS "merchant_insights_merchantSkuId_fkey";
ALTER TABLE "merchant_insights"
  ADD CONSTRAINT "merchant_insights_retailerSkuId_fkey"
  FOREIGN KEY ("retailerSkuId") REFERENCES "retailer_skus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- Part 12: Rename merchantSkuId to retailerSkuId in product_suggestions
-- ============================================================================

ALTER TABLE "product_suggestions" RENAME COLUMN "merchantSkuId" TO "retailerSkuId";

-- Update FK
ALTER TABLE "product_suggestions" DROP CONSTRAINT IF EXISTS "product_suggestions_merchantSkuId_fkey";
ALTER TABLE "product_suggestions"
  ADD CONSTRAINT "product_suggestions_retailerSkuId_fkey"
  FOREIGN KEY ("retailerSkuId") REFERENCES "retailer_skus"("id") ON DELETE SET NULL ON UPDATE CASCADE;
