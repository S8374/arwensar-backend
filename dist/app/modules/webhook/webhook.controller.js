"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookController = void 0;
const catchAsync_1 = __importDefault(require("../../shared/catchAsync"));
const stripe_service_1 = require("../../shared/stripe.service");
const payment_service_1 = require("../payment/payment.service");
const handleWebhook = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const signature = req.headers["stripe-signature"];
    if (!signature) {
        return res.status(400).json({
            success: false,
            message: "Missing Stripe signature"
        });
    }
    let event;
    try {
        event = stripe_service_1.stripeService.constructEvent(req.body, signature);
    }
    catch (error) {
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
            yield payment_service_1.PaymentService.handleCheckoutSessionCompleted(event.data.object);
            break;
        case "customer.subscription.updated":
            yield payment_service_1.PaymentService.handleSubscriptionUpdated(event.data.object);
            break;
        case "customer.subscription.deleted":
            yield payment_service_1.PaymentService.handleSubscriptionDeleted(event.data.object);
            break;
        case "invoice.payment_succeeded":
            yield payment_service_1.PaymentService.handleInvoicePaymentSucceeded(event.data.object);
            break;
        case "invoice.payment_failed":
            yield payment_service_1.PaymentService.handleInvoicePaymentFailed(event.data.object);
            break;
        case "payment_intent.succeeded":
            break;
        case "payment_intent.payment_failed":
            break;
        default:
        //  console.log(`⚠️ Unhandled event type: ${event.type}`);
    }
    res.json({ received: true, processed: true });
}));
exports.WebhookController = {
    handleWebhook
};
