// src/modules/subscription/subscription.service.ts
import { Subscription, Plan, Payment, Invoice } from "@prisma/client";
import { prisma } from "../../shared/prisma";
import httpStatus from "http-status";
import Stripe from "stripe";
import ApiError from "../../../error/ApiError";
import { config } from "../../../config";

const stripe = new Stripe(config.STRIPE.SECRET_KEY, {
  apiVersion: "2025-12-15.clover"
});

export interface PlanFeatures {
  supplierLimit: number;
  complianceDashboard: boolean;
  alertAndReminder: boolean;
  basicAssessment?: boolean;
  fullAssessment?: boolean;
  emailSupport: boolean;
  documentUploads: string;
  nis2Compliance: boolean;
  advancedAnalytics: boolean;
  apiAccess: boolean;
  prioritySupport: boolean;
  expiryNotification?: boolean;
  multiUserAccess?: boolean;
  integrations?: boolean;
  performanceAnalytics?: boolean;
  dedicatedAccount?: boolean;
  customReporting?: boolean;
  whiteLabel?: boolean;
  [key: string]: any;
}

export const SubscriptionService = {
  // ========== GET AVAILABLE PLANS ==========
  async getAvailablePlans(billingCycle?: string): Promise<any[]> {
    const where: any = {
      isActive: true,
      isDeleted: false,
      type: { not: 'FREE' } // Don't include free trial in available plans
    };

    if (billingCycle) {
      where.billingCycle = billingCycle;
    }

    const plans = await prisma.plan.findMany({
      where,
      orderBy: [
        { billingCycle: 'asc' },
        { price: 'asc' }
      ]
    });

    // Format plans to match frontend structure
    return plans.map(plan => ({
      id: plan.id,
      name: plan.name,
      type: plan.type,
      billingCycle: plan.billingCycle,
      price: plan.price.toNumber(),
      originalPrice: plan.originalPrice?.toNumber() || null,
      currency: plan.currency,
      features: plan.features as PlanFeatures,
      description: plan.description,
      trialDays: plan.trialDays,
      isPopular: plan.isPopular,
      stripePriceId: plan.stripePriceId,
      stripeProductId: plan.stripeProductId,
      // Add calculated fields
      isDiscounted: plan.originalPrice !== null,
      discountPercentage: plan.originalPrice ? 
        Math.round((1 - plan.price.toNumber() / plan.originalPrice.toNumber()) * 100) : 0
    }));
  },

  // ========== GET PLAN BY ID ==========
  async getPlanById(planId: string): Promise<any> {
    const plan = await prisma.plan.findUnique({
      where: { 
        id: planId,
        isActive: true,
        isDeleted: false 
      }
    });

    if (!plan) {
      throw new ApiError(httpStatus.NOT_FOUND, "Plan not found");
    }

    return {
      id: plan.id,
      name: plan.name,
      type: plan.type,
      billingCycle: plan.billingCycle,
      price: plan.price.toNumber(),
      originalPrice: plan.originalPrice?.toNumber() || null,
      currency: plan.currency,
      features: plan.features as PlanFeatures,
      description: plan.description,
      trialDays: plan.trialDays,
      isPopular: plan.isPopular,
      stripePriceId: plan.stripePriceId,
      stripeProductId: plan.stripeProductId,
      supplierLimit: plan.supplierLimit,
      assessmentLimit: plan.assessmentLimit,
      storageLimit: plan.storageLimit,
      userLimit: plan.userLimit
    };
  },

  // ========== CREATE CHECKOUT SESSION ==========
  async createCheckoutSession(
    userId: string,
    planId: string,
    billingCycle: string
  ): Promise<{ sessionId: string; url: string }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { vendorProfile: true }
    });

    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, "User not found");
    }

    // Check if user is a vendor
    if (user.role !== 'VENDOR') {
      throw new ApiError(httpStatus.FORBIDDEN, "Only vendors can subscribe to plans");
    }

    // Get the selected plan
    const plan = await prisma.plan.findFirst({
      where: { 
        id: planId,
        isActive: true,
        isDeleted: false,
        billingCycle: billingCycle as any
      }
    });

    if (!plan) {
      throw new ApiError(httpStatus.NOT_FOUND, "Plan not found");
    }

    // Check for existing active subscription
    const existingSubscription = await prisma.subscription.findUnique({
      where: { userId }
    });

    if (existingSubscription && existingSubscription.status !== 'CANCELED' && existingSubscription.status !== 'EXPIRED') {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "You already have an active subscription. Please cancel it before subscribing to a new plan."
      );
    }

    // Create or get Stripe customer
    let customerId: string;
    if (user.vendorProfile?.stripeCustomerId) {
      customerId = user.vendorProfile.stripeCustomerId;
    } else {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.vendorProfile?.companyName || user.email,
        metadata: {
          userId,
          vendorId: user.vendorProfile?.id
        }
      });
      customerId = customer.id;

      // Update vendor with Stripe customer ID
      if (user.vendorProfile) {
        await prisma.vendor.update({
          where: { id: user.vendorProfile.id },
          data: { stripeCustomerId: customerId }
        });
      }
    }

    // Get Stripe price ID
    const priceId = plan.stripePriceId;
    if (!priceId) {
      throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, "Plan is not properly configured with Stripe");
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      mode: "subscription",
      success_url: `${ config.APP.WEBSITE}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${config.APP.WEBSITE}/subscription`,
      metadata: {
        userId,
        planId: plan.id,
        planName: plan.name,
        billingCycle: plan.billingCycle
      },
      subscription_data: {
        trial_period_days: plan.trialDays || config.APP.FREE_TRIAL_DAYS || 14
      },
      billing_address_collection: 'required',
      customer_update: {
        address: 'auto'
      }
    });

    // Create pending subscription record
    await prisma.subscription.create({
      data: {
        userId,
        planId: plan.id,
        status: 'PENDING',
        billingCycle: plan.billingCycle as any,
        stripeCustomerId: customerId,
        stripeSessionId: session.id,
        trialDays: plan.trialDays
      }
    });

    return {
      sessionId: session.id,
      url: session.url || ""
    };
  },

  // ========== HANDLE WEBHOOK ==========
  async handleWebhook(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case 'invoice.paid':
        await this.handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      case 'invoice.payment_failed':
        await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      case 'invoice.payment_succeeded':
        await this.handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;
    }
  },

  async handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const { userId, planId, planName, billingCycle } = session.metadata || {};
    
    if (!userId || !planId) {
      throw new Error("Missing metadata in session");
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { vendorProfile: true }
    });

    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    const plan = await prisma.plan.findUnique({
      where: { id: planId }
    });

    if (!plan) {
      throw new Error(`Plan not found: ${planId}`);
    }

    const subscription = await stripe.subscriptions.retrieve(
      session.subscription as string
    );

    await prisma.$transaction(async (tx) => {
      // Update subscription
      const updatedSubscription = await tx.subscription.update({
        where: { stripeSessionId: session.id },
        data: {
          status: subscription.status.toUpperCase() as any,
          stripeSubscriptionId: subscription.id,
          currentPeriodStart: new Date(subscription.current_period_start * 1000),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          trialStart: subscription.trial_start ? new Date(subscription.trial_start * 1000) : null,
          trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null
        }
      });

      // Create initial payment record if payment was made
      if (session.payment_status === 'paid') {
        await tx.payment.create({
          data: {
            userId,
            subscriptionId: updatedSubscription.id,
            planId: plan.id,
            amount: plan.price,
            currency: plan.currency,
            status: 'SUCCEEDED',
            stripePaymentId: session.payment_intent as string,
            stripeInvoiceId: session.invoice as string,
            stripeSessionId: session.id,
            stripeCustomerId: subscription.customer as string,
            paymentType: 'SUBSCRIPTION',
            paidAt: new Date()
          }
        });
      }

      // Create notification
      await tx.notification.create({
        data: {
          userId,
          title: "Subscription Activated",
          message: `Your ${plan.name} subscription has been activated`,
          type: 'PAYMENT_SUCCESS',
          metadata: {
            subscriptionId: updatedSubscription.id,
            planName: plan.name,
            amount: plan.price.toNumber(),
            billingCycle: plan.billingCycle
          }
        }
      });

      // Send welcome email
      await this.sendSubscriptionWelcomeEmail(user.email, plan);
    });
  },

  async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    const dbSubscription = await prisma.subscription.findFirst({
      where: { stripeSubscriptionId: subscription.id }
    });

    if (!dbSubscription) {
      throw new Error(`Subscription not found: ${subscription.id}`);
    }

    await prisma.subscription.update({
      where: { id: dbSubscription.id },
      data: {
        status: subscription.status.toUpperCase() as any,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end
      }
    });
  },

  async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    const dbSubscription = await prisma.subscription.findFirst({
      where: { stripeSubscriptionId: subscription.id }
    });

    if (!dbSubscription) {
      throw new Error(`Subscription not found: ${subscription.id}`);
    }

    await prisma.subscription.update({
      where: { id: dbSubscription.id },
      data: {
        status: 'CANCELED',
        cancelledAt: new Date(),
        cancellationReason: 'Cancelled from Stripe'
      }
    });
  },

  async handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    const subscription = await prisma.subscription.findFirst({
      where: { stripeSubscriptionId: invoice.subscription as string }
    });

    if (!subscription) {
      throw new Error(`Subscription not found for invoice: ${invoice.id}`);
    }

    const plan = await prisma.plan.findUnique({
      where: { id: subscription.planId }
    });

    if (!plan) {
      throw new Error(`Plan not found for subscription: ${subscription.planId}`);
    }

    await prisma.$transaction(async (tx) => {
      // Create payment record
      await tx.payment.create({
        data: {
          subscriptionId: subscription.id,
          userId: subscription.userId,
          planId: subscription.planId,
          amount: invoice.amount_paid / 100,
          currency: invoice.currency.toUpperCase(),
          status: 'SUCCEEDED',
          stripePaymentId: invoice.payment_intent as string,
          stripeInvoiceId: invoice.id,
          stripeCustomerId: invoice.customer as string,
          paymentType: 'SUBSCRIPTION',
          paidAt: new Date()
        }
      });

      // Create invoice record
      await tx.invoice.create({
        data: {
          subscriptionId: subscription.id,
          invoiceNumber: invoice.number || `INV-${Date.now()}`,
          amount: invoice.amount_paid / 100,
          currency: invoice.currency.toUpperCase(),
          status: 'SUCCEEDED',
          periodStart: invoice.period_start ? new Date(invoice.period_start * 1000) : null,
          periodEnd: invoice.period_end ? new Date(invoice.period_end * 1000) : null,
          dueDate: invoice.due_date ? new Date(invoice.due_date * 1000) : null,
          stripeInvoiceId: invoice.id,
          hostedInvoiceUrl: invoice.hosted_invoice_url || null,
          pdfUrl: invoice.invoice_pdf || null,
          paidAt: new Date(),
          items: invoice.lines.data.map(line => ({
            description: line.description,
            amount: line.amount / 100,
            quantity: line.quantity || 1,
            period: line.period
          }))
        }
      });

      // Update subscription usage limits if needed
      if (subscription.planId !== plan.id) {
        await tx.subscription.update({
          where: { id: subscription.id },
          data: { planId: plan.id }
        });
      }
    });
  },

  async handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const subscription = await prisma.subscription.findFirst({
      where: { stripeSubscriptionId: invoice.subscription as string }
    });

    if (!subscription) {
      throw new Error(`Subscription not found for invoice: ${invoice.id}`);
    }

    await prisma.$transaction(async (tx) => {
      // Update subscription status
      await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'PAST_DUE'
        }
      });

      // Create failed payment record
      await tx.payment.create({
        data: {
          subscriptionId: subscription.id,
          userId: subscription.userId,
          planId: subscription.planId,
          amount: invoice.amount_due / 100,
          currency: invoice.currency.toUpperCase(),
          status: 'FAILED',
          stripeInvoiceId: invoice.id,
          paymentType: 'SUBSCRIPTION'
        }
      });

      // Create notification
      await tx.notification.create({
        data: {
          userId: subscription.userId,
          title: "Payment Failed",
          message: `Your subscription payment has failed. Please update your payment method.`,
          type: 'PAYMENT_FAILED',
          metadata: {
            invoiceId: invoice.id,
            amountDue: invoice.amount_due / 100
          }
        }
      });
    });
  },

  async handleInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    // This handles successful payments after initial subscription
    await this.handleInvoicePaid(invoice);
  },

  // ========== GET CURRENT SUBSCRIPTION ==========
  async getCurrentSubscription(userId: string): Promise<any> {
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
      include: {
        plan: true,
        payments: {
          where: { status: 'SUCCEEDED' },
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        invoices: {
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      }
    });

    if (!subscription) {
      // Check if user is on free trial
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { vendorProfile: true }
      });

      if (user?.role === 'VENDOR') {
        // Return free trial information
        const freePlan = await prisma.plan.findFirst({
          where: { type: 'FREE', isActive: true }
        });

        return {
          status: 'TRIALING',
          plan: freePlan,
          trialDays: freePlan?.trialDays || 14,
          currentPeriodEnd: new Date(Date.now() + (freePlan?.trialDays || 14) * 24 * 60 * 60 * 1000),
          features: freePlan?.features || {},
          isOnFreeTrial: true
        };
      }

      throw new ApiError(httpStatus.NOT_FOUND, "No subscription found");
    }

    const planFeatures = subscription.plan.features as PlanFeatures;

    return {
      ...subscription,
      plan: {
        ...subscription.plan,
        features: planFeatures
      },
      usage: {
        suppliers: subscription.usedSuppliers,
        assessments: subscription.usedAssessments,
        storage: subscription.usedStorage,
        suppliersLimit: planFeatures.supplierLimit,
        assessmentsLimit: subscription.plan.assessmentLimit,
        storageLimit: subscription.plan.storageLimit
      },
      isOnFreeTrial: subscription.status === 'TRIALING'
    };
  },

  // ========== CANCEL SUBSCRIPTION ==========
  async cancelSubscription(
    userId: string,
    reason?: string
  ): Promise<Subscription> {
    const subscription = await prisma.subscription.findUnique({
      where: { userId }
    });

    if (!subscription) {
      throw new ApiError(httpStatus.NOT_FOUND, "Subscription not found");
    }

    if (subscription.status === 'CANCELED') {
      throw new ApiError(httpStatus.BAD_REQUEST, "Subscription is already canceled");
    }

    if (!subscription.stripeSubscriptionId) {
      throw new ApiError(httpStatus.BAD_REQUEST, "No Stripe subscription found");
    }

    // Cancel at period end in Stripe
    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: true
    });

    const updatedSubscription = await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        cancelAtPeriodEnd: true,
        cancellationReason: reason
      }
    });

    // Create notification
    await prisma.notification.create({
      data: {
        userId,
        title: "Subscription Cancellation Requested",
        message: `Your subscription will be cancelled at the end of the current billing period.`,
        type: 'SYSTEM_ALERT',
        metadata: {
          subscriptionId: subscription.id,
          cancellationReason: reason
        }
      }
    });

    return updatedSubscription;
  },

  // ========== UPDATE PAYMENT METHOD ==========
  async createPaymentMethodSetupSession(userId: string): Promise<{ sessionId: string; url: string }> {
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
      include: { plan: true }
    });

    if (!subscription) {
      throw new ApiError(httpStatus.NOT_FOUND, "Subscription not found");
    }

    if (!subscription.stripeCustomerId) {
      throw new ApiError(httpStatus.BAD_REQUEST, "No Stripe customer found");
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${config.frontend?.url || config.APP.WEBSITE}/subscription`
    });

    return {
      sessionId: session.id,
      url: session.url
    };
  },

  // ========== CHECK USAGE LIMITS ==========
  async checkUsageLimits(userId: string): Promise<{
    canAddSupplier: boolean;
    canCreateAssessment: boolean;
    canUploadDocument: boolean;
    limits: any;
    usage: any;
  }> {
    const subscription = await this.getCurrentSubscription(userId);
    
    const planFeatures = subscription.plan.features as PlanFeatures;
    const usage = subscription.usage || {};

    return {
      canAddSupplier: usage.suppliers < planFeatures.supplierLimit,
      canCreateAssessment: usage.assessments < (subscription.plan.assessmentLimit || 100),
      canUploadDocument: usage.storage < (subscription.plan.storageLimit || 10),
      limits: {
        suppliers: planFeatures.supplierLimit,
        assessments: subscription.plan.assessmentLimit,
        storage: subscription.plan.storageLimit,
        users: subscription.plan.userLimit
      },
      usage: {
        suppliers: usage.suppliers || 0,
        assessments: usage.assessments || 0,
        storage: usage.storage || 0
      }
    };
  },

  // ========== UPGRADE SUBSCRIPTION ==========
  async upgradeSubscription(
    userId: string,
    newPlanId: string
  ): Promise<{ sessionId: string; url: string }> {
    const currentSubscription = await prisma.subscription.findUnique({
      where: { userId },
      include: { plan: true }
    });

    if (!currentSubscription) {
      throw new ApiError(httpStatus.NOT_FOUND, "No active subscription found");
    }

    const newPlan = await prisma.plan.findUnique({
      where: { id: newPlanId, isActive: true, isDeleted: false }
    });

    if (!newPlan) {
      throw new ApiError(httpStatus.NOT_FOUND, "New plan not found");
    }

    // Check if it's actually an upgrade
    const currentPrice = currentSubscription.plan.price.toNumber();
    const newPrice = newPlan.price.toNumber();
    
    if (newPrice <= currentPrice) {
      throw new ApiError(httpStatus.BAD_REQUEST, "You can only upgrade to a higher-priced plan");
    }

    // Create checkout session for upgrade
    const session = await this.createCheckoutSession(userId, newPlanId, newPlan.billingCycle);

    return session;
  },

  // ========== SEND WELCOME EMAIL ==========
  async sendSubscriptionWelcomeEmail(email: string, plan: Plan): Promise<void> {
    const features = plan.features as PlanFeatures;
    
    const featureList = Object.entries(features)
      .filter(([key, value]) => value === true && !key.includes('trialOnly'))
      .map(([key]) => {
        // Format feature name for display
        return key
          .replace(/([A-Z])/g, ' $1')
          .replace(/^./, str => str.toUpperCase())
          .replace(/Api/, 'API')
          .replace(/Nis2/, 'NIS2');
      })
      .slice(0, 10); // Limit to top 10 features

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Welcome to Your ${plan.name} Plan! 🎉</h2>
        <p>Thank you for subscribing to the ${plan.name} plan on CyberNark.</p>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Plan Details:</h3>
          <p><strong>Plan:</strong> ${plan.name} (${plan.billingCycle})</p>
          <p><strong>Price:</strong> ${plan.price.toNumber()} ${plan.currency}/${plan.billingCycle.toLowerCase()}</p>
          ${plan.originalPrice ? `<p><strong>Discount:</strong> You saved ${Math.round((1 - plan.price.toNumber() / plan.originalPrice.toNumber()) * 100)}%</p>` : ''}
          <p><strong>Trial Period:</strong> ${plan.trialDays} days</p>
        </div>
        
        <div style="background-color: #e8f4fd; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Key Features:</h3>
          <ul style="margin: 0; padding-left: 20px;">
            ${featureList.map(feature => `<li>${feature}</li>`).join('')}
          </ul>
          <p><strong>Supplier Limit:</strong> ${features.supplierLimit === 999999 ? 'Unlimited' : features.supplierLimit}</p>
        </div>
        
        <p>You can now start adding suppliers and conducting risk assessments.</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${config.frontend?.url || config.APP.WEBSITE}/dashboard" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
            Go to Dashboard
          </a>
        </div>
        
        <p style="color: #666; font-size: 14px;">
          Need help getting started? Check out our <a href="${config.frontend?.url || config.APP.WEBSITE}/help">help documentation</a> or contact our support team.
        </p>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">© ${new Date().getFullYear()} CyberNark. All rights reserved.</p>
      </div>
    `;

    try {
      // Send email using your mail service
      // await mailtrapService.sendHtmlEmail({
      //   to: email,
      //   subject: `Welcome to CyberNark ${plan.name} Plan`,
      //   html
      // });
      console.log(`Welcome email sent to ${email} for ${plan.name} plan`);
    } catch (error) {
      console.error('Failed to send welcome email:', error);
    }
  }
};