-- CreateEnum
CREATE TYPE "ScrapeCycleStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- AlterTable
ALTER TABLE "scrape_adapter_status" ADD COLUMN     "currentCycleId" TEXT,
ADD COLUMN     "cycleTimeoutMinutes" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "lastCycleStartedAt" TIMESTAMP(3),
ADD COLUMN     "schedule" TEXT;

-- AlterTable
ALTER TABLE "scrape_runs" ADD COLUMN     "cycleId" TEXT;

-- CreateTable
CREATE TABLE "scrape_cycles" (
    "id" TEXT NOT NULL,
    "adapterId" TEXT NOT NULL,
    "status" "ScrapeCycleStatus" NOT NULL DEFAULT 'RUNNING',
    "trigger" "ScrapeRunTrigger" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "totalTargets" INTEGER NOT NULL DEFAULT 0,
    "targetsCompleted" INTEGER NOT NULL DEFAULT 0,
    "targetsFailed" INTEGER NOT NULL DEFAULT 0,
    "targetsSkipped" INTEGER NOT NULL DEFAULT 0,
    "lastProcessedTargetId" TEXT,
    "offersExtracted" INTEGER NOT NULL DEFAULT 0,
    "offersValid" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scrape_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scrape_cycles_adapterId_idx" ON "scrape_cycles"("adapterId");

-- CreateIndex
CREATE INDEX "scrape_cycles_status_idx" ON "scrape_cycles"("status");

-- CreateIndex
CREATE INDEX "scrape_cycles_startedAt_idx" ON "scrape_cycles"("startedAt");

-- CreateIndex
CREATE INDEX "scrape_runs_cycleId_idx" ON "scrape_runs"("cycleId");

-- AddForeignKey
ALTER TABLE "scrape_runs" ADD CONSTRAINT "scrape_runs_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "scrape_cycles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scrape_cycles" ADD CONSTRAINT "scrape_cycles_adapterId_fkey" FOREIGN KEY ("adapterId") REFERENCES "scrape_adapter_status"("adapterId") ON DELETE RESTRICT ON UPDATE CASCADE;
