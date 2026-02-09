-- Issue #218: Add unique index for affiliate price deduplication
--
-- Problem: bulkInsertPrices() uses ON CONFLICT DO NOTHING, but no unique
-- constraint existed on the prices table besides the PK (auto-generated UUID).
-- Every insert was treated as unique, causing duplicate rows on feed retries.
--
-- The dedupe key is (sourceProductId, observedAt):
--   - For a given source product, there should be one price row per observation time
--   - observedAt is set to the run's t0, so all prices in a run share the same value
--   - Different runs have different t0 values, so time-series history is preserved
--
-- Partial index (WHERE sourceProductId IS NOT NULL) because:
--   - sourceProductId is nullable in the schema
--   - Affiliate feeds always set it, so the index covers the retry path
--   - Non-affiliate prices (merchant, scraper) are unaffected
--
-- DEPLOYMENT NOTE:
--   This migration does NOT use CONCURRENTLY because Prisma runs migrations
--   inside a transaction (incompatible with CONCURRENTLY). For a pre-launch
--   dataset this is fine. For a large production table, instead:
--
--   1. Run: packages/db/scripts/dedupe-existing-prices.sql
--   2. Run manually:
--        CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS prices_source_observed_dedupe
--          ON prices ("sourceProductId", "observedAt")
--          WHERE "sourceProductId" IS NOT NULL;
--   3. Mark resolved: npx prisma migrate resolve --applied 20260209010000_add_price_dedupe_index
--
-- PREREQUISITE: Run dedupe-existing-prices.sql first if the table has
-- existing duplicate rows, or this CREATE UNIQUE INDEX will fail.

CREATE UNIQUE INDEX IF NOT EXISTS prices_source_observed_dedupe
  ON prices ("sourceProductId", "observedAt")
  WHERE "sourceProductId" IS NOT NULL;
