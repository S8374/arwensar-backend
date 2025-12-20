/*
  Warnings:

  - You are about to drop the column `paymentId` on the `invoices` table. All the data in the column will be lost.
  - You are about to drop the column `current_payment_id` on the `subscriptions` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[invoiceId]` on the table `payments` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_paymentId_fkey";

-- DropIndex
DROP INDEX "invoices_paymentId_key";

-- AlterTable
ALTER TABLE "invoices" DROP COLUMN "paymentId";

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "invoiceId" TEXT;

-- AlterTable
ALTER TABLE "subscriptions" DROP COLUMN "current_payment_id";

-- CreateIndex
CREATE UNIQUE INDEX "payments_invoiceId_key" ON "payments"("invoiceId");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
