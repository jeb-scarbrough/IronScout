-- =====================================================
-- Market Deals Performance Indexes
--
-- These indexes support the /api/dashboard/market-deals endpoint
-- which runs 4 heavy queries:
-- 1. Current best prices (ROW_NUMBER over sourceProductId, price ASC)
-- 2. 30-day median (PERCENTILE_CONT over observedAt)
-- 3. 90-day lowest (MIN over observedAt)
-- 4. Back-in-stock detection (DATE_TRUNC on observedAt with gap analysis)
--
-- All queries filter on:
-- - prices.sourceProductId (via product_links join)
-- - prices.observedAt (7/30/90 day filters)
-- - prices.inStock = true (for current prices)
--
-- NOTE: Cannot use CONCURRENTLY - Prisma runs migrations in transactions
-- NOTE: prices.observedAt already has @@index([observedAt]) in schema
-- =====================================================

-- 1. Composite index for sourceProductId + observedAt DESC
-- Supports time-range filtering on prices via product_links join
-- Critical for all 4 queries in market-deals.ts
CREATE INDEX IF NOT EXISTS idx_prices_source_product_observed
ON prices("sourceProductId", "observedAt" DESC);

-- 2. Covering index for in-stock price lookups with observedAt filter
-- Supports Phase 1 query: finding current best prices with inStock = true
-- The partial index reduces size by only indexing in-stock prices
CREATE INDEX IF NOT EXISTS idx_prices_source_product_stock_observed
ON prices("sourceProductId", "observedAt" DESC, price)
WHERE "inStock" = true;

-- 3. Composite for retailer visibility joins (ADR-005 predicate)
-- Query pattern: LEFT JOIN merchant_retailers mr ON mr."retailerId" = r.id AND mr.status = 'ACTIVE'
--                WHERE ... AND (mr.id IS NULL OR (mr."listingStatus" = 'LISTED' AND mr.status = 'ACTIVE'))
-- Index covers both join condition and WHERE filter
CREATE INDEX IF NOT EXISTS idx_merchant_retailers_visibility
ON merchant_retailers("retailerId", status, "listingStatus")
WHERE status = 'ACTIVE';

-- 4. Product_links status filter (used in all 4 queries)
-- Supports WHERE pl.status IN ('MATCHED', 'CREATED')
CREATE INDEX IF NOT EXISTS idx_product_links_status_product
ON product_links(status, "productId")
WHERE status IN ('MATCHED', 'CREATED');

-- Analyze tables to update statistics
ANALYZE prices;
ANALYZE product_links;
ANALYZE merchant_retailers;
