// src/modules/payment/payment.service.ts
import { Payment, Plan, Subscription, PaymentStatus, PaymentType, PlanType, BillingCycle } from "@prisma/client";
import { prisma } from "../../shared/prisma";
import httpStatus from "http-status";
import Stripe from "stripe";
import { mailtrapService } from "../../shared/mailtrap.service";
import { NotificationService } from "../notification/notification.service";
import { config } from "../../../config";
import ApiError from "../../../error/ApiError";

const stripe = new Stripe(config.STRIPE.SECRET_KEY, {
  apiVersion: "2025-12-15.clover"
});

export interface PaymentSessionResponse {
  sessionId: string;
  url: string;
  session: Stripe.Checkout.Session;
}

export interface DirectPaymentResponse {
  payment: Payment;
  subscription?: Subscription;
  invoice?: any;
}

export interface PaymentMethodResponse {
  id: string;
  type: string;
  last4: string;
  brand: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

export const PaymentService = {
  // ========== GET AVAILABLE PLANS ==========
  async getAvailablePlans(): Promise<{
    monthly: any[];
    annual: any[];
  }> {
    const plans = await prisma.plan.findMany({
      where: {
        isActive: true,
        isDeleted: false
      },
      orderBy: [
        { billingCycle: 'asc' },
        { price: 'asc' }
      ]
    });

    const monthly = plans.filter(p => p.billingCycle === 'MONTHLY');
    const annual = plans.filter(p => p.billingCycle === 'ANNUAL');

    return { monthly, annual };
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
    data: any
  ): Promise<PaymentSessionResponse> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { vendorProfile: true }
    });

    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, "User not found");
    }

    const plan = await prisma.plan.findUnique({
      where: { 
        id: data.planId,
        isActive: true,
        isDeleted: false 
      }
    });

    if (!plan) {
      throw new ApiError(httpStatus.NOT_FOUND, "Plan not found");
    }

    // Check if user already has an active subscription
    const existingSubscription = await prisma.subscription.findUnique({
      where: { userId }
    });

    if (existingSubscription) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "You already have an active subscription. Please cancel it before purchasing a new plan."
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

    // Get or create Stripe price
    let priceId = plan.stripePriceId;
    if (!priceId) {
      const stripePrice = await stripe.prices.create({
        unit_amount: Math.round(plan.price.toNumber() * 100), // Convert to cents
        currency: plan.currency.toLowerCase(),
        recurring: {
          interval: data.billingCycle.toLowerCase() as any
        },
        product_data: {
          name: plan.name,
          description: plan.description || undefined,
          metadata: {
            planId: plan.id,
            supplierLimit: plan.supplierLimit.toString(),
            features: JSON.stringify(plan.features)
          }
        }
      });
      priceId = stripePrice.id;

      // Update plan with Stripe price ID
      await prisma.plan.update({
        where: { id: data.planId },
        data: { stripePriceId: priceId }
      });
    }

    // Create checkout session
    const successUrl = data.successUrl || `${config.FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = data.cancelUrl || `${config.FRONTEND_URL}/payment/cancel`;

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
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId,
        planId: plan.id,
        billingCycle: data.billingCycle,
        type: 'SUBSCRIPTION'
      },
      subscription_data: {
        trial_period_days: plan.trialDays || config.APP.FREE_TRIAL_DAYS,
        metadata: {
          planId: plan.id,
          billingCycle: data.billingCycle
        }
      },
      billing_address_collection: 'required',
      customer_update: {
        address: 'auto',
        name: 'auto'
      }
    });

    // Create pending payment record
    await prisma.payment.create({
      data: {
        userId,
        planId: plan.id,
        amount: plan.price,
        currency: plan.currency,
        status: 'PENDING',
        paymentType: 'SUBSCRIPTION',
        stripeSessionId: session.id,
        stripeCustomerId: customerId,
        metadata: {
          planName: plan.name,
          billingCycle: data.billingCycle,
          trialDays: plan.trialDays
        }
      }
    });

    return {
      sessionId: session.id,
      url: session.url || "",
      session
    };
  },

  // ========== CREATE DIRECT PAYMENT ==========
  async createDirectPayment(
    userId: string,
    data: any
  ): Promise<DirectPaymentResponse> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { vendorProfile: true }
    });

    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, "User not found");
    }

    const plan = await prisma.plan.findUnique({
      where: { 
        id: data.planId,
        isActive: true,
        isDeleted: false 
      }
    });

    if (!plan) {
      throw new ApiError(httpStatus.NOT_FOUND, "Plan not found");
    }

    // Check if user already has an active subscription
    const existingSubscription = await prisma.subscription.findUnique({
      where: { userId }
    });

    if (existingSubscription) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "You already have an active subscription"
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

    // Attach payment method to customer if saving
    if (data.savePaymentMethod) {
      await stripe.paymentMethods.attach(data.paymentMethodId, {
        customer: customerId
      });

      // Set as default payment method
      await stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: data.paymentMethodId
        }
      });
    }

    // Get or create Stripe price
    let priceId = plan.stripePriceId;
    if (!priceId) {
      const stripePrice = await stripe.prices.create({
        unit_amount: Math.round(plan.price.toNumber() * 100),
        currency: plan.currency.toLowerCase(),
        recurring: {
          interval: data.billingCycle.toLowerCase() as any
        },
        product_data: {
          name: plan.name,
          description: plan.description || undefined
        }
      });
      priceId = stripePrice.id;

      await prisma.plan.update({
        where: { id: data.planId },
        data: { stripePriceId: priceId }
      });
    }

    // Create subscription in Stripe
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        planId: plan.id,
        billingCycle: data.billingCycle
      },
      trial_period_days: plan.trialDays || config.APP.FREE_TRIAL_DAYS
    });

    // Create subscription in database
    const dbSubscription = await prisma.subscription.create({
      data: {
        userId,
        planId: plan.id,
        status: subscription.status.toUpperCase() as any,
        billingCycle: data.billingCycle,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        trialStart: subscription.trial_start ? new Date(subscription.trial_start * 1000) : null,
        trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscription.id
      }
    });

    // Create payment record
    const payment = await prisma.payment.create({
      data: {
        userId,
        planId: plan.id,
        subscriptionId: dbSubscription.id,
        amount: plan.price,
        currency: plan.currency,
        status: 'PENDING',
        paymentType: 'SUBSCRIPTION',
        stripeSubscriptionId: subscription.id ,
        stripeCustomerId: customerId,
        paymentMethodId: data.paymentMethodId,
        metadata: {
          planName: plan.name,
          billingCycle: data.billingCycle,
          trialDays: plan.trialDays
        }
      }
    });

    return {
      payment,
      subscription: dbSubscription
    };
  },

  // ========== HANDLE WEBHOOK ==========
  async handleWebhook(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.created':
        await this.handleSubscriptionCreated(event.data.object as Stripe.Subscription);
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
      case 'payment_intent.succeeded':
        await this.handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;
      case 'payment_intent.payment_failed':
        await this.handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;
      case 'payment_method.attached':
        await this.handlePaymentMethodAttached(event.data.object as Stripe.PaymentMethod);
        break;
      case 'payment_method.detached':
        await this.handlePaymentMethodDetached(event.data.object as Stripe.PaymentMethod);
        break;
    }
  },

  async handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const { userId, planId, billingCycle, type } = session.metadata || {};
    
    if (!userId || !planId || type !== 'SUBSCRIPTION') {
      console.error('Missing metadata in checkout session');
      return;
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

    const result = await prisma.$transaction(async (tx) => {
      // Check if subscription already exists
      let dbSubscription = await tx.subscription.findUnique({
        where: { userId }
      });

      if (!dbSubscription) {
        // Create subscription
        dbSubscription = await tx.subscription.create({
          data: {
            userId,
            planId,
            status: subscription.status.toUpperCase() as any,
            billingCycle: billingCycle?.toUpperCase() as any || 'MONTHLY',
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            trialStart: subscription.trial_start ? new Date(subscription.trial_start * 1000) : null,
            trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
            stripeCustomerId: subscription.customer as string,
            stripeSubscriptionId: subscription.id,
            stripeSessionId: session.id
          }
        });
      }

      // Update payment status
      const payment = await tx.payment.updateMany({
        where: {
          stripeSessionId: session.id,
          userId
        },
        data: {
          status: 'SUCCEEDED',
          stripePaymentId: session.payment_intent as string,
          stripeInvoiceId: session.invoice as string,
          paidAt: new Date(),
          subscriptionId: dbSubscription.id
        }
      });

      // Create invoice if payment was successful
      if (session.payment_status === 'paid' && session.invoice) {
        const stripeInvoice = await stripe.invoices.retrieve(session.invoice as string);
        
        await tx.invoice.create({
          data: {
            subscriptionId: dbSubscription.id,
            invoiceNumber: stripeInvoice.number || `INV-${Date.now()}`,
            amount: stripeInvoice.amount_paid / 100,
            currency: stripeInvoice.currency.toUpperCase(),
            status: 'SUCCEEDED',
            periodStart: stripeInvoice.period_start ? new Date(stripeInvoice.period_start * 1000) : null,
            periodEnd: stripeInvoice.period_end ? new Date(stripeInvoice.period_end * 1000) : null,
            dueDate: stripeInvoice.due_date ? new Date(stripeInvoice.due_date * 1000) : null,
            stripeInvoiceId: stripeInvoice.id,
            hostedInvoiceUrl: stripeInvoice.hosted_invoice_url || null,
            pdfUrl: stripeInvoice.invoice_pdf || null,
            paidAt: new Date(),
            items: stripeInvoice.lines.data.map(line => ({
              description: line.description,
              amount: line.amount / 100,
              quantity: line.quantity || 1
            }))
          }
        });
      }

      // Update vendor with Stripe customer ID
      if (user.vendorProfile) {
        await tx.vendor.update({
          where: { id: user.vendorProfile.id },
          data: {
            stripeCustomerId: subscription.customer as string
          }
        });
      }

      return { dbSubscription, payment };
    });

    // Send notification
    await NotificationService.createNotification({
      userId,
      title: "Payment Successful",
      message: `Your payment for ${plan.name} plan was successful`,
      type: 'PAYMENT_SUCCESS',
      metadata: {
        planId: plan.id,
        planName: plan.name,
        amount: plan.price.toNumber(),
        billingCycle: billingCycle,
        subscriptionId: result.dbSubscription.id
      }
    });

    // Send confirmation email
    try {
      await mailtrapService.sendHtmlEmail({
        to: user.email,
        subject: `Payment Confirmation - ${plan.name} Plan`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Payment Successful! 🎉</h2>
            <p>Thank you for subscribing to the <strong>${plan.name}</strong> plan.</p>
            
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <h3 style="margin-top: 0;">Order Details:</h3>
              <p><strong>Plan:</strong> ${plan.name}</p>
              <p><strong>Billing Cycle:</strong> ${billingCycle}</p>
              <p><strong>Amount:</strong> ${plan.currency} ${plan.price.toNumber()}</p>
              <p><strong>Payment Date:</strong> ${new Date().toLocaleDateString()}</p>
              <p><strong>Subscription ID:</strong> ${result.dbSubscription.id}</p>
            </div>
            
            <p>Your subscription is now active. You can access all features of your plan immediately.</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${config.FRONTEND_URL}/dashboard" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                Go to Dashboard
              </a>
            </div>
            
            <div style="background-color: #e8f4fd; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h4 style="margin-top: 0;">What's Next?</h4>
              <ul style="margin-bottom: 0;">
                <li>Add your suppliers to start risk assessments</li>
                <li>Configure compliance settings</li>
                <li>Invite team members (if plan supports)</li>
                <li>Set up automated alerts and reminders</li>
              </ul>
            </div>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">© ${new Date().getFullYear()} CyberNark. All rights reserved.</p>
          </div>
        `
      });
    } catch (error) {
      console.error("Failed to send payment confirmation email:", error);
    }
  },

  async handleSubscriptionCreated(subscription: Stripe.Subscription): Promise<void> {
    const { planId, billingCycle } = subscription.metadata;
    
    if (!planId) {
      console.error('Missing planId in subscription metadata');
      return;
    }

    const customerId = subscription.customer as string;
    const vendor = await prisma.vendor.findFirst({
      where: { stripeCustomerId: customerId },
      include: { user: true }
    });

    if (!vendor) {
      console.error(`Vendor not found for customer: ${customerId}`);
      return;
    }

    // Update subscription status
    await prisma.subscription.updateMany({
      where: {
        userId: vendor.userId,
        stripeSubscriptionId: subscription.id
      },
      data: {
        status: subscription.status.toUpperCase() as any,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        trialStart: subscription.trial_start ? new Date(subscription.trial_start * 1000) : null,
        trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null
      }
    });
  },

  async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    const dbSubscription = await prisma.subscription.findFirst({
      where: { stripeSubscriptionId: subscription.id }
    });

    if (!dbSubscription) {
      console.error(`Subscription not found: ${subscription.id}`);
      return;
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
      console.error(`Subscription not found: ${subscription.id}`);
      return;
    }

    await prisma.subscription.update({
      where: { id: dbSubscription.id },
      data: {
        status: 'CANCELED',
        cancelledAt: new Date(),
        cancellationReason: 'Cancelled from Stripe'
      }
    });

    // Send notification
    await NotificationService.createNotification({
      userId: dbSubscription.userId,
      title: "Subscription Cancelled",
      message: "Your subscription has been cancelled",
      type: 'SYSTEM_ALERT',
      metadata: {
        subscriptionId: dbSubscription.id,
        cancelledAt: new Date().toISOString()
      }
    });
  },

  async handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    const subscription = await prisma.subscription.findFirst({
      where: { stripeSubscriptionId: invoice.subscription as string }
    });

    if (!subscription) {
      console.error(`Subscription not found for invoice: ${invoice.id}`);
      return;
    }

    await prisma.$transaction(async (tx) => {
      // Create payment record
      const payment = await tx.payment.create({
        data: {
          userId: subscription.userId,
          subscriptionId: subscription.id,
          planId: subscription.planId,
          amount: invoice.amount_paid / 100,
          currency: invoice.currency.toUpperCase(),
          status: 'SUCCEEDED',
          paymentType: 'SUBSCRIPTION',
          stripePaymentId: invoice.payment_intent as string,
          stripeInvoiceId: invoice.id,
          stripeCustomerId: invoice.customer as string,
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
          paymentId: payment.id,
          items: invoice.lines.data.map(line => ({
            description: line.description,
            amount: line.amount / 100,
            quantity: line.quantity || 1
          }))
        }
      });

      // Send notification
      await NotificationService.createNotification({
        userId: subscription.userId,
        title: "Payment Received",
        message: `Payment received for your subscription`,
        type: 'PAYMENT_SUCCESS',
        metadata: {
          amount: invoice.amount_paid / 100,
          currency: invoice.currency,
          invoiceNumber: invoice.number
        }
      });
    });
  },

  async handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const subscription = await prisma.subscription.findFirst({
      where: { stripeSubscriptionId: invoice.subscription as string }
    });

    if (!subscription) {
      console.error(`Subscription not found for invoice: ${invoice.id}`);
      return;
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
          userId: subscription.userId,
          subscriptionId: subscription.id,
          planId: subscription.planId,
          amount: invoice.amount_due / 100,
          currency: invoice.currency.toUpperCase(),
          status: 'FAILED',
          paymentType: 'SUBSCRIPTION',
          stripeInvoiceId: invoice.id,
          stripeCustomerId: invoice.customer as string,
          metadata: {
            failureMessage: invoice.charge ? (invoice.charge as any).failure_message : 'Payment failed'
          }
        }
      });

      // Send notification
      await NotificationService.createNotification({
        userId: subscription.userId,
        title: "Payment Failed",
        message: `Your subscription payment has failed. Please update your payment method.`,
        type: 'PAYMENT_FAILED',
        metadata: {
          invoiceId: invoice.id,
          amountDue: invoice.amount_due / 100,
          dueDate: invoice.due_date ? new Date(invoice.due_date * 1000) : null
        }
      });
    });
  },

  async handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    // Find and update payment
    const payment = await prisma.payment.findFirst({
      where: { stripePaymentId: paymentIntent.id }
    });

    if (payment) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'SUCCEEDED',
          paidAt: new Date(),
          paymentMethod: paymentIntent.payment_method_types?.[0],
          billingDetails: paymentIntent.shipping || paymentIntent.billing_details
        }
      });
    }
  },

  async handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const payment = await prisma.payment.findFirst({
      where: { stripePaymentId: paymentIntent.id }
    });

    if (payment) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'FAILED',
          metadata: {
            ...(payment.metadata as any),
            failureMessage: paymentIntent.last_payment_error?.message,
            failureCode: paymentIntent.last_payment_error?.code
          }
        }
      });
    }
  },

  async handlePaymentMethodAttached(paymentMethod: Stripe.PaymentMethod): Promise<void> {
    // Could log or update payment method details in database
    console.log('Payment method attached:', paymentMethod.id);
  },

  async handlePaymentMethodDetached(paymentMethod: Stripe.PaymentMethod): Promise<void> {
    // Could update payment method status in database
    console.log('Payment method detached:', paymentMethod.id);
  },

  // ========== GET PAYMENT METHODS ==========
  async getPaymentMethods(userId: string): Promise<PaymentMethodResponse[]> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { vendorProfile: true }
    });

    if (!user || !user.vendorProfile?.stripeCustomerId) {
      return [];
    }

    const paymentMethods = await stripe.paymentMethods.list({
      customer: user.vendorProfile.stripeCustomerId,
      type: 'card'
    });

    const customer = await stripe.customers.retrieve(user.vendorProfile.stripeCustomerId);
    const defaultPaymentMethod = (customer as any).invoice_settings?.default_payment_method;

    return paymentMethods.data.map(pm => ({
      id: pm.id,
      type: pm.type,
      last4: pm.card?.last4 || '',
      brand: pm.card?.brand || '',
      expMonth: pm.card?.exp_month || 0,
      expYear: pm.card?.exp_year || 0,
      isDefault: pm.id === defaultPaymentMethod
    }));
  },

  // ========== CREATE PAYMENT METHOD ==========
  async createPaymentMethod(
    userId: string,
    paymentMethodId: string
  ): Promise<PaymentMethodResponse> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { vendorProfile: true }
    });

    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, "User not found");
    }

    let customerId: string;
    if (user.vendorProfile?.stripeCustomerId) {
      customerId = user.vendorProfile.stripeCustomerId;
    } else {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.vendorProfile?.companyName || user.email,
        metadata: { userId }
      });
      customerId = customer.id;

      if (user.vendorProfile) {
        await prisma.vendor.update({
          where: { id: user.vendorProfile.id },
          data: { stripeCustomerId: customerId }
        });
      }
    }

    // Attach payment method to customer
    const paymentMethod = await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId
    });

    // Set as default payment method
    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId
      }
    });

    return {
      id: paymentMethod.id,
      type: paymentMethod.type,
      last4: paymentMethod.card?.last4 || '',
      brand: paymentMethod.card?.brand || '',
      expMonth: paymentMethod.card?.exp_month || 0,
      expYear: paymentMethod.card?.exp_year || 0,
      isDefault: true
    };
  },

  // ========== DELETE PAYMENT METHOD ==========
  async deletePaymentMethod(
    userId: string,
    paymentMethodId: string
  ): Promise<{ message: string }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { vendorProfile: true }
    });

    if (!user || !user.vendorProfile?.stripeCustomerId) {
      throw new ApiError(httpStatus.NOT_FOUND, "User or customer not found");
    }

    // Check if this is the only payment method
    const paymentMethods = await stripe.paymentMethods.list({
      customer: user.vendorProfile.stripeCustomerId,
      type: 'card'
    });

    if (paymentMethods.data.length <= 1) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Cannot delete the only payment method. Please add another payment method first."
      );
    }

    // Check if this is the default payment method
    const customer = await stripe.customers.retrieve(user.vendorProfile.stripeCustomerId);
    const defaultPaymentMethod = (customer as any).invoice_settings?.default_payment_method;

    if (paymentMethodId === defaultPaymentMethod) {
      // Find another payment method to set as default
      const otherMethod = paymentMethods.data.find(pm => pm.id !== paymentMethodId);
      if (otherMethod) {
        await stripe.customers.update(user.vendorProfile.stripeCustomerId, {
          invoice_settings: {
            default_payment_method: otherMethod.id
          }
        });
      }
    }

    // Detach payment method
    await stripe.paymentMethods.detach(paymentMethodId);

    return {
      message: "Payment method deleted successfully"
    };
  },

  // ========== SET DEFAULT PAYMENT METHOD ==========
  async setDefaultPaymentMethod(
    userId: string,
    paymentMethodId: string
  ): Promise<{ message: string }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { vendorProfile: true }
    });

    if (!user || !user.vendorProfile?.stripeCustomerId) {
      throw new ApiError(httpStatus.NOT_FOUND, "User or customer not found");
    }

    // Verify payment method belongs to customer
    const paymentMethods = await stripe.paymentMethods.list({
      customer: user.vendorProfile.stripeCustomerId,
      type: 'card'
    });

    const paymentMethodExists = paymentMethods.data.some(pm => pm.id === paymentMethodId);
    if (!paymentMethodExists) {
      throw new ApiError(httpStatus.NOT_FOUND, "Payment method not found");
    }

    // Set as default payment method
    await stripe.customers.update(user.vendorProfile.stripeCustomerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId
      }
    });

    return {
      message: "Default payment method updated successfully"
    };
  },

  // ========== GET PAYMENTS ==========
  async getPayments(
    userId: string,
    options: any = {}
  ): Promise<{ payments: Payment[]; meta: any }> {
    const { 
      page = 1, 
      limit = 20,
      status,
      paymentType,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = options;
    
    const skip = (page - 1) * limit;

    const where: any = { userId };

    if (status) {
      where.status = status;
    }

    if (paymentType) {
      where.paymentType = paymentType;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          plan: {
            select: {
              id: true,
              name: true,
              billingCycle: true
            }
          },
          subscription: {
            select: {
              id: true,
              status: true
            }
          },
          invoice: true
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit
      }),
      prisma.payment.count({ where })
    ]);

    return {
      payments,
      meta: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  },

  // ========== GET PAYMENT BY ID ==========
  async getPaymentById(paymentId: string, userId: string): Promise<Payment | null> {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        plan: true,
        subscription: true,
        invoice: true,
        user: {
          select: {
            id: true,
            email: true,
            vendorProfile: {
              select: {
                companyName: true
              }
            }
          }
        }
      }
    });

    if (!payment) {
      throw new ApiError(httpStatus.NOT_FOUND, "Payment not found");
    }

    if (payment.userId !== userId) {
      throw new ApiError(httpStatus.FORBIDDEN, "You don't have permission to view this payment");
    }

    return payment;
  },

  // ========== GET INVOICES ==========
  async getInvoices(
    userId: string,
    options: any = {}
  ): Promise<{ invoices: any[]; meta: any }> {
    const { 
      page = 1, 
      limit = 20,
      status,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = options;
    
    const skip = (page - 1) * limit;

    // Get user's subscription
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
      select: { id: true }
    });

    if (!subscription) {
      return { invoices: [], meta: { page, limit, total: 0, pages: 0 } };
    }

    const where: any = { subscriptionId: subscription.id };

    if (status) {
      where.status = status;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          payment: {
            select: {
              id: true,
              status: true,
              paidAt: true
            }
          }
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit
      }),
      prisma.invoice.count({ where })
    ]);

    return {
      invoices,
      meta: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  },

  // ========== GET INVOICE BY ID ==========
  async getInvoiceById(invoiceId: string, userId: string): Promise<any> {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        subscription: {
          include: {
            plan: true,
            user: {
              select: {
                id: true,
                email: true,
                vendorProfile: {
                  select: {
                    companyName: true,
                    businessEmail: true,
                    contactNumber: true
                  }
                }
              }
            }
          }
        },
        payment: true
      }
    });

    if (!invoice) {
      throw new ApiError(httpStatus.NOT_FOUND, "Invoice not found");
    }

    if (invoice.subscription.userId !== userId) {
      throw new ApiError(httpStatus.FORBIDDEN, "You don't have permission to view this invoice");
    }

    return invoice;
  },

  // ========== DOWNLOAD INVOICE ==========
  async downloadInvoice(invoiceId: string, userId: string): Promise<{ url: string }> {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        subscription: {
          select: { userId: true }
        }
      }
    });

    if (!invoice) {
      throw new ApiError(httpStatus.NOT_FOUND, "Invoice not found");
    }

    if (invoice.subscription.userId !== userId) {
      throw new ApiError(httpStatus.FORBIDDEN, "You don't have permission to download this invoice");
    }

    if (!invoice.pdfUrl && invoice.stripeInvoiceId) {
      // Retrieve from Stripe if not stored locally
      const stripeInvoice = await stripe.invoices.retrieve(invoice.stripeInvoiceId);
      if (stripeInvoice.invoice_pdf) {
        return { url: stripeInvoice.invoice_pdf };
      }
    }

    if (!invoice.pdfUrl) {
      throw new ApiError(httpStatus.NOT_FOUND, "Invoice PDF not available");
    }

    return { url: invoice.pdfUrl };
  },

  // ========== REFUND PAYMENT ==========
  async refundPayment(
    paymentId: string,
    userId: string,
    data: any
  ): Promise<{ message: string; refund: Stripe.Refund }> {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        user: {
          select: { id: true }
        }
      }
    });

    if (!payment) {
      throw new ApiError(httpStatus.NOT_FOUND, "Payment not found");
    }

    if (payment.userId !== userId) {
      throw new ApiError(httpStatus.FORBIDDEN, "You don't have permission to refund this payment");
    }

    if (payment.status !== 'SUCCEEDED') {
      throw new ApiError(httpStatus.BAD_REQUEST, "Only successful payments can be refunded");
    }

    if (!payment.stripePaymentId) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Cannot refund payment without Stripe payment ID");
    }

    // Create refund in Stripe
    const refundParams: Stripe.RefundCreateParams = {
      payment_intent: payment.stripePaymentId,
      reason: data.reason || 'requested_by_customer'
    };

    if (data.amount) {
      refundParams.amount = Math.round(data.amount * 100);
    }

    const refund = await stripe.refunds.create(refundParams);

    // Update payment status
    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: 'REFUNDED',
        refundedAt: new Date(),
        metadata: {
          ...(payment.metadata as any),
          refundId: refund.id,
          refundReason: data.reason,
          refundAmount: data.amount || payment.amount.toNumber()
        }
      }
    });

    // Send notification
    await NotificationService.createNotification({
      userId,
      title: "Payment Refunded",
      message: `Your payment has been refunded`,
      type: 'PAYMENT_SUCCESS',
      metadata: {
        paymentId: payment.id,
        amount: data.amount || payment.amount.toNumber(),
        refundId: refund.id
      }
    });

    return {
      message: "Payment refunded successfully",
      refund
    };
  },

  // ========== CANCEL SUBSCRIPTION ==========
  async cancelSubscription(
    userId: string,
    reason?: string
  ): Promise<{ message: string; subscription: Subscription }> {
    const subscription = await prisma.subscription.findUnique({
      where: { userId }
    });

    if (!subscription) {
      throw new ApiError(httpStatus.NOT_FOUND, "Subscription not found");
    }

    if (!subscription.stripeSubscriptionId) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Cannot cancel subscription without Stripe ID");
    }

    // Cancel subscription in Stripe
    const cancelledSubscription = await stripe.subscriptions.cancel(
      subscription.stripeSubscriptionId,
      {
        cancellation_details: {
          comment: reason || 'Cancelled by customer'
        }
      }
    );

    // Update subscription in database
    const updatedSubscription = await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'CANCELED',
        cancelledAt: new Date(),
        cancellationReason: reason,
        cancelAtPeriodEnd: false
      }
    });

    // Send notification
    await NotificationService.createNotification({
      userId,
      title: "Subscription Cancelled",
      message: "Your subscription has been cancelled",
      type: 'SYSTEM_ALERT',
      metadata: {
        subscriptionId: subscription.id,
        cancellationReason: reason
      }
    });

    return {
      message: "Subscription cancelled successfully",
      subscription: updatedSubscription
    };
  },

  // ========== GET BILLING PORTAL SESSION ==========
  async getBillingPortalSession(userId: string): Promise<{ url: string }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { vendorProfile: true }
    });

    if (!user || !user.vendorProfile?.stripeCustomerId) {
      throw new ApiError(httpStatus.NOT_FOUND, "Customer not found");
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.vendorProfile.stripeCustomerId,
      return_url: `${config.FRONTEND_URL}/billing`
    });

    return { url: session.url };
  },

  // ========== GET PAYMENT STATISTICS ==========
  async getPaymentStatistics(userId: string): Promise<any> {
    const payments = await prisma.payment.findMany({
      where: { userId },
      include: {
        plan: {
          select: {
            name: true,
            billingCycle: true
          }
        }
      }
    });

    const totalPayments = payments.length;
    const totalAmount = payments.reduce((sum, p) => sum + p.amount.toNumber(), 0);
    const successfulPayments = payments.filter(p => p.status === 'SUCCEEDED').length;
    const failedPayments = payments.filter(p => p.status === 'FAILED').length;
    const refundedPayments = payments.filter(p => p.status === 'REFUNDED').length;

    // Group by month
    const paymentsByMonth: Record<string, number> = {};
    payments.forEach(payment => {
      const month = payment.createdAt.toLocaleString('default', { 
        month: 'short',
        year: 'numeric'
      });
      paymentsByMonth[month] = (paymentsByMonth[month] || 0) + payment.amount.toNumber();
    });

    return {
      totalPayments,
      totalAmount: parseFloat(totalAmount.toFixed(2)),
      successfulPayments,
      failedPayments,
      refundedPayments,
      successRate: totalPayments > 0 ? (successfulPayments / totalPayments) * 100 : 0,
      paymentsByMonth,
      recentPayments: payments.slice(-5).map(p => ({
        id: p.id,
        amount: p.amount.toNumber(),
        currency: p.currency,
        status: p.status,
        createdAt: p.createdAt,
        plan: p.plan?.name
      }))
    };
  }
};