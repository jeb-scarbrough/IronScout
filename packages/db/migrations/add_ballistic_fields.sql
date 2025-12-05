-- Migration: Add ballistic performance fields for Premium features
-- Run this migration after updating the Prisma schema

-- Create new enums
CREATE TYPE "BulletType" AS ENUM (
  'JHP', 'HP', 'BJHP', 'XTP', 'HST', 'GDHP', 'VMAX',
  'FMJ', 'TMJ', 'CMJ', 'MC', 'BALL',
  'SP', 'JSP', 'PSP', 'RN', 'FPRN',
  'FRANGIBLE', 'AP', 'TRACER', 'BLANK', 'WADCUTTER', 'SWC', 'LSWC',
  'BUCKSHOT', 'BIRDSHOT', 'SLUG',
  'OTHER'
);

CREATE TYPE "PressureRating" AS ENUM (
  'STANDARD', 'PLUS_P', 'PLUS_P_PLUS', 'NATO', 'UNKNOWN'
);

CREATE TYPE "DataSource" AS ENUM (
  'MANUFACTURER', 'RETAILER_FEED', 'PARSED', 'MANUAL', 'AI_INFERRED', 'UNKNOWN'
);

-- Add new columns to products table
ALTER TABLE "products" ADD COLUMN "bulletType" "BulletType";
ALTER TABLE "products" ADD COLUMN "pressureRating" "PressureRating" DEFAULT 'STANDARD';
ALTER TABLE "products" ADD COLUMN "muzzleVelocityFps" INTEGER;
ALTER TABLE "products" ADD COLUMN "barrelLengthReference" DECIMAL(4,2);
ALTER TABLE "products" ADD COLUMN "isSubsonic" BOOLEAN;
ALTER TABLE "products" ADD COLUMN "shortBarrelOptimized" BOOLEAN;
ALTER TABLE "products" ADD COLUMN "suppressorSafe" BOOLEAN;
ALTER TABLE "products" ADD COLUMN "lowFlash" BOOLEAN;
ALTER TABLE "products" ADD COLUMN "lowRecoil" BOOLEAN;
ALTER TABLE "products" ADD COLUMN "controlledExpansion" BOOLEAN;
ALTER TABLE "products" ADD COLUMN "matchGrade" BOOLEAN;
ALTER TABLE "products" ADD COLUMN "factoryNew" BOOLEAN DEFAULT true;
ALTER TABLE "products" ADD COLUMN "dataSource" "DataSource" DEFAULT 'UNKNOWN';
ALTER TABLE "products" ADD COLUMN "dataConfidence" DECIMAL(3,2);

-- Create indexes for premium filter queries
CREATE INDEX "products_caliber_idx" ON "products"("caliber");
CREATE INDEX "products_bulletType_idx" ON "products"("bulletType");
CREATE INDEX "products_pressureRating_idx" ON "products"("pressureRating");
CREATE INDEX "products_isSubsonic_idx" ON "products"("isSubsonic");
CREATE INDEX "products_purpose_idx" ON "products"("purpose");

-- Create indexes on prices table for better query performance
CREATE INDEX IF NOT EXISTS "prices_productId_idx" ON "prices"("productId");
CREATE INDEX IF NOT EXISTS "prices_retailerId_idx" ON "prices"("retailerId");
CREATE INDEX IF NOT EXISTS "prices_inStock_idx" ON "prices"("inStock");

-- Add comments for documentation
COMMENT ON COLUMN "products"."bulletType" IS 'Bullet construction type (JHP, FMJ, etc.) - critical for purpose matching';
COMMENT ON COLUMN "products"."pressureRating" IS 'Pressure rating (+P, +P+, NATO) - affects firearm compatibility';
COMMENT ON COLUMN "products"."muzzleVelocityFps" IS 'Muzzle velocity in feet per second';
COMMENT ON COLUMN "products"."barrelLengthReference" IS 'Barrel length (inches) used for velocity measurement';
COMMENT ON COLUMN "products"."isSubsonic" IS 'Whether round is subsonic (<1125 fps) - for suppressor use';
COMMENT ON COLUMN "products"."shortBarrelOptimized" IS 'Designed for reliable performance in <4" barrels';
COMMENT ON COLUMN "products"."suppressorSafe" IS 'Safe for use with suppressors';
COMMENT ON COLUMN "products"."lowFlash" IS 'Reduced muzzle flash - good for indoor/low-light';
COMMENT ON COLUMN "products"."lowRecoil" IS 'Reduced felt recoil';
COMMENT ON COLUMN "products"."controlledExpansion" IS 'Designed to limit overpenetration';
COMMENT ON COLUMN "products"."matchGrade" IS 'Match/competition quality ammunition';
COMMENT ON COLUMN "products"."factoryNew" IS 'Factory new (not remanufactured)';
COMMENT ON COLUMN "products"."dataSource" IS 'How this product data was populated';
COMMENT ON COLUMN "products"."dataConfidence" IS 'Confidence score (0-1) in data accuracy';
