-- Affiliate Feed Constraints Migration
-- Per spec: context/specs/affiliate-feeds-v1.md
--
-- These constraints cannot be expressed in Prisma schema and must be applied manually.
-- Run after the Prisma migration that creates the affiliate feed tables.

-- ============================================================================
-- 1. CRITICAL: Price Deduplication Partial Unique Index
-- ============================================================================
-- Ensures retry-safe price writes from affiliate feeds.
-- Prevents duplicate prices for the same product in the same run.
-- Only applies to prices that came from affiliate feeds (affiliateFeedRunId IS NOT NULL).
-- NOTE: Prisma uses quoted camelCase column names, not snake_case!

CREATE UNIQUE INDEX IF NOT EXISTS prices_affiliate_dedupe
ON prices ("sourceProductId", "affiliateFeedRunId", "priceSignatureHash")
WHERE "affiliateFeedRunId" IS NOT NULL;

COMMENT ON INDEX prices_affiliate_dedupe IS
  'Ensures idempotent price writes from affiliate feed runs. Allows retry without duplicates.';

-- ============================================================================
-- 2. Display Primary Enforcement Partial Unique Index
-- ============================================================================
-- Ensures exactly one source per retailer can be marked as display primary.
-- This is used for price display on the consumer site.
-- NOTE: Prisma uses quoted camelCase column names, not snake_case!

CREATE UNIQUE INDEX IF NOT EXISTS sources_one_primary_per_retailer
ON sources ("retailerId")
WHERE "isDisplayPrimary" = true;

COMMENT ON INDEX sources_one_primary_per_retailer IS
  'Enforces at most one display-primary source per retailer for price display.';

-- ============================================================================
-- 3. Expiry Hours CHECK Constraint (Defense-in-Depth)
-- ============================================================================
-- Validates expiryHours is within allowed range (1-168 hours = 1 hour to 1 week).
-- Application-level validation is primary, this is defense-in-depth.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'expiry_hours_range'
    AND conrelid = 'affiliate_feeds'::regclass
  ) THEN
    ALTER TABLE affiliate_feeds
    ADD CONSTRAINT expiry_hours_range
    CHECK ("expiryHours" >= 1 AND "expiryHours" <= 168);
  END IF;
END $$;

COMMENT ON CONSTRAINT expiry_hours_range ON affiliate_feeds IS
  'Expiry hours must be between 1 and 168 (1 hour to 1 week). Defense-in-depth validation.';

-- ============================================================================
-- 4. Feed Lock ID Uniqueness
-- ============================================================================
-- Ensures each feed has a unique lock ID for advisory locking.
-- feedLockId is a BigInt used with pg_try_advisory_lock().

CREATE UNIQUE INDEX IF NOT EXISTS affiliate_feeds_feed_lock_id_unique
ON affiliate_feeds ("feedLockId")
WHERE "feedLockId" IS NOT NULL;

COMMENT ON INDEX affiliate_feeds_feed_lock_id_unique IS
  'Ensures unique advisory lock IDs for feed-level mutual exclusion.';

-- ============================================================================
-- 5. Source Product Identity Composite Index
-- ============================================================================
-- Optimizes identity resolution queries during feed processing.
-- Already defined in Prisma as @@unique, but adding explicit comment.

-- (Prisma handles this via: @@unique([sourceId, identityType, identityValue]))

-- ============================================================================
-- 6. Run Deduplication Index
-- ============================================================================
-- Optimizes checking for existing products seen in a run.

CREATE INDEX IF NOT EXISTS source_product_seen_run_lookup
ON source_product_seen ("runId", "sourceProductId");

COMMENT ON INDEX source_product_seen_run_lookup IS
  'Optimizes circuit breaker queries that check products seen in a run.';

-- ============================================================================
-- Verification Queries (run manually to verify constraints)
-- ============================================================================
--
-- Check partial unique indexes exist:
--   SELECT indexname, indexdef
--   FROM pg_indexes
--   WHERE tablename IN ('prices', 'sources', 'affiliate_feeds');
--
-- Check CHECK constraint exists:
--   SELECT conname, pg_get_constraintdef(oid)
--   FROM pg_constraint
--   WHERE conrelid = 'affiliate_feeds'::regclass;
--
-- Test price deduplication (should fail on duplicate):
--   INSERT INTO prices ("sourceProductId", "affiliateFeedRunId", "priceSignatureHash", ...)
--   VALUES ('sp1', 'run1', 'hash1', ...);
--   INSERT INTO prices ("sourceProductId", "affiliateFeedRunId", "priceSignatureHash", ...)
--   VALUES ('sp1', 'run1', 'hash1', ...);  -- Should fail
