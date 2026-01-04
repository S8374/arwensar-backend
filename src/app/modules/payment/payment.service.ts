// src/app/modules/payment/payment.service.ts
import { Plan, Subscription, Payment, PaymentStatus, SubscriptionStatus, BillingCycle } from "@prisma/client";
import { prisma } from "../../shared/prisma";
import { stripeService } from "../../shared/stripe.service";
import ApiError from "../../../error/ApiError";
import httpStatus from "http-status";
import { config } from "../../../config";
import { mailtrapService } from "../../shared/mailtrap.service";
import { getPlanFeatures } from "../../helper/getFeatures";

export interface CheckoutSessionResponse {
  url: string;
  sessionId: string;
  subscriptionId: string;
}

export interface PaymentHistory {
  id: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paymentType: string;
  paidAt: Date | null;
  createdAt: Date;
  planName: string | null;
}

export const PaymentService = {
  // ========== GET AVAILABLE PLANS ==========
  async getAvailablePlans(): Promise<Plan[]> {
    return prisma.plan.findMany({
      where: {
        isActive: true,
        isDeleted: false
      },
      orderBy: [
        { isPopular: 'desc' },
        { price: 'asc' }
      ]
    });
  },

  // ========== GET PLAN BY ID ==========
  async getPlanById(planId: string): Promise<Plan | null> {
    return prisma.plan.findUnique({
      where: {
        id: planId,
        isActive: true,
        isDeleted: false
      }
    });
  },

  // ========== CREATE CHECKOUT SESSION ==========
  async createCheckoutSession(
    userId: string,
    planId: string,
    billingCycle: BillingCycle = 'MONTHLY'
  ): Promise<CheckoutSessionResponse> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { vendorProfile: true }
    });

    if (!user || !user.vendorProfile) {
      throw new ApiError(httpStatus.NOT_FOUND, "User or vendor profile not found");
    }

    const vendor = user.vendorProfile;
    const plan = await this.getPlanById(planId);

    if (!plan || !plan.stripePriceId) {
      throw new ApiError(httpStatus.NOT_FOUND, "Plan not found or not configured for Stripe");
    }

    const existingSubscription = await prisma.subscription.findUnique({
      where: { userId }
    });

    // Block same plan
    if (
      existingSubscription &&
      existingSubscription.planId === planId &&
      existingSubscription.billingCycle === billingCycle &&
      ['ACTIVE', 'TRIALING', 'PAST_DUE'].includes(existingSubscription.status)
    ) {
      throw new ApiError(httpStatus.BAD_REQUEST, "You are already on this plan.");
    }

    // Get/create customer
    let stripeCustomerId = vendor.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await stripeService.createCustomer(user.email, vendor.companyName, {
        userId: user.id,
        vendorId: vendor.id,
      });
      stripeCustomerId = customer.id;
      await prisma.vendor.update({
        where: { id: vendor.id },
        data: { stripeCustomerId }
      });
    }

    const isPlanChange = !!existingSubscription && existingSubscription.planId !== planId;

    const subscription = await prisma.subscription.upsert({
      where: { userId },
      update: {
        planId: plan.id,
        billingCycle,
        status: 'PENDING',
        stripeCustomerId,
        // No trial for paid plans - payment required immediately
        trialEnd: null,
        trialStart: null,
      },
      create: {
        userId,
        planId: plan.id,
        billingCycle,
        status: 'PENDING',
        stripeCustomerId,
        // No trial for paid plans - payment required immediately
        trialEnd: null,
        trialStart: null,
      }
    });

    // Build session metadata
    const metadata: any = {
      userId: user.id,
      vendorId: vendor.id,
      planId: plan.id,
      subscriptionId: subscription.id,
      planName: plan.name,
      billingCycle,
      isPlanChange: isPlanChange.toString(),
    };

    // Add previous subscription info for plan changes
    if (isPlanChange && existingSubscription) {
      metadata.previousPlanId = existingSubscription.planId;
      metadata.previousSubscriptionId = existingSubscription.id;
      metadata.previousStripeSubscriptionId = existingSubscription.stripeSubscriptionId;
      metadata.previousBillingCycle = existingSubscription.billingCycle;
    }

    // Build checkout session - ALWAYS require payment
    const session = await stripeService.stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription',
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      metadata,
      success_url: `${config.FRONTEND_URL}/dashboard/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${config.FRONTEND_URL}/dashboard/pricing`,
      billing_address_collection: 'required',
      allow_promotion_codes: true,
      payment_method_types: ['card'],
      payment_method_collection: 'always',
    });

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { stripeSessionId: session.id }
    });

    return {
      url: session.url!,
      sessionId: session.id,
      subscriptionId: subscription.id,
    };
  },

  // ========== GET SESSION STATUS ==========
  async getSessionStatus(sessionId: string): Promise<any> {
    try {
      const session = await stripeService.stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['subscription', 'customer']
      });

      return {
        id: session.id,
        status: session.status,
        paymentStatus: session.payment_status,
        customerEmail: session.customer_email,
        customerId: session.customer,
        amountTotal: session.amount_total ? session.amount_total / 100 : 0,
        currency: session.currency?.toUpperCase(),
        metadata: session.metadata,
        subscriptionId: session.subscription,
        createdAt: new Date(session.created * 1000)
      };
    } catch (error: any) {
      throw new ApiError(httpStatus.BAD_REQUEST, `Invalid session ID: ${error.message}`);
    }
  },

  // ========== CONFIRM PAYMENT ==========
  async confirmPayment(sessionId: string): Promise<{
    success: boolean;
    message: string;
    data: any;
  }> {
    console.log("Confirming payment for session:", sessionId);

    const session = await this.getSessionStatus(sessionId);

    if (session.status !== 'complete' || session.paymentStatus !== 'paid') {
      throw new ApiError(httpStatus.BAD_REQUEST, "Payment not completed yet");
    }

    const { userId, subscriptionId, planId } = session.metadata;

    if (!userId || !subscriptionId || !planId) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid session metadata");
    }

    // Check if user already has an active subscription
    const existingActiveSubscription = await prisma.subscription.findUnique({
      where: { userId },
      include: {
        plan: true,
        PlanLimitData: true,
      }
    });

    // Get the new plan
    const newPlan = await prisma.plan.findUnique({
      where: { id: planId }
    });

    if (!newPlan) {
      throw new ApiError(httpStatus.NOT_FOUND, "Plan not found");
    }

    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        plan: true,
        user: { include: { vendorProfile: true } }
      }
    });

    if (!subscription) {
      throw new ApiError(httpStatus.NOT_FOUND, "Subscription not found");
    }

    const stripeSubscription = session.subscriptionId
      ? await stripeService.stripe.subscriptions.retrieve(session.subscriptionId as string)
      : null;

    // Start a transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // If user has an existing active subscription, handle upgrade/downgrade
      if (existingActiveSubscription &&
        ['ACTIVE', 'TRIALING', 'PAST_DUE'].includes(existingActiveSubscription.status)) {

        // Check if this is an upgrade or downgrade
        const isUpgrade = this.isPlanUpgrade(existingActiveSubscription.plan, newPlan);

        // Update the existing subscription (change plan)
        const updatedSubscription = await tx.subscription.update({
          where: { id: existingActiveSubscription.id },
          data: {
            planId: newPlan.id,
            status: stripeSubscription?.status?.toUpperCase() as SubscriptionStatus || 'ACTIVE',
            stripeSubscriptionId: stripeSubscription?.id || session.subscriptionId as string,
            currentPeriodStart: (stripeSubscription as any)?.current_period_start
              ? new Date((stripeSubscription as any).current_period_start * 1000)
              : new Date(),
            currentPeriodEnd: (stripeSubscription as any)?.current_period_end
              ? new Date((stripeSubscription as any).current_period_end * 1000)
              : null,
            // No trial for paid upgrades/downgrades
            trialStart: null,
            trialEnd: null,
            updatedAt: new Date(),
          },
          include: {
            plan: true,
            PlanLimitData: true,
          }
        });

        // Create a payment record for the plan change
        await tx.payment.create({
          data: {
            userId,
            planId: newPlan.id,
            subscriptionId: updatedSubscription.id,
            amount: newPlan.price,
            currency: newPlan.currency,
            status: 'SUCCEEDED',
            paymentType: isUpgrade ? 'UPGRADE' : 'DOWNGRADE',
            stripePaymentId: session.payment_intent as string | null,
            stripeInvoiceId: session.invoice as string | null,
            stripeCustomerId: session.customer as string,
            billingEmail: subscription.user.email,
            paidAt: new Date(),
            metadata: {
              sessionId: session.id,
              previousPlanId: existingActiveSubscription.planId,
              previousPlanName: existingActiveSubscription.plan.name,
              newPlanId: newPlan.id,
              newPlanName: newPlan.name,
              isUpgrade,
              changeDate: new Date().toISOString(),
            },
          },
        });

        // Send upgrade/downgrade email
        if (subscription.user.vendorProfile?.businessEmail) {
          try {
            await mailtrapService.sendHtmlEmail({
              to: subscription.user.vendorProfile.businessEmail,
              subject: isUpgrade
                ? `🎉 Your Plan Has Been Upgraded to ${newPlan.name}!`
                : `📋 Your Plan Has Been Changed to ${newPlan.name}`,
              html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #1a5fb4;">${isUpgrade ? 'Plan Upgrade Successful!' : 'Plan Change Confirmed'}</h2>
                <p>${isUpgrade ? 'Congratulations!' : 'Your plan has been successfully changed.'}</p>
                
                <div style="background-color: #f0f8ff; padding: 20px; border-radius: 8px; margin: 25px 0;">
                  <h3>Plan Details</h3>
                  <p><strong>Previous Plan:</strong> ${existingActiveSubscription.plan.name}</p>
                  <p><strong>New Plan:</strong> ${newPlan.name}</p>
                  <p><strong>Price:</strong> ${newPlan.price} ${newPlan.currency}/${updatedSubscription.billingCycle.toLowerCase()}</p>
                  <p><strong>Status:</strong> ${updatedSubscription.status}</p>
                </div>
                
                <div style="background-color: #f9f9f9; padding: 15px; border-radius: 6px; margin: 20px 0;">
                  <h4 style="margin-top: 0;">New Plan Features:</h4>
                  <ul style="margin: 10px 0; padding-left: 20px;">
                    <li><strong>Suppliers:</strong> ${newPlan.supplierLimit === -1 ? 'Unlimited' : newPlan.supplierLimit}</li>
                    <li><strong>Assessments:</strong> ${newPlan.assessmentLimit === -1 ? 'Unlimited' : newPlan.assessmentLimit} per month</li>
                    <li><strong>Users:</strong> ${newPlan.userLimit === -1 ? 'Unlimited' : newPlan.userLimit}</li>
                  </ul>
                </div>
                
                <p>Your new plan is now active. You can continue using the platform with your updated limits.</p>
                
                <div style="text-align: center; margin: 35px 0;">
                  <a href="${config.FRONTEND_URL}/dashboard" style="background-color: #1a5fb4; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
                    Go to Dashboard →
                  </a>
                </div>
                
                <p style="color: #666; font-size: 14px;">
                  Questions about your plan? Contact our support team.<br>
                  © ${new Date().getFullYear()} CyberNark. All rights reserved.
                </p>
              </div>
            `
            });
          } catch (error) {
            console.error("Failed to send plan change email:", error);
          }
        }

        // Delete the pending subscription that was created during checkout
        await tx.subscription.delete({
          where: { id: subscriptionId }
        });

        return {
          subscription: updatedSubscription,
          isPlanChange: true,
          isUpgrade,
          previousPlan: existingActiveSubscription.planId,
          newPlan,

        };

      } else {
        // New subscription (first-time purchase)
        const updatedSubscription = await tx.subscription.update({
          where: { id: subscriptionId },
          data: {
            status: stripeSubscription?.status?.toUpperCase() as SubscriptionStatus || 'ACTIVE',
            stripeSubscriptionId: stripeSubscription?.id || session.subscriptionId as string,
            currentPeriodStart: (stripeSubscription as any)?.current_period_start
              ? new Date((stripeSubscription as any).current_period_start * 1000)
              : new Date(),
            currentPeriodEnd: (stripeSubscription as any)?.current_period_end
              ? new Date((stripeSubscription as any).current_period_end * 1000)
              : null,
            // No trial for new paid subscriptions
            trialStart: null,
            trialEnd: null,
          },
          include: {
            plan: true,
          }
        });

        // Create plan usage record for new subscription
        const planUsage = await tx.planLimitData.create({
          data: {
            subscriptionId: updatedSubscription.id,
            suppliersUsed: 0,
            assessmentsUsed: 0,
            messagesUsed: 0,
            documentReviewsUsed: 0,
            reportCreate: 0,
            reportsGeneratedUsed: 0,
            notificationsSend: 0,
            month: new Date().getMonth(),
            year: new Date().getFullYear(),
          },
        });

        // Update vendor with Stripe customer ID
        if (subscription.user.vendorProfile) {
          await tx.vendor.update({
            where: { id: subscription.user.vendorProfile.id },
            data: {
              stripeCustomerId: session.customer as string,
            },
          });
        }

        return {
          subscription: updatedSubscription,
          isPlanChange: false,
          isUpgrade: false,
          newPlan,
          planUsage,
        };
      }
    });

    // Send welcome email for new subscriptions only
    if (!result.isPlanChange && subscription.user.vendorProfile?.businessEmail) {
      try {
        await mailtrapService.sendHtmlEmail({
          to: subscription.user.vendorProfile.businessEmail,
          subject: `🎉 Welcome to ${result.newPlan.name} — Your Subscription is Now Active!`,
          html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1a5fb4;">Welcome to CyberNark!</h2>
            <p>Congratulations! Your <strong>${result.newPlan.name}</strong> subscription is now active.</p>
            
            <div style="background-color: #f0f8ff; padding: 20px; border-radius: 8px; margin: 25px 0;">
              <h3>Your Subscription Details</h3>
              <p><strong>Plan:</strong> ${result.newPlan.name}</p>
              <p><strong>Price:</strong> ${result.newPlan.price} ${result.newPlan.currency}/${result.subscription.billingCycle.toLowerCase()}</p>
              ${result.subscription.currentPeriodEnd ? `
                <p><strong>Next Billing Date:</strong> ${result.subscription.currentPeriodEnd.toLocaleDateString()}</p>
              ` : ''}
            </div>
            
            <div style="background-color: #f9f9f9; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <h4 style="margin-top: 0;">Plan Features:</h4>
              <ul style="margin: 10px 0; padding-left: 20px;">
                <li><strong>Suppliers:</strong> ${result.newPlan.supplierLimit === -1 ? 'Unlimited' : result.newPlan.supplierLimit}</li>
                <li><strong>Assessments:</strong> ${result.newPlan.assessmentLimit === -1 ? 'Unlimited' : result.newPlan.assessmentLimit} per month</li>
                <li><strong>Users:</strong> ${result.newPlan.userLimit === -1 ? 'Unlimited' : result.newPlan.userLimit}</li>
              </ul>
            </div>
            
            <p>You now have full access to all features. Explore the platform and see how CyberNark can help secure your supply chain.</p>
            
            <div style="text-align: center; margin: 35px 0;">
              <a href="${config.FRONTEND_URL}/dashboard" style="background-color: #1a5fb4; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
                Go to Dashboard →
              </a>
            </div>
            
            <p style="color: #666; font-size: 14px;">
              Questions? Contact support anytime.<br>
              © ${new Date().getFullYear()} CyberNark. All rights reserved.
            </p>
          </div>
        `
        });
      } catch (error) {
        console.error("Failed to send welcome email:", error);
      }
    }

    const responseMessage = result.isPlanChange
      ? result.isUpgrade
        ? `Plan upgraded to ${result.newPlan.name} successfully!`
        : `Plan changed to ${result.newPlan.name} successfully!`
      : "Subscription activated successfully!";

    return {
      success: true,
      message: responseMessage,
      data: {
        subscription: result.subscription,
        plan: result.newPlan,
        isPlanChange: result.isPlanChange,
        isUpgrade: result.isUpgrade,
        planUsage: result.planUsage,
      }
    };
  },

  // Helper method to determine if it's an upgrade
  isPlanUpgrade(oldPlan: any, newPlan: any): boolean {
    // Define plan hierarchy
    const planHierarchy: Record<string, number> = {
      'FREE': 0,
      'STARTER': 1,
      'BUSINESS': 2,
      'PROFESSIONAL': 3,
      'ENTERPRISE': 4,
      'CUSTOM': 5,
    };

    const oldPlanRank = planHierarchy[oldPlan.type] || 0;
    const newPlanRank = planHierarchy[newPlan.type] || 0;

    // Also consider price for same plan type but different tiers
    if (oldPlan.type === newPlan.type) {
      return parseFloat(newPlan.price.toString()) > parseFloat(oldPlan.price.toString());
    }

    return newPlanRank > oldPlanRank;
  },

  // ========== CREATE PORTAL SESSION ==========
  async createPortalSession(userId: string, returnUrl: string = '/dashboard'): Promise<{ url: string }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        vendorProfile: true,
        subscription: true
      }
    });

    if (!user || !user.vendorProfile) {
      throw new ApiError(httpStatus.NOT_FOUND, "User or vendor profile not found");
    }

    if (!user.subscription || !user.subscription.stripeCustomerId) {
      throw new ApiError(httpStatus.BAD_REQUEST, "No active subscription found");
    }

    const session = await stripeService.stripe.billingPortal.sessions.create({
      customer: user.subscription.stripeCustomerId,
      return_url: `${config.FRONTEND_URL}${returnUrl}`
    });

    return {
      url: session.url
    };
  },

  // ========== GET CURRENT SUBSCRIPTION ==========
  async getCurrentSubscription(userId: string): Promise<any> {
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
      include: {
        plan: true,
        payments: {
          where: {
            status: 'SUCCEEDED'
          },
          orderBy: {
            paidAt: 'desc'
          },
          take: 5
        }
      }
    });

    if (!subscription) {
      throw new ApiError(httpStatus.NOT_FOUND, "No subscription found");
    }

    // Get Stripe subscription details if available
    let stripeSubscription = null;
    if (subscription.stripeSubscriptionId) {
      try {
        stripeSubscription = await stripeService.stripe.subscriptions.retrieve(
          subscription.stripeSubscriptionId
        );
      } catch (error) {
        console.error("Failed to fetch Stripe subscription:", error);
      }
    }

    return {
      ...subscription,
      stripeSubscription,
      nextBillingDate: subscription.currentPeriodEnd,
      daysUntilRenewal: subscription.currentPeriodEnd
        ? Math.ceil((subscription.currentPeriodEnd.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
        : null
    };
  },

  // ========== GET PAYMENT HISTORY ==========
  async getPaymentHistory(userId: string, options: { page?: number; limit?: number } = {}): Promise<{
    payments: PaymentHistory[];
    meta: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }> {
    const page = options.page || 1;
    const limit = options.limit || 10;
    const skip = (page - 1) * limit;

    const where = { userId };

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          plan: {
            select: {
              name: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take: limit
      }),
      prisma.payment.count({ where })
    ]);

    const formattedPayments: PaymentHistory[] = payments.map(payment => ({
      id: payment.id,
      amount: payment.amount.toNumber(),
      currency: payment.currency,
      status: payment.status,
      paymentType: payment.paymentType,
      paidAt: payment.paidAt,
      createdAt: payment.createdAt,
      planName: payment.plan?.name || null
    }));

    return {
      payments: formattedPayments,
      meta: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  },

  // ========== CANCEL SUBSCRIPTION ==========
  async cancelSubscription(userId: string, cancelAtPeriodEnd: boolean = true): Promise<{
    success: boolean;
    message: string;
    data: any;
  }> {
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
      include: {
        plan: true
      }
    });

    if (!subscription) {
      throw new ApiError(httpStatus.NOT_FOUND, "No subscription found");
    }

    if (subscription.status === 'CANCELED') {
      throw new ApiError(httpStatus.BAD_REQUEST, "Subscription is already canceled");
    }

    // Cancel in Stripe if subscription exists there
    if (subscription.stripeSubscriptionId) {
      try {
        await stripeService.stripe.subscriptions.update(subscription.stripeSubscriptionId, {
          cancel_at_period_end: cancelAtPeriodEnd
        });
      } catch (error: any) {
        console.error("Failed to cancel Stripe subscription:", error);
        // Continue with local cancellation even if Stripe fails
      }
    }

    // Update local subscription
    const updatedSubscription = await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: cancelAtPeriodEnd ? subscription.status : 'CANCELED',
        cancelAtPeriodEnd,
        cancelledAt: cancelAtPeriodEnd ? null : new Date(),
        cancellationReason: cancelAtPeriodEnd ? 'Cancelled at period end' : 'Immediate cancellation',
        updatedAt: new Date()
      }
    });

    const message = cancelAtPeriodEnd
      ? "Your subscription will be cancelled at the end of the current billing period."
      : "Your subscription has been cancelled immediately.";

    // Send cancellation email
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { vendorProfile: true }
    });

    if (user?.vendorProfile?.businessEmail) {
      try {
        await mailtrapService.sendHtmlEmail({
          to: user.vendorProfile.businessEmail,
          subject: `Subscription ${cancelAtPeriodEnd ? 'Scheduled for Cancellation' : 'Cancelled'}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">Subscription ${cancelAtPeriodEnd ? 'Scheduled for Cancellation' : 'Cancelled'}</h2>
              <p>${message}</p>
              
              <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
                <h3 style="margin-top: 0;">Subscription Details</h3>
                <p><strong>Plan:</strong> ${subscription.plan.name}</p>
                <p><strong>Status:</strong> ${cancelAtPeriodEnd ? 'Active until period end' : 'Cancelled'}</p>
                ${subscription.currentPeriodEnd ? `
                  <p><strong>Current Period Ends:</strong> ${subscription.currentPeriodEnd.toLocaleDateString()}</p>
                ` : ''}
              </div>
              
              <p>You can reactivate your subscription at any time from your dashboard.</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${config.FRONTEND_URL}/dashboard/subscription" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                  Manage Subscription
                </a>
              </div>
              
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
              <p style="color: #666; font-size: 12px;">© ${new Date().getFullYear()} CyberNark. All rights reserved.</p>
            </div>
          `
        });
      } catch (error) {
        console.error("Failed to send cancellation email:", error);
      }
    }

    return {
      success: true,
      message,
      data: {
        subscription: updatedSubscription,
        cancelAtPeriodEnd,
        cancellationDate: updatedSubscription.cancelledAt
      }
    };
  },
  async startFreeTrial(userId: string, planId: string, trialDays: number = 14): Promise<any> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { vendorProfile: true }
    });

    if (!user || user.role !== "VENDOR") {
      throw new ApiError(httpStatus.BAD_REQUEST, "Only vendors can start free trials");
    }

    const plan = await prisma.plan.findUnique({
      where: { id: planId }
    });

    if (!plan) {
      throw new ApiError(httpStatus.NOT_FOUND, "Plan not found");
    }

    // Check if user already has a subscription
    const existingSubscription = await prisma.subscription.findUnique({
      where: { userId }
    });

    const trialStart = new Date();
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + trialDays);

    let subscription;

    if (existingSubscription) {
      // Update existing subscription with trial
      subscription = await prisma.subscription.update({
        where: { id: existingSubscription.id },
        data: {
          planId: plan.id,
          status: 'TRIALING',
          trialStart,
          trialEnd,
          currentPeriodStart: trialStart,
          currentPeriodEnd: trialEnd,
        },
        include: {
          plan: true
        }
      });
    } else {
      // Create new subscription with trial
      subscription = await prisma.subscription.create({
        data: {
          userId,
          planId: plan.id,
          status: 'TRIALING',
          trialStart,
          trialEnd,
          currentPeriodStart: trialStart,
          currentPeriodEnd: trialEnd,
        },
        include: {
          plan: true
        }
      });

      // Create plan usage record for trial
      const features = getPlanFeatures(plan);
      const isEnterprisePlan = plan.type === "ENTERPRISE";

      await prisma.planLimitData.create({
        data: {
          subscriptionId: subscription.id,
          suppliersUsed: isEnterprisePlan ? null : (features.supplierLimit ?? 0),
          assessmentsUsed: isEnterprisePlan ? null : (features.assessmentLimit ?? 0),
          messagesUsed: isEnterprisePlan ? null : (features.messagesPerMonth ?? 0),
          documentReviewsUsed: isEnterprisePlan ? null : (features.documentReviewsPerMonth ?? 0),
          reportCreate: isEnterprisePlan ? null : (features.reportCreate ?? 0),
          reportsGeneratedUsed: isEnterprisePlan ? null : (features.reportsGeneratedPerMonth ?? 0),
          notificationsSend: isEnterprisePlan ? null : (features.notificationsSend ?? 0),
          month: new Date().getMonth() + 1,
          year: new Date().getFullYear(),
        },
      });
    }

    // Send trial started email
    if (user.vendorProfile?.businessEmail) {
      try {
        await mailtrapService.sendHtmlEmail({
          to: user.vendorProfile.businessEmail,
          subject: `🎉 Your Free Trial Has Started!`,
          html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1a5fb4;">Welcome to Your Free Trial!</h2>
            <p>Your free trial for <strong>${plan.name}</strong> has been activated.</p>
            
            <div style="background-color: #f0f8ff; padding: 20px; border-radius: 8px; margin: 25px 0;">
              <h3>Trial Details</h3>
              <p><strong>Plan:</strong> ${plan.name}</p>
              <p><strong>Trial Start:</strong> ${trialStart.toLocaleDateString()}</p>
              <p><strong>Trial End:</strong> ${trialEnd.toLocaleDateString()}</p>
              <p><strong>Trial Duration:</strong> ${trialDays} days</p>
              <p><strong>Status:</strong> Active Trial</p>
            </div>
            
            <p>You now have full access to all features of the ${plan.name} plan. Explore the platform and see how CyberNark can help secure your supply chain.</p>
            
            <div style="background-color: #f9f9f9; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <h4 style="margin-top: 0;">Trial Features:</h4>
              <ul style="margin: 10px 0; padding-left: 20px;">
                <li><strong>Suppliers:</strong> ${plan.supplierLimit === -1 ? 'Unlimited' : (plan.supplierLimit || 'Unlimited')}</li>
                <li><strong>Assessments:</strong> ${plan.assessmentLimit === -1 ? 'Unlimited' : (plan.assessmentLimit || 'Unlimited')} per month</li>
                <li><strong>Users:</strong> ${plan.userLimit === -1 ? 'Unlimited' : (plan.userLimit || 'Unlimited')}</li>
              </ul>
            </div>
            
            <p>After your trial ends, you'll need to choose a subscription plan to continue using the platform.</p>
            
            <div style="text-align: center; margin: 35px 0;">
              <a href="${config.FRONTEND_URL}/dashboard" style="background-color: #1a5fb4; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
                Start Exploring →
              </a>
            </div>
            
            <p style="color: #666; font-size: 14px;">
              Questions? Contact support anytime.<br>
              © ${new Date().getFullYear()} CyberNark. All rights reserved.
            </p>
          </div>
        `
        });
      } catch (error) {
        console.error("Failed to send trial started email:", error);
      }
    }

    return subscription;
  },


  // ========== WEBHOOK HANDLERS ==========
  async handleCheckoutSessionCompleted(session: any): Promise<void> {
    const metadata = session.metadata || {};
    const {
      userId,
      vendorId,
      planId: newPlanId,
      subscriptionId,
      isPlanChange,
      previousPlanId,
      billingCycle,
      previousStripeSubscriptionId,
    } = metadata;

    if (!userId || !vendorId || !newPlanId) {
      console.error("Missing required metadata");
      return;
    }

    const stripeSubscription = session.subscription
      ? await stripeService.stripe.subscriptions.retrieve(
        session.subscription as string
      )
      : null;

    const isPlanChangeFlag = isPlanChange === "true";

    try {
      let finalSubscription;

      // ==================================================
      // PLAN CHANGE (UPGRADE / DOWNGRADE)
      // ==================================================
      if (isPlanChangeFlag) {
        const existingSubscription = await prisma.subscription.findUnique({
          where: { userId },
          include: { plan: true },
        });

        if (!existingSubscription) {
          console.error("Existing subscription not found");
          return;
        }

        const newPlan = await prisma.plan.findUnique({
          where: { id: newPlanId },
        });

        if (!newPlan) {
          console.error("New plan not found");
          return;
        }

        // Cancel previous Stripe subscription safely
        if (
          previousStripeSubscriptionId &&
          previousStripeSubscriptionId !== stripeSubscription?.id
        ) {
          try {
            await stripeService.stripe.subscriptions.cancel(
              previousStripeSubscriptionId,
              { prorate: true }
            );
          } catch (err) {
            console.error("Failed to cancel old Stripe subscription", err);
          }
        }

        // Update subscription
        finalSubscription = await prisma.subscription.update({
          where: { id: existingSubscription.id },
          data: {
            planId: newPlanId,
            status:
              (stripeSubscription?.status?.toUpperCase() as SubscriptionStatus) ||
              "ACTIVE",
            stripeSubscriptionId:
              stripeSubscription?.id || (session.subscription as string),
            stripeCustomerId: session.customer as string,
            currentPeriodStart: (stripeSubscription as any)?.current_period_start
              ? new Date(
                (stripeSubscription as any).current_period_start * 1000
              )
              : new Date(),
            currentPeriodEnd: (stripeSubscription as any)?.current_period_end
              ? new Date((stripeSubscription as any).current_period_end * 1000)
              : null,
            trialStart: null,
            trialEnd: null,
            billingCycle: billingCycle || existingSubscription.billingCycle,
          },
        });

        // ===================== LIMIT HANDLING =====================
        const features = getPlanFeatures(newPlan);
        const isEnterprisePlan = newPlan.type === "ENTERPRISE";
        const now = new Date();

        const existingUsage = await prisma.planLimitData.findUnique({
          where: { subscriptionId: finalSubscription.id },
        });

        if (existingUsage) {
          await prisma.planLimitData.update({
            where: { subscriptionId: finalSubscription.id },
            data: isEnterprisePlan
              ? {
                suppliersUsed: null,
                assessmentsUsed: null,
                messagesUsed: null,
                documentReviewsUsed: null,
                reportCreate: null,
                reportsGeneratedUsed: null,
                notificationsSend: null,
                month: now.getMonth() + 1,
                year: now.getFullYear(),
              }
              : {
                suppliersUsed:
                  (existingUsage.suppliersUsed ?? 0) +
                  (features.supplierLimit ?? 0),

                assessmentsUsed:
                  (existingUsage.assessmentsUsed ?? 0) +
                  (features.assessmentLimit ?? 0),

                messagesUsed:
                  (existingUsage.messagesUsed ?? 0) +
                  (features.messagesPerMonth ?? 0),

                documentReviewsUsed:
                  (existingUsage.documentReviewsUsed ?? 0) +
                  (features.documentReviewsPerMonth ?? 0),

                reportCreate:
                  (existingUsage.reportCreate ?? 0) +
                  (features.reportCreate ?? 0),

                reportsGeneratedUsed:
                  (existingUsage.reportsGeneratedUsed ?? 0) +
                  (features.reportsGeneratedPerMonth ?? 0),

                notificationsSend:
                  (existingUsage.notificationsSend ?? 0) +
                  (features.notificationsSend ?? 0),

                month: now.getMonth() + 1,
                year: now.getFullYear(),
              },
          });
        } else {
          await prisma.planLimitData.create({
            data: isEnterprisePlan
              ? {
                subscriptionId: finalSubscription.id,
                suppliersUsed: null,
                assessmentsUsed: null,
                messagesUsed: null,
                documentReviewsUsed: null,
                reportCreate: null,
                reportsGeneratedUsed: null,
                notificationsSend: null,
                month: now.getMonth() + 1,
                year: now.getFullYear(),
              }
              : {
                subscriptionId: finalSubscription.id,
                suppliersUsed: features.supplierLimit ?? 0,
                assessmentsUsed: features.assessmentLimit ?? 0,
                messagesUsed: features.messagesPerMonth ?? 0,
                documentReviewsUsed:
                  features.documentReviewsPerMonth ?? 0,
                reportCreate: features.reportCreate ?? 0,
                reportsGeneratedUsed:
                  features.reportsGeneratedPerMonth ?? 0,
                notificationsSend: features.notificationsSend ?? 0,
                month: now.getMonth() + 1,
                year: now.getFullYear(),
              },
          });
        }

        // Save plan change history
        await prisma.planChangeHistory.create({
          data: {
            subscriptionId: finalSubscription.id,
            previousPlanId: previousPlanId || existingSubscription.planId,
            newPlanId,
            changedAt: new Date(),
            changedBy: userId,
            reason: this.isPlanUpgrade(existingSubscription.plan, newPlan)
              ? "upgrade"
              : "downgrade",
            stripeSessionId: session.id,
          },
        });

        console.log("Plan changed successfully with cumulative limits");
      }

      // ==================================================
      // FIRST-TIME SUBSCRIPTION
      // ==================================================
      else {
        finalSubscription = await prisma.subscription.update({
          where: { id: subscriptionId },
          data: {
            status:
              (stripeSubscription?.status?.toUpperCase() as SubscriptionStatus) ||
              "ACTIVE",
            stripeSubscriptionId:
              stripeSubscription?.id || (session.subscription as string),
            stripeCustomerId: session.customer as string,
            currentPeriodStart: (stripeSubscription as any)?.current_period_start
              ? new Date(
                (stripeSubscription as any).current_period_start * 1000
              )
              : new Date(),
            currentPeriodEnd: (stripeSubscription as any)?.current_period_end
              ? new Date((stripeSubscription as any).current_period_end * 1000)
              : null,
            trialStart: null,
            trialEnd: null,
          },
        });

        const newPlan = await prisma.plan.findUnique({
          where: { id: newPlanId },
        });

        if (!newPlan) throw new Error("Plan not found");

        const features = getPlanFeatures(newPlan);
        const isEnterprisePlan = newPlan.type === "ENTERPRISE";

        await prisma.planLimitData.create({
          data: isEnterprisePlan
            ? {
              subscriptionId: finalSubscription.id,
              suppliersUsed: null,
              assessmentsUsed: null,
              messagesUsed: null,
              documentReviewsUsed: null,
              reportCreate: null,
              reportsGeneratedUsed: null,
              notificationsSend: null,
              month: new Date().getMonth() + 1,
              year: new Date().getFullYear(),
            }
            : {
              subscriptionId: finalSubscription.id,
              suppliersUsed: features.supplierLimit ?? 0,
              assessmentsUsed: features.assessmentLimit ?? 0,
              messagesUsed: features.messagesPerMonth ?? 0,
              documentReviewsUsed:
                features.documentReviewsPerMonth ?? 0,
              reportCreate: features.reportCreate ?? 0,
              reportsGeneratedUsed:
                features.reportsGeneratedPerMonth ?? 0,
              notificationsSend: features.notificationsSend ?? 0,
              month: new Date().getMonth() + 1,
              year: new Date().getFullYear(),
            },
        });

        console.log("First subscription created & limits initialized");
      }

      // ==================================================
      // UPDATE VENDOR STRIPE CUSTOMER
      // ==================================================
      await prisma.vendor.update({
        where: { id: vendorId },
        data: { stripeCustomerId: session.customer as string },
      });

      console.log(`Subscription ${finalSubscription.id} processed successfully`);
    } catch (error) {
      console.error("Error processing checkout.session.completed:", error);
    }
  }
  ,

  // Only create payment when real money is charged
  async handleInvoicePaymentSucceeded(invoice: any): Promise<void> {
    console.log("Processing invoice.payment_succeeded webhook", invoice);

    const subscription = await prisma.subscription.findFirst({
      where: { stripeSubscriptionId: invoice.subscription as string },
      include: { plan: true, user: true }
    });

    if (!subscription) {
      console.error(`Subscription not found for invoice ${invoice.id}`);
      return;
    }

    // Prevent duplicates
    const existingPayment = await prisma.payment.findFirst({
      where: { stripeInvoiceId: invoice.id }
    });

    if (existingPayment) {
      console.log(`Payment already recorded for invoice ${invoice.id}`);
      return;
    }

    await prisma.payment.create({
      data: {
        userId: subscription.userId,
        planId: subscription.planId,
        subscriptionId: subscription.id,
        amount: subscription.plan.price,
        currency: subscription.plan.currency,
        status: 'SUCCEEDED',
        paymentType: 'SUBSCRIPTION',
        stripePaymentId: invoice.payment_intent as string | null,
        stripeInvoiceId: invoice.id,
        stripeCustomerId: invoice.customer as string,
        billingEmail: invoice.customer_email || subscription.user.email,
        receiptUrl: invoice.invoice_pdf || invoice.hosted_invoice_url || null,
        paidAt: new Date(invoice.status_transitions.paid_at * 1000),
        metadata: {
          invoiceId: invoice.id,
          invoiceNumber: invoice.number,
          billingReason: invoice.billing_reason,
          periodStart: invoice.lines.data[0]?.period.start
            ? new Date(invoice.lines.data[0].period.start * 1000)
            : null,
          periodEnd: invoice.lines.data[0]?.period.end
            ? new Date(invoice.lines.data[0].period.end * 1000)
            : null,
        },
      },
    });

    console.log(`Payment recorded: ${invoice.amount_paid / 100} ${invoice.currency.toUpperCase()}`);
  },

  async handleSubscriptionUpdated(subscription: any): Promise<void> {
    console.log("🔄 Processing customer.subscription.updated webhook");

    const dbSubscription = await prisma.subscription.findFirst({
      where: {
        OR: [
          { stripeSubscriptionId: subscription.id },
          { stripeCustomerId: subscription.customer as string }
        ]
      }
    });

    if (!dbSubscription) {
      console.error(`❌ Subscription not found for Stripe subscription ${subscription.id}`);
      return;
    }

    await prisma.subscription.update({
      where: { id: dbSubscription.id },
      data: {
        status: subscription.status.toUpperCase() as SubscriptionStatus,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        // No trial for paid subscriptions
        trialStart: null,
        trialEnd: null,
        updatedAt: new Date()
      }
    });

    console.log(`✅ Updated subscription ${dbSubscription.id} status to ${subscription.status}`);
  },

  async handleSubscriptionDeleted(subscription: any): Promise<void> {
    console.log("🔄 Processing customer.subscription.deleted webhook");

    const dbSubscription = await prisma.subscription.findFirst({
      where: { stripeSubscriptionId: subscription.id }
    });

    if (!dbSubscription) {
      console.error(`❌ Subscription not found for Stripe subscription ${subscription.id}`);
      return;
    }

    await prisma.subscription.update({
      where: { id: dbSubscription.id },
      data: {
        status: 'CANCELED',
        cancelledAt: new Date(),
        cancellationReason: 'Cancelled from Stripe',
        updatedAt: new Date()
      }
    });

    console.log(`✅ Marked subscription ${dbSubscription.id} as cancelled`);
  },

  async handleInvoicePaymentFailed(invoice: any): Promise<void> {
    console.log("🔄 Processing invoice.payment_failed webhook");

    const subscription = await prisma.subscription.findFirst({
      where: { stripeSubscriptionId: invoice.subscription as string }
    });

    if (!subscription) {
      console.error(`❌ Subscription not found for invoice ${invoice.id}`);
      return;
    }

    // Update subscription status
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'PAST_DUE',
        updatedAt: new Date()
      }
    });

    // Create failed payment record
    await prisma.payment.create({
      data: {
        userId: subscription.userId,
        planId: subscription.planId,
        subscriptionId: subscription.id,
        amount: invoice.amount_due / 100,
        currency: invoice.currency.toUpperCase(),
        status: 'FAILED',
        paymentType: 'SUBSCRIPTION',
        stripeInvoiceId: invoice.id,
        stripeCustomerId: invoice.customer as string,
        metadata: {
          invoiceId: invoice.id,
          failureMessage: invoice.last_finalization_error?.message,
          failureCode: invoice.last_finalization_error?.code
        }
      }
    });

    console.log(`✅ Marked subscription ${subscription.id} as past due`);
  }
};