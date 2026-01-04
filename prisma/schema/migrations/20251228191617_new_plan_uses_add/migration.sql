-- CreateTable
CREATE TABLE "plan_usages" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "suppliers_used" INTEGER NOT NULL DEFAULT 0,
    "assessments_used" INTEGER NOT NULL DEFAULT 0,
    "messages_used" INTEGER NOT NULL DEFAULT 0,
    "document_reviews_used" INTEGER NOT NULL DEFAULT 0,
    "reports_used" INTEGER NOT NULL DEFAULT 0,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_usages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plan_usages_subscriptionId_key" ON "plan_usages"("subscriptionId");

-- CreateIndex
CREATE INDEX "plan_usages_month_year_idx" ON "plan_usages"("month", "year");

-- CreateIndex
CREATE INDEX "plan_usages_subscriptionId_idx" ON "plan_usages"("subscriptionId");

-- AddForeignKey
ALTER TABLE "plan_usages" ADD CONSTRAINT "plan_usages_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
