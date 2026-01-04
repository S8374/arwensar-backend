// src/services/PlanLimitService.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface PlanFeatures {
  supplierLimit: number | null;
  assessmentLimit: number | null;
  messagesPerMonth: number | null;
  documentReviewsPerMonth: number | null;
  reportCreate: number | null;
  reportsGeneratedPerMonth: number | null;
  notificationsSend: number | null;
}

export interface UsageCheckResult {
  allowed: boolean;
  remaining: number;
  message?: string;
}

export class PlanLimitService {
  // Get current usage for a vendor
  static async getCurrentUsage(vendorId: string) {
    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
      include: {
        user: {
          include: {
            subscription: {
              include: {
                plan: true,
                PlanLimitData: true,
              },
            },
          },
        },
      },
    });

    if (!vendor || !vendor.user?.subscription) {
      throw new Error('Vendor or subscription not found');
    }

    const subscription = vendor.user.subscription;
    const plan = subscription.plan;
    const usage = subscription.PlanLimitData;
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    // Check if usage needs reset (new month)
    if (
      !usage ||
      usage.month !== currentMonth ||
      usage.year !== currentYear
    ) {
      // Reset usage for new month
      const features = this.getPlanFeatures(plan);
      const resetUsage = await prisma.planLimitData.upsert({
        where: { subscriptionId: subscription.id },
        update: {
          suppliersUsed: 0,
          assessmentsUsed: 0,
          messagesUsed: 0,
          documentReviewsUsed: 0,
          reportCreate: 0,
          reportsGeneratedUsed: 0,
          notificationsSend: 0,
          test: 0,
          month: currentMonth,
          year: currentYear,
        },
        create: {
          subscriptionId: subscription.id,
          suppliersUsed: 0,
          assessmentsUsed: 0,
          messagesUsed: 0,
          documentReviewsUsed: 0,
          reportCreate: 0,
          reportsGeneratedUsed: 0,
          notificationsSend: 0,
          test: 0,
          month: currentMonth,
          year: currentYear,
        },
      });

      return {
        plan: plan,
        usage: resetUsage,
        limits: features,
        subscription: subscription,
      };
    }

    const features = this.getPlanFeatures(plan);
    return {
      plan: plan,
      usage: usage,
      limits: features,
      subscription: subscription,
    };
  }

  // Check and increment usage
  static async checkAndIncrementUsage(
    vendorId: string,
    limitType: keyof Omit<
      PlanFeatures,
      'supplierLimit' | 'assessmentLimit'
    >,
    incrementBy: number = 1
  ): Promise<UsageCheckResult> {
    const current = await this.getCurrentUsage(vendorId);
    const usage = current.usage;
    const limits = current.limits;

    const limitKeyMap = {
      messagesPerMonth: 'messagesUsed' as const,
      documentReviewsPerMonth: 'documentReviewsUsed' as const,
      reportCreate: 'reportCreate' as const,
      reportsGeneratedPerMonth: 'reportsGeneratedUsed' as const,
      notificationsSend: 'notificationsSend' as const,
    };

    const usageField = limitKeyMap[limitType];
    const currentUsed = usage[usageField] ?? 0; // Handle null case
    const planLimit = limits[limitType] ?? 0; // Handle null case

    // Unlimited (null) always allowed
    if (planLimit === null) {
      return { allowed: true, remaining: -1 };
    }

    // Check if limit is exceeded
    if (planLimit !== -1 && currentUsed + incrementBy > planLimit) {
      return { 
        allowed: false, 
        remaining: Math.max(0, planLimit - currentUsed),
        message: `${limitType} limit exceeded. Available: ${Math.max(0, planLimit - currentUsed)}, Requested: ${incrementBy}`
      };
    }

    // Increment usage if not unlimited
    if (planLimit !== -1) {
      await prisma.planLimitData.update({
        where: { id: usage.id },
        data: {
          [usageField]: currentUsed + incrementBy,
        },
      });
    }

    return {
      allowed: true,
      remaining: planLimit === -1 ? -1 : planLimit - (currentUsed + incrementBy),
    };
  }

  // Check supplier creation
  static async checkSupplierCreation(
    vendorId: string,
    count: number = 1
  ): Promise<UsageCheckResult> {
    const current = await this.getCurrentUsage(vendorId);
    const plan = current.plan;
    
    // Get total suppliers count for this vendor
    const totalSuppliers = await prisma.supplier.count({
      where: {
        vendorId: vendorId,
        isDeleted: false,
      },
    });

    const currentUsed = totalSuppliers;
    const planLimit = plan.supplierLimit ?? 0; // Handle null case

    // Unlimited (null) always allowed
    if (planLimit === null) {
      return { allowed: true, remaining: -1 };
    }

    // Check if limit is exceeded
    if (planLimit !== -1 && currentUsed + count > planLimit) {
      return { 
        allowed: false, 
        remaining: Math.max(0, planLimit - currentUsed),
        message: `Supplier limit exceeded. Available: ${Math.max(0, planLimit - currentUsed)}, Requested: ${count}`
      };
    }

    return {
      allowed: true,
      remaining: planLimit === -1 ? -1 : planLimit - (currentUsed + count),
    };
  }

  // Check assessment limit
  static async checkAssessmentLimit(
    vendorId: string
  ): Promise<UsageCheckResult> {
    const current = await this.getCurrentUsage(vendorId);
    const usage = current.usage;
    const plan = current.plan;

    const currentUsed = usage.assessmentsUsed ?? 0; // Handle null case
    const planLimit = plan.assessmentLimit ?? 0; // Handle null case

    // Unlimited (null) always allowed
    if (planLimit === null) {
      return { allowed: true, remaining: -1 };
    }

    // Check if limit is exceeded
    if (planLimit !== -1 && currentUsed + 1 > planLimit) {
      return { 
        allowed: false, 
        remaining: Math.max(0, planLimit - currentUsed),
        message: `Assessment limit exceeded. Available: ${Math.max(0, planLimit - currentUsed)}`
      };
    }

    // Increment usage if not unlimited
    if (planLimit !== -1) {
      await prisma.planLimitData.update({
        where: { id: usage.id },
        data: {
          assessmentsUsed: currentUsed + 1,
        },
      });
    }

    return {
      allowed: true,
      remaining: planLimit === -1 ? -1 : planLimit - (currentUsed + 1),
    };
  }

  // Get remaining limits for all features
  static async getRemainingLimits(vendorId: string) {
    const current = await this.getCurrentUsage(vendorId);
    const usage = current.usage;
    const limits = current.limits;
    const plan = current.plan;

    // Get supplier count
    const totalSuppliers = await prisma.supplier.count({
      where: {
        vendorId: vendorId,
        isDeleted: false,
      },
    });

    const result: Record<string, {
      used: number;
      limit: number | null;
      remaining: number | null;
      isUnlimited: boolean;
    }> = {};

    // Supplier limit
    const supplierLimit = plan.supplierLimit;
    result.suppliers = {
      used: totalSuppliers,
      limit: supplierLimit,
      remaining: supplierLimit === null ? null : (supplierLimit === -1 ? -1 : Math.max(0, supplierLimit - totalSuppliers)),
      isUnlimited: supplierLimit === null || supplierLimit === -1,
    };

    // Assessment limit
    const assessmentLimit = plan.assessmentLimit;
    const assessmentsUsed = usage.assessmentsUsed ?? 0;
    result.assessments = {
      used: assessmentsUsed,
      limit: assessmentLimit,
      remaining: assessmentLimit === null ? null : (assessmentLimit === -1 ? -1 : Math.max(0, assessmentLimit - assessmentsUsed)),
      isUnlimited: assessmentLimit === null || assessmentLimit === -1,
    };

    // Other limits
    const otherLimits = {
      messagesPerMonth: { used: usage.messagesUsed ?? 0, limit: limits.messagesPerMonth },
      documentReviewsPerMonth: { used: usage.documentReviewsUsed ?? 0, limit: limits.documentReviewsPerMonth },
      reportCreate: { used: usage.reportCreate ?? 0, limit: limits.reportCreate },
      reportsGeneratedPerMonth: { used: usage.reportsGeneratedUsed ?? 0, limit: limits.reportsGeneratedPerMonth },
      notificationsSend: { used: usage.notificationsSend ?? 0, limit: limits.notificationsSend },
    };

    Object.entries(otherLimits).forEach(([key, { used, limit }]) => {
      result[key] = {
        used,
        limit,
        remaining: limit === null ? null : (limit === -1 ? -1 : Math.max(0, limit - used)),
        isUnlimited: limit === null || limit === -1,
      };
    });

    return result;
  }

  // Check subscription status
  static async checkSubscriptionStatus(vendorId: string): Promise<{
    isActive: boolean;
    message?: string;
    subscription: any;
  }> {
    const current = await this.getCurrentUsage(vendorId);
    const subscription = current.subscription;

    if (!subscription) {
      return {
        isActive: false,
        message: 'No subscription found',
        subscription: null,
      };
    }

    // Check subscription status
    const validStatuses = ['ACTIVE', 'TRIALING'];
    if (!validStatuses.includes(subscription.status)) {
      return {
        isActive: false,
        message: `Subscription is ${subscription.status.toLowerCase()}`,
        subscription,
      };
    }

    // Check if subscription period has ended
    if (subscription.currentPeriodEnd && subscription.currentPeriodEnd < new Date()) {
      return {
        isActive: false,
        message: 'Subscription has expired',
        subscription,
      };
    }

    return {
      isActive: true,
      subscription,
    };
  }

  // Helper function to extract features from plan
  static getPlanFeatures(plan: any): PlanFeatures {
    const features = typeof plan.features === 'string' 
      ? JSON.parse(plan.features) 
      : plan.features || {};

    return {
      supplierLimit: plan.supplierLimit,
      assessmentLimit: plan.assessmentLimit,
      messagesPerMonth: features.messagesPerMonth ?? null,
      documentReviewsPerMonth: features.documentReviewsPerMonth ?? null,
      reportCreate: features.reportCreate ?? null,
      reportsGeneratedPerMonth: features.reportsGeneratedPerMonth ?? null,
      notificationsSend: features.notificationsSend ?? null,
    };
  }

  // Middleware for route protection
  static createLimitMiddleware(
    limitType: keyof PlanFeatures | 'supplierLimit' | 'assessmentLimit',
    incrementBy: number = 1
  ) {
    return async (req: any, res: any, next: any) => {
      try {
        const vendorId = req.user?.vendorProfile?.id;
        
        if (!vendorId) {
          return res.status(401).json({
            success: false,
            message: 'Vendor not found',
          });
        }

        // First check subscription status
        const subscriptionCheck = await this.checkSubscriptionStatus(vendorId);
        if (!subscriptionCheck.isActive) {
          return res.status(403).json({
            success: false,
            message: subscriptionCheck.message || 'Subscription is not active',
          });
        }

        let checkResult: UsageCheckResult;

        if (limitType === 'supplierLimit') {
          // For supplier creation, count is determined by the request
          const count = req.body.suppliers?.length || 1;
          checkResult = await this.checkSupplierCreation(vendorId, count);
        } else if (limitType === 'assessmentLimit') {
          checkResult = await this.checkAssessmentLimit(vendorId);
        } else {
          checkResult = await this.checkAndIncrementUsage(vendorId, limitType, incrementBy);
        }

        if (!checkResult.allowed) {
          return res.status(429).json({
            success: false,
            message: checkResult.message || 'Plan limit exceeded',
            remaining: checkResult.remaining,
          });
        }

        // Attach limit info to request for logging
        req.limitInfo = {
          limitType,
          remaining: checkResult.remaining,
          allowed: checkResult.allowed,
        };

        next();
      } catch (error: any) {
        console.error('Limit middleware error:', error);
        return res.status(500).json({
          success: false,
          message: 'Error checking plan limits',
          error: error.message,
        });
      }
    };
  }
}