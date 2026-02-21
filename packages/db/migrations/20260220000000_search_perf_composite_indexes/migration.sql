-- Search & Loadout Query Performance Optimization
-- Step 0: Add composite indexes for P0 JOIN query, drop confirmed dead indexes
--
-- Context:
--   current_visible_prices: 43M PK scans on 25K-row table from two-query price resolution
--   products: 67.7% index hit rate with 12,791 seq scans from 6-9 separate facet queries
--   product_links: missing composite for (productId, status, sourceProductId) predicate

-- ============================================================================
-- NEW COMPOSITE INDEXES
-- ============================================================================

-- Covers WHERE (productId, status) + provides sourceProductId for JOIN without heap fetch
-- NOTE: Not using CONCURRENTLY — Prisma wraps migrations in a transaction.
-- For production, consider applying via psql with CONCURRENTLY to avoid table locks.
CREATE INDEX IF NOT EXISTS "product_links_productId_status_sourceProductId_idx"
  ON "product_links" ("productId", "status", "sourceProductId");

-- Covers JOIN on sourceProductId + observedAt lookback filter
CREATE INDEX IF NOT EXISTS "current_visible_prices_sourceProductId_observedAt_idx"
  ON "current_visible_prices" ("sourceProductId", "observedAt" DESC);

-- ============================================================================
-- DROP CONFIRMED DEAD INDEXES (0 scans in pg_stat_user_indexes)
-- ============================================================================

-- current_visible_prices: dead single-column indexes
DROP INDEX IF EXISTS "current_visible_prices_productId_idx";   -- 0 scans, 792 kB
DROP INDEX IF EXISTS "current_visible_prices_inStock_idx";     -- 0 scans, 768 kB

-- product_links: dead single-column indexes (now covered by composite)
DROP INDEX IF EXISTS "product_links_matchType_idx";            -- 0 scans
DROP INDEX IF EXISTS "product_links_resolverVersion_idx";      -- 0 scans

-- products: dead indexes
DROP INDEX IF EXISTS "idx_products_brand";           -- 0 scans, duplicate of products_brand_idx (40 scans)
DROP INDEX IF EXISTS "idx_products_caliber_grain";   -- 0 scans
DROP INDEX IF EXISTS "idx_products_round_count";     -- 0 scans
DROP INDEX IF EXISTS "products_updatedAt_idx";       -- 0 scans

-- products: dead trigram indexes (0 scans)
-- NOTE: These are GIN trigram indexes that Prisma cannot represent.
-- Prisma drift detection will show these as expected drift — do NOT re-add.
DROP INDEX IF EXISTS "products_purpose_trgm_idx";
DROP INDEX IF EXISTS "products_casematerial_trgm_idx";

-- products: dead search vector index
-- NOTE: This is a GIN index on a GENERATED column. Prisma cannot represent it.
DROP INDEX IF EXISTS "products_search_vector_idx";
