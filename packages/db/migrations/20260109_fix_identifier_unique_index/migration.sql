-- Migration: Fix source_product_identifiers unique index for ON CONFLICT
-- Purpose: Replace COALESCE-based unique index with regular column index
-- Reason: ON CONFLICT clause cannot reference expression-based unique indexes
--
-- This migration:
-- 1. Ensures all NULL namespaces are converted to empty string
-- 2. Drops the COALESCE-based unique index
-- 3. Creates a regular unique index on the 4 columns
-- 4. Adds NOT NULL constraint with default '' to prevent future NULLs

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 1: Convert any remaining NULL namespaces to empty string
-- ═══════════════════════════════════════════════════════════════════════════════
UPDATE source_product_identifiers
SET namespace = ''
WHERE namespace IS NULL;

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 2: Drop COALESCE-based indexes (expression indexes)
-- ═══════════════════════════════════════════════════════════════════════════════
DROP INDEX IF EXISTS source_product_identifiers_unique;
DROP INDEX IF EXISTS source_product_identifiers_lookup;

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 3: Set default and NOT NULL on namespace column
-- This prevents NULLs from ever being inserted again
-- ═══════════════════════════════════════════════════════════════════════════════
ALTER TABLE source_product_identifiers
  ALTER COLUMN namespace SET DEFAULT '';

ALTER TABLE source_product_identifiers
  ALTER COLUMN namespace SET NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 4: Create regular unique index (no COALESCE)
-- This allows ON CONFLICT ("sourceProductId", "idType", "idValue", "namespace")
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE UNIQUE INDEX source_product_identifiers_unique
  ON source_product_identifiers ("sourceProductId", "idType", "idValue", "namespace");

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 5: Recreate lookup index (regular, no COALESCE)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE INDEX source_product_identifiers_lookup
  ON source_product_identifiers ("idType", "idValue", "namespace");

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 6: Verify
-- ═══════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_count
  FROM source_product_identifiers
  WHERE namespace IS NULL;

  IF null_count > 0 THEN
    RAISE EXCEPTION 'Migration failed: % rows still have NULL namespace', null_count;
  END IF;

  RAISE NOTICE 'Migration complete: namespace column is now NOT NULL with empty string default';
END$$;

SELECT 'Migration 20260109_fix_identifier_unique_index completed successfully' as status;
