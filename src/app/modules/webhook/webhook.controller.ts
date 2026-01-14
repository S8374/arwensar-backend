// src/app/modules/webhook/webhook.controller.ts
import { Request, Response } from "express";
import catchAsync from "../../shared/catchAsync";
import { stripeService } from "../../shared/stripe.service";
import { PaymentService } from "../payment/payment.service";

const handleWebhook = catchAsync(async (req: Request, res: Response) => {
  const signature = req.headers["stripe-signature"] as string;
  
  if (!signature) {
    return res.status(400).json({
      success: false,
      message: "Missing Stripe signature"
    });
  }

  let event;
  
  try {
    event = stripeService.constructEvent(req.body, signature);
  } catch (error: any) {
    console.error(`❌ Webhook signature verification failed:`, error.message);
    return res.status(400).json({
      success: false,
      message: `Webhook Error: ${error.message}`
    });
  }

  // console.log(`🔄 Processing Stripe event: ${event.type}`);

  // Handle event types
  switch (event.type) {
    case "checkout.session.completed":
      await PaymentService.handleCheckoutSessionCompleted(event.data.object);
      break;

    case "customer.subscription.updated":
      await PaymentService.handleSubscriptionUpdated(event.data.object);
      break;

    case "customer.subscription.deleted":
      await PaymentService.handleSubscriptionDeleted(event.data.object);
      break;

    case "invoice.payment_succeeded":
      await PaymentService.handleInvoicePaymentSucceeded(event.data.object);
      break;

    case "invoice.payment_failed":
      await PaymentService.handleInvoicePaymentFailed(event.data.object);
      break;

    case "payment_intent.succeeded":
      break;

    case "payment_intent.payment_failed":
      break;

    default:
     //  console.log(`⚠️ Unhandled event type: ${event.type}`);
  }

  res.json({ received: true, processed: true });
});

export const WebhookController = {
  handleWebhook
};