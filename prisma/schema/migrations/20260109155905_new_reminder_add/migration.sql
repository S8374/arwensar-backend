-- CreateEnum
CREATE TYPE "ReminderType" AS ENUM ('CONTRACT_EXPIRY', 'SUBSCRIPTION_EXPIRY', 'ASSESSMENT_DUE', 'HIGH_RISK_ALERT', 'EVIDENCE_MISSING', 'PAYMENT_DUE', 'SLA_BREACH', 'NIS2_COMPLIANCE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'CANCELLED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ReminderPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "ReminderChannel" AS ENUM ('EMAIL', 'PUSH', 'IN_APP', 'SMS', 'ALL');

-- CreateEnum
CREATE TYPE "ReminderFrequency" AS ENUM ('ONCE', 'DAILY', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "QueueStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'RETRY');

-- CreateEnum
CREATE TYPE "QueueType" AS ENUM ('REMINDER', 'EMAIL', 'NOTIFICATION', 'REPORT', 'SYNC');

-- CreateTable
CREATE TABLE "reminders" (
    "id" TEXT NOT NULL,
    "type" "ReminderType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "ReminderStatus" NOT NULL DEFAULT 'PENDING',
    "priority" "ReminderPriority" NOT NULL DEFAULT 'MEDIUM',
    "channel" "ReminderChannel" NOT NULL DEFAULT 'EMAIL',
    "userId" TEXT,
    "vendorId" TEXT,
    "supplierId" TEXT,
    "role" "UserRole",
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "sent_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "frequency" "ReminderFrequency" NOT NULL DEFAULT 'ONCE',
    "repeat_count" INTEGER NOT NULL DEFAULT 0,
    "max_retries" INTEGER NOT NULL DEFAULT 3,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "next_retry_at" TIMESTAMP(3),
    "metadata" JSONB,
    "template_id" TEXT,
    "createdById" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminder_logs" (
    "id" TEXT NOT NULL,
    "reminderId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "status" "ReminderStatus" NOT NULL,
    "channel" "ReminderChannel" NOT NULL,
    "recipient_id" TEXT,
    "recipient_email" TEXT,
    "error_message" TEXT,
    "error_code" TEXT,
    "response" JSONB,
    "sent_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reminder_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminder_rules" (
    "id" TEXT NOT NULL,
    "reminderId" TEXT NOT NULL,
    "rule_type" TEXT NOT NULL,
    "conditions" JSONB NOT NULL,
    "actions" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reminder_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "queue_jobs" (
    "id" TEXT NOT NULL,
    "type" "QueueType" NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "QueueStatus" NOT NULL DEFAULT 'PENDING',
    "priority" INTEGER NOT NULL DEFAULT 1,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "error" TEXT,
    "result" JSONB,
    "scheduled_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "locked_at" TIMESTAMP(3),
    "locked_by" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "queue_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "queue_logs" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "status" "QueueStatus" NOT NULL,
    "details" JSONB,
    "error" TEXT,
    "processed_by" TEXT,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "queue_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reminders_userId_idx" ON "reminders"("userId");

-- CreateIndex
CREATE INDEX "reminders_vendorId_idx" ON "reminders"("vendorId");

-- CreateIndex
CREATE INDEX "reminders_supplierId_idx" ON "reminders"("supplierId");

-- CreateIndex
CREATE INDEX "reminders_status_idx" ON "reminders"("status");

-- CreateIndex
CREATE INDEX "reminders_scheduled_at_idx" ON "reminders"("scheduled_at");

-- CreateIndex
CREATE INDEX "reminders_type_status_idx" ON "reminders"("type", "status");

-- CreateIndex
CREATE INDEX "reminder_logs_reminderId_idx" ON "reminder_logs"("reminderId");

-- CreateIndex
CREATE INDEX "reminder_logs_recipient_id_idx" ON "reminder_logs"("recipient_id");

-- CreateIndex
CREATE INDEX "reminder_logs_sent_at_idx" ON "reminder_logs"("sent_at");

-- CreateIndex
CREATE INDEX "reminder_rules_reminderId_idx" ON "reminder_rules"("reminderId");

-- CreateIndex
CREATE INDEX "reminder_rules_rule_type_idx" ON "reminder_rules"("rule_type");

-- CreateIndex
CREATE INDEX "reminder_rules_is_active_idx" ON "reminder_rules"("is_active");

-- CreateIndex
CREATE INDEX "queue_jobs_type_status_idx" ON "queue_jobs"("type", "status");

-- CreateIndex
CREATE INDEX "queue_jobs_status_scheduled_at_idx" ON "queue_jobs"("status", "scheduled_at");

-- CreateIndex
CREATE INDEX "queue_jobs_priority_created_at_idx" ON "queue_jobs"("priority", "created_at");

-- CreateIndex
CREATE INDEX "queue_jobs_locked_at_locked_by_idx" ON "queue_jobs"("locked_at", "locked_by");

-- CreateIndex
CREATE INDEX "queue_logs_jobId_idx" ON "queue_logs"("jobId");

-- CreateIndex
CREATE INDEX "queue_logs_processed_at_idx" ON "queue_logs"("processed_at");

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder_logs" ADD CONSTRAINT "reminder_logs_reminderId_fkey" FOREIGN KEY ("reminderId") REFERENCES "reminders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder_rules" ADD CONSTRAINT "reminder_rules_reminderId_fkey" FOREIGN KEY ("reminderId") REFERENCES "reminders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "queue_jobs" ADD CONSTRAINT "queue_jobs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "queue_logs" ADD CONSTRAINT "queue_logs_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "queue_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "queue_logs" ADD CONSTRAINT "queue_logs_processed_by_fkey" FOREIGN KEY ("processed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
