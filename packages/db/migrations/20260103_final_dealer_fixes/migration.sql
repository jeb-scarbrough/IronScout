-- Final dealer to merchant column renames

-- feed_corrections: dealerId -> merchantId
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'feed_corrections' AND column_name = 'dealerId') THEN
    ALTER TABLE "feed_corrections" RENAME COLUMN "dealerId" TO "merchantId";
  END IF;
END $$;

-- merchant_skus: dealerSkuHash -> merchantSkuHash (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'merchant_skus' AND column_name = 'dealerSkuHash') THEN
    ALTER TABLE "merchant_skus" RENAME COLUMN "dealerSkuHash" TO "merchantSkuHash";
  END IF;
END $$;

-- pixel_events: dealerId -> merchantId
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pixel_events' AND column_name = 'dealerId') THEN
    ALTER TABLE "pixel_events" RENAME COLUMN "dealerId" TO "merchantId";
  END IF;
END $$;

-- prices: dealerId -> merchantId (if it has dealerId, not merchantId)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prices' AND column_name = 'dealerId') THEN
    ALTER TABLE "prices" RENAME COLUMN "dealerId" TO "merchantId";
  END IF;
END $$;

-- product_suggestions: dealerId -> merchantId, dealerSkuId -> merchantSkuId
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_suggestions' AND column_name = 'dealerId') THEN
    ALTER TABLE "product_suggestions" RENAME COLUMN "dealerId" TO "merchantId";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_suggestions' AND column_name = 'dealerSkuId') THEN
    ALTER TABLE "product_suggestions" RENAME COLUMN "dealerSkuId" TO "merchantSkuId";
  END IF;
END $$;

-- quarantined_records: dealerId -> merchantId
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quarantined_records' AND column_name = 'dealerId') THEN
    ALTER TABLE "quarantined_records" RENAME COLUMN "dealerId" TO "merchantId";
  END IF;
END $$;

-- Drop old dealer indexes and create merchant indexes

-- feed_corrections
DROP INDEX IF EXISTS "feed_corrections_dealerId_idx";
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'feed_corrections') THEN
    CREATE INDEX IF NOT EXISTS "feed_corrections_merchantId_idx" ON "feed_corrections"("merchantId");
  END IF;
END $$;

-- pixel_events
DROP INDEX IF EXISTS "pixel_events_dealerId_idx";
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pixel_events') THEN
    CREATE INDEX IF NOT EXISTS "pixel_events_merchantId_idx" ON "pixel_events"("merchantId");
  END IF;
END $$;

-- prices - only rename if dealerId exists
DROP INDEX IF EXISTS "prices_dealerId_idx";
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prices' AND column_name = 'merchantId') THEN
    CREATE INDEX IF NOT EXISTS "prices_merchantId_idx" ON "prices"("merchantId");
  END IF;
END $$;

-- product_suggestions
DROP INDEX IF EXISTS "product_suggestions_dealerId_idx";
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'product_suggestions') THEN
    CREATE INDEX IF NOT EXISTS "product_suggestions_merchantId_idx" ON "product_suggestions"("merchantId");
  END IF;
END $$;

-- quarantined_records
DROP INDEX IF EXISTS "quarantined_records_dealerId_idx";
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'quarantined_records') THEN
    CREATE INDEX IF NOT EXISTS "quarantined_records_merchantId_idx" ON "quarantined_records"("merchantId");
  END IF;
END $$;

-- Fix foreign keys
ALTER TABLE "pixel_events" DROP CONSTRAINT IF EXISTS "pixel_events_dealerId_fkey";
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pixel_events') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'pixel_events_merchantId_fkey') THEN
      ALTER TABLE "pixel_events" ADD CONSTRAINT "pixel_events_merchantId_fkey"
        FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END IF;
END $$;

ALTER TABLE "product_suggestions" DROP CONSTRAINT IF EXISTS "product_suggestions_dealerId_fkey";
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'product_suggestions') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'product_suggestions_merchantId_fkey') THEN
      ALTER TABLE "product_suggestions" ADD CONSTRAINT "product_suggestions_merchantId_fkey"
        FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END IF;
END $$;

ALTER TABLE "product_suggestions" DROP CONSTRAINT IF EXISTS "product_suggestions_dealerSkuId_fkey";
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'product_suggestions') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'product_suggestions_merchantSkuId_fkey') THEN
      ALTER TABLE "product_suggestions" ADD CONSTRAINT "product_suggestions_merchantSkuId_fkey"
        FOREIGN KEY ("merchantSkuId") REFERENCES "merchant_skus"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  END IF;
END $$;
