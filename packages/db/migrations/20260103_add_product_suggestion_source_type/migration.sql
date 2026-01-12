-- CreateEnum
CREATE TYPE "ProductSuggestionSourceType" AS ENUM ('MERCHANT', 'AFFILIATE', 'INTERNAL');

-- AlterTable product_suggestions
-- Add new columns for multi-source support
ALTER TABLE "product_suggestions" ADD COLUMN IF NOT EXISTS "sourceType" "ProductSuggestionSourceType" NOT NULL DEFAULT 'MERCHANT';
ALTER TABLE "product_suggestions" ADD COLUMN IF NOT EXISTS "affiliateFeedId" TEXT;
ALTER TABLE "product_suggestions" ADD COLUMN IF NOT EXISTS "sourceName" TEXT;

-- Make merchantId nullable (existing data already has values, so this is safe)
ALTER TABLE "product_suggestions" ALTER COLUMN "merchantId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "product_suggestions_affiliateFeedId_idx" ON "product_suggestions"("affiliateFeedId");
CREATE INDEX IF NOT EXISTS "product_suggestions_sourceType_idx" ON "product_suggestions"("sourceType");

-- AddForeignKey
ALTER TABLE "product_suggestions"
ADD CONSTRAINT "product_suggestions_affiliateFeedId_fkey"
FOREIGN KEY ("affiliateFeedId") REFERENCES "affiliate_feeds"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
