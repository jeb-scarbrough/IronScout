-- DropIndex
DROP INDEX "prices_sourceProductId_idx";

-- CreateIndex
CREATE INDEX "prices_sourceProductId_createdAt_idx" ON "prices"("sourceProductId", "createdAt" DESC);
