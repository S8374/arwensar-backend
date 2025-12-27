// src/shared/stripe.service.ts
import Stripe from 'stripe';
import { config } from '../../config';

export class StripeService {
  public stripe: Stripe;

  constructor() {
    if (!config.STRIPE.SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not defined in environment variables');
    }

    this.stripe = new Stripe(config.STRIPE.SECRET_KEY, {
      apiVersion: '2024-11-20.acacia' as any,
      typescript: true,
    });
  }

  // Create a customer
  async createCustomer(
    email: string,
    name?: string,
    metadata?: any
  ): Promise<Stripe.Customer> {
    console.log('Creating customer with email:', email);
    console.log('Creating customer with name:', name);

    return await this.stripe.customers.create({


      email,
      name,
      metadata,
    });
  }
  
  // Create a product
  async createProduct(
    name: string,
    description?: string,
    metadata?: any
  ): Promise<Stripe.Product> {
    return await this.stripe.products.create({
      name,
      description,
      metadata,
      active: true,
    });
  }

  // Create a price
  async createPrice(
    productId: string,
    unitAmount: number,
    currency: string = 'eur',
    interval: 'month' | 'year' = 'month',
    metadata?: any
  ): Promise<Stripe.Price> {
    return await this.stripe.prices.create({
      product: productId,
      unit_amount: Math.round(unitAmount * 100), // Convert to cents
      currency,
      recurring: {
        interval,
      },
      metadata,
    });
  }

  // Create a subscription
  async createSubscription(
    customerId: string,
    priceId: string,
    trialDays?: number,
    metadata?: any
  ): Promise<Stripe.Subscription> {
    const subscriptionData: Stripe.SubscriptionCreateParams = {
      customer: customerId,
      items: [{ price: priceId }],
      metadata,
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent'],
    };

    if (trialDays && trialDays > 0) {
      subscriptionData.trial_period_days = trialDays;
    }

    return await this.stripe.subscriptions.create(subscriptionData);
  }

  // Cancel a subscription
  async cancelSubscription(
    subscriptionId: string,
    cancelAtPeriodEnd: boolean = false
  ): Promise<Stripe.Subscription> {
    return await this.stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: cancelAtPeriodEnd,
    });
  }

  // Retrieve a subscription
  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return await this.stripe.subscriptions.retrieve(subscriptionId);
  }

  // Update subscription
  async updateSubscription(
    subscriptionId: string,
    priceId: string
  ): Promise<Stripe.Subscription> {
    const subscription = await this.getSubscription(subscriptionId);

    return await this.stripe.subscriptions.update(subscriptionId, {
      items: [{
        id: subscription.items.data[0].id,
        price: priceId,
      }],
      proration_behavior: 'create_prorations',
    });
  }

  // Retrieve customer
  async getCustomer(customerId: string): Promise<Stripe.Customer | Stripe.DeletedCustomer> {
    return await this.stripe.customers.retrieve(customerId);
  }

  // Retrieve invoice
  async getInvoice(invoiceId: string): Promise<Stripe.Invoice> {
    return await this.stripe.invoices.retrieve(invoiceId);
  }

  // Construct webhook event
  constructEvent(payload: Buffer, signature: string): Stripe.Event {
    if (!config.STRIPE.WEBHOOK_SECRET) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not defined in environment variables');
    }

    return this.stripe.webhooks.constructEvent(
      payload,
      signature,
      config.STRIPE.WEBHOOK_SECRET
    );
  }

  // Create checkout session
  async createCheckoutSession(
    customerEmail: string,
    priceId: string,
    planName: string,
    vendorId: string,
    planId: string,
    successUrl: string,
    cancelUrl: string
  ): Promise<Stripe.Checkout.Session> {
    return await this.stripe.checkout.sessions.create({
      customer_email: customerEmail,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      metadata: {
        vendorId,
        planId,
        planName,
      },
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      billing_address_collection: 'required',
      allow_promotion_codes: true,
    });
  }

  // Retrieve checkout session
  async getCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session> {
    return await this.stripe.checkout.sessions.retrieve(sessionId);
  }

  // Create a portal session for customer portal
  async createPortalSession(
    customerId: string,
    returnUrl: string
  ): Promise<Stripe.BillingPortal.Session> {
    return await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
  }
}

// Create and export singleton instance
export const stripeService = new StripeService();