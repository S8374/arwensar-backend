"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentRoutes = void 0;
// src/app/modules/payment/payment.routes.ts
const express_1 = __importDefault(require("express"));
const auth_1 = __importDefault(require("../../middlewares/auth"));
const client_1 = require("@prisma/client");
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const payment_controller_1 = require("./payment.controller");
const payment_validation_1 = require("./payment.validation");
const router = express_1.default.Router();
// Create checkout session
router.post('/create-checkout-session', (0, auth_1.default)(client_1.UserRole.VENDOR), (0, validateRequest_1.default)(payment_validation_1.createCheckoutSchema), payment_controller_1.PaymentController.createCheckoutSession);
// Get session status (public for frontend polling)
router.get('/session-status/:sessionId', payment_controller_1.PaymentController.getSessionStatus);
// Create portal session for customer portal
router.post('/create-portal-session', (0, auth_1.default)(client_1.UserRole.VENDOR), payment_controller_1.PaymentController.createPortalSession);
exports.paymentRoutes = router;
