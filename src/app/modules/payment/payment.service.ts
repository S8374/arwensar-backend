// src/app/modules/payment/payment.service.ts
import { Plan, Subscription, Payment, PaymentStatus, SubscriptionStatus, BillingCycle } from "@prisma/client";
import { prisma } from "../../shared/prisma";
import { stripeService } from "../../shared/stripe.service";
import ApiError from "../../../error/ApiError";
import httpStatus from "http-status";
import { config } from "../../../config";
import { mailtrapService } from "../../shared/mailtrap.service";

// Generate unique invoice number
const generateInvoiceNumber = (): string => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return `INV-${timestamp}-${random}`;
};

// Calculate trial end date
const calculateTrialEndDate = (trialDays: number): Date => {
  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + trialDays);
  return trialEnd;
};

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
    // Get user with vendor profile
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        vendorProfile: true
      }
    });

    if (!user || !user.vendorProfile) {
      throw new ApiError(httpStatus.NOT_FOUND, "User or vendor profile not found");
    }

    const vendor = user.vendorProfile;
    console.log("user",user);
    console.log("vendor profile", vendor);
    // Check if user already has an active subscription
    const existingSubscription = await prisma.subscription.findUnique({
      where: { userId }
    });

    if (existingSubscription && ['ACTIVE', 'TRIALING', 'PAST_DUE'].includes(existingSubscription.status)) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "You already have an active subscription. Please manage it from your dashboard."
      );
    }

    // Get plan
    const plan = await this.getPlanById(planId);
    if (!plan) {
      throw new ApiError(httpStatus.NOT_FOUND, "Plan not found or inactive");
    }

    if (!plan.stripePriceId) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Plan does not have a Stripe price ID configured");
    }

    // Get or create Stripe customer
    let stripeCustomerId = vendor.stripeCustomerId;
    console.log("stripeCustomerId", stripeCustomerId);

    if (!stripeCustomerId) {
      const customer = await stripeService.createCustomer(
        user.email,
        vendor.companyName,
        {
          userId: user.id,
          vendorId: vendor.id,
          vendorName: vendor.companyName
        }
      );
      stripeCustomerId = customer.id;

      // Update vendor with Stripe customer ID
      await prisma.vendor.update({
        where: { id: vendor.id },
        data: { stripeCustomerId }
      });
    }

    // Create subscription record in database
    const trialEnd = plan.trialDays > 0 ? calculateTrialEndDate(plan.trialDays) : null;

    const subscription = await prisma.subscription.upsert({
      where: { userId },
      update: {
        planId: plan.id,
        billingCycle,
        status: 'PENDING',
        stripeCustomerId,
        trialEnd,
        updatedAt: new Date()
      },
      create: {
        userId,
        planId: plan.id,
        billingCycle,
        status: 'PENDING',
        stripeCustomerId,
        trialEnd
      }
    });

    // Create checkout session with Stripe
    const session = await stripeService.stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      line_items: [
        {
          price: plan.stripePriceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      metadata: {
        userId: user.id,
        vendorId: vendor.id,
        planId: plan.id,
        subscriptionId: subscription.id,
        planName: plan.name
      },
      subscription_data: {
        trial_period_days: plan.trialDays || undefined,
        metadata: {
          userId: user.id,
          vendorId: vendor.id,
          subscriptionId: subscription.id
        }
      },
      success_url: `${config.FRONTEND_URL}/dashboard/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${config.FRONTEND_URL}/dashboard/pricing`,
      billing_address_collection: 'required',
      allow_promotion_codes: true,
      customer_update: {
        address: 'auto',
        name: 'auto'
      },
      payment_method_collection: 'if_required'
    });

    // Update subscription with session ID
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        stripeSessionId: session.id,
        updatedAt: new Date()
      }
    });

    return {
      url: session.url!,
      sessionId: session.id,
      subscriptionId: subscription.id
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
    const session = await this.getSessionStatus(sessionId);

    if (session.status !== 'complete' || session.paymentStatus !== 'paid') {
      throw new ApiError(httpStatus.BAD_REQUEST, "Payment not completed yet");
    }

    const { userId, subscriptionId } = session.metadata;

    if (!userId || !subscriptionId) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid session metadata");
    }

    // Get subscription details
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        plan: true,
        user: {
          include: {
            vendorProfile: true
          }
        }
      }
    });

    if (!subscription) {
      throw new ApiError(httpStatus.NOT_FOUND, "Subscription not found");
    }

    // Get Stripe subscription details
    const stripeSubscription = session.subscriptionId
      ? await stripeService.stripe.subscriptions.retrieve(session.subscriptionId as string)
      : null;

    // Update subscription status
    const updatedSubscription = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: stripeSubscription?.status?.toUpperCase() as SubscriptionStatus || 'ACTIVE',
        stripeSubscriptionId: stripeSubscription?.id || session.subscriptionId as string,
        currentPeriodStart: stripeSubscription?.current_period_start
          ? new Date(stripeSubscription.current_period_start * 1000)
          : new Date(),
        currentPeriodEnd: stripeSubscription?.current_period_end
          ? new Date(stripeSubscription.current_period_end * 1000)
          : null,
        trialStart: stripeSubscription?.trial_start
          ? new Date(stripeSubscription.trial_start * 1000)
          : null,
        trialEnd: stripeSubscription?.trial_end
          ? new Date(stripeSubscription.trial_end * 1000)
          : null,
        updatedAt: new Date()
      }
    });

    // Create payment record
    const payment = await prisma.payment.create({
      data: {
        userId,
        planId: subscription.planId,
        subscriptionId: subscription.id,
        amount: subscription.plan.price,
        currency: subscription.plan.currency,
        status: 'SUCCEEDED',
        paymentType: 'SUBSCRIPTION',
        stripePaymentId: session.paymentIntentId || `checkout_${sessionId}`,
        stripeSessionId: sessionId,
        stripeCustomerId: session.customerId as string,
        billingEmail: session.customerEmail,
        paidAt: new Date(),
        metadata: {
          sessionId,
          planName: subscription.plan.name,
          billingCycle: subscription.billingCycle
        }
      }
    });

    // Send confirmation email
    if (subscription.user.vendorProfile?.businessEmail) {
      try {
        await mailtrapService.sendHtmlEmail({
          to: subscription.user.vendorProfile.businessEmail,
          subject: `🎉 Payment Confirmed - ${subscription.plan.name} Plan`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">Payment Confirmed!</h2>
              <p>Your subscription to the <strong>${subscription.plan.name}</strong> plan has been successfully activated.</p>
              
              <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
                <h3 style="margin-top: 0;">Order Details</h3>
                <p><strong>Plan:</strong> ${subscription.plan.name}</p>
                <p><strong>Billing Cycle:</strong> ${subscription.billingCycle}</p>
                <p><strong>Amount:</strong> ${subscription.plan.price} ${subscription.plan.currency}</p>
                <p><strong>Payment Date:</strong> ${new Date().toLocaleDateString()}</p>
                <p><strong>Payment ID:</strong> ${payment.id}</p>
              </div>
              
              <p>Your account now has access to all features included in your plan. You can manage your subscription from your dashboard.</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${config.FRONTEND_URL}/dashboard" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                  Go to Dashboard
                </a>
              </div>
              
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
              <p style="color: #666; font-size: 12px;">© ${new Date().getFullYear()} CyberNark. All rights reserved.</p>
            </div>
          `
        });
      } catch (error) {
        console.error("Failed to send payment confirmation email:", error);
      }
    }

    return {
      success: true,
      message: "Payment confirmed and subscription activated successfully",
      data: {
        subscription: updatedSubscription,
        payment,
        plan: subscription.plan
      }
    };
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
      isTrial: subscription.status === 'TRIALING',
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

  // ========== WEBHOOK HANDLERS ==========
  async handleCheckoutSessionCompleted(session: any): Promise<void> {
    console.log("🔄 Processing checkout.session.completed webhook", session);

    const { userId, subscriptionId, vendorId, planId } = session.metadata || {};

    if (!userId || !subscriptionId || !vendorId || !planId) {
      console.error("❌ Missing required metadata in session:", session.metadata);
      return;
    }

    try {
      // Fetch subscription from Stripe
      const stripeSubscription = session.subscription
        ? await stripeService.stripe.subscriptions.retrieve(session.subscription as string)
        : null;

      // Update subscription in database
      await prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          status: stripeSubscription?.status?.toUpperCase() as SubscriptionStatus || 'ACTIVE',
          stripeSubscriptionId: stripeSubscription?.id || session.subscription,
          stripeCustomerId: session.customer as string,
          currentPeriodStart: stripeSubscription?.current_period_start
            ? new Date(stripeSubscription.current_period_start * 1000)
            : new Date(),
          currentPeriodEnd: stripeSubscription?.current_period_end
            ? new Date((stripeSubscription.current_period_end) * 1000)
            : null,
          trialStart: stripeSubscription?.trial_start
            ? new Date(stripeSubscription.trial_start * 1000)
            : null,
          trialEnd: stripeSubscription?.trial_end
            ? new Date(stripeSubscription.trial_end * 1000)
            : null,
          updatedAt: new Date()
        }
      });

      // Update vendor with Stripe customer ID
      await prisma.vendor.update({
        where: { id: vendorId },
        data: {
          stripeCustomerId: session.customer as string,
          updatedAt: new Date()
        }
      });

      // Create payment record
      const plan = await prisma.plan.findUnique({
        where: { id: planId }
      });

      if (plan) {
        await prisma.payment.create({
          data: {
            userId,
            planId,
            subscriptionId,
            amount: plan.price,
            currency: plan.currency,
            status: 'SUCCEEDED',
            paymentType: 'SUBSCRIPTION',
            stripePaymentId: session.payment_intent as string,
            stripeSessionId: session.id,
            stripeCustomerId: session.customer as string,
            billingEmail: session.customer_email,
            paidAt: new Date(),
            metadata: {
              sessionId: session.id,
              planName: plan.name,
              checkoutSession: session
            }
          }
        });
      }

      console.log(`✅ Successfully processed checkout for subscription ${subscriptionId}`);
    } catch (error: any) {
      console.error("❌ Error processing checkout session:", error);
      throw error;
    }
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
        trialStart: subscription.trial_start ? new Date(subscription.trial_start * 1000) : null,
        trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
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

  async handleInvoicePaymentSucceeded(invoice: any): Promise<void> {
    console.log("🔄 Processing invoice.payment_succeeded webhook");

    const subscription = await prisma.subscription.findFirst({
      where: { stripeSubscriptionId: invoice.subscription as string },
      include: { plan: true }
    });

    if (!subscription) {
      console.error(`❌ Subscription not found for invoice ${invoice.id}`);
      return;
    }

    // Create payment record for successful invoice
    await prisma.payment.create({
      data: {
        userId: subscription.userId,
        planId: subscription.planId,
        subscriptionId: subscription.id,
        amount: invoice.amount_paid / 100,
        currency: invoice.currency.toUpperCase(),
        status: 'SUCCEEDED',
        paymentType: 'SUBSCRIPTION',
        stripePaymentId: invoice.payment_intent as string,
        stripeInvoiceId: invoice.id,
        stripeCustomerId: invoice.customer as string,
        billingEmail: invoice.customer_email,
        paidAt: new Date(),
        metadata: {
          invoiceId: invoice.id,
          invoiceNumber: invoice.number,
          periodStart: invoice.period_start ? new Date(invoice.period_start * 1000) : null,
          periodEnd: invoice.period_end ? new Date(invoice.period_end * 1000) : null
        }
      }
    });

    console.log(`✅ Created payment record for invoice ${invoice.id}`);
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