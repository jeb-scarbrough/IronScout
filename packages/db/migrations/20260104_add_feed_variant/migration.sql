-- Add FeedVariant enum and variant column to affiliate_feeds
-- Enables multiple feeds per source (full/delta, regional splits, category splits)
-- Per ADR-016: Feed variant design for flexible ingestion

-- Step 1: Create FeedVariant enum type
DO $$ BEGIN
  CREATE TYPE "FeedVariant" AS ENUM (
    'FULL',
    'DELTA',
    'REGIONAL_US',
    'REGIONAL_CA',
    'REGIONAL_EU',
    'CATEGORY_AMMO',
    'CATEGORY_ACCESSORIES'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Step 2: Add variant column with default FULL
-- Existing rows will automatically get FULL as default
ALTER TABLE "affiliate_feeds"
ADD COLUMN IF NOT EXISTS "variant" "FeedVariant" NOT NULL DEFAULT 'FULL';

-- Step 3: Drop the old unique constraint on sourceId alone
-- This allows multiple feeds per source (differentiated by variant)
DROP INDEX IF EXISTS "affiliate_feeds_sourceId_key";

-- Step 4: Create new composite unique constraint on (sourceId, variant)
-- Ensures uniqueness: one FULL feed, one DELTA feed, etc. per source
CREATE UNIQUE INDEX IF NOT EXISTS "affiliate_feeds_sourceId_variant_key"
ON "affiliate_feeds" ("sourceId", "variant");

-- Step 5: Add index on sourceId for efficient lookups
-- (The composite unique already covers this, but explicit index is clearer)
CREATE INDEX IF NOT EXISTS "affiliate_feeds_sourceId_idx"
ON "affiliate_feeds" ("sourceId");
