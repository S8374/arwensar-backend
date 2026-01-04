// src/app/modules/usage/usage.service.ts
import { Prisma, PlanLimitData, SubscriptionStatus, Criticality } from "@prisma/client";
import { prisma } from "../../shared/prisma";
import ApiError from "../../../error/ApiError";
import httpStatus from "http-status";
import { getPlanFeatures } from "../../helper/getFeatures";
import { PlanFeatures } from "../../helper/planFeatures";

// src/app/modules/usage/usage.service.ts - Updated interfaces
export interface UsageCheckResult {
  canProceed: boolean;
  remaining?: number | null; // Allow null for unlimited
  limit?: number | null;     // Allow null for unlimited
  message?: string;
}

export interface BulkLimitCheckResult {
  canProceed: boolean;
  message?: string;
  limit?: number | null;     // Allow null for unlimited
  remaining?: number | null; // Allow null for unlimited
}
class UsageService {
  // ========== GET CURRENT USAGE ==========
  async getCurrentUsage(subscriptionId: string) {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    const usage = await prisma.planLimitData.findUnique({
      where: { subscriptionId },
    });

    // If no usage record exists or it's from a previous month, create/refresh it
    if (!usage || (usage.month !== currentMonth && usage.year !== currentYear)) {
      return await this.refreshMonthlyUsage(subscriptionId);
    }

    return usage;
  }

  // ========== REFRESH MONTHLY USAGE ==========
  async refreshMonthlyUsage(subscriptionId: string): Promise<PlanLimitData> {
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { plan: true }
    });

    if (!subscription) {
      throw new ApiError(httpStatus.NOT_FOUND, "Subscription not found");
    }

    const features = getPlanFeatures(subscription.plan);
    const isEnterprise = subscription.plan.type === "ENTERPRISE";

    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    // Get existing usage to carry over cumulative values for non-enterprise plans
    const existingUsage = await prisma.planLimitData.findUnique({
      where: { subscriptionId }
    });

    if (existingUsage) {
      return await prisma.planLimitData.update({
        where: { subscriptionId },
        data: isEnterprise
          ? {
            // Enterprise: reset to unlimited (null)
            suppliersUsed: null,
            assessmentsUsed: null,
            messagesUsed: null,
            documentReviewsUsed: null,
            reportCreate: null,
            reportsGeneratedUsed: null,
            notificationsSend: null,
            month: currentMonth,
            year: currentYear,
          }
          : {
            // Non-enterprise: cumulative + monthly refresh
            suppliersUsed: existingUsage.suppliersUsed !== null
              ? existingUsage.suppliersUsed + (features.supplierLimit ?? 0)
              : features.supplierLimit,
            assessmentsUsed: existingUsage.assessmentsUsed !== null
              ? existingUsage.assessmentsUsed + (features.assessmentLimit ?? 0)
              : features.assessmentLimit,
            messagesUsed: existingUsage.messagesUsed !== null
              ? existingUsage.messagesUsed + (features.messagesPerMonth ?? 0)
              : features.messagesPerMonth,
            documentReviewsUsed: existingUsage.documentReviewsUsed !== null
              ? existingUsage.documentReviewsUsed + (features.documentReviewsPerMonth ?? 0)
              : features.documentReviewsPerMonth,
            reportCreate: existingUsage.reportCreate !== null
              ? existingUsage.reportCreate + (features.reportCreate ?? 0)
              : features.reportCreate,
            reportsGeneratedUsed: existingUsage.reportsGeneratedUsed !== null
              ? existingUsage.reportsGeneratedUsed + (features.reportsGeneratedPerMonth ?? 0)
              : features.reportsGeneratedPerMonth,
            notificationsSend: existingUsage.notificationsSend !== null
              ? existingUsage.notificationsSend + (features.notificationsSend ?? 0)
              : features.notificationsSend,
            month: currentMonth,
            year: currentYear,
          }
      });
    } else {
      return await prisma.planLimitData.create({
        data: isEnterprise
          ? {
            subscriptionId,
            suppliersUsed: null,
            assessmentsUsed: null,
            messagesUsed: null,
            documentReviewsUsed: null,
            reportCreate: null,
            reportsGeneratedUsed: null,
            notificationsSend: null,
            month: currentMonth,
            year: currentYear,
          }
          : {
            subscriptionId,
            suppliersUsed: features.supplierLimit,
            assessmentsUsed: features.assessmentLimit,
            messagesUsed: features.messagesPerMonth,
            documentReviewsUsed: features.documentReviewsPerMonth,
            reportCreate: features.reportCreate,
            reportsGeneratedUsed: features.reportsGeneratedPerMonth,
            notificationsSend: features.notificationsSend,
            month: currentMonth,
            year: currentYear,
          }
      });
    }
  }

  // ========== VALIDATE SUBSCRIPTION STATUS ==========
  private async validateSubscription(userId: string) {
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
      include: { plan: true }
    });

    if (!subscription) {
      throw new ApiError(httpStatus.NOT_FOUND, "No active subscription found");
    }

    // Check if subscription is active
    if (!['ACTIVE', 'TRIALING'].includes(subscription.status)) {
      throw new ApiError(httpStatus.FORBIDDEN, "Your subscription is not active");
    }

    // Check if trial has ended
    if (subscription.status === 'TRIALING' && subscription.trialEnd && subscription.trialEnd < new Date()) {
      throw new ApiError(httpStatus.FORBIDDEN, "Your trial period has ended");
    }

    // Check if subscription period has ended
    if (subscription.currentPeriodEnd && subscription.currentPeriodEnd < new Date()) {
      throw new ApiError(httpStatus.FORBIDDEN, "Your subscription has expired");
    }

    return subscription;
  }

  // ========== DECREMENT USAGE ==========
  async decrementUsage(
    userId: string,
    field: keyof Pick<
      PlanLimitData,
      | 'suppliersUsed'
      | 'assessmentsUsed'
      | 'messagesUsed'
      | 'documentReviewsUsed'
      | 'reportCreate'
      | 'reportsGeneratedUsed'
      | 'notificationsSend'
    >,
    count: number = 1
  ): Promise<{ success: boolean; remaining: number | null }> {
    // Validate subscription
    const subscription = await this.validateSubscription(userId);
    console.log("Decrement heare come...")
    // Enterprise plans have unlimited usage (null)
    if (subscription.plan.type === "ENTERPRISE") {
      return { success: true, remaining: null };
    }

    // Get current usage
    const usage = await this.getCurrentUsage(subscription.id);
    console.log("Decrement heare come...")

    // Get current value
    const currentValue = usage[field] as number | null;
    console.log("Decrement currentValue come...")

    if (currentValue === null) {
      // Unlimited for this field
      return { success: true, remaining: null };
    }

    if (currentValue < count) {
      throw new ApiError(httpStatus.PAYMENT_REQUIRED, {
        message: `Insufficient ${this.getFieldDisplayName(field)}. Available: ${currentValue}, Required: ${count}`,
        code: 'LIMIT_EXCEEDED',
        limit: currentValue,
        required: count,
        field
      });
    }

    // Decrement the value
    const newValue = currentValue - count;
    console.log("Decrement newValue come...")
    await prisma.planLimitData.update({
      where: { subscriptionId: subscription.id },
      data: { [field]: newValue }
    });

    return { success: true, remaining: newValue };
  }

  // ========== CHECK USAGE WITHOUT DECREMENT ==========
  async checkUsage(
    userId: string,
    field: keyof Pick<
      PlanLimitData,
      | 'suppliersUsed'
      | 'assessmentsUsed'
      | 'messagesUsed'
      | 'documentReviewsUsed'
      | 'reportCreate'
      | 'reportsGeneratedUsed'
      | 'notificationsSend'
    >,
    count: number = 1
  ): Promise<UsageCheckResult> {
    try {
      const subscription = await this.validateSubscription(userId);

      // Enterprise plans have unlimited usage
      if (subscription.plan.type === "ENTERPRISE") {
        return { canProceed: true, remaining: null, limit: null };
      }

      const usage = await this.getCurrentUsage(subscription.id);
      const currentValue = usage[field] as number | null;

      if (currentValue === null) {
        return { canProceed: true, remaining: null, limit: null };
      }

      if (currentValue < count) {
        return {
          canProceed: false,
          remaining: currentValue,
          limit: currentValue,
          message: `Insufficient ${this.getFieldDisplayName(field)}. Available: ${currentValue}, Required: ${count}`
        };
      }

      return {
        canProceed: true,
        remaining: currentValue,
        limit: currentValue
      };
    } catch (error) {
      return {
        canProceed: false,
        message: error instanceof Error ? error.message : "Usage check failed"
      };
    }
  }

  // ========== BULK SUPPLIER LIMIT CHECK ==========
  async checkBulkSupplierLimit(userId: string, requiredCount: number): Promise<BulkLimitCheckResult> {
    try {
      const subscription = await this.validateSubscription(userId);

      // Enterprise plans have unlimited suppliers
      if (subscription.plan.type === "ENTERPRISE") {
        return { canProceed: true, limit: null, remaining: null };
      }

      const usage = await this.getCurrentUsage(subscription.id);
      const currentSuppliers = usage.suppliersUsed as number | null;

      if (currentSuppliers === null) {
        return { canProceed: true, limit: null, remaining: null };
      }

      if (currentSuppliers < requiredCount) {
        return {
          canProceed: false,
          remaining: currentSuppliers,
          limit: currentSuppliers,
          message: `Cannot add ${requiredCount} suppliers. You have ${currentSuppliers} supplier slots remaining.`
        };
      }

      return {
        canProceed: true,
        remaining: currentSuppliers,
        limit: currentSuppliers
      };
    } catch (error) {
      return {
        canProceed: false,
        message: error instanceof Error ? error.message : "Bulk limit check failed"
      };
    }
  }


  // ========== GET REMAINING LIMITS ==========
  async getRemainingLimits(userId: string): Promise<{
    limits: Record<string, number | null>;
    subscription: any;
  }> {
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
      include: { plan: true, PlanLimitData: true }
    });

    if (!subscription) {
      throw new ApiError(httpStatus.NOT_FOUND, "No subscription found");
    }

    const usage = subscription.PlanLimitData || await this.getCurrentUsage(subscription.id);
    const features = getPlanFeatures(subscription.plan);

    // Get all usage values
    const limits = {
      suppliersUsed: usage.suppliersUsed,
      assessmentsUsed: usage.assessmentsUsed,
      messagesUsed: usage.messagesUsed,
      documentReviewsUsed: usage.documentReviewsUsed,
      reportCreate: usage.reportCreate,
      reportsGeneratedUsed: usage.reportsGeneratedUsed,
      notificationsSend: usage.notificationsSend,
    };

    // Also include the plan features for reference
    const planFeatures = {
      supplierLimit: features.supplierLimit,
      assessmentLimit: features.assessmentLimit,
      messagesPerMonth: features.messagesPerMonth,
      documentReviewsPerMonth: features.documentReviewsPerMonth,
      reportCreate: features.reportCreate,
      reportsGeneratedPerMonth: features.reportsGeneratedPerMonth,
      notificationsSend: features.notificationsSend,
    };

    return {
      limits,
      subscription: {
        id: subscription.id,
        status: subscription.status,
        plan: subscription.plan,
      }
    };
  }

  // ========== RESET EXPIRED SUBSCRIPTION ==========
  async resetExpiredSubscription(userId: string): Promise<void> {
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
      include: { plan: true }
    });

    if (!subscription) return;

    const isExpired = subscription.currentPeriodEnd && subscription.currentPeriodEnd < new Date();
    const isTrialExpired = subscription.status === 'TRIALING' &&
      subscription.trialEnd &&
      subscription.trialEnd < new Date();

    if (isExpired || isTrialExpired) {
      // Reset usage to minimum/zero
      await prisma.planLimitData.update({
        where: { subscriptionId: subscription.id },
        data: {
          suppliersUsed: 0,
          assessmentsUsed: 0,
          messagesUsed: 0,
          documentReviewsUsed: 0,
          reportCreate: 0,
          reportsGeneratedUsed: 0,
          notificationsSend: 0,
        }
      });

      // Update subscription status
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: isTrialExpired ? 'EXPIRED' : 'CANCELED',
          updatedAt: new Date()
        }
      });
    }
  }

  // ========== HANDLE PLAN UPGRADE/DOWNGRADE ==========
  async handlePlanChange(
    subscriptionId: string,
    newPlanId: string,
    previousPlanId?: string
  ): Promise<void> {
    const [newPlan, subscription] = await Promise.all([
      prisma.plan.findUnique({ where: { id: newPlanId } }),
      prisma.subscription.findUnique({
        where: { id: subscriptionId },
        include: { PlanLimitData: true }
      })
    ]);

    if (!newPlan || !subscription) {
      throw new ApiError(httpStatus.NOT_FOUND, "Plan or subscription not found");
    }

    const features = getPlanFeatures(newPlan);
    const isEnterprisePlan = newPlan.type === "ENTERPRISE";
    const existingUsage = subscription.PlanLimitData;

    if (existingUsage) {
      // Update existing usage with cumulative addition
      await prisma.planLimitData.update({
        where: { subscriptionId },
        data: isEnterprisePlan
          ? {
            // Enterprise: set to unlimited (null)
            suppliersUsed: null,
            assessmentsUsed: null,
            messagesUsed: null,
            documentReviewsUsed: null,
            reportCreate: null,
            reportsGeneratedUsed: null,
            notificationsSend: null,
          }
          : {
            // Cumulative addition for non-enterprise plans
            suppliersUsed: existingUsage.suppliersUsed !== null && features.supplierLimit !== null
              ? existingUsage.suppliersUsed + features.supplierLimit
              : features.supplierLimit,
            assessmentsUsed: existingUsage.assessmentsUsed !== null && features.assessmentLimit !== null
              ? existingUsage.assessmentsUsed + features.assessmentLimit
              : features.assessmentLimit,
            messagesUsed: existingUsage.messagesUsed !== null && features.messagesPerMonth !== null
              ? existingUsage.messagesUsed + features.messagesPerMonth
              : features.messagesPerMonth,
            documentReviewsUsed: existingUsage.documentReviewsUsed !== null && features.documentReviewsPerMonth !== null
              ? existingUsage.documentReviewsUsed + features.documentReviewsPerMonth
              : features.documentReviewsPerMonth,
            reportCreate: existingUsage.reportCreate !== null && features.reportCreate !== null
              ? existingUsage.reportCreate + features.reportCreate
              : features.reportCreate,
            reportsGeneratedUsed: existingUsage.reportsGeneratedUsed !== null && features.reportsGeneratedPerMonth !== null
              ? existingUsage.reportsGeneratedUsed + features.reportsGeneratedPerMonth
              : features.reportsGeneratedPerMonth,
            notificationsSend: existingUsage.notificationsSend !== null && features.notificationsSend !== null
              ? existingUsage.notificationsSend + features.notificationsSend
              : features.notificationsSend,
          }
      });
    } else {
      // Create new usage record
      await prisma.planLimitData.create({
        data: isEnterprisePlan
          ? {
            subscriptionId,
            suppliersUsed: null,
            assessmentsUsed: null,
            messagesUsed: null,
            documentReviewsUsed: null,
            reportCreate: null,
            reportsGeneratedUsed: null,
            notificationsSend: null,
          }
          : {
            subscriptionId,
            suppliersUsed: features.supplierLimit,
            assessmentsUsed: features.assessmentLimit,
            messagesUsed: features.messagesPerMonth,
            documentReviewsUsed: features.documentReviewsPerMonth,
            reportCreate: features.reportCreate,
            reportsGeneratedUsed: features.reportsGeneratedPerMonth,
            notificationsSend: features.notificationsSend,
          }
      });
    }
  }

  // ========== HELPER METHODS ==========
  private getFieldDisplayName(field: string): string {
    const fieldNames: Record<string, string> = {
      suppliersUsed: 'supplier slots',
      assessmentsUsed: 'assessment reviews',
      messagesUsed: 'messages',
      documentReviewsUsed: 'document reviews',
      reportCreate: 'report creation',
      reportsGeneratedUsed: 'report generation',
      notificationsSend: 'notifications'
    };
    return fieldNames[field] || field;
  }

  // ========== MIDDLEWARE FOR ROUTES ==========
  async decrementMiddleware(
    userId: string,
    field: keyof Pick<
      PlanLimitData,
      | 'suppliersUsed'
      | 'assessmentsUsed'
      | 'messagesUsed'
      | 'documentReviewsUsed'
      | 'reportCreate'
      | 'reportsGeneratedUsed'
      | 'notificationsSend'
    >,
    count: number = 1
  ) {
    const result = await this.decrementUsage(userId, field, count);

    if (!result.success) {
      throw new ApiError(httpStatus.PAYMENT_REQUIRED,
        `Insufficient ${this.getFieldDisplayName(field)} available. Please upgrade your plan.`
      );
    }

    return result;
  }
}

export const usageService = new UsageService();