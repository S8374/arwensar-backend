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
exports.stripeService = exports.StripeService = void 0;
// src/shared/stripe.service.ts
const stripe_1 = __importDefault(require("stripe"));
const config_1 = require("../../config");
class StripeService {
    constructor() {
        if (!config_1.config.STRIPE.SECRET_KEY) {
            throw new Error('STRIPE_SECRET_KEY is not defined in environment variables');
        }
        this.stripe = new stripe_1.default(config_1.config.STRIPE.SECRET_KEY, {
            apiVersion: '2024-11-20.acacia',
            typescript: true,
        });
    }
    // Create a customer
    createCustomer(email, name, metadata) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('Creating customer with email:', email);
            console.log('Creating customer with name:', name);
            return yield this.stripe.customers.create({
                email,
                name,
                metadata,
            });
        });
    }
    // Create a product
    createProduct(name, description, metadata) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.stripe.products.create({
                name,
                description,
                metadata,
                active: true,
            });
        });
    }
    // Create a price
    createPrice(productId_1, unitAmount_1) {
        return __awaiter(this, arguments, void 0, function* (productId, unitAmount, currency = 'eur', interval = 'month', metadata) {
            return yield this.stripe.prices.create({
                product: productId,
                unit_amount: Math.round(unitAmount * 100), // Convert to cents
                currency,
                recurring: {
                    interval,
                },
                metadata,
            });
        });
    }
    // Create a subscription
    createSubscription(customerId, priceId, trialDays, metadata) {
        return __awaiter(this, void 0, void 0, function* () {
            const subscriptionData = {
                customer: customerId,
                items: [{ price: priceId }],
                metadata,
                payment_behavior: 'default_incomplete',
                expand: ['latest_invoice.payment_intent'],
            };
            if (trialDays && trialDays > 0) {
                subscriptionData.trial_period_days = trialDays;
            }
            return yield this.stripe.subscriptions.create(subscriptionData);
        });
    }
    // Cancel a subscription
    cancelSubscription(subscriptionId_1) {
        return __awaiter(this, arguments, void 0, function* (subscriptionId, cancelAtPeriodEnd = false) {
            return yield this.stripe.subscriptions.update(subscriptionId, {
                cancel_at_period_end: cancelAtPeriodEnd,
            });
        });
    }
    // Retrieve a subscription
    getSubscription(subscriptionId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.stripe.subscriptions.retrieve(subscriptionId);
        });
    }
    // Update subscription
    updateSubscription(subscriptionId, priceId) {
        return __awaiter(this, void 0, void 0, function* () {
            const subscription = yield this.getSubscription(subscriptionId);
            return yield this.stripe.subscriptions.update(subscriptionId, {
                items: [{
                        id: subscription.items.data[0].id,
                        price: priceId,
                    }],
                proration_behavior: 'create_prorations',
            });
        });
    }
    // Retrieve customer
    getCustomer(customerId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.stripe.customers.retrieve(customerId);
        });
    }
    // Retrieve invoice
    getInvoice(invoiceId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.stripe.invoices.retrieve(invoiceId);
        });
    }
    // Construct webhook event
    constructEvent(payload, signature) {
        if (!config_1.config.STRIPE.WEBHOOK_SECRET) {
            throw new Error('STRIPE_WEBHOOK_SECRET is not defined in environment variables');
        }
        return this.stripe.webhooks.constructEvent(payload, signature, config_1.config.STRIPE.WEBHOOK_SECRET);
    }
    // Create checkout session
    createCheckoutSession(customerEmail, priceId, planName, vendorId, planId, successUrl, cancelUrl) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.stripe.checkout.sessions.create({
                customer_email: customerEmail,
                line_items: [
                    {
                        price: priceId,
                        quantity: 1,
                    },
                ],
                mode: 'subscription',
                metadata: {
                    vendorId,
                    planId,
                    planName,
                },
                success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: cancelUrl,
                billing_address_collection: 'required',
                allow_promotion_codes: true,
            });
        });
    }
    // Retrieve checkout session
    getCheckoutSession(sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.stripe.checkout.sessions.retrieve(sessionId);
        });
    }
    // Create a portal session for customer portal
    createPortalSession(customerId, returnUrl) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.stripe.billingPortal.sessions.create({
                customer: customerId,
                return_url: returnUrl,
            });
        });
    }
}
exports.StripeService = StripeService;
// Create and export singleton instance
exports.stripeService = new StripeService();
