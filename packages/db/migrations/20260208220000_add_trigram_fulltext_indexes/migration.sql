-- Issue #203: Add trigram + full-text indexes for product search
--
-- Problem: All text search uses ILIKE '%term%' which forces sequential scans.
-- The existing B-tree indexes on name, description, brand cannot optimize
-- substring pattern matching (ILIKE with leading wildcard).
--
-- Solution:
-- 1. Enable pg_trgm extension for trigram-based GIN indexes
-- 2. Add GIN trigram indexes on columns used in ILIKE searches
-- 3. Add a generated tsvector column + GIN index for full-text search
--    (enables future ts_rank-based relevance scoring)
--
-- Impact: ILIKE queries will use GIN index scans instead of sequential scans.
-- PostgreSQL automatically uses trigram GIN indexes for ILIKE when available.

-- ============================================================================
-- Step 1: Enable pg_trgm extension
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================================
-- Step 2: GIN trigram indexes for ILIKE pattern matching
-- ============================================================================
-- These indexes accelerate: column ILIKE '%term%' (contains with leading wildcard)
-- PostgreSQL's query planner automatically selects these for ILIKE operations.

-- Primary search fallback: keyword search across name, description, brand
-- search-service.ts buildWhereClause(): { name: { contains: keyword, mode: 'insensitive' } }
-- NOTE: Not using CONCURRENTLY because Prisma runs migrations in a transaction.
-- For a pre-launch dataset this is fine. For large production tables, split into
-- a separate non-transactional script using CONCURRENTLY.

CREATE INDEX IF NOT EXISTS products_name_trgm_idx
  ON products USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS products_description_trgm_idx
  ON products USING gin (description gin_trgm_ops);

CREATE INDEX IF NOT EXISTS products_brand_trgm_idx
  ON products USING gin (brand gin_trgm_ops);

-- Caliber filter: used in both standard and vector search paths
-- search-service.ts: { caliberNorm: { contains: cal, mode: 'insensitive' } }
-- vector path: "caliberNorm" ILIKE ANY($N)
CREATE INDEX IF NOT EXISTS products_calibernorm_trgm_idx
  ON products USING gin ("caliberNorm" gin_trgm_ops);

-- Explicit filter paths (less frequent but still sequential-scanning)
-- Purpose: { purpose: { contains: purpose, mode: 'insensitive' } }
CREATE INDEX IF NOT EXISTS products_purpose_trgm_idx
  ON products USING gin (purpose gin_trgm_ops);

-- Case material: { caseMaterial: { contains: caseMaterial, mode: 'insensitive' } }
CREATE INDEX IF NOT EXISTS products_casematerial_trgm_idx
  ON products USING gin ("caseMaterial" gin_trgm_ops);

-- ============================================================================
-- Step 3: Generated tsvector column + GIN full-text search index
-- ============================================================================
-- This enables future migration from ILIKE to ts_query/ts_rank for
-- ranked full-text search. The column auto-updates on INSERT/UPDATE.
--
-- Weight mapping:
--   A (highest): name — most important for product identity
--   B: brand — important for filtering, secondary to name
--   C: caliber — structured but sometimes searched as text
--   D (lowest): description — supplementary info

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(brand, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(caliber, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'D')
  ) STORED;

CREATE INDEX IF NOT EXISTS products_search_vector_idx
  ON products USING gin (search_vector);

-- ============================================================================
-- Step 4: Drop redundant B-tree indexes on text columns
-- ============================================================================
-- B-tree indexes on name, description, brand, purpose are useless for
-- ILIKE '%term%' queries. They only help exact match or prefix matching.
-- The trigram GIN indexes above fully replace them for search use cases.
-- Keeping caliber B-tree since it's used for exact/prefix lookups too.
--
-- NOTE: Prisma manages these via @@index in schema.prisma. We drop them here
-- and must also remove the corresponding @@index directives from schema.prisma
-- to prevent Prisma from recreating them.

DROP INDEX IF EXISTS "products_name_idx";
DROP INDEX IF EXISTS "products_description_idx";
DROP INDEX IF EXISTS "products_purpose_idx";
