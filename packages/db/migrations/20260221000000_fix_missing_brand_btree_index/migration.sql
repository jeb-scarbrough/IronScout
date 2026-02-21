-- Fix missing brand B-tree index
--
-- The capture_manual_indexes migration (20260211000000) created idx_products_brand,
-- and search_perf_composite_indexes (20260220000000) dropped it as a dead duplicate.
-- But the Prisma-managed index (products_brand_idx from @@index([brand])) was never
-- created — the init migration omitted it during baseline squash.
--
-- This creates the Prisma-standard named index so fresh databases match schema.prisma.

CREATE INDEX IF NOT EXISTS "products_brand_idx" ON "products" ("brand");
