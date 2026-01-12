-- CreateEnum
CREATE TYPE "ProductSuggestionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'MERGED');

-- CreateTable
CREATE TABLE "product_suggestions" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "dealerSkuId" TEXT,
    "status" "ProductSuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "suggestedName" TEXT NOT NULL,
    "suggestedUpc" TEXT,
    "caliber" TEXT NOT NULL,
    "grain" INTEGER,
    "packSize" INTEGER,
    "brand" TEXT,
    "bulletType" TEXT,
    "caseType" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "rejectionNote" TEXT,
    "canonicalSkuId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_suggestions_dealerId_idx" ON "product_suggestions"("dealerId");

-- CreateIndex
CREATE INDEX "product_suggestions_status_idx" ON "product_suggestions"("status");

-- CreateIndex
CREATE INDEX "product_suggestions_createdAt_idx" ON "product_suggestions"("createdAt");

-- AddForeignKey: Only add if referenced tables exist (may not exist in shadow database)
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'dealers') THEN
        ALTER TABLE "product_suggestions" ADD CONSTRAINT "product_suggestions_dealerId_fkey"
        FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'dealer_skus') THEN
        ALTER TABLE "product_suggestions" ADD CONSTRAINT "product_suggestions_dealerSkuId_fkey"
        FOREIGN KEY ("dealerSkuId") REFERENCES "dealer_skus"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'canonical_skus') THEN
        ALTER TABLE "product_suggestions" ADD CONSTRAINT "product_suggestions_canonicalSkuId_fkey"
        FOREIGN KEY ("canonicalSkuId") REFERENCES "canonical_skus"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
