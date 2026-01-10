-- CreateEnum
CREATE TYPE "ReminderType" AS ENUM ('ASSESSMENT_DUE', 'ASSESSMENT_OVERDUE', 'CONTRACT_EXPIRING', 'CONTRACT_EXPIRED', 'SUBSCRIPTION_EXPIRING', 'SUBSCRIPTION_EXPIRED', 'HIGH_RISK_SUPPLIER', 'EVIDENCE_PENDING', 'EVIDENCE_OVERDUE', 'PROBLEM_ESCALATION', 'MONTHLY_COMPLIANCE_CHECK', 'QUARTERLY_REVIEW', 'ANNUAL_REVIEW');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ReminderChannel" AS ENUM ('EMAIL', 'IN_APP', 'SMS', 'PUSH', 'ALL');

-- CreateEnum
CREATE TYPE "ReminderPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- AlterTable
ALTER TABLE "assessment_submissions" ADD COLUMN     "last_reminder_at" TIMESTAMP(3),
ADD COLUMN     "reminder_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reminder_sent_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "last_renewal_reminder_at" TIMESTAMP(3),
ADD COLUMN     "renewal_reminder_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "suppliers" ADD COLUMN     "contract_reminder_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "high_risk_reminder_sent_at" TIMESTAMP(3),
ADD COLUMN     "last_contract_reminder_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "reminders" (
    "id" TEXT NOT NULL,
    "type" "ReminderType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vendor_id" TEXT,
    "supplier_id" TEXT,
    "assessment_id" TEXT,
    "subscription_id" TEXT,
    "problem_id" TEXT,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "sent_at" TIMESTAMP(3),
    "status" "ReminderStatus" NOT NULL DEFAULT 'PENDING',
    "priority" "ReminderPriority" NOT NULL DEFAULT 'MEDIUM',
    "channel" "ReminderChannel" NOT NULL DEFAULT 'IN_APP',
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "max_retries" INTEGER NOT NULL DEFAULT 3,
    "last_attempt_at" TIMESTAMP(3),
    "error_message" TEXT,
    "metadata" JSONB,
    "action_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reminders_userId_status_scheduled_at_idx" ON "reminders"("userId", "status", "scheduled_at");

-- CreateIndex
CREATE INDEX "reminders_type_status_scheduled_at_idx" ON "reminders"("type", "status", "scheduled_at");

-- CreateIndex
CREATE INDEX "reminders_vendor_id_supplier_id_idx" ON "reminders"("vendor_id", "supplier_id");

-- CreateIndex
CREATE INDEX "reminders_scheduled_at_idx" ON "reminders"("scheduled_at");

-- CreateIndex
CREATE INDEX "reminders_status_idx" ON "reminders"("status");

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
