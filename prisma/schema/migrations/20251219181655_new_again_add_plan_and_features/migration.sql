/*
  Warnings:

  - You are about to drop the column `payment_method_details` on the `payments` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[stripe_session_id]` on the table `payments` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('SUBSCRIPTION', 'ONE_TIME', 'RENEWAL', 'UPGRADE', 'DOWNGRADE');

-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_subscriptionId_fkey";

-- AlterTable
ALTER TABLE "assessment_submissions" ADD COLUMN     "compliance_rate" DECIMAL(5,2),
ADD COLUMN     "evidence_status" TEXT;

-- AlterTable
ALTER TABLE "payments" DROP COLUMN "payment_method_details",
ADD COLUMN     "billing_details" JSONB,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "payment_method_id" TEXT,
ADD COLUMN     "payment_type" "PaymentType" NOT NULL DEFAULT 'SUBSCRIPTION',
ADD COLUMN     "planId" TEXT,
ADD COLUMN     "refunded_at" TIMESTAMP(3),
ADD COLUMN     "stripe_customer_id" TEXT,
ADD COLUMN     "stripe_session_id" TEXT,
ALTER COLUMN "subscriptionId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "suppliers" ALTER COLUMN "nis2_compliant" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "payments_stripe_session_id_key" ON "payments"("stripe_session_id");

-- CreateIndex
CREATE INDEX "payments_stripe_payment_id_idx" ON "payments"("stripe_payment_id");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
