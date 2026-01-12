-- Migration: Add source_product_identifiers table
-- Purpose: Normalize product identifiers into a child table
-- Safe for production: additive changes only, backward compatible

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 1: Create new IdentifierType enum
-- ═══════════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'IdentifierType') THEN
    CREATE TYPE "IdentifierType" AS ENUM (
      'SKU',
      'UPC',
      'EAN',
      'GTIN',
      'MPN',
      'ASIN',
      'URL',
      'URL_HASH',
      'NETWORK_ITEM_ID',
      'MERCHANT_SKU',
      'INTERNAL_ID'
    );
  END IF;
END$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 2: Add new columns to source_products (if not exist)
-- ═══════════════════════════════════════════════════════════════════════════════
ALTER TABLE source_products ADD COLUMN IF NOT EXISTS brand TEXT;
ALTER TABLE source_products ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE source_products ADD COLUMN IF NOT EXISTS category TEXT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 3: Create source_product_identifiers table
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS source_product_identifiers (
  id TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "sourceProductId" TEXT NOT NULL,
  "idType" "IdentifierType" NOT NULL,
  "idValue" TEXT NOT NULL,
  namespace TEXT,
  "isCanonical" BOOLEAN NOT NULL DEFAULT false,
  "normalizedValue" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT source_product_identifiers_pkey PRIMARY KEY (id)
);

-- Foreign key to source_products
ALTER TABLE source_product_identifiers
  DROP CONSTRAINT IF EXISTS source_product_identifiers_sourceProductId_fkey;
ALTER TABLE source_product_identifiers
  ADD CONSTRAINT source_product_identifiers_sourceProductId_fkey
  FOREIGN KEY ("sourceProductId") REFERENCES source_products(id) ON DELETE CASCADE;

-- Unique constraint: same identifier can't appear twice for same product
CREATE UNIQUE INDEX IF NOT EXISTS source_product_identifiers_unique
  ON source_product_identifiers ("sourceProductId", "idType", "idValue", namespace);

-- Fast lookup by identifier (for find-by-any-identifier upsert)
CREATE INDEX IF NOT EXISTS source_product_identifiers_lookup
  ON source_product_identifiers ("idType", "idValue", namespace);

-- Find canonical identifier for a product
CREATE INDEX IF NOT EXISTS source_product_identifiers_canonical
  ON source_product_identifiers ("sourceProductId", "isCanonical");

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 4: Backfill identifiers from existing source_products columns
-- This creates identifier rows from the existing denormalized columns.
-- ═══════════════════════════════════════════════════════════════════════════════

