/*
  Warnings:

  - You are about to drop the `queue_jobs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `queue_logs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `reminder_logs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `reminder_rules` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `reminders` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "queue_jobs" DROP CONSTRAINT "queue_jobs_created_by_fkey";

-- DropForeignKey
ALTER TABLE "queue_logs" DROP CONSTRAINT "queue_logs_jobId_fkey";

-- DropForeignKey
ALTER TABLE "reminder_logs" DROP CONSTRAINT "reminder_logs_reminderId_fkey";

-- DropForeignKey
ALTER TABLE "reminder_rules" DROP CONSTRAINT "reminder_rules_reminderId_fkey";

-- DropForeignKey
ALTER TABLE "reminders" DROP CONSTRAINT "reminders_createdById_fkey";

-- DropTable
DROP TABLE "queue_jobs";

-- DropTable
DROP TABLE "queue_logs";

-- DropTable
DROP TABLE "reminder_logs";

-- DropTable
DROP TABLE "reminder_rules";

-- DropTable
DROP TABLE "reminders";

-- DropEnum
DROP TYPE "QueueStatus";

-- DropEnum
DROP TYPE "QueueType";

-- DropEnum
DROP TYPE "ReminderChannel";

-- DropEnum
DROP TYPE "ReminderFrequency";

-- DropEnum
DROP TYPE "ReminderPriority";

-- DropEnum
DROP TYPE "ReminderStatus";

-- DropEnum
DROP TYPE "ReminderType";
