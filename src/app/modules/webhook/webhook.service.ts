// src/app/modules/webhook/webhook.controller.ts
import { Request, Response } from "express";
import catchAsync from "../../shared/catchAsync";
import { stripeService } from "../../shared/stripe.service";
import { prisma } from "../../shared/prisma";
import { PaymentService } from "../payment/payment.service";

const handleWebhook = catchAsync(async (req: Request, res: Response) => {
  const signature = req.headers['stripe-signature'] as string;
  let event;
  console.log("req", req.body)
  try {
    event = stripeService.constructEvent(req.body, signature);
  } catch (err: any) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log(`Received Stripe event: ${event.type}`);

  // Handle relevant events
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      await PaymentService.handleCheckoutSessionCompleted(session);
      break;

    case 'customer.subscription.updated':
    case 'customer.subscription.created':
      await handleSubscriptionUpdate(event.data.object);
      break;

    case 'customer.subscription.deleted':
      await handleSubscriptionDelete(event.data.object);
      break;

    case 'invoice.payment_succeeded':
      await handlePaymentSuccess(event.data.object);
      break;

    case 'invoice.payment_failed':
      await handlePaymentFailed(event.data.object);
      break;

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  res.json({ received: true });
});
const handleSubscriptionUpdate = async (subscription: any) => {
  const dbSubscription = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: subscription.id },
  });

  if (dbSubscription) {
    await prisma.subscription.update({
      where: { id: dbSubscription.id },
      data: {
        status: subscription.status.toUpperCase(),
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end
      },
    });
  }
};

const handleSubscriptionDelete = async (subscription: any) => {
  await prisma.subscription.update({
    where: { stripeSubscriptionId: subscription.id },
    data: {
      status: 'CANCELED',
    },
  });
};

const handlePaymentSuccess = async (invoice: any) => {
  // Create or update payment record
  await prisma.payment.create({
    data: {
      subscriptionId: invoice.subscription as string,
      amount: invoice.amount_paid / 100, // Convert from cents
      currency: invoice.currency,
      status: 'PAID',
      stripePaymentId: invoice.payment_intent,
      stripeInvoiceId: invoice.id,
      paidAt: new Date(),
    },
  });

  // Update subscription status
  if (invoice.subscription) {
    await prisma.subscription.update({
      where: { stripeSubscriptionId: invoice.subscription as string },
      data: {
        status: 'ACTIVE',
      },
    });
  }
};

const handlePaymentFailed = async (invoice: any) => {
  await prisma.payment.create({
    data: {
      subscriptionId: invoice.subscription as string,
      amount: invoice.amount_due / 100,
      currency: invoice.currency,
      status: 'FAILED',
      stripeInvoiceId: invoice.id,
    },
  });

  if (invoice.subscription) {
    await prisma.subscription.update({
      where: { stripeSubscriptionId: invoice.subscription as string },
      data: {
        status: 'PAST_DUE',
      },
    });
  }
};


export const WebhookController = {
  handleWebhook,
};