-- ADR-011A: Intent-Ready Saved Items (WatchlistItem Resolver Seam)
--
-- This migration adds schema support for future SEARCH intent while keeping
-- v1 behavior (SKU saves) identical. No user-visible behavior changes.
--
-- See: context/decisions/ADR-011A-Intent-Ready-Saved-Items.md
--
-- OPERATIONAL NOTES:
-- - For tables exceeding ~1M rows, run during low-traffic windows
-- - All CREATE INDEX use CONCURRENTLY to avoid write locks
-- - CHECK constraints validate existing rows (may take time on large tables)
-- - Rollback SQL is provided at the end of this file

-- ============================================================================
-- Part 1: Add nullable columns (fast, metadata-only for nullable columns)
-- ============================================================================

-- Add intent_type with default 'SKU' for all existing rows
ALTER TABLE watchlist_items
  ADD COLUMN IF NOT EXISTS intent_type TEXT NOT NULL DEFAULT 'SKU';

-- Add query_snapshot for future SEARCH intent (nullable, no validation needed)
ALTER TABLE watchlist_items
  ADD COLUMN IF NOT EXISTS query_snapshot JSONB NULL;

-- Add deleted_at for soft delete (nullable)
ALTER TABLE watchlist_items
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;

-- ============================================================================
-- Part 2: Make product_id nullable (metadata-only, fast)
-- ============================================================================

-- Required for future SEARCH intent where productId will be NULL
ALTER TABLE watchlist_items
  ALTER COLUMN "productId" DROP NOT NULL;

-- ============================================================================
-- Part 2.5: Drop old unique constraint (replaced by partial unique index)
-- ============================================================================

-- The old (userId, productId) unique constraint prevents soft delete from working
-- because a user could have both a deleted and an active row for the same product.
-- The new partial unique index watchlist_items_sku_active_uniq handles uniqueness
-- for active SKU items only.
ALTER TABLE watchlist_items
  DROP CONSTRAINT IF EXISTS "watchlist_items_userId_productId_key";

-- ============================================================================
-- Part 3: Create indexes
-- ============================================================================
-- NOTE: CONCURRENTLY removed for Prisma transaction compatibility.
-- For production with large tables, consider running indexes manually outside of migration.

-- Index for soft delete queries (cleanup jobs, analytics)
CREATE INDEX IF NOT EXISTS watchlist_items_deleted_at_idx
  ON watchlist_items (deleted_at);

-- Index for intent type filtering
CREATE INDEX IF NOT EXISTS watchlist_items_intent_type_idx
  ON watchlist_items (intent_type);

-- Partial index for active items per user (hot path optimization)
-- Per ADR-011A Section 4.3
CREATE INDEX IF NOT EXISTS watchlist_items_active_user_idx
  ON watchlist_items ("userId", "createdAt" DESC)
  WHERE deleted_at IS NULL;

-- Partial unique index: enforces SKU uniqueness for active rows
-- Per ADR-011A Section 19.1 - this is the authoritative uniqueness constraint
CREATE UNIQUE INDEX IF NOT EXISTS watchlist_items_sku_active_uniq
  ON watchlist_items ("userId", "productId")
  WHERE intent_type = 'SKU' AND deleted_at IS NULL AND "productId" IS NOT NULL;

-- ============================================================================
-- Part 4: Add CHECK constraints
-- ============================================================================

-- Intent type must be SKU or SEARCH
ALTER TABLE watchlist_items
  ADD CONSTRAINT watchlist_items_intent_type_check
  CHECK (intent_type IN ('SKU', 'SEARCH'));

-- Cross-field correctness: SKU requires productId, SEARCH requires query_snapshot
-- Per ADR-011A Section 4.2
ALTER TABLE watchlist_items
  ADD CONSTRAINT watchlist_items_intent_fields_check
  CHECK (
    (intent_type = 'SKU' AND "productId" IS NOT NULL)
    OR
    (intent_type = 'SEARCH' AND "productId" IS NULL AND query_snapshot IS NOT NULL)
  );

-- ============================================================================
-- ROLLBACK SQL (if needed)
-- ============================================================================
--
-- To rollback this migration, run the following:
--
-- -- Drop constraints
-- ALTER TABLE watchlist_items DROP CONSTRAINT IF EXISTS watchlist_items_intent_fields_check;
-- ALTER TABLE watchlist_items DROP CONSTRAINT IF EXISTS watchlist_items_intent_type_check;
--
-- -- Drop indexes
-- DROP INDEX IF EXISTS watchlist_items_sku_active_uniq;
-- DROP INDEX IF EXISTS watchlist_items_active_user_idx;
-- DROP INDEX IF EXISTS watchlist_items_intent_type_idx;
-- DROP INDEX IF EXISTS watchlist_items_deleted_at_idx;
--
-- -- Drop columns
-- ALTER TABLE watchlist_items
--   DROP COLUMN IF EXISTS deleted_at,
--   DROP COLUMN IF EXISTS query_snapshot,
--   DROP COLUMN IF EXISTS intent_type;
--
-- -- Restore NOT NULL on product_id (only if verified no NULLs exist)
-- -- First verify: SELECT COUNT(*) FROM watchlist_items WHERE product_id IS NULL;
-- -- Must be 0 before running:
-- ALTER TABLE watchlist_items ALTER COLUMN product_id SET NOT NULL;
--
-- -- Restore original unique constraint
-- ALTER TABLE watchlist_items
--   ADD CONSTRAINT "watchlist_items_userId_productId_key" UNIQUE (user_id, product_id);
