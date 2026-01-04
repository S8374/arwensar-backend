/*
  Warnings:

  - You are about to drop the `plan_usages` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "plan_usages" DROP CONSTRAINT "plan_usages_subscriptionId_fkey";

-- DropTable
DROP TABLE "plan_usages";

-- CreateTable
CREATE TABLE "plan_limited_data" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "suppliers_used" INTEGER DEFAULT 0,
    "assessments_used" INTEGER DEFAULT 0,
    "messages_used" INTEGER DEFAULT 0,
    "document_reviews_used" INTEGER DEFAULT 0,
    "reports_used" INTEGER DEFAULT 0,
    "reports_generated_used" INTEGER DEFAULT 0,
    "notifications_send" INTEGER DEFAULT 0,
    "test" INTEGER DEFAULT 0,
    "month" INTEGER,
    "year" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_limited_data_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plan_limited_data_subscriptionId_key" ON "plan_limited_data"("subscriptionId");

-- CreateIndex
CREATE INDEX "plan_limited_data_month_year_idx" ON "plan_limited_data"("month", "year");

-- CreateIndex
CREATE INDEX "plan_limited_data_subscriptionId_idx" ON "plan_limited_data"("subscriptionId");

-- AddForeignKey
ALTER TABLE "plan_limited_data" ADD CONSTRAINT "plan_limited_data_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