-- 4a: Insert canonical identifiers from identityType/identityValue
-- These are marked isCanonical=true since they were the "winner" identity
INSERT INTO source_product_identifiers (id, "sourceProductId", "idType", "idValue", namespace, "isCanonical", "normalizedValue", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  sp.id,
  CASE sp."identityType"
    WHEN 'IMPACT_ITEM_ID' THEN 'NETWORK_ITEM_ID'::"IdentifierType"
    WHEN 'SKU' THEN 'SKU'::"IdentifierType"
    WHEN 'URL_HASH' THEN 'URL_HASH'::"IdentifierType"
  END,
  sp."identityValue",
  CASE sp."identityType"
    WHEN 'IMPACT_ITEM_ID' THEN 'IMPACT'  -- Network namespace
    ELSE NULL
  END,
  true,  -- isCanonical
  UPPER(TRIM(sp."identityValue")),
  sp."createdAt",
  sp."updatedAt"
FROM source_products sp
WHERE sp."identityType" IS NOT NULL
  AND sp."identityValue" IS NOT NULL
  AND sp."identityValue" != ''
ON CONFLICT ("sourceProductId", "idType", "idValue", namespace) DO NOTHING;

-- 4b: Insert SKU identifiers (if not already canonical)
INSERT INTO source_product_identifiers (id, "sourceProductId", "idType", "idValue", namespace, "isCanonical", "normalizedValue", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  sp.id,
  'SKU'::"IdentifierType",
  sp.sku,
  NULL,
  (sp."identityType" = 'SKU'),  -- canonical if SKU was the winner
  UPPER(TRIM(sp.sku)),
  sp."createdAt",
  sp."updatedAt"
FROM source_products sp
WHERE sp.sku IS NOT NULL
  AND sp.sku != ''
  AND NOT (sp."identityType" = 'SKU' AND sp."identityValue" = sp.sku)  -- Avoid duplicating canonical
ON CONFLICT ("sourceProductId", "idType", "idValue", namespace) DO NOTHING;

-- 4c: Insert UPC identifiers
INSERT INTO source_product_identifiers (id, "sourceProductId", "idType", "idValue", namespace, "isCanonical", "normalizedValue", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  sp.id,
  'UPC'::"IdentifierType",
  sp.upc,
  NULL,
  false,  -- UPC is never canonical in current system
  REGEXP_REPLACE(sp.upc, '^0+', ''),  -- Normalize: strip leading zeros
  sp."createdAt",
  sp."updatedAt"
FROM source_products sp
WHERE sp.upc IS NOT NULL
  AND sp.upc != ''
ON CONFLICT ("sourceProductId", "idType", "idValue", namespace) DO NOTHING;

-- 4d: Insert URL_HASH identifiers (if not already canonical)
INSERT INTO source_product_identifiers (id, "sourceProductId", "idType", "idValue", namespace, "isCanonical", "normalizedValue", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  sp.id,
  'URL_HASH'::"IdentifierType",
  sp."urlHash",
  NULL,
  (sp."identityType" = 'URL_HASH'),  -- canonical if URL_HASH was the winner
  sp."urlHash",
  sp."createdAt",
  sp."updatedAt"
FROM source_products sp
WHERE sp."urlHash" IS NOT NULL
  AND sp."urlHash" != ''
  AND NOT (sp."identityType" = 'URL_HASH' AND sp."identityValue" = sp."urlHash")  -- Avoid duplicating canonical
ON CONFLICT ("sourceProductId", "idType", "idValue", namespace) DO NOTHING;

-- 4e: Insert NETWORK_ITEM_ID for Impact (if not already canonical)
INSERT INTO source_product_identifiers (id, "sourceProductId", "idType", "idValue", namespace, "isCanonical", "normalizedValue", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  sp.id,
  'NETWORK_ITEM_ID'::"IdentifierType",
  sp."impactItemId",
  'IMPACT',
  (sp."identityType" = 'IMPACT_ITEM_ID'),  -- canonical if IMPACT was the winner
  TRIM(sp."impactItemId"),
  sp."createdAt",
  sp."updatedAt"
FROM source_products sp
WHERE sp."impactItemId" IS NOT NULL
  AND sp."impactItemId" != ''
  AND NOT (sp."identityType" = 'IMPACT_ITEM_ID' AND sp."identityValue" = sp."impactItemId")  -- Avoid duplicating canonical
ON CONFLICT ("sourceProductId", "idType", "idValue", namespace) DO NOTHING;

-- 4f: Insert URL identifiers (product URLs)
INSERT INTO source_product_identifiers (id, "sourceProductId", "idType", "idValue", namespace, "isCanonical", "normalizedValue", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  sp.id,
  'URL'::"IdentifierType",
  sp.url,
  NULL,
  false,  -- URL is never canonical
  sp."normalizedUrl",
  sp."createdAt",
  sp."updatedAt"
FROM source_products sp
WHERE sp.url IS NOT NULL
  AND sp.url != ''
ON CONFLICT ("sourceProductId", "idType", "idValue", namespace) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 5: Verify migration
-- ═══════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  sp_count INTEGER;
  id_count INTEGER;
  canonical_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO sp_count FROM source_products;
  SELECT COUNT(*) INTO id_count FROM source_product_identifiers;
  SELECT COUNT(*) INTO canonical_count FROM source_product_identifiers WHERE "isCanonical" = true;

  RAISE NOTICE 'Migration complete:';
  RAISE NOTICE '  source_products: % rows', sp_count;
  RAISE NOTICE '  source_product_identifiers: % rows', id_count;
  RAISE NOTICE '  canonical identifiers: % rows', canonical_count;

  -- Verify every source_product has at least one canonical identifier
  IF canonical_count < sp_count THEN
    RAISE WARNING 'Some source_products may be missing canonical identifiers: % vs %', canonical_count, sp_count;
  END IF;
END$$;

SELECT 'Migration 20260106_source_product_identifiers completed successfully' as status;
