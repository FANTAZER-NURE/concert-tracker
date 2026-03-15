-- AlterTable
ALTER TABLE "SourceEntry" ADD COLUMN     "processed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rawData" JSONB;

-- CreateIndex
CREATE INDEX "SourceEntry_processed_idx" ON "SourceEntry"("processed");
