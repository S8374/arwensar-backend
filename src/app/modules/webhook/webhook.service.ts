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
      await PaymentService.handleSubscriptionUpdated(event.data.object);
      break;

    case 'customer.subscription.deleted':
      await PaymentService.handleSubscriptionDeleted(event.data.object);
      break;

    case 'invoice.payment_succeeded':
      await PaymentService.handleInvoicePaymentSucceeded(event.data.object);
      break;

    case 'invoice.payment_failed':
      await PaymentService.handleInvoicePaymentFailed(event.data.object);
      break;

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  res.json({ received: true });
});


export const WebhookController = {
  handleWebhook,
};