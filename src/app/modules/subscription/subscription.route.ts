// src/modules/subscription/subscription.route.ts
import express from "express";
import { SubscriptionController } from "./subscription.controller";
import bodyParser from "body-parser";
import auth from "../../middlewares/auth";

const router = express.Router();

// Public webhook endpoint (must be raw body)
router.post(
  "/webhook",
  bodyParser.raw({ type: 'application/json' }),
  SubscriptionController.handleWebhook
);

// Get available plans (public)
router.get(
  "/plans",
  SubscriptionController.getAvailablePlans
);

router.get(
  "/plans/:planId",
  SubscriptionController.getPlanById
);

// Authenticated routes
router.post(
  "/checkout",
  auth("VENDOR"),
  SubscriptionController.createCheckoutSession
);

router.get(
  "/current",
  auth("VENDOR"),
  SubscriptionController.getCurrentSubscription
);

router.post(
  "/cancel",
  auth("VENDOR"),
  SubscriptionController.cancelSubscription
);

router.get(
  "/usage-limits",
  auth("VENDOR"),
  SubscriptionController.checkUsageLimits
);

router.post(
  "/upgrade",
  auth("VENDOR"),
  SubscriptionController.upgradeSubscription
);

router.post(
  "/payment-method/setup",
  auth("VENDOR"),
  SubscriptionController.createPaymentMethodSession
);

export const SubscriptionRoutes = router;