-- CreateTable
CREATE TABLE "PlanChangeHistory" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "previousPlanId" TEXT NOT NULL,
    "newPlanId" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedBy" TEXT,
    "reason" TEXT,
    "stripeSessionId" TEXT,

    CONSTRAINT "PlanChangeHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlanChangeHistory_subscriptionId_idx" ON "PlanChangeHistory"("subscriptionId");

-- AddForeignKey
ALTER TABLE "PlanChangeHistory" ADD CONSTRAINT "PlanChangeHistory_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanChangeHistory" ADD CONSTRAINT "PlanChangeHistory_previousPlanId_fkey" FOREIGN KEY ("previousPlanId") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanChangeHistory" ADD CONSTRAINT "PlanChangeHistory_newPlanId_fkey" FOREIGN KEY ("newPlanId") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
