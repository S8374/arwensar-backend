// src/app/helper/getFeatures.ts
import { Plan } from "@prisma/client";

export interface PlanFeatures {
  supplierLimit: number | null;
  assessmentLimit: number | null;
  messagesPerMonth: number | null;
  documentReviewsPerMonth: number | null;
  reportCreate: number | null;
  reportsGeneratedPerMonth: number | null;
  notificationsSend: number | null;
}

export const getPlanFeatures = (plan: Plan): PlanFeatures => {
  // Parse features from JSON or use direct plan fields
  const features = typeof plan.features === 'string' 
    ? JSON.parse(plan.features) 
    : plan.features;

  return {
    supplierLimit: plan.supplierLimit,
    assessmentLimit: plan.assessmentLimit,
    messagesPerMonth: features?.messagesPerMonth ?? null,
    documentReviewsPerMonth: features?.documentReviewsPerMonth ?? null,
    reportCreate: features?.reportCreate ?? null,
    reportsGeneratedPerMonth: features?.reportsGeneratedPerMonth ?? null,
    notificationsSend: features?.notificationsSend ?? null,
  };
};