
export interface UsageLimits {
  supplierLimit: number;
  userLimit: number;
  assessmentLimit: number;
  messagesPerMonth: number;
  documentReviewsPerMonth: number;
  reportsGeneratedPerMonth: number;
  reportCreate: number;
  notificationsSend: number;
}

export function getPlanFeatures(plan: any): UsageLimits {
  const features = plan.features || {};

  const parseLimit = (value: any): number => {
    if (value === null || value === undefined) return 0;
    if (value === 0 || value === "unlimited" || value === -1 || value < -1) return -2; // -2 = unlimited
    return value;
  };

  return {
    supplierLimit: parseLimit(plan.supplierLimit),
    userLimit: parseLimit(plan.userLimit) || 1,
    assessmentLimit: parseLimit(plan.assessmentLimit) || 0,
    messagesPerMonth: parseLimit(features.messagesPerMonth),
    documentReviewsPerMonth: parseLimit(features.documentReviewsPerMonth),
    reportsGeneratedPerMonth: parseLimit(features.reportsGeneratedPerMonth),
    reportCreate: parseLimit(features.reportCreate),
    notificationsSend: parseLimit(features.notificationsSend) || -2,
  };
}
