-- Add brandNorm column to source_products for alias matching and impact estimation
-- This enables efficient queries for brand alias impact analysis

-- Step 1: Add the column
ALTER TABLE "source_products" ADD COLUMN IF NOT EXISTS "brandNorm" TEXT;

-- Step 2: Basic backfill - lowercase and trim
-- Note: This is an approximation. Full normalization (NFKD, trademark stripping, etc.)
-- should be done via application-level backfill script for accuracy.
UPDATE "source_products"
SET "brandNorm" = LOWER(TRIM("brand"))
WHERE "brand" IS NOT NULL AND "brandNorm" IS NULL;

-- Step 3: Add composite index for impact estimation queries
-- Supports: WHERE brandNorm = ? AND createdAt >= ?
CREATE INDEX IF NOT EXISTS "source_products_brandNorm_createdAt_idx"
ON "source_products" ("brandNorm", "createdAt");
