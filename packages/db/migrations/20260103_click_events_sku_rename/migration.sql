-- Rename merchantSkuId to retailerSkuId in click_events
-- (missed in previous migration)

ALTER TABLE "click_events" RENAME COLUMN "merchantSkuId" TO "retailerSkuId";

DROP INDEX IF EXISTS "click_events_merchantSkuId_idx";
CREATE INDEX IF NOT EXISTS "click_events_retailerSkuId_idx" ON "click_events"("retailerSkuId");
