/*
  Warnings:

  - A unique constraint covering the columns `[stripe_customer_id]` on the table `vendors` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[stripe_account_id]` on the table `vendors` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "vendors" ADD COLUMN     "stripe_account_id" TEXT,
ADD COLUMN     "stripe_customer_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "vendors_stripe_customer_id_key" ON "vendors"("stripe_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "vendors_stripe_account_id_key" ON "vendors"("stripe_account_id");
