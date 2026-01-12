-- Migration: add_product_resolve_requests
-- Adds product resolution request tracking for hybrid product matching architecture
-- Per Spec: ProductMatcher handles UPC hits, Resolver handles unmatched items

-- 1. Add NEEDS_REVIEW to ProductLinkStatus enum
ALTER TYPE "ProductLinkStatus" ADD VALUE IF NOT EXISTS 'NEEDS_REVIEW' AFTER 'UNMATCHED';

-- 2. Create ProductResolveRequestStatus enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProductResolveRequestStatus') THEN
        CREATE TYPE "ProductResolveRequestStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
    END IF;
END
$$;

-- 3. Add identityKey column to source_products
ALTER TABLE "source_products" ADD COLUMN IF NOT EXISTS "identityKey" TEXT;

-- 4. Create product_resolve_requests table
CREATE TABLE IF NOT EXISTS "product_resolve_requests" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "sourceProductId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "status" "ProductResolveRequestStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "resultProductId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_resolve_requests_pkey" PRIMARY KEY ("id")
);

-- 5. Create unique constraint on idempotencyKey
CREATE UNIQUE INDEX IF NOT EXISTS "product_resolve_requests_idempotencyKey_key"
ON "product_resolve_requests"("idempotencyKey");

-- 6. Create indexes
CREATE INDEX IF NOT EXISTS "product_resolve_requests_sourceProductId_idx"
ON "product_resolve_requests"("sourceProductId");

CREATE INDEX IF NOT EXISTS "product_resolve_requests_sourceId_idx"
ON "product_resolve_requests"("sourceId");

CREATE INDEX IF NOT EXISTS "product_resolve_requests_status_idx"
ON "product_resolve_requests"("status");

CREATE INDEX IF NOT EXISTS "product_resolve_requests_createdAt_idx"
ON "product_resolve_requests"("createdAt");

CREATE INDEX IF NOT EXISTS "product_resolve_requests_status_updatedAt_idx"
ON "product_resolve_requests"("status", "updatedAt");

-- 7. Add foreign key constraints
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'product_resolve_requests_sourceProductId_fkey'
    ) THEN
        ALTER TABLE "product_resolve_requests"
        ADD CONSTRAINT "product_resolve_requests_sourceProductId_fkey"
        FOREIGN KEY ("sourceProductId") REFERENCES "source_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'product_resolve_requests_sourceId_fkey'
    ) THEN
        ALTER TABLE "product_resolve_requests"
        ADD CONSTRAINT "product_resolve_requests_sourceId_fkey"
        FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'product_resolve_requests_resultProductId_fkey'
    ) THEN
        ALTER TABLE "product_resolve_requests"
        ADD CONSTRAINT "product_resolve_requests_resultProductId_fkey"
        FOREIGN KEY ("resultProductId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END
$$;

-- 8. Add index on source_products.identityKey for dedupe lookups
CREATE INDEX IF NOT EXISTS "source_products_identityKey_idx"
ON "source_products"("identityKey");

-- 9. Add composite index on product_links(status, matchType) for filtered queries
CREATE INDEX IF NOT EXISTS "product_links_status_matchType_idx"
ON "product_links"("status", "matchType");

-- 10. Add partial index for unresolved product_links (NEEDS_REVIEW, ERROR)
-- Speeds up human review queue and error investigation queries
CREATE INDEX IF NOT EXISTS "product_links_unresolved_idx"
ON "product_links"("status", "createdAt")
WHERE "status" IN ('NEEDS_REVIEW', 'ERROR');

-- 11. Add CHECK constraint: NEEDS_REVIEW status must have NULL productId
-- ERROR can have NULL productId (system failure before resolution)
-- MATCHED/CREATED must have non-NULL productId
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'product_links_status_productId_check'
    ) THEN
        ALTER TABLE "product_links"
        ADD CONSTRAINT "product_links_status_productId_check"
        CHECK (
            (status IN ('NEEDS_REVIEW') AND "productId" IS NULL)
            OR (status IN ('ERROR')) -- ERROR can be NULL or non-NULL
            OR (status IN ('MATCHED', 'CREATED', 'UNMATCHED') AND "productId" IS NOT NULL)
        );
    END IF;
END
$$;
