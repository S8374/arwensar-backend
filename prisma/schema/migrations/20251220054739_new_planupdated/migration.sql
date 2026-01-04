-- AlterEnum
ALTER TYPE "PlanType" ADD VALUE 'BUSINESS';

-- AlterTable
ALTER TABLE "plans" ADD COLUMN     "is_popular" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "original_price" DECIMAL(10,2);
