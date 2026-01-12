-- Migration: Product Resolver v1.2 Schema
-- Purpose: Add tables and fields for the Product Resolver (Spec v1.2)
--
-- New tables:
--   - product_links: Control plane for identity decisions
--   - product_aliases: Merge backstop for canonical products
--   - source_trust_config: Per-source trust configuration
--
-- New enums:
--   - ProductLinkMatchType
--   - ProductLinkStatus
--   - ProductLinkReasonCode
--
-- New fields on existing tables:
--   - products: canonicalKey, upcNorm, brandNorm, caliberNorm, specs
--   - source_products: normalizedHash

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 1: Create enums (safe for re-runs)
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProductLinkMatchType') THEN
    CREATE TYPE "ProductLinkMatchType" AS ENUM ('UPC', 'FINGERPRINT', 'MANUAL', 'NONE', 'ERROR');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProductLinkStatus') THEN
    CREATE TYPE "ProductLinkStatus" AS ENUM ('MATCHED', 'CREATED', 'UNMATCHED', 'ERROR');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProductLinkReasonCode') THEN
    CREATE TYPE "ProductLinkReasonCode" AS ENUM (
      'INSUFFICIENT_DATA',
      'INVALID_UPC',
      'UPC_NOT_TRUSTED',
      'AMBIGUOUS_FINGERPRINT',
      'CONFLICTING_IDENTIFIERS',
      'MANUAL_LOCKED',
      'RELINK_BLOCKED_HYSTERESIS',
      'SYSTEM_ERROR',
      'NORMALIZATION_FAILED'
    );
  END IF;
END$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 2: Add new columns to products table
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "canonicalKey" TEXT;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "upcNorm" TEXT;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "brandNorm" TEXT;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "caliberNorm" TEXT;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "specs" JSONB;

-- Add unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS "products_canonicalKey_key" ON "products"("canonicalKey");
CREATE UNIQUE INDEX IF NOT EXISTS "products_upcNorm_key" ON "products"("upcNorm");

-- Add index for fingerprint lookups
CREATE INDEX IF NOT EXISTS "products_brandNorm_caliberNorm_idx" ON "products"("brandNorm", "caliberNorm");

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 3: Add normalizedHash to source_products
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE "source_products" ADD COLUMN IF NOT EXISTS "normalizedHash" TEXT;
CREATE INDEX IF NOT EXISTS "source_products_normalizedHash_idx" ON "source_products"("normalizedHash");

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 4: Create product_links table
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "product_links" (
  "id" TEXT NOT NULL,
  "sourceProductId" TEXT NOT NULL,
  "productId" TEXT,
  "matchType" "ProductLinkMatchType" NOT NULL,
  "status" "ProductLinkStatus" NOT NULL,
  "reasonCode" "ProductLinkReasonCode",
  "confidence" DECIMAL(5,4) NOT NULL,
  "resolverVersion" TEXT NOT NULL,
  "evidence" JSONB NOT NULL,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "product_links_pkey" PRIMARY KEY ("id")
);

-- Unique constraint on sourceProductId
CREATE UNIQUE INDEX IF NOT EXISTS "product_links_sourceProductId_key" ON "product_links"("sourceProductId");

-- Foreign keys (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_links_sourceProductId_fkey') THEN
    ALTER TABLE "product_links"
      ADD CONSTRAINT "product_links_sourceProductId_fkey"
      FOREIGN KEY ("sourceProductId") REFERENCES "source_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_links_productId_fkey') THEN
    ALTER TABLE "product_links"
      ADD CONSTRAINT "product_links_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS "product_links_productId_idx" ON "product_links"("productId");
CREATE INDEX IF NOT EXISTS "product_links_status_idx" ON "product_links"("status");
CREATE INDEX IF NOT EXISTS "product_links_matchType_idx" ON "product_links"("matchType");
CREATE INDEX IF NOT EXISTS "product_links_resolverVersion_idx" ON "product_links"("resolverVersion");
CREATE INDEX IF NOT EXISTS "product_links_resolvedAt_idx" ON "product_links"("resolvedAt");

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 5: Create product_aliases table
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "product_aliases" (
  "id" TEXT NOT NULL,
  "fromProductId" TEXT NOT NULL,
  "toProductId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy" TEXT,

  CONSTRAINT "product_aliases_pkey" PRIMARY KEY ("id")
);

-- Unique constraint on fromProductId (product can only be aliased once)
CREATE UNIQUE INDEX IF NOT EXISTS "product_aliases_fromProductId_key" ON "product_aliases"("fromProductId");

-- Foreign keys with RESTRICT to prevent accidental deletion (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_aliases_fromProductId_fkey') THEN
    ALTER TABLE "product_aliases"
      ADD CONSTRAINT "product_aliases_fromProductId_fkey"
      FOREIGN KEY ("fromProductId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_aliases_toProductId_fkey') THEN
    ALTER TABLE "product_aliases"
      ADD CONSTRAINT "product_aliases_toProductId_fkey"
      FOREIGN KEY ("toProductId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END$$;

-- Index for reverse lookups
CREATE INDEX IF NOT EXISTS "product_aliases_toProductId_idx" ON "product_aliases"("toProductId");

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 6: Create source_trust_config table
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "source_trust_config" (
  "id" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "upcTrusted" BOOLEAN NOT NULL DEFAULT false,
  "version" INTEGER NOT NULL DEFAULT 1,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "updatedBy" TEXT,

  CONSTRAINT "source_trust_config_pkey" PRIMARY KEY ("id")
);

-- Unique constraint on sourceId
CREATE UNIQUE INDEX IF NOT EXISTS "source_trust_config_sourceId_key" ON "source_trust_config"("sourceId");

-- Foreign key (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'source_trust_config_sourceId_fkey') THEN
    ALTER TABLE "source_trust_config"
      ADD CONSTRAINT "source_trust_config_sourceId_fkey"
      FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 7: Verify migration
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  -- Verify enums exist
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProductLinkMatchType') THEN
    RAISE EXCEPTION 'Migration failed: ProductLinkMatchType enum does not exist';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProductLinkStatus') THEN
    RAISE EXCEPTION 'Migration failed: ProductLinkStatus enum does not exist';
  END IF;

  -- Verify tables exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'product_links') THEN
    RAISE EXCEPTION 'Migration failed: product_links table does not exist';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'product_aliases') THEN
    RAISE EXCEPTION 'Migration failed: product_aliases table does not exist';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'source_trust_config') THEN
    RAISE EXCEPTION 'Migration failed: source_trust_config table does not exist';
  END IF;

  RAISE NOTICE 'Migration 20260106_product_resolver_v12 completed successfully';
END$$;

SELECT 'Migration 20260106_product_resolver_v12 completed successfully' as status;
