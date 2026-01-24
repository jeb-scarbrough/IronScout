-- ADR-004: Add promotional metadata fields to prices table
-- These fields persist sale/promo context at ingestion time

-- Add PriceType enum if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PriceType') THEN
        CREATE TYPE "PriceType" AS ENUM ('REGULAR', 'SALE', 'CLEARANCE');
    END IF;
END$$;

-- Add promotional metadata columns to prices table
ALTER TABLE prices
ADD COLUMN IF NOT EXISTS "originalPrice" DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS "priceType" "PriceType",
ADD COLUMN IF NOT EXISTS "saleStartsAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "saleEndsAt" TIMESTAMP(3);

-- Comments for documentation
COMMENT ON COLUMN prices."originalPrice" IS 'MSRP or compare-at price when feed provides it';
COMMENT ON COLUMN prices."priceType" IS 'Pricing context: REGULAR, SALE, or CLEARANCE (null if unknown)';
COMMENT ON COLUMN prices."saleStartsAt" IS 'Sale window start (informational only, not enforced)';
COMMENT ON COLUMN prices."saleEndsAt" IS 'Sale window end (informational only, not enforced)';
