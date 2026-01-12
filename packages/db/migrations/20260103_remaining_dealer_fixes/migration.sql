-- Fix remaining dealer column names in merchant_insights and other tables

-- merchant_insights: dealerSkuId -> merchantSkuId, dealerPrice -> merchantPrice
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'merchant_insights' AND column_name = 'dealerSkuId') THEN
    ALTER TABLE "merchant_insights" RENAME COLUMN "dealerSkuId" TO "merchantSkuId";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'merchant_insights' AND column_name = 'dealerPrice') THEN
    ALTER TABLE "merchant_insights" RENAME COLUMN "dealerPrice" TO "merchantPrice";
  END IF;
END $$;

-- Fix foreign key for merchant_insights
ALTER TABLE "merchant_insights" DROP CONSTRAINT IF EXISTS "dealer_insights_dealerSkuId_fkey";
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'merchant_insights') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'merchant_insights_merchantSkuId_fkey') THEN
      ALTER TABLE "merchant_insights" ADD CONSTRAINT "merchant_insights_merchantSkuId_fkey"
        FOREIGN KEY ("merchantSkuId") REFERENCES "merchant_skus"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  END IF;
END $$;

-- Check and fix any remaining dealerId columns in other tables
-- source_product_presence
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'source_product_presence' AND column_name = 'dealerId') THEN
    ALTER TABLE "source_product_presence" RENAME COLUMN "dealerId" TO "merchantId";
  END IF;
END $$;

-- source_product_seen
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'source_product_seen' AND column_name = 'dealerId') THEN
    ALTER TABLE "source_product_seen" RENAME COLUMN "dealerId" TO "merchantId";
  END IF;
END $$;

-- source_products
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'source_products' AND column_name = 'dealerId') THEN
    ALTER TABLE "source_products" RENAME COLUMN "dealerId" TO "merchantId";
  END IF;
END $$;
