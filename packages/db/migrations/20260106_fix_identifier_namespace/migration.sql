-- Migration: Fix source_product_identifiers namespace handling
-- Purpose: Convert NULL namespaces to empty string and recreate unique index with COALESCE

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 1: Convert NULL namespaces to empty string
-- ═══════════════════════════════════════════════════════════════════════════════
UPDATE source_product_identifiers
SET namespace = ''
WHERE namespace IS NULL;

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 2: Drop old unique index and recreate with COALESCE for future-proofing
-- This ensures the constraint works even if NULLs slip through somehow
-- ═══════════════════════════════════════════════════════════════════════════════
DROP INDEX IF EXISTS source_product_identifiers_unique;

CREATE UNIQUE INDEX source_product_identifiers_unique
  ON source_product_identifiers ("sourceProductId", "idType", "idValue", COALESCE(namespace, ''));

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 3: Update lookup index to also use COALESCE
-- ═══════════════════════════════════════════════════════════════════════════════
DROP INDEX IF EXISTS source_product_identifiers_lookup;

CREATE INDEX source_product_identifiers_lookup
  ON source_product_identifiers ("idType", "idValue", COALESCE(namespace, ''));

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 4: Verify
-- ═══════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_count FROM source_product_identifiers WHERE namespace IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'Migration failed: % rows still have NULL namespace', null_count;
  END IF;
  RAISE NOTICE 'Migration complete: All namespaces are now non-NULL';
END$$;

SELECT 'Migration 20260106_fix_identifier_namespace completed successfully' as status;
