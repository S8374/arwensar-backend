-- AlterTable
ALTER TABLE "plans" ALTER COLUMN "supplier_limit" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "PlanChangeHistory_changedAt_idx" ON "PlanChangeHistory"("changedAt");
