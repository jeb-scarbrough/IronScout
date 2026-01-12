-- Fix click_events table: rename dealerId to merchantId and dealerSkuId to merchantSkuId

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'click_events' AND column_name = 'dealerId') THEN
    ALTER TABLE "click_events" RENAME COLUMN "dealerId" TO "merchantId";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'click_events' AND column_name = 'dealerSkuId') THEN
    ALTER TABLE "click_events" RENAME COLUMN "dealerSkuId" TO "merchantSkuId";
  END IF;
END $$;

-- Fix indexes
DROP INDEX IF EXISTS "click_events_dealerId_idx";
DROP INDEX IF EXISTS "click_events_dealerSkuId_idx";

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'click_events') THEN
    CREATE INDEX IF NOT EXISTS "click_events_merchantId_idx" ON "click_events"("merchantId");
    CREATE INDEX IF NOT EXISTS "click_events_merchantSkuId_idx" ON "click_events"("merchantSkuId");
  END IF;
END $$;

-- Fix foreign key
ALTER TABLE "click_events" DROP CONSTRAINT IF EXISTS "click_events_dealerId_fkey";

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'click_events') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'click_events_merchantId_fkey') THEN
      ALTER TABLE "click_events" ADD CONSTRAINT "click_events_merchantId_fkey"
        FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END IF;
END $$;
