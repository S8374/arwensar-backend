-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'VENDOR', 'SUPPLIER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "Criticality" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'REQUIRES_ACTION', 'APPROVED', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AnswerType" AS ENUM ('YES', 'NO', 'PARTIAL', 'NOT_APPLICABLE', 'NA');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'ANNUAL', 'QUARTERLY');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'TRIALING', 'PENDING', 'PAST_DUE', 'CANCELED', 'EXPIRED', 'PAUSED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('RISK_ASSESSMENT', 'COMPLIANCE_REPORT', 'SECURITY_AUDIT', 'PERFORMANCE_REVIEW', 'FINANCIAL_ANALYSIS', 'SUPPLIER_EVALUATION', 'INCIDENT_REPORT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ProblemStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'ESCALATED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ProblemType" AS ENUM ('QUALITY_ISSUE', 'DELIVERY_DELAY', 'COMMUNICATION', 'CONTRACT_VIOLATION', 'PAYMENT_ISSUE', 'COMPLIANCE', 'TECHNICAL', 'OTHER');

-- CreateEnum
CREATE TYPE "ProblemDirection" AS ENUM ('VENDOR_TO_SUPPLIER', 'SUPPLIER_TO_VENDOR');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('RISK_ALERT', 'CONTRACT_EXPIRY', 'ASSESSMENT_DUE', 'ASSESSMENT_SUBMITTED', 'PROBLEM_REPORTED', 'PROBLEM_UPDATED', 'PROBLEM_RESOLVED', 'SYSTEM_ALERT', 'PAYMENT_SUCCESS', 'PAYMENT_FAILED', 'REPORT_GENERATED', 'INVITATION_SENT', 'INVITATION_ACCEPTED');

-- CreateEnum
CREATE TYPE "OTPType" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('GENERATED', 'SENT', 'VIEWED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'SENT', 'ACCEPTED', 'EXPIRED', 'REVOKED');

-- CreateTable
CREATE TABLE "assessments" (
    "id" TEXT NOT NULL,
    "exam_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_template" BOOLEAN NOT NULL DEFAULT false,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "total_points" INTEGER NOT NULL DEFAULT 100,
    "passing_score" DECIMAL(5,2),
    "time_limit" INTEGER,
    "created_by" TEXT NOT NULL,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "vendor_id" TEXT NOT NULL,

    CONSTRAINT "assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_categories" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 1,
    "weight" DECIMAL(5,2) DEFAULT 100,
    "max_score" INTEGER NOT NULL DEFAULT 100,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "assessmentId" TEXT NOT NULL,

    CONSTRAINT "assessment_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_questions" (
    "id" TEXT NOT NULL,
    "question_id" INTEGER NOT NULL,
    "question" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 1,
    "is_document" BOOLEAN NOT NULL DEFAULT false,
    "is_input_field" BOOLEAN NOT NULL DEFAULT false,
    "answer_type" "AnswerType" NOT NULL DEFAULT 'YES',
    "required" BOOLEAN NOT NULL DEFAULT true,
    "weight" DECIMAL(5,2) DEFAULT 100,
    "max_score" INTEGER NOT NULL DEFAULT 10,
    "help_text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "assessment_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_submissions" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'DRAFT',
    "total_questions" INTEGER NOT NULL,
    "answered_questions" INTEGER NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "score" DECIMAL(5,2),
    "risk_score" DECIMAL(5,2),
    "risk_level" "Criticality",
    "business_score" DECIMAL(5,2),
    "impact_score" DECIMAL(5,2),
    "vulnerability_score" DECIMAL(5,2),
    "risk_components" JSONB,
    "risk_breakdown" JSONB,
    "risk_metadata" JSONB,
    "started_at" TIMESTAMP(3),
    "submitted_at" TIMESTAMP(3),
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "reviewed_by" TEXT,
    "review_comments" TEXT,
    "reviewer_report" TEXT,

    CONSTRAINT "assessment_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_answers" (
    "id" TEXT NOT NULL,
    "answer" "AnswerType" NOT NULL,
    "evidence" TEXT,
    "comments" TEXT,
    "score" DECIMAL(5,2),
    "max_score" INTEGER NOT NULL DEFAULT 10,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "questionId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,

    CONSTRAINT "assessment_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "file_size" DOUBLE PRECISION NOT NULL,
    "mime_type" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "supplier_id" TEXT,
    "vendor_id" TEXT,
    "problem_id" TEXT,
    "assessment_submission_id" TEXT,
    "is_private" BOOLEAN NOT NULL DEFAULT false,
    "accessRoles" "UserRole"[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "metadata" JSONB,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "priority" "NotificationPriority" NOT NULL DEFAULT 'MEDIUM',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email_notifications" BOOLEAN NOT NULL DEFAULT true,
    "push_notifications" BOOLEAN NOT NULL DEFAULT true,
    "risk_alerts" BOOLEAN NOT NULL DEFAULT true,
    "contract_reminders" BOOLEAN NOT NULL DEFAULT true,
    "compliance_updates" BOOLEAN NOT NULL DEFAULT true,
    "assessment_reminders" BOOLEAN NOT NULL DEFAULT true,
    "problem_alerts" BOOLEAN NOT NULL DEFAULT true,
    "report_alerts" BOOLEAN NOT NULL DEFAULT true,
    "payment_alerts" BOOLEAN NOT NULL DEFAULT true,
    "message_alerts" BOOLEAN NOT NULL DEFAULT true,
    "digestFrequency" TEXT NOT NULL DEFAULT 'DAILY',
    "quiet_hours_start" INTEGER DEFAULT 22,
    "quiet_hours_end" INTEGER DEFAULT 8,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otps" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "otp" VARCHAR(6) NOT NULL,
    "type" "OTPType" NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "is_used" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "otps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entity_id" TEXT,
    "details" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "PlanType" NOT NULL DEFAULT 'STARTER',
    "billing_cycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
    "price" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "supplier_limit" INTEGER NOT NULL DEFAULT 10,
    "assessment_limit" INTEGER DEFAULT 100,
    "storage_limit" INTEGER DEFAULT 10,
    "user_limit" INTEGER DEFAULT 5,
    "features" JSONB NOT NULL,
    "trial_days" INTEGER NOT NULL DEFAULT 14,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "stripe_price_id" TEXT,
    "stripe_product_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "billing_cycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "current_period_start" TIMESTAMP(3),
    "current_period_end" TIMESTAMP(3),
    "trial_start" TIMESTAMP(3),
    "trial_end" TIMESTAMP(3),
    "stripe_customer_id" TEXT,
    "stripe_subscription_id" TEXT,
    "stripe_session_id" TEXT,
    "used_suppliers" INTEGER NOT NULL DEFAULT 0,
    "used_assessments" INTEGER NOT NULL DEFAULT 0,
    "used_storage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cancellation_reason" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "stripe_payment_id" TEXT,
    "stripe_invoice_id" TEXT,
    "payment_method" TEXT,
    "billing_email" TEXT,
    "receipt_url" TEXT,
    "payment_method_details" JSONB,
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "period_start" TIMESTAMP(3),
    "period_end" TIMESTAMP(3),
    "due_date" TIMESTAMP(3),
    "stripe_invoice_id" TEXT,
    "pdf_url" TEXT,
    "hosted_invoice_url" TEXT,
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "items" JSONB,
    "paymentId" TEXT,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "problems" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "ProblemType" NOT NULL DEFAULT 'OTHER',
    "direction" "ProblemDirection" NOT NULL,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "status" "ProblemStatus" NOT NULL DEFAULT 'OPEN',
    "reportedById" TEXT NOT NULL,
    "assignedToId" TEXT,
    "vendor_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "resolution_notes" TEXT,
    "resolved_at" TIMESTAMP(3),
    "due_date" TIMESTAMP(3),
    "sla_breached" BOOLEAN NOT NULL DEFAULT false,
    "first_response_at" TIMESTAMP(3),
    "attachments" TEXT[],
    "internal_notes" TEXT,
    "supplier_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "problems_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "problem_messages" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "is_internal" BOOLEAN NOT NULL DEFAULT false,
    "attachments" TEXT[],
    "problemId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "problem_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "report_type" "ReportType" NOT NULL,
    "description" TEXT,
    "document_url" TEXT NOT NULL,
    "document_type" TEXT NOT NULL,
    "file_size" DOUBLE PRECISION NOT NULL,
    "parameters" JSONB,
    "filters" JSONB,
    "createdById" TEXT NOT NULL,
    "generatedForId" TEXT,
    "vendor_id" TEXT NOT NULL,
    "supplier_id" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'GENERATED',
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "viewed_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'VENDOR',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "needPasswordChange" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_login_at" TIMESTAMP(3),
    "email_verified_at" TIMESTAMP(3),
    "vendorId" TEXT,
    "supplierId" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendors" (
    "id" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "business_email" TEXT NOT NULL,
    "contact_number" TEXT NOT NULL,
    "industry_type" TEXT NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "terms_accepted" BOOLEAN NOT NULL DEFAULT false,
    "company_logo" TEXT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact_person" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "criticality" "Criticality" NOT NULL,
    "contract_start_date" TIMESTAMP(3) NOT NULL,
    "contract_end_date" TIMESTAMP(3),
    "contract_document" TEXT,
    "document_type" TEXT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "invitation_status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "invitation_sent_at" TIMESTAMP(3),
    "invitation_accepted_at" TIMESTAMP(3),
    "userId" TEXT,
    "vendorId" TEXT NOT NULL,
    "invitation_token" TEXT,
    "invited_by" TEXT,
    "overall_score" DECIMAL(5,2),
    "last_assessment_date" TIMESTAMP(3),
    "next_assessment_due" TIMESTAMP(3),
    "compliance_rate" DECIMAL(5,2),
    "risk_level" "Criticality",
    "total_contract_value" DECIMAL(10,2),
    "outstanding_payments" DECIMAL(10,2),
    "on_time_delivery_rate" DECIMAL(5,2),
    "average_response_time" INTEGER,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "assessments_exam_id_key" ON "assessments"("exam_id");

-- CreateIndex
CREATE INDEX "assessments_created_by_idx" ON "assessments"("created_by");

-- CreateIndex
CREATE INDEX "assessments_vendor_id_idx" ON "assessments"("vendor_id");

-- CreateIndex
CREATE INDEX "assessments_is_active_idx" ON "assessments"("is_active");

-- CreateIndex
CREATE INDEX "assessments_created_at_idx" ON "assessments"("created_at");

-- CreateIndex
CREATE INDEX "assessments_exam_id_idx" ON "assessments"("exam_id");

-- CreateIndex
CREATE INDEX "assessment_categories_assessmentId_idx" ON "assessment_categories"("assessmentId");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_categories_assessmentId_category_id_key" ON "assessment_categories"("assessmentId", "category_id");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_categories_assessmentId_order_key" ON "assessment_categories"("assessmentId", "order");

-- CreateIndex
CREATE INDEX "assessment_questions_categoryId_idx" ON "assessment_questions"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_questions_categoryId_question_id_key" ON "assessment_questions"("categoryId", "question_id");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_questions_categoryId_order_key" ON "assessment_questions"("categoryId", "order");

-- CreateIndex
CREATE INDEX "assessment_submissions_userId_idx" ON "assessment_submissions"("userId");

-- CreateIndex
CREATE INDEX "assessment_submissions_supplier_id_idx" ON "assessment_submissions"("supplier_id");

-- CreateIndex
CREATE INDEX "assessment_submissions_vendor_id_idx" ON "assessment_submissions"("vendor_id");

-- CreateIndex
CREATE INDEX "assessment_submissions_assessmentId_idx" ON "assessment_submissions"("assessmentId");

-- CreateIndex
CREATE INDEX "assessment_submissions_status_idx" ON "assessment_submissions"("status");

-- CreateIndex
CREATE INDEX "assessment_submissions_submitted_at_idx" ON "assessment_submissions"("submitted_at");

-- CreateIndex
CREATE INDEX "assessment_submissions_created_at_idx" ON "assessment_submissions"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_submissions_supplier_id_assessmentId_key" ON "assessment_submissions"("supplier_id", "assessmentId");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_answers_submissionId_questionId_key" ON "assessment_answers"("submissionId", "questionId");

-- CreateIndex
CREATE INDEX "documents_uploadedById_idx" ON "documents"("uploadedById");

-- CreateIndex
CREATE INDEX "documents_supplier_id_type_idx" ON "documents"("supplier_id", "type");

-- CreateIndex
CREATE INDEX "documents_created_at_idx" ON "documents"("created_at");

-- CreateIndex
CREATE INDEX "notifications_userId_is_read_idx" ON "notifications"("userId", "is_read");

-- CreateIndex
CREATE INDEX "notifications_userId_created_at_idx" ON "notifications"("userId", "created_at");

-- CreateIndex
CREATE INDEX "notifications_type_created_at_idx" ON "notifications"("type", "created_at");

-- CreateIndex
CREATE INDEX "notifications_is_read_created_at_idx" ON "notifications"("is_read", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_userId_key" ON "notification_preferences"("userId");

-- CreateIndex
CREATE INDEX "otps_email_idx" ON "otps"("email");

-- CreateIndex
CREATE INDEX "otps_type_idx" ON "otps"("type");

-- CreateIndex
CREATE INDEX "otps_expires_at_idx" ON "otps"("expires_at");

-- CreateIndex
CREATE INDEX "otps_userId_idx" ON "otps"("userId");

-- CreateIndex
CREATE INDEX "activity_logs_userId_created_at_idx" ON "activity_logs"("userId", "created_at");

-- CreateIndex
CREATE INDEX "activity_logs_entityType_entity_id_idx" ON "activity_logs"("entityType", "entity_id");

-- CreateIndex
CREATE INDEX "activity_logs_action_created_at_idx" ON "activity_logs"("action", "created_at");

-- CreateIndex
CREATE INDEX "activity_logs_created_at_idx" ON "activity_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "plans_stripe_price_id_key" ON "plans"("stripe_price_id");

-- CreateIndex
CREATE UNIQUE INDEX "plans_stripe_product_id_key" ON "plans"("stripe_product_id");

-- CreateIndex
CREATE INDEX "plans_type_billing_cycle_idx" ON "plans"("type", "billing_cycle");

-- CreateIndex
CREATE INDEX "plans_is_active_idx" ON "plans"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_userId_key" ON "subscriptions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_stripe_customer_id_key" ON "subscriptions"("stripe_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_stripe_subscription_id_key" ON "subscriptions"("stripe_subscription_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_stripe_session_id_key" ON "subscriptions"("stripe_session_id");

-- CreateIndex
CREATE INDEX "subscriptions_userId_idx" ON "subscriptions"("userId");

-- CreateIndex
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");

-- CreateIndex
CREATE INDEX "subscriptions_current_period_end_idx" ON "subscriptions"("current_period_end");

-- CreateIndex
CREATE INDEX "subscriptions_trial_end_idx" ON "subscriptions"("trial_end");

-- CreateIndex
CREATE UNIQUE INDEX "payments_stripe_payment_id_key" ON "payments"("stripe_payment_id");

-- CreateIndex
CREATE INDEX "payments_subscriptionId_idx" ON "payments"("subscriptionId");

-- CreateIndex
CREATE INDEX "payments_userId_idx" ON "payments"("userId");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE INDEX "payments_paid_at_idx" ON "payments"("paid_at");

-- CreateIndex
CREATE INDEX "payments_created_at_idx" ON "payments"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoice_number_key" ON "invoices"("invoice_number");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_stripe_invoice_id_key" ON "invoices"("stripe_invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_paymentId_key" ON "invoices"("paymentId");

-- CreateIndex
CREATE INDEX "invoices_invoice_number_idx" ON "invoices"("invoice_number");

-- CreateIndex
CREATE INDEX "invoices_subscriptionId_idx" ON "invoices"("subscriptionId");

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- CreateIndex
CREATE INDEX "invoices_due_date_idx" ON "invoices"("due_date");

-- CreateIndex
CREATE INDEX "problems_reportedById_idx" ON "problems"("reportedById");

-- CreateIndex
CREATE INDEX "problems_assignedToId_idx" ON "problems"("assignedToId");

-- CreateIndex
CREATE INDEX "problems_vendor_id_supplier_id_idx" ON "problems"("vendor_id", "supplier_id");

-- CreateIndex
CREATE INDEX "problems_status_priority_idx" ON "problems"("status", "priority");

-- CreateIndex
CREATE INDEX "problems_created_at_idx" ON "problems"("created_at");

-- CreateIndex
CREATE INDEX "problems_due_date_idx" ON "problems"("due_date");

-- CreateIndex
CREATE INDEX "problem_messages_problemId_idx" ON "problem_messages"("problemId");

-- CreateIndex
CREATE INDEX "problem_messages_senderId_idx" ON "problem_messages"("senderId");

-- CreateIndex
CREATE INDEX "problem_messages_created_at_idx" ON "problem_messages"("created_at");

-- CreateIndex
CREATE INDEX "reports_createdById_idx" ON "reports"("createdById");

-- CreateIndex
CREATE INDEX "reports_vendor_id_supplier_id_idx" ON "reports"("vendor_id", "supplier_id");

-- CreateIndex
CREATE INDEX "reports_report_type_idx" ON "reports"("report_type");

-- CreateIndex
CREATE INDEX "reports_created_at_idx" ON "reports"("created_at");

-- CreateIndex
CREATE INDEX "reports_status_idx" ON "reports"("status");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_vendorId_key" ON "users"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "users_supplierId_key" ON "users"("supplierId");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "users_created_at_idx" ON "users"("created_at");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "vendors_business_email_key" ON "vendors"("business_email");

-- CreateIndex
CREATE UNIQUE INDEX "vendors_userId_key" ON "vendors"("userId");

-- CreateIndex
CREATE INDEX "vendors_userId_idx" ON "vendors"("userId");

-- CreateIndex
CREATE INDEX "vendors_business_email_idx" ON "vendors"("business_email");

-- CreateIndex
CREATE INDEX "vendors_created_at_idx" ON "vendors"("created_at");

-- CreateIndex
CREATE INDEX "vendors_is_active_idx" ON "vendors"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_email_key" ON "suppliers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_userId_key" ON "suppliers"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_invitation_token_key" ON "suppliers"("invitation_token");

-- CreateIndex
CREATE INDEX "suppliers_vendorId_is_active_idx" ON "suppliers"("vendorId", "is_active");

-- CreateIndex
CREATE INDEX "suppliers_email_idx" ON "suppliers"("email");

-- CreateIndex
CREATE INDEX "suppliers_criticality_idx" ON "suppliers"("criticality");

-- CreateIndex
CREATE INDEX "suppliers_invitation_status_idx" ON "suppliers"("invitation_status");

-- CreateIndex
CREATE INDEX "suppliers_contract_end_date_idx" ON "suppliers"("contract_end_date");

-- CreateIndex
CREATE INDEX "suppliers_risk_level_idx" ON "suppliers"("risk_level");

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_categories" ADD CONSTRAINT "assessment_categories_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_questions" ADD CONSTRAINT "assessment_questions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "assessment_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_submissions" ADD CONSTRAINT "assessment_submissions_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_submissions" ADD CONSTRAINT "assessment_submissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_answers" ADD CONSTRAINT "assessment_answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "assessment_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_answers" ADD CONSTRAINT "assessment_answers_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "assessment_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "otps" ADD CONSTRAINT "otps_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problems" ADD CONSTRAINT "problems_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problems" ADD CONSTRAINT "problems_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problem_messages" ADD CONSTRAINT "problem_messages_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "problems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problem_messages" ADD CONSTRAINT "problem_messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_generatedForId_fkey" FOREIGN KEY ("generatedForId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
