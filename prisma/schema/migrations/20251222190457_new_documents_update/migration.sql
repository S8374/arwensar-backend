/*
  Warnings:

  - You are about to drop the column `assessment_answer_id` on the `documents` table. All the data in the column will be lost.
  - You are about to drop the column `assessment_submission_id` on the `documents` table. All the data in the column will be lost.
  - You are about to drop the column `problem_id` on the `documents` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED');

-- DropIndex
DROP INDEX "documents_assessment_answer_id_idx";

-- DropIndex
DROP INDEX "documents_supplier_id_type_idx";

-- AlterTable
ALTER TABLE "documents" DROP COLUMN "assessment_answer_id",
DROP COLUMN "assessment_submission_id",
DROP COLUMN "problem_id",
ADD COLUMN     "category" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "expiry_date" TIMESTAMP(3),
ADD COLUMN     "is_verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "review_notes" TEXT,
ADD COLUMN     "reviewed_at" TIMESTAMP(3),
ADD COLUMN     "reviewed_by" TEXT,
ADD COLUMN     "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "documents_supplier_id_idx" ON "documents"("supplier_id");

-- CreateIndex
CREATE INDEX "documents_vendor_id_idx" ON "documents"("vendor_id");

-- CreateIndex
CREATE INDEX "documents_status_idx" ON "documents"("status");

-- CreateIndex
CREATE INDEX "documents_category_idx" ON "documents"("category");

-- CreateIndex
CREATE INDEX "documents_expiry_date_idx" ON "documents"("expiry_date");
