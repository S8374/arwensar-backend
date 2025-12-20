/*
  Warnings:

  - You are about to drop the column `impact_score` on the `assessment_submissions` table. All the data in the column will be lost.
  - You are about to drop the column `vulnerability_score` on the `assessment_submissions` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "EvidenceStatus" AS ENUM ('PENDING', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'REQUESTED');

-- CreateEnum
CREATE TYPE "AssessmentStage" AS ENUM ('INITIAL', 'FULL', 'COMPLETE');

-- AlterEnum
ALTER TYPE "AnswerType" ADD VALUE 'NA';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'ASSESSMENT_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'ASSESSMENT_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE 'EVIDENCE_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE 'EVIDENCE_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'EVIDENCE_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE 'CONTRACT_EXPIRING_SOON';
ALTER TYPE "NotificationType" ADD VALUE 'SLA_BREACHED';

-- DropIndex
DROP INDEX "assessment_submissions_supplier_id_status_idx";

-- DropIndex
DROP INDEX "assessment_submissions_vendor_id_status_idx";

-- DropIndex
DROP INDEX "assessments_exam_id_vendor_id_idx";

-- DropIndex
DROP INDEX "assessments_vendor_id_is_active_idx";

-- AlterTable
ALTER TABLE "assessment_answers" ADD COLUMN     "evidence_rejection_reason" TEXT,
ADD COLUMN     "evidence_status" "EvidenceStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "assessment_categories" ADD COLUMN     "description" TEXT;

-- AlterTable
ALTER TABLE "assessment_questions" ADD COLUMN     "biv_category" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "evidence_required" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "assessment_submissions" DROP COLUMN "impact_score",
DROP COLUMN "vulnerability_score",
ADD COLUMN     "availability_score" DECIMAL(5,2),
ADD COLUMN     "biv_score" DECIMAL(5,2),
ADD COLUMN     "integrity_score" DECIMAL(5,2),
ADD COLUMN     "stage" "AssessmentStage" NOT NULL DEFAULT 'FULL';

-- AlterTable
ALTER TABLE "assessments" ADD COLUMN     "stage" "AssessmentStage" NOT NULL DEFAULT 'FULL';

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "assessment_answer_id" TEXT;

-- AlterTable
ALTER TABLE "suppliers" ADD COLUMN     "availability_score" DECIMAL(5,2),
ADD COLUMN     "biv_score" DECIMAL(5,2),
ADD COLUMN     "business_score" DECIMAL(5,2),
ADD COLUMN     "full_assessment_completed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "initial_assessment_completed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "integrity_score" DECIMAL(5,2),
ADD COLUMN     "nis2_compliant" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "phoneNumber" TEXT,
ADD COLUMN     "profileImage" TEXT;

-- CreateIndex
CREATE INDEX "assessment_answers_evidence_status_idx" ON "assessment_answers"("evidence_status");

-- CreateIndex
CREATE INDEX "assessment_questions_biv_category_idx" ON "assessment_questions"("biv_category");

-- CreateIndex
CREATE INDEX "assessment_submissions_stage_idx" ON "assessment_submissions"("stage");

-- CreateIndex
CREATE INDEX "assessments_stage_idx" ON "assessments"("stage");

-- CreateIndex
CREATE INDEX "documents_assessment_answer_id_idx" ON "documents"("assessment_answer_id");

-- CreateIndex
CREATE INDEX "suppliers_biv_score_idx" ON "suppliers"("biv_score");

-- AddForeignKey
ALTER TABLE "assessment_submissions" ADD CONSTRAINT "assessment_submissions_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
