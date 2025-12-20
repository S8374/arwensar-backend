// src/modules/payment/payment.route.ts
import express from "express";
import { PaymentController } from "./payment.controller";
import {
  createDirectPaymentSchema,
  createPaymentMethodSchema,
  refundPaymentSchema
} from "./payment.constant";
import bodyParser from "body-parser";
import auth from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { createCheckoutSessionSchema } from "../subscription/subscription.constant";

const router = express.Router();

// Webhook needs raw body
const webhookRouter = express.Router();
webhookRouter.post(
  "/webhook",
  bodyParser.raw({ type: 'application/json' }),
  PaymentController.handleWebhook
);

// Public routes for webhook
router.use(webhookRouter);

// Get plans (public)
router.get(
  "/plans",
  PaymentController.getAvailablePlans
);

router.get(
  "/plans/:planId",
  PaymentController.getPlanById
);

// Protected routes
router.post(
  "/checkout",
  auth("VENDOR", "ADMIN"),
  validateRequest(createCheckoutSessionSchema),
  PaymentController.createCheckoutSession
);

router.post(
  "/direct",
  auth("VENDOR", "ADMIN"),
  validateRequest(createDirectPaymentSchema),
  PaymentController.createDirectPayment
);

// Payment methods
router.get(
  "/payment-methods",
  auth("VENDOR", "ADMIN"),
  PaymentController.getPaymentMethods
);

router.post(
  "/payment-methods",
  auth("VENDOR", "ADMIN"),
  validateRequest(createPaymentMethodSchema),
  PaymentController.createPaymentMethod
);

router.delete(
  "/payment-methods/:paymentMethodId",
  auth("VENDOR", "ADMIN"),
  PaymentController.deletePaymentMethod
);

router.post(
  "/payment-methods/:paymentMethodId/default",
  auth("VENDOR", "ADMIN"),
  PaymentController.setDefaultPaymentMethod
);

// Payments history
router.get(
  "/payments",
  auth("VENDOR", "ADMIN"),
  PaymentController.getPayments
);

router.get(
  "/payments/:paymentId",
  auth("VENDOR", "ADMIN"),
  PaymentController.getPaymentById
);

// Invoices
router.get(
  "/invoices",
  auth("VENDOR", "ADMIN"),
  PaymentController.getInvoices
);

router.get(
  "/invoices/:invoiceId",
  auth("VENDOR", "ADMIN"),
  PaymentController.getInvoiceById
);

router.get(
  "/invoices/:invoiceId/download",
  auth("VENDOR", "ADMIN"),
  PaymentController.downloadInvoice
);

// Refund
router.post(
  "/payments/:paymentId/refund",
  auth("ADMIN"), // Only admin can refund
  validateRequest(refundPaymentSchema),
  PaymentController.refundPayment
);

// Subscription management
router.post(
  "/subscription/cancel",
  auth("VENDOR", "ADMIN"),
  PaymentController.cancelSubscription
);

// Billing portal
router.post(
  "/billing-portal",
  auth("VENDOR", "ADMIN"),
  PaymentController.getBillingPortalSession
);

// Statistics
router.get(
  "/statistics",
  auth("VENDOR", "ADMIN"),
  PaymentController.getPaymentStatistics
);

export const PaymentRoutes = router;