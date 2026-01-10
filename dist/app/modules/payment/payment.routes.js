"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentRoutes = void 0;
const express_1 = __importDefault(require("express"));
const auth_1 = __importDefault(require("../../middlewares/auth"));
const client_1 = require("@prisma/client");
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const payment_controller_1 = require("./payment.controller");
const payment_validation_1 = require("./payment.validation");
const router = express_1.default.Router();
/* =========================
   PLANS
========================= */
// Get all available plans (public)
router.get("/plans", payment_controller_1.PaymentController.getAvailablePlans);
// Get single plan by ID (public)
router.get("/plans/:planId", payment_controller_1.PaymentController.getPlanById);
/* =========================
   CHECKOUT & PAYMENT
========================= */
router.post("/create-checkout-session", (0, auth_1.default)(client_1.UserRole.VENDOR), (0, validateRequest_1.default)(payment_validation_1.createCheckoutSchema), payment_controller_1.PaymentController.createCheckoutSession);
// Stripe session status (public for polling)
router.get("/session-status/:sessionId", payment_controller_1.PaymentController.getSessionStatus);
// Confirm payment after success redirect
router.post("/confirm-payment", payment_controller_1.PaymentController.confirmPayment);
/* =========================
   SUBSCRIPTION
========================= */
// Get current user subscription
router.get("/current-subscription", (0, auth_1.default)(client_1.UserRole.VENDOR), payment_controller_1.PaymentController.getCurrentSubscription);
// Cancel subscription
router.post("/cancel-subscription", (0, auth_1.default)(client_1.UserRole.VENDOR), payment_controller_1.PaymentController.cancelSubscription);
// Stripe customer portal
router.post("/create-portal-session", (0, auth_1.default)(client_1.UserRole.VENDOR), payment_controller_1.PaymentController.createPortalSession);
/* =========================
   PAYMENT HISTORY
========================= */
router.get("/payment-history", (0, auth_1.default)(client_1.UserRole.VENDOR), payment_controller_1.PaymentController.getPaymentHistory);
exports.paymentRoutes = router;
