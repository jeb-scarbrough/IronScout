-- Unified Quarantine Table Migration
-- Supports both RETAILER and AFFILIATE feed types in a single table
-- Removes FK constraint to retailer_feeds for flexibility

-- Create the QuarantineFeedType enum
CREATE TYPE "QuarantineFeedType" AS ENUM ('RETAILER', 'AFFILIATE');

-- Add new columns to quarantined_records
ALTER TABLE "quarantined_records"
  ADD COLUMN "feedType" "QuarantineFeedType" NOT NULL DEFAULT 'RETAILER',
  ADD COLUMN "sourceId" TEXT;

-- Make retailerId optional (was required before)
ALTER TABLE "quarantined_records"
  ALTER COLUMN "retailerId" DROP NOT NULL;

-- Drop the FK constraint to retailer_feeds
-- This allows affiliate feeds to use the same table
ALTER TABLE "quarantined_records"
  DROP CONSTRAINT IF EXISTS "quarantined_records_feedId_fkey";

-- Add indexes for new columns
CREATE INDEX "quarantined_records_feedType_idx" ON "quarantined_records"("feedType");
CREATE INDEX "quarantined_records_sourceId_idx" ON "quarantined_records"("sourceId");

-- Backfill: existing records are RETAILER type (no change needed, default handles it)
-- The feedType column defaults to 'RETAILER' which matches existing records
