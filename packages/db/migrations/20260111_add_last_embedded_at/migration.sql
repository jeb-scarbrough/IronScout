-- Migration: Add lastEmbeddedAt column to products table
-- Purpose: Track when embeddings were last generated for staleness detection

ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "lastEmbeddedAt" TIMESTAMP(3);

-- Verify the migration
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'lastEmbeddedAt'
  ) THEN
    RAISE EXCEPTION 'Migration failed: lastEmbeddedAt column does not exist';
  END IF;
  RAISE NOTICE 'Migration 20260111_add_last_embedded_at completed successfully';
END$$;

SELECT 'Migration 20260111_add_last_embedded_at completed successfully' as status;
