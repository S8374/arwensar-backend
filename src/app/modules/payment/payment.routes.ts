import express from "express";
import auth from "../../middlewares/auth";
import { UserRole } from "@prisma/client";
import validateRequest from "../../middlewares/validateRequest";
import { PaymentController } from "./payment.controller";
import { createCheckoutSchema } from "./payment.validation";

const router = express.Router();

/* =========================
   PLANS
========================= */

// Get all available plans (public)
router.get(
  "/plans",
  PaymentController.getAvailablePlans
);

// Get single plan by ID (public)
router.get(
  "/plans/:planId",
  PaymentController.getPlanById
);

/* =========================
   CHECKOUT & PAYMENT
========================= */

router.post(
  "/create-checkout-session",
  auth(UserRole.VENDOR),
  validateRequest(createCheckoutSchema),
  PaymentController.createCheckoutSession
);

// Stripe session status (public for polling)
router.get(
  "/session-status/:sessionId",
  PaymentController.getSessionStatus
);

// Confirm payment after success redirect
router.post(
  "/confirm-payment",
  PaymentController.confirmPayment
);

/* =========================
   SUBSCRIPTION
========================= */

// Get current user subscription
router.get(
  "/current-subscription",
  auth(UserRole.VENDOR),
  PaymentController.getCurrentSubscription
);

// Cancel subscription
router.post(
  "/cancel-subscription",
  auth(UserRole.VENDOR),
  PaymentController.cancelSubscription
);

// Stripe customer portal
router.post(
  "/create-portal-session",
  auth(UserRole.VENDOR),
  PaymentController.createPortalSession
);

/* =========================
   PAYMENT HISTORY
========================= */

router.get(
  "/payment-history",
  auth(UserRole.VENDOR),
  PaymentController.getPaymentHistory
);

export const paymentRoutes = router;
