/*
  Warnings:

  - The values [NA] on the enum `AnswerType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "AnswerType_new" AS ENUM ('YES', 'NO', 'PARTIAL', 'NOT_APPLICABLE');
ALTER TABLE "public"."assessment_questions" ALTER COLUMN "answer_type" DROP DEFAULT;
ALTER TABLE "assessment_questions" ALTER COLUMN "answer_type" TYPE "AnswerType_new" USING ("answer_type"::text::"AnswerType_new");
ALTER TABLE "assessment_answers" ALTER COLUMN "answer" TYPE "AnswerType_new" USING ("answer"::text::"AnswerType_new");
ALTER TYPE "AnswerType" RENAME TO "AnswerType_old";
ALTER TYPE "AnswerType_new" RENAME TO "AnswerType";
DROP TYPE "public"."AnswerType_old";
ALTER TABLE "assessment_questions" ALTER COLUMN "answer_type" SET DEFAULT 'YES';
COMMIT;

-- CreateIndex
CREATE INDEX "assessment_submissions_supplier_id_status_idx" ON "assessment_submissions"("supplier_id", "status");

-- CreateIndex
CREATE INDEX "assessment_submissions_vendor_id_status_idx" ON "assessment_submissions"("vendor_id", "status");

-- CreateIndex
CREATE INDEX "assessments_vendor_id_is_active_idx" ON "assessments"("vendor_id", "is_active");

-- CreateIndex
CREATE INDEX "assessments_exam_id_vendor_id_idx" ON "assessments"("exam_id", "vendor_id");
