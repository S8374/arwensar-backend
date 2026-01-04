/*
  Warnings:

  - You are about to drop the column `used_assessments` on the `subscriptions` table. All the data in the column will be lost.
  - You are about to drop the column `used_storage` on the `subscriptions` table. All the data in the column will be lost.
  - You are about to drop the column `used_suppliers` on the `subscriptions` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "subscriptions" DROP COLUMN "used_assessments",
DROP COLUMN "used_storage",
DROP COLUMN "used_suppliers";
