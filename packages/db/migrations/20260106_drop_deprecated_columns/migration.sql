-- Migration: Drop deprecated source_products columns
-- Purpose: Remove old identity columns now replaced by source_product_identifiers table
-- Safe: Data has been migrated to source_product_identifiers in previous migration

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 1: Drop indexes that reference deprecated columns
-- ═══════════════════════════════════════════════════════════════════════════════
DROP INDEX IF EXISTS source_products_sourceId_identityType_identityValue_key;
DROP INDEX IF EXISTS source_products_impactItemId_idx;
DROP INDEX IF EXISTS source_products_sku_idx;
DROP INDEX IF EXISTS source_products_upc_idx;

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 2: Drop deprecated columns from source_products
-- ═══════════════════════════════════════════════════════════════════════════════
ALTER TABLE source_products DROP COLUMN IF EXISTS "identityType";
ALTER TABLE source_products DROP COLUMN IF EXISTS "identityValue";
ALTER TABLE source_products DROP COLUMN IF EXISTS "sku";
ALTER TABLE source_products DROP COLUMN IF EXISTS "upc";
ALTER TABLE source_products DROP COLUMN IF EXISTS "urlHash";
ALTER TABLE source_products DROP COLUMN IF EXISTS "impactItemId";

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 3: Drop deprecated enum type
-- ═══════════════════════════════════════════════════════════════════════════════
DROP TYPE IF EXISTS "SourceProductIdentityType";

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 4: Verify migration
-- ═══════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  col_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO col_count
  FROM information_schema.columns
  WHERE table_name = 'source_products'
    AND column_name IN ('identityType', 'identityValue', 'sku', 'upc', 'urlHash', 'impactItemId');

  IF col_count > 0 THEN
    RAISE EXCEPTION 'Migration failed: % deprecated columns still exist', col_count;
  END IF;

  RAISE NOTICE 'Migration complete: All deprecated columns dropped from source_products';
END$$;

SELECT 'Migration 20260106_drop_deprecated_columns completed successfully' as status;
