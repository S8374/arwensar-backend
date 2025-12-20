// src/modules/subscription/subscription.controller.ts
import { Request, Response } from "express";
import sendResponse from "../../shared/sendResponse";
import httpStatus from "http-status";
import { SubscriptionService } from "./subscription.service";
import Stripe from "stripe";
import { config } from "../../../config";
import catchAsync from "../../shared/catchAsync";

const getAvailablePlans = catchAsync(async (req: Request, res: Response) => {
  const { billingCycle } = req.query;
  
  const plans = await SubscriptionService.getAvailablePlans(billingCycle as string);
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Plans retrieved successfully",
    data: plans
  });
});

const getPlanById = catchAsync(async (req: Request, res: Response) => {
  const { planId } = req.params;
  
  const plan = await SubscriptionService.getPlanById(planId);
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Plan retrieved successfully",
    data: plan
  });
});

const createCheckoutSession = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  
  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "User ID not found",
      data: null
    });
  }

  const { planId, billingCycle } = req.body;
  
  if (!planId || !billingCycle) {
    return sendResponse(res, {
      statusCode: httpStatus.BAD_REQUEST,
      success: false,
      message: "Plan ID and billing cycle are required",
      data: null
    });
  }

  const result = await SubscriptionService.createCheckoutSession(
    userId,
    planId,
    billingCycle
  );
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Checkout session created successfully",
    data: result
  });
});

const getCurrentSubscription = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  
  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "User ID not found",
      data: null
    });
  }

  const subscription = await SubscriptionService.getCurrentSubscription(userId);
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Subscription retrieved successfully",
    data: subscription
  });
});

const cancelSubscription = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  
  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "User ID not found",
      data: null
    });
  }

  const subscription = await SubscriptionService.cancelSubscription(
    userId,
    req.body.reason
  );
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Subscription cancellation requested",
    data: subscription
  });
});

const checkUsageLimits = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  
  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "User ID not found",
      data: null
    });
  }

  const limits = await SubscriptionService.checkUsageLimits(userId);
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Usage limits retrieved successfully",
    data: limits
  });
});

const upgradeSubscription = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  
  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "User ID not found",
      data: null
    });
  }

  const { newPlanId } = req.body;
  
  if (!newPlanId) {
    return sendResponse(res, {
      statusCode: httpStatus.BAD_REQUEST,
      success: false,
      message: "New plan ID is required",
      data: null
    });
  }

  const result = await SubscriptionService.upgradeSubscription(userId, newPlanId);
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Upgrade checkout session created",
    data: result
  });
});

const createPaymentMethodSession = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  
  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "User ID not found",
      data: null
    });
  }

  const result = await SubscriptionService.createPaymentMethodSetupSession(userId);
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Payment method setup session created",
    data: result
  });
});

// Webhook endpoint (no auth required)
const handleWebhook = catchAsync(async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = config.STRIPE.WEBHOOK_SECRET;

  let event: Stripe.Event;

  try {
    if (!sig || !endpointSecret) {
      throw new Error('Missing Stripe signature or webhook secret');
    }

    event = Stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  await SubscriptionService.handleWebhook(event);

  // Return a 200 response to acknowledge receipt of the event
  res.json({ received: true });
});

export const SubscriptionController = {
  getAvailablePlans,
  getPlanById,
  createCheckoutSession,
  getCurrentSubscription,
  cancelSubscription,
  checkUsageLimits,
  upgradeSubscription,
  createPaymentMethodSession,
  handleWebhook
};