-- CreateEnum
CREATE TYPE "CaliberSnapshotStatus" AS ENUM ('CURRENT', 'SUPERSEDED');

-- CreateTable
CREATE TABLE "caliber_market_snapshots" (
    "id" TEXT NOT NULL,
    "caliber" TEXT NOT NULL,
    "windowDays" INTEGER NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "median" DECIMAL(10,6),
    "p25" DECIMAL(10,6),
    "p75" DECIMAL(10,6),
    "min" DECIMAL(10,6),
    "max" DECIMAL(10,6),
    "sampleCount" INTEGER NOT NULL,
    "daysWithData" INTEGER NOT NULL,
    "productCount" INTEGER NOT NULL,
    "retailerCount" INTEGER NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL,
    "computationVersion" TEXT NOT NULL,
    "computationDurationMs" INTEGER,
    "status" "CaliberSnapshotStatus" NOT NULL DEFAULT 'CURRENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "caliber_market_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "caliber_market_snapshots_status_idx" ON "caliber_market_snapshots"("status");

-- CreateIndex
CREATE INDEX "caliber_market_snapshots_computedAt_idx" ON "caliber_market_snapshots"("computedAt");
