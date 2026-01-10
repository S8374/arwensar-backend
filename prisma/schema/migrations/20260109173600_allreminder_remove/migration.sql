/*
  Warnings:

  - You are about to drop the column `last_reminder_at` on the `assessment_submissions` table. All the data in the column will be lost.
  - You are about to drop the column `reminder_count` on the `assessment_submissions` table. All the data in the column will be lost.
  - You are about to drop the column `reminder_sent_at` on the `assessment_submissions` table. All the data in the column will be lost.
  - You are about to drop the column `contract_reminder_count` on the `suppliers` table. All the data in the column will be lost.
  - You are about to drop the column `high_risk_reminder_sent_at` on the `suppliers` table. All the data in the column will be lost.
  - You are about to drop the column `last_contract_reminder_at` on the `suppliers` table. All the data in the column will be lost.
  - You are about to drop the `reminders` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "reminders" DROP CONSTRAINT "reminders_userId_fkey";

-- AlterTable
ALTER TABLE "assessment_submissions" DROP COLUMN "last_reminder_at",
DROP COLUMN "reminder_count",
DROP COLUMN "reminder_sent_at";

-- AlterTable
ALTER TABLE "suppliers" DROP COLUMN "contract_reminder_count",
DROP COLUMN "high_risk_reminder_sent_at",
DROP COLUMN "last_contract_reminder_at";

-- DropTable
DROP TABLE "reminders";

-- DropEnum
DROP TYPE "ReminderChannel";

-- DropEnum
DROP TYPE "ReminderPriority";

-- DropEnum
DROP TYPE "ReminderStatus";

-- DropEnum
DROP TYPE "ReminderType";
