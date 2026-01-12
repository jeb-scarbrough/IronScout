-- Migration: Add missing contentHash column to retailer_skus
-- Purpose: Hash of mutable fields (price, stock) for change detection during feed processing

ALTER TABLE "retailer_skus" ADD COLUMN IF NOT EXISTS "contentHash" TEXT;

-- Verify the migration
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'retailer_skus' AND column_name = 'contentHash'
  ) THEN
    RAISE EXCEPTION 'Migration failed: contentHash column does not exist on retailer_skus';
  END IF;
  RAISE NOTICE 'Migration 20260111_fix_missing_columns completed successfully';
END$$;

SELECT 'Migration 20260111_fix_missing_columns completed successfully' as status;
