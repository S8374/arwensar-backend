/*
  Warnings:

  - You are about to drop the column `compliance_updates` on the `notification_preferences` table. All the data in the column will be lost.
  - You are about to drop the column `push_notifications` on the `notification_preferences` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "notification_preferences" DROP COLUMN "compliance_updates",
DROP COLUMN "push_notifications";
