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
exports.PaymentService = void 0;
const prisma_1 = require("../../shared/prisma");
const stripe_service_1 = require("../../shared/stripe.service");
const ApiError_1 = __importDefault(require("../../../error/ApiError"));
const http_status_1 = __importDefault(require("http-status"));
const config_1 = require("../../../config");
const mailtrap_service_1 = require("../../shared/mailtrap.service");
const getFeatures_1 = require("../../helper/getFeatures");
exports.PaymentService = {
    // ========== GET AVAILABLE PLANS ==========
    getAvailablePlans() {
        return __awaiter(this, void 0, void 0, function* () {
            return prisma_1.prisma.plan.findMany({
                where: {
                    isActive: true,
                    isDeleted: false
                },
                orderBy: [
                    { isPopular: 'desc' },
                    { price: 'asc' }
                ]
            });
        });
    },
    // ========== GET PLAN BY ID ==========
    getPlanById(planId) {
        return __awaiter(this, void 0, void 0, function* () {
            return prisma_1.prisma.plan.findUnique({
                where: {
                    id: planId,
                    isActive: true,
                    isDeleted: false
                }
            });
        });
    },
    // ========== CREATE CHECKOUT SESSION ==========
    createCheckoutSession(userId_1, planId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, planId, billingCycle = 'MONTHLY') {
            const user = yield prisma_1.prisma.user.findUnique({
                where: { id: userId },
                include: { vendorProfile: true }
            });
            if (!user || !user.vendorProfile) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "User or vendor profile not found");
            }
            const vendor = user.vendorProfile;
            const plan = yield this.getPlanById(planId);
            if (!plan || !plan.stripePriceId) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "Plan not found or not configured for Stripe");
            }
            const existingSubscription = yield prisma_1.prisma.subscription.findUnique({
                where: { userId }
            });
            // Block same plan
            if (existingSubscription &&
                existingSubscription.planId === planId &&
                existingSubscription.billingCycle === billingCycle &&
                ['ACTIVE', 'TRIALING', 'PAST_DUE'].includes(existingSubscription.status)) {
                throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, "You are already on this plan.");
            }
            // Get/create customer
            let stripeCustomerId = vendor.stripeCustomerId;
            if (!stripeCustomerId) {
                const customer = yield stripe_service_1.stripeService.createCustomer(user.email, vendor.companyName, {
                    userId: user.id,
                    vendorId: vendor.id,
                });
                stripeCustomerId = customer.id;
                yield prisma_1.prisma.vendor.update({
                    where: { id: vendor.id },
                    data: { stripeCustomerId }
                });
            }
            const isPlanChange = !!existingSubscription && existingSubscription.planId !== planId;
            // Build session metadata
            const metadata = {
                userId: user.id,
                vendorId: vendor.id,
                planId: plan.id,
                planName: plan.name,
                billingCycle,
                isPlanChange: isPlanChange.toString(),
            };
            // Add previous subscription info for plan changes
            if (isPlanChange && existingSubscription) {
                metadata.previousPlanId = existingSubscription.planId;
                metadata.previousSubscriptionId = existingSubscription.id;
                metadata.previousStripeSubscriptionId = existingSubscription.stripeSubscriptionId;
                metadata.previousBillingCycle = existingSubscription.billingCycle;
            }
            // Build checkout session - ALWAYS require payment
            const session = yield stripe_service_1.stripeService.stripe.checkout.sessions.create({
                customer: stripeCustomerId,
                mode: 'subscription',
                line_items: [{ price: plan.stripePriceId, quantity: 1 }],
                metadata,
                success_url: `${config_1.config.FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${config_1.config.FRONTEND_URL}/pricing`,
                billing_address_collection: 'required',
                allow_promotion_codes: true,
                payment_method_types: ['card'],
                payment_method_collection: 'always',
            });
            return {
                url: session.url,
                sessionId: session.id,
            };
        });
    },
    // ========== GET SESSION STATUS ==========
    getSessionStatus(sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const session = yield stripe_service_1.stripeService.stripe.checkout.sessions.retrieve(sessionId, {
                    expand: ['subscription', 'customer']
                });
                return {
                    id: session.id,
                    status: session.status,
                    paymentStatus: session.payment_status,
                    customerEmail: session.customer_email,
                    customerId: session.customer,
                    amountTotal: session.amount_total ? session.amount_total / 100 : 0,
                    currency: (_a = session.currency) === null || _a === void 0 ? void 0 : _a.toUpperCase(),
                    metadata: session.metadata,
                    subscriptionId: session.subscription,
                    createdAt: new Date(session.created * 1000)
                };
            }
            catch (error) {
                throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, `Invalid session ID: ${error.message}`);
            }
        });
    },
    // ========== CONFIRM PAYMENT ==========
    confirmPayment(sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            console.log("Confirming payment for session:", sessionId);
            const session = yield this.getSessionStatus(sessionId);
            if (session.status !== 'complete' || session.paymentStatus !== 'paid') {
                throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, "Payment not completed yet");
            }
            const { userId, subscriptionId, planId } = session.metadata;
            if (!userId || !subscriptionId || !planId) {
                throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, "Invalid session metadata");
            }
            // Check if user already has an active subscription
            const existingActiveSubscription = yield prisma_1.prisma.subscription.findUnique({
                where: { userId },
                include: {
                    plan: true,
                    PlanLimitData: true,
                }
            });
            // Get the new plan
            const newPlan = yield prisma_1.prisma.plan.findUnique({
                where: { id: planId }
            });
            if (!newPlan) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "Plan not found");
            }
            const subscription = yield prisma_1.prisma.subscription.findUnique({
                where: { id: subscriptionId },
                include: {
                    plan: true,
                    user: { include: { vendorProfile: true } }
                }
            });
            if (!subscription) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "Subscription not found");
            }
            const stripeSubscription = session.subscriptionId
                ? yield stripe_service_1.stripeService.stripe.subscriptions.retrieve(session.subscriptionId)
                : null;
            // Start a transaction to ensure data consistency
            const result = yield prisma_1.prisma.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                var _a, _b, _c;
                // If user has an existing active subscription, handle upgrade/downgrade
                if (existingActiveSubscription &&
                    ['ACTIVE', 'TRIALING', 'PAST_DUE'].includes(existingActiveSubscription.status)) {
                    // Check if this is an upgrade or downgrade
                    const isUpgrade = this.isPlanUpgrade(existingActiveSubscription.plan, newPlan);
                    // Update the existing subscription (change plan)
                    const updatedSubscription = yield tx.subscription.update({
                        where: { id: existingActiveSubscription.id },
                        data: {
                            planId: newPlan.id,
                            status: ((_a = stripeSubscription === null || stripeSubscription === void 0 ? void 0 : stripeSubscription.status) === null || _a === void 0 ? void 0 : _a.toUpperCase()) || 'ACTIVE',
                            stripeSubscriptionId: (stripeSubscription === null || stripeSubscription === void 0 ? void 0 : stripeSubscription.id) || session.subscriptionId,
                            currentPeriodStart: (stripeSubscription === null || stripeSubscription === void 0 ? void 0 : stripeSubscription.current_period_start)
                                ? new Date(stripeSubscription.current_period_start * 1000)
                                : new Date(),
                            currentPeriodEnd: (stripeSubscription === null || stripeSubscription === void 0 ? void 0 : stripeSubscription.current_period_end)
                                ? new Date(stripeSubscription.current_period_end * 1000)
                                : null,
                            // No trial for paid upgrades/downgrades
                            trialStart: null,
                            trialEnd: null,
                            updatedAt: new Date(),
                        },
                        include: {
                            plan: true,
                            PlanLimitData: true,
                        }
                    });
                    // Create a payment record for the plan change
                    yield tx.payment.create({
                        data: {
                            userId,
                            planId: newPlan.id,
                            subscriptionId: updatedSubscription.id,
                            amount: newPlan.price,
                            currency: newPlan.currency,
                            status: 'SUCCEEDED',
                            paymentType: isUpgrade ? 'UPGRADE' : 'DOWNGRADE',
                            stripePaymentId: session.payment_intent,
                            stripeInvoiceId: session.invoice,
                            stripeCustomerId: session.customer,
                            billingEmail: subscription.user.email,
                            paidAt: new Date(),
                            metadata: {
                                sessionId: session.id,
                                previousPlanId: existingActiveSubscription.planId,
                                previousPlanName: existingActiveSubscription.plan.name,
                                newPlanId: newPlan.id,
                                newPlanName: newPlan.name,
                                isUpgrade,
                                changeDate: new Date().toISOString(),
                            },
                        },
                    });
                    // Send upgrade/downgrade email
                    if ((_b = subscription.user.vendorProfile) === null || _b === void 0 ? void 0 : _b.businessEmail) {
                        try {
                            yield mailtrap_service_1.mailtrapService.sendHtmlEmail({
                                to: subscription.user.vendorProfile.businessEmail,
                                subject: isUpgrade
                                    ? `🎉 Your Plan Has Been Upgraded to ${newPlan.name}!`
                                    : `📋 Your Plan Has Been Changed to ${newPlan.name}`,
                                html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #1a5fb4;">${isUpgrade ? 'Plan Upgrade Successful!' : 'Plan Change Confirmed'}</h2>
                <p>${isUpgrade ? 'Congratulations!' : 'Your plan has been successfully changed.'}</p>
                
                <div style="background-color: #f0f8ff; padding: 20px; border-radius: 8px; margin: 25px 0;">
                  <h3>Plan Details</h3>
                  <p><strong>Previous Plan:</strong> ${existingActiveSubscription.plan.name}</p>
                  <p><strong>New Plan:</strong> ${newPlan.name}</p>
                  <p><strong>Price:</strong> ${newPlan.price} ${newPlan.currency}/${updatedSubscription.billingCycle.toLowerCase()}</p>
                  <p><strong>Status:</strong> ${updatedSubscription.status}</p>
                </div>
                
                <div style="background-color: #f9f9f9; padding: 15px; border-radius: 6px; margin: 20px 0;">
                  <h4 style="margin-top: 0;">New Plan Features:</h4>
                  <ul style="margin: 10px 0; padding-left: 20px;">
                    <li><strong>Suppliers:</strong> ${newPlan.supplierLimit === -1 ? 'Unlimited' : newPlan.supplierLimit}</li>
                    <li><strong>Assessments:</strong> ${newPlan.assessmentLimit === -1 ? 'Unlimited' : newPlan.assessmentLimit} per month</li>
                    <li><strong>Users:</strong> ${newPlan.userLimit === -1 ? 'Unlimited' : newPlan.userLimit}</li>
                  </ul>
                </div>
                
                <p>Your new plan is now active. You can continue using the platform with your updated limits.</p>
                
                <div style="text-align: center; margin: 35px 0;">
                  <a href="${config_1.config.FRONTEND_URL}/loginvendor" style="background-color: #1a5fb4; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
                    Go to Dashboard →
                  </a>
                </div>
                
                <p style="color: #666; font-size: 14px;">
                  Questions about your plan? Contact our support team.<br>
                  © ${new Date().getFullYear()} CyberNark. All rights reserved.
                </p>
              </div>
            `
                            });
                        }
                        catch (error) {
                            console.error("Failed to send plan change email:", error);
                        }
                    }
                    // Delete the pending subscription that was created during checkout
                    yield tx.subscription.delete({
                        where: { id: subscriptionId }
                    });
                    return {
                        subscription: updatedSubscription,
                        isPlanChange: true,
                        isUpgrade,
                        previousPlan: existingActiveSubscription.planId,
                        newPlan,
                    };
                }
                else {
                    // New subscription (first-time purchase)
                    const updatedSubscription = yield tx.subscription.update({
                        where: { id: subscriptionId },
                        data: {
                            status: ((_c = stripeSubscription === null || stripeSubscription === void 0 ? void 0 : stripeSubscription.status) === null || _c === void 0 ? void 0 : _c.toUpperCase()) || 'ACTIVE',
                            stripeSubscriptionId: (stripeSubscription === null || stripeSubscription === void 0 ? void 0 : stripeSubscription.id) || session.subscriptionId,
                            currentPeriodStart: (stripeSubscription === null || stripeSubscription === void 0 ? void 0 : stripeSubscription.current_period_start)
                                ? new Date(stripeSubscription.current_period_start * 1000)
                                : new Date(),
                            currentPeriodEnd: (stripeSubscription === null || stripeSubscription === void 0 ? void 0 : stripeSubscription.current_period_end)
                                ? new Date(stripeSubscription.current_period_end * 1000)
                                : null,
                            // No trial for new paid subscriptions
                            trialStart: null,
                            trialEnd: null,
                        },
                        include: {
                            plan: true,
                        }
                    });
                    // Create plan usage record for new subscription
                    const planUsage = yield tx.planLimitData.create({
                        data: {
                            subscriptionId: updatedSubscription.id,
                            suppliersUsed: 0,
                            assessmentsUsed: 0,
                            messagesUsed: 0,
                            documentReviewsUsed: 0,
                            reportCreate: 0,
                            reportsGeneratedUsed: 0,
                            notificationsSend: 0,
                            month: new Date().getMonth(),
                            year: new Date().getFullYear(),
                        },
                    });
                    // Update vendor with Stripe customer ID
                    if (subscription.user.vendorProfile) {
                        yield tx.vendor.update({
                            where: { id: subscription.user.vendorProfile.id },
                            data: {
                                stripeCustomerId: session.customer,
                            },
                        });
                    }
                    return {
                        subscription: updatedSubscription,
                        isPlanChange: false,
                        isUpgrade: false,
                        newPlan,
                        planUsage,
                    };
                }
            }));
            // Send welcome email for new subscriptions only
            if (!result.isPlanChange && ((_a = subscription.user.vendorProfile) === null || _a === void 0 ? void 0 : _a.businessEmail)) {
                try {
                    yield mailtrap_service_1.mailtrapService.sendHtmlEmail({
                        to: subscription.user.vendorProfile.businessEmail,
                        subject: `🎉 Welcome to ${result.newPlan.name} — Your Subscription is Now Active!`,
                        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1a5fb4;">Welcome to CyberNark!</h2>
            <p>Congratulations! Your <strong>${result.newPlan.name}</strong> subscription is now active.</p>
            
            <div style="background-color: #f0f8ff; padding: 20px; border-radius: 8px; margin: 25px 0;">
              <h3>Your Subscription Details</h3>
              <p><strong>Plan:</strong> ${result.newPlan.name}</p>
              <p><strong>Price:</strong> ${result.newPlan.price} ${result.newPlan.currency}/${result.subscription.billingCycle.toLowerCase()}</p>
              ${result.subscription.currentPeriodEnd ? `
                <p><strong>Next Billing Date:</strong> ${result.subscription.currentPeriodEnd.toLocaleDateString()}</p>
              ` : ''}
            </div>
            
            <div style="background-color: #f9f9f9; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <h4 style="margin-top: 0;">Plan Features:</h4>
              <ul style="margin: 10px 0; padding-left: 20px;">
                <li><strong>Suppliers:</strong> ${result.newPlan.supplierLimit === -1 ? 'Unlimited' : result.newPlan.supplierLimit}</li>
                <li><strong>Assessments:</strong> ${result.newPlan.assessmentLimit === -1 ? 'Unlimited' : result.newPlan.assessmentLimit} per month</li>
                <li><strong>Users:</strong> ${result.newPlan.userLimit === -1 ? 'Unlimited' : result.newPlan.userLimit}</li>
              </ul>
            </div>
            
            <p>You now have full access to all features. Explore the platform and see how CyberNark can help secure your supply chain.</p>
            
            <div style="text-align: center; margin: 35px 0;">
              <a href="${config_1.config.FRONTEND_URL}/vendor/analytics" style="background-color: #1a5fb4; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
                Go to Dashboard →
              </a>
            </div>
            
            <p style="color: #666; font-size: 14px;">
              Questions? Contact support anytime.<br>
              © ${new Date().getFullYear()} CyberNark. All rights reserved.
            </p>
          </div>
        `
                    });
                }
                catch (error) {
                    console.error("Failed to send welcome email:", error);
                }
            }
            const responseMessage = result.isPlanChange
                ? result.isUpgrade
                    ? `Plan upgraded to ${result.newPlan.name} successfully!`
                    : `Plan changed to ${result.newPlan.name} successfully!`
                : "Subscription activated successfully!";
            return {
                success: true,
                message: responseMessage,
                data: {
                    subscription: result.subscription,
                    plan: result.newPlan,
                    isPlanChange: result.isPlanChange,
                    isUpgrade: result.isUpgrade,
                    planUsage: result.planUsage,
                }
            };
        });
    },
    // Helper method to determine if it's an upgrade
    isPlanUpgrade(oldPlan, newPlan) {
        // Define plan hierarchy
        const planHierarchy = {
            'FREE': 0,
            'STARTER': 1,
            'BUSINESS': 2,
            'PROFESSIONAL': 3,
            'ENTERPRISE': 4,
            'CUSTOM': 5,
        };
        const oldPlanRank = planHierarchy[oldPlan.type] || 0;
        const newPlanRank = planHierarchy[newPlan.type] || 0;
        // Also consider price for same plan type but different tiers
        if (oldPlan.type === newPlan.type) {
            return parseFloat(newPlan.price.toString()) > parseFloat(oldPlan.price.toString());
        }
        return newPlanRank > oldPlanRank;
    },
    // ========== CREATE PORTAL SESSION ==========
    createPortalSession(userId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, returnUrl = '/dashboard') {
            const user = yield prisma_1.prisma.user.findUnique({
                where: { id: userId },
                include: {
                    vendorProfile: true,
                    subscription: true
                }
            });
            if (!user || !user.vendorProfile) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "User or vendor profile not found");
            }
            if (!user.subscription || !user.subscription.stripeCustomerId) {
                throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, "No active subscription found");
            }
            const session = yield stripe_service_1.stripeService.stripe.billingPortal.sessions.create({
                customer: user.subscription.stripeCustomerId,
                return_url: `${config_1.config.FRONTEND_URL}${returnUrl}`
            });
            return {
                url: session.url
            };
        });
    },
    // ========== GET CURRENT SUBSCRIPTION ==========
    getCurrentSubscription(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const subscription = yield prisma_1.prisma.subscription.findUnique({
                where: { userId },
                include: {
                    plan: true,
                    payments: {
                        where: {
                            status: 'SUCCEEDED'
                        },
                        orderBy: {
                            paidAt: 'desc'
                        },
                        take: 5
                    }
                }
            });
            if (!subscription) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "No subscription found");
            }
            // Get Stripe subscription details if available
            let stripeSubscription = null;
            if (subscription.stripeSubscriptionId) {
                try {
                    stripeSubscription = yield stripe_service_1.stripeService.stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);
                }
                catch (error) {
                    console.error("Failed to fetch Stripe subscription:", error);
                }
            }
            return Object.assign(Object.assign({}, subscription), { stripeSubscription, nextBillingDate: subscription.currentPeriodEnd, daysUntilRenewal: subscription.currentPeriodEnd
                    ? Math.ceil((subscription.currentPeriodEnd.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
                    : null });
        });
    },
    // ========== GET PAYMENT HISTORY ==========
    getPaymentHistory(userId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, options = {}) {
            const page = options.page || 1;
            const limit = options.limit || 10;
            const skip = (page - 1) * limit;
            const where = { userId };
            const [payments, total] = yield Promise.all([
                prisma_1.prisma.payment.findMany({
                    where,
                    include: {
                        plan: {
                            select: {
                                name: true
                            }
                        }
                    },
                    orderBy: {
                        createdAt: 'desc'
                    },
                    skip,
                    take: limit
                }),
                prisma_1.prisma.payment.count({ where })
            ]);
            const formattedPayments = payments.map(payment => {
                var _a;
                return ({
                    id: payment.id,
                    amount: payment.amount.toNumber(),
                    currency: payment.currency,
                    status: payment.status,
                    paymentType: payment.paymentType,
                    paidAt: payment.paidAt,
                    createdAt: payment.createdAt,
                    planName: ((_a = payment.plan) === null || _a === void 0 ? void 0 : _a.name) || null
                });
            });
            return {
                payments: formattedPayments,
                meta: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            };
        });
    },
    // ========== CANCEL SUBSCRIPTION ==========
    cancelSubscription(userId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, cancelAtPeriodEnd = true) {
            var _a;
            const subscription = yield prisma_1.prisma.subscription.findUnique({
                where: { userId },
                include: {
                    plan: true
                }
            });
            if (!subscription) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "No subscription found");
            }
            if (subscription.status === 'CANCELED') {
                throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, "Subscription is already canceled");
            }
            // Cancel in Stripe if subscription exists there
            if (subscription.stripeSubscriptionId) {
                try {
                    yield stripe_service_1.stripeService.stripe.subscriptions.update(subscription.stripeSubscriptionId, {
                        cancel_at_period_end: cancelAtPeriodEnd
                    });
                }
                catch (error) {
                    console.error("Failed to cancel Stripe subscription:", error);
                    // Continue with local cancellation even if Stripe fails
                }
            }
            // Update local subscription
            const updatedSubscription = yield prisma_1.prisma.subscription.update({
                where: { id: subscription.id },
                data: {
                    status: cancelAtPeriodEnd ? subscription.status : 'CANCELED',
                    cancelAtPeriodEnd,
                    cancelledAt: cancelAtPeriodEnd ? null : new Date(),
                    cancellationReason: cancelAtPeriodEnd ? 'Cancelled at period end' : 'Immediate cancellation',
                    updatedAt: new Date()
                }
            });
            const message = cancelAtPeriodEnd
                ? "Your subscription will be cancelled at the end of the current billing period."
                : "Your subscription has been cancelled immediately.";
            // Send cancellation email
            const user = yield prisma_1.prisma.user.findUnique({
                where: { id: userId },
                include: { vendorProfile: true }
            });
            if ((_a = user === null || user === void 0 ? void 0 : user.vendorProfile) === null || _a === void 0 ? void 0 : _a.businessEmail) {
                try {
                    yield mailtrap_service_1.mailtrapService.sendHtmlEmail({
                        to: user.vendorProfile.businessEmail,
                        subject: `Subscription ${cancelAtPeriodEnd ? 'Scheduled for Cancellation' : 'Cancelled'}`,
                        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">Subscription ${cancelAtPeriodEnd ? 'Scheduled for Cancellation' : 'Cancelled'}</h2>
              <p>${message}</p>
              
              <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
                <h3 style="margin-top: 0;">Subscription Details</h3>
                <p><strong>Plan:</strong> ${subscription.plan.name}</p>
                <p><strong>Status:</strong> ${cancelAtPeriodEnd ? 'Active until period end' : 'Cancelled'}</p>
                ${subscription.currentPeriodEnd ? `
                  <p><strong>Current Period Ends:</strong> ${subscription.currentPeriodEnd.toLocaleDateString()}</p>
                ` : ''}
              </div>
              
              <p>You can reactivate your subscription at any time from your dashboard.</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${config_1.config.FRONTEND_URL}/pricing" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                  Manage Subscription
                </a>
              </div>
              
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
              <p style="color: #666; font-size: 12px;">© ${new Date().getFullYear()} CyberNark. All rights reserved.</p>
            </div>
          `
                    });
                }
                catch (error) {
                    console.error("Failed to send cancellation email:", error);
                }
            }
            return {
                success: true,
                message,
                data: {
                    subscription: updatedSubscription,
                    cancelAtPeriodEnd,
                    cancellationDate: updatedSubscription.cancelledAt
                }
            };
        });
    },
    startFreeTrial(userId_1, planId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, planId, trialDays = 14) {
            var _a, _b, _c, _d, _e, _f, _g, _h;
            const user = yield prisma_1.prisma.user.findUnique({
                where: { id: userId },
                include: { vendorProfile: true }
            });
            if (!user || user.role !== "VENDOR") {
                throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, "Only vendors can start free trials");
            }
            const plan = yield prisma_1.prisma.plan.findUnique({
                where: { id: planId }
            });
            if (!plan) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "Plan not found");
            }
            // Check if user already has a subscription
            const existingSubscription = yield prisma_1.prisma.subscription.findUnique({
                where: { userId }
            });
            const trialStart = new Date();
            const trialEnd = new Date();
            trialEnd.setDate(trialEnd.getDate() + trialDays);
            let subscription;
            if (existingSubscription) {
                // Update existing subscription with trial
                subscription = yield prisma_1.prisma.subscription.update({
                    where: { id: existingSubscription.id },
                    data: {
                        planId: plan.id,
                        status: 'TRIALING',
                        trialStart,
                        trialEnd,
                        currentPeriodStart: trialStart,
                        currentPeriodEnd: trialEnd,
                    },
                    include: {
                        plan: true
                    }
                });
            }
            else {
                // Create new subscription with trial
                subscription = yield prisma_1.prisma.subscription.create({
                    data: {
                        userId,
                        planId: plan.id,
                        status: 'TRIALING',
                        trialStart,
                        trialEnd,
                        currentPeriodStart: trialStart,
                        currentPeriodEnd: trialEnd,
                    },
                    include: {
                        plan: true
                    }
                });
                // Create plan usage record for trial
                const features = (0, getFeatures_1.getPlanFeatures)(plan);
                console.log("Free Plan features", features);
                const isEnterprisePlan = plan.type === "ENTERPRISE";
                yield prisma_1.prisma.planLimitData.create({
                    data: {
                        subscriptionId: subscription.id,
                        suppliersUsed: isEnterprisePlan ? null : ((_a = features.supplierLimit) !== null && _a !== void 0 ? _a : 0),
                        assessmentsUsed: isEnterprisePlan ? null : ((_b = features.assessmentLimit) !== null && _b !== void 0 ? _b : 0),
                        messagesUsed: isEnterprisePlan ? null : ((_c = features.messagesPerMonth) !== null && _c !== void 0 ? _c : 0),
                        documentReviewsUsed: isEnterprisePlan ? null : ((_d = features.documentReviewsPerMonth) !== null && _d !== void 0 ? _d : 0),
                        reportCreate: isEnterprisePlan ? null : ((_e = features.reportCreate) !== null && _e !== void 0 ? _e : 0),
                        reportsGeneratedUsed: isEnterprisePlan ? null : ((_f = features.reportsGeneratedPerMonth) !== null && _f !== void 0 ? _f : 0),
                        notificationsSend: isEnterprisePlan ? null : ((_g = features.notificationsSend) !== null && _g !== void 0 ? _g : 0),
                        month: new Date().getMonth() + 1,
                        year: new Date().getFullYear(),
                    },
                });
            }
            // Send trial started email
            if ((_h = user.vendorProfile) === null || _h === void 0 ? void 0 : _h.businessEmail) {
                try {
                    yield mailtrap_service_1.mailtrapService.sendHtmlEmail({
                        to: user.vendorProfile.businessEmail,
                        subject: `🎉 Your Free Trial Has Started!`,
                        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1a5fb4;">Welcome to Your Free Trial!</h2>
            <p>Your free trial for <strong>${plan.name}</strong> has been activated.</p>
            
            <div style="background-color: #f0f8ff; padding: 20px; border-radius: 8px; margin: 25px 0;">
              <h3>Trial Details</h3>
              <p><strong>Plan:</strong> ${plan.name}</p>
              <p><strong>Trial Start:</strong> ${trialStart.toLocaleDateString()}</p>
              <p><strong>Trial End:</strong> ${trialEnd.toLocaleDateString()}</p>
              <p><strong>Trial Duration:</strong> ${trialDays} days</p>
              <p><strong>Status:</strong> Active Trial</p>
            </div>
            
            <p>You now have full access to all features of the ${plan.name} plan. Explore the platform and see how CyberNark can help secure your supply chain.</p>
            
            <div style="background-color: #f9f9f9; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <h4 style="margin-top: 0;">Trial Features:</h4>
              <ul style="margin: 10px 0; padding-left: 20px;">
                <li><strong>Suppliers:</strong> ${plan.supplierLimit === -1 ? 'Unlimited' : (plan.supplierLimit || 'Unlimited')}</li>
                <li><strong>Assessments:</strong> ${plan.assessmentLimit === -1 ? 'Unlimited' : (plan.assessmentLimit || 'Unlimited')} per month</li>
                <li><strong>Users:</strong> ${plan.userLimit === -1 ? 'Unlimited' : (plan.userLimit || 'Unlimited')}</li>
              </ul>
            </div>
            
            <p>After your trial ends, you'll need to choose a subscription plan to continue using the platform.</p>
            
            <div style="text-align: center; margin: 35px 0;">
              <a href="${config_1.config.FRONTEND_URL}/loginvendor" style="background-color: #1a5fb4; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
                Start Exploring →
              </a>
            </div>
            
            <p style="color: #666; font-size: 14px;">
              Questions? Contact support anytime.<br>
              © ${new Date().getFullYear()} CyberNark. All rights reserved.
            </p>
          </div>
        `
                    });
                }
                catch (error) {
                    console.error("Failed to send trial started email:", error);
                }
            }
            return subscription;
        });
    },
    // ========== WEBHOOK HANDLERS ==========
    handleCheckoutSessionCompleted(session) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5;
            const metadata = session.metadata || {};
            const { userId, vendorId, planId: newPlanId, subscriptionId, isPlanChange, previousPlanId, billingCycle, previousStripeSubscriptionId, } = metadata;
            if (!userId || !vendorId || !newPlanId) {
                console.error("Missing required metadata");
                return;
            }
            const stripeSubscription = session.subscription
                ? yield stripe_service_1.stripeService.stripe.subscriptions.retrieve(session.subscription)
                : null;
            const isPlanChangeFlag = isPlanChange === "true";
            try {
                let finalSubscription;
                // ==================================================
                // PLAN CHANGE (UPGRADE / DOWNGRADE)
                // ==================================================
                if (isPlanChangeFlag) {
                    const existingSubscription = yield prisma_1.prisma.subscription.findUnique({
                        where: { userId },
                        include: { plan: true },
                    });
                    if (!existingSubscription) {
                        console.error("Existing subscription not found");
                        return;
                    }
                    const newPlan = yield prisma_1.prisma.plan.findUnique({
                        where: { id: newPlanId },
                    });
                    if (!newPlan) {
                        console.error("New plan not found");
                        return;
                    }
                    // Cancel previous Stripe subscription safely
                    if (previousStripeSubscriptionId &&
                        previousStripeSubscriptionId !== (stripeSubscription === null || stripeSubscription === void 0 ? void 0 : stripeSubscription.id)) {
                        try {
                            yield stripe_service_1.stripeService.stripe.subscriptions.cancel(previousStripeSubscriptionId, { prorate: true });
                        }
                        catch (err) {
                            console.error("Failed to cancel old Stripe subscription", err);
                        }
                    }
                    // Update subscription
                    finalSubscription = yield prisma_1.prisma.subscription.update({
                        where: { id: existingSubscription.id },
                        data: {
                            planId: newPlanId,
                            status: ((_a = stripeSubscription === null || stripeSubscription === void 0 ? void 0 : stripeSubscription.status) === null || _a === void 0 ? void 0 : _a.toUpperCase()) ||
                                "ACTIVE",
                            stripeSubscriptionId: (stripeSubscription === null || stripeSubscription === void 0 ? void 0 : stripeSubscription.id) || session.subscription,
                            stripeCustomerId: session.customer,
                            currentPeriodStart: (stripeSubscription === null || stripeSubscription === void 0 ? void 0 : stripeSubscription.current_period_start)
                                ? new Date(stripeSubscription.current_period_start * 1000)
                                : new Date(),
                            currentPeriodEnd: (stripeSubscription === null || stripeSubscription === void 0 ? void 0 : stripeSubscription.current_period_end)
                                ? new Date(stripeSubscription.current_period_end * 1000)
                                : null,
                            trialStart: null,
                            trialEnd: null,
                            billingCycle: billingCycle || existingSubscription.billingCycle,
                        },
                    });
                    // ===================== LIMIT HANDLING =====================
                    const features = (0, getFeatures_1.getPlanFeatures)(newPlan);
                    const isEnterprisePlan = newPlan.type === "ENTERPRISE";
                    const now = new Date();
                    const existingUsage = yield prisma_1.prisma.planLimitData.findUnique({
                        where: { subscriptionId: finalSubscription.id },
                    });
                    if (existingUsage) {
                        yield prisma_1.prisma.planLimitData.update({
                            where: { subscriptionId: finalSubscription.id },
                            data: isEnterprisePlan
                                ? {
                                    suppliersUsed: null,
                                    assessmentsUsed: null,
                                    messagesUsed: null,
                                    documentReviewsUsed: null,
                                    reportCreate: null,
                                    reportsGeneratedUsed: null,
                                    notificationsSend: null,
                                    month: now.getMonth() + 1,
                                    year: now.getFullYear(),
                                }
                                : {
                                    suppliersUsed: ((_b = existingUsage.suppliersUsed) !== null && _b !== void 0 ? _b : 0) +
                                        ((_c = features.supplierLimit) !== null && _c !== void 0 ? _c : 0),
                                    assessmentsUsed: ((_d = existingUsage.assessmentsUsed) !== null && _d !== void 0 ? _d : 0) +
                                        ((_e = features.assessmentLimit) !== null && _e !== void 0 ? _e : 0),
                                    messagesUsed: ((_f = existingUsage.messagesUsed) !== null && _f !== void 0 ? _f : 0) +
                                        ((_g = features.messagesPerMonth) !== null && _g !== void 0 ? _g : 0),
                                    documentReviewsUsed: ((_h = existingUsage.documentReviewsUsed) !== null && _h !== void 0 ? _h : 0) +
                                        ((_j = features.documentReviewsPerMonth) !== null && _j !== void 0 ? _j : 0),
                                    reportCreate: ((_k = existingUsage.reportCreate) !== null && _k !== void 0 ? _k : 0) +
                                        ((_l = features.reportCreate) !== null && _l !== void 0 ? _l : 0),
                                    reportsGeneratedUsed: ((_m = existingUsage.reportsGeneratedUsed) !== null && _m !== void 0 ? _m : 0) +
                                        ((_o = features.reportsGeneratedPerMonth) !== null && _o !== void 0 ? _o : 0),
                                    notificationsSend: ((_p = existingUsage.notificationsSend) !== null && _p !== void 0 ? _p : 0) +
                                        ((_q = features.notificationsSend) !== null && _q !== void 0 ? _q : 0),
                                    month: now.getMonth() + 1,
                                    year: now.getFullYear(),
                                },
                        });
                    }
                    else {
                        yield prisma_1.prisma.planLimitData.create({
                            data: isEnterprisePlan
                                ? {
                                    subscriptionId: finalSubscription.id,
                                    suppliersUsed: null,
                                    assessmentsUsed: null,
                                    messagesUsed: null,
                                    documentReviewsUsed: null,
                                    reportCreate: null,
                                    reportsGeneratedUsed: null,
                                    notificationsSend: null,
                                    month: now.getMonth() + 1,
                                    year: now.getFullYear(),
                                }
                                : {
                                    subscriptionId: finalSubscription.id,
                                    suppliersUsed: (_r = features.supplierLimit) !== null && _r !== void 0 ? _r : 0,
                                    assessmentsUsed: (_s = features.assessmentLimit) !== null && _s !== void 0 ? _s : 0,
                                    messagesUsed: (_t = features.messagesPerMonth) !== null && _t !== void 0 ? _t : 0,
                                    documentReviewsUsed: (_u = features.documentReviewsPerMonth) !== null && _u !== void 0 ? _u : 0,
                                    reportCreate: (_v = features.reportCreate) !== null && _v !== void 0 ? _v : 0,
                                    reportsGeneratedUsed: (_w = features.reportsGeneratedPerMonth) !== null && _w !== void 0 ? _w : 0,
                                    notificationsSend: (_x = features.notificationsSend) !== null && _x !== void 0 ? _x : 0,
                                    month: now.getMonth() + 1,
                                    year: now.getFullYear(),
                                },
                        });
                    }
                    // Save plan change history
                    yield prisma_1.prisma.planChangeHistory.create({
                        data: {
                            subscriptionId: finalSubscription.id,
                            previousPlanId: previousPlanId || existingSubscription.planId,
                            newPlanId,
                            changedAt: new Date(),
                            changedBy: userId,
                            reason: this.isPlanUpgrade(existingSubscription.plan, newPlan)
                                ? "upgrade"
                                : "downgrade",
                            stripeSessionId: session.id,
                        },
                    });
                    console.log("Plan changed successfully with cumulative limits");
                }
                // ==================================================
                // FIRST-TIME SUBSCRIPTION
                // ==================================================
                else {
                    finalSubscription = yield prisma_1.prisma.subscription.update({
                        where: { id: subscriptionId },
                        data: {
                            status: ((_y = stripeSubscription === null || stripeSubscription === void 0 ? void 0 : stripeSubscription.status) === null || _y === void 0 ? void 0 : _y.toUpperCase()) ||
                                "ACTIVE",
                            stripeSubscriptionId: (stripeSubscription === null || stripeSubscription === void 0 ? void 0 : stripeSubscription.id) || session.subscription,
                            stripeCustomerId: session.customer,
                            currentPeriodStart: (stripeSubscription === null || stripeSubscription === void 0 ? void 0 : stripeSubscription.current_period_start)
                                ? new Date(stripeSubscription.current_period_start * 1000)
                                : new Date(),
                            currentPeriodEnd: (stripeSubscription === null || stripeSubscription === void 0 ? void 0 : stripeSubscription.current_period_end)
                                ? new Date(stripeSubscription.current_period_end * 1000)
                                : null,
                            trialStart: null,
                            trialEnd: null,
                        },
                    });
                    const newPlan = yield prisma_1.prisma.plan.findUnique({
                        where: { id: newPlanId },
                    });
                    if (!newPlan)
                        throw new Error("Plan not found");
                    const features = (0, getFeatures_1.getPlanFeatures)(newPlan);
                    const isEnterprisePlan = newPlan.type === "ENTERPRISE";
                    yield prisma_1.prisma.planLimitData.create({
                        data: isEnterprisePlan
                            ? {
                                subscriptionId: finalSubscription.id,
                                suppliersUsed: null,
                                assessmentsUsed: null,
                                messagesUsed: null,
                                documentReviewsUsed: null,
                                reportCreate: null,
                                reportsGeneratedUsed: null,
                                notificationsSend: null,
                                month: new Date().getMonth() + 1,
                                year: new Date().getFullYear(),
                            }
                            : {
                                subscriptionId: finalSubscription.id,
                                suppliersUsed: (_z = features.supplierLimit) !== null && _z !== void 0 ? _z : 0,
                                assessmentsUsed: (_0 = features.assessmentLimit) !== null && _0 !== void 0 ? _0 : 0,
                                messagesUsed: (_1 = features.messagesPerMonth) !== null && _1 !== void 0 ? _1 : 0,
                                documentReviewsUsed: (_2 = features.documentReviewsPerMonth) !== null && _2 !== void 0 ? _2 : 0,
                                reportCreate: (_3 = features.reportCreate) !== null && _3 !== void 0 ? _3 : 0,
                                reportsGeneratedUsed: (_4 = features.reportsGeneratedPerMonth) !== null && _4 !== void 0 ? _4 : 0,
                                notificationsSend: (_5 = features.notificationsSend) !== null && _5 !== void 0 ? _5 : 0,
                                month: new Date().getMonth() + 1,
                                year: new Date().getFullYear(),
                            },
                    });
                    console.log("First subscription created & limits initialized");
                }
                // ==================================================
                // UPDATE VENDOR STRIPE CUSTOMER
                // ==================================================
                yield prisma_1.prisma.vendor.update({
                    where: { id: vendorId },
                    data: { stripeCustomerId: session.customer },
                });
                console.log(`Subscription ${finalSubscription.id} processed successfully`);
            }
            catch (error) {
                console.error("Error processing checkout.session.completed:", error);
            }
        });
    },
    // Only create payment when real money is charged
    handleInvoicePaymentSucceeded(invoice) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            console.log("Processing invoice.payment_succeeded webhook", invoice);
            const subscription = yield prisma_1.prisma.subscription.findFirst({
                where: { stripeSubscriptionId: invoice.subscription },
                include: { plan: true, user: true }
            });
            if (!subscription) {
                console.error(`Subscription not found for invoice ${invoice.id}`);
                return;
            }
            // Prevent duplicates
            const existingPayment = yield prisma_1.prisma.payment.findFirst({
                where: { stripeInvoiceId: invoice.id }
            });
            if (existingPayment) {
                console.log(`Payment already recorded for invoice ${invoice.id}`);
                return;
            }
            yield prisma_1.prisma.payment.create({
                data: {
                    userId: subscription.userId,
                    planId: subscription.planId,
                    subscriptionId: subscription.id,
                    amount: subscription.plan.price,
                    currency: subscription.plan.currency,
                    status: 'SUCCEEDED',
                    paymentType: 'SUBSCRIPTION',
                    stripePaymentId: invoice.payment_intent,
                    stripeInvoiceId: invoice.id,
                    stripeCustomerId: invoice.customer,
                    billingEmail: invoice.customer_email || subscription.user.email,
                    receiptUrl: invoice.invoice_pdf || invoice.hosted_invoice_url || null,
                    paidAt: new Date(invoice.status_transitions.paid_at * 1000),
                    metadata: {
                        invoiceId: invoice.id,
                        invoiceNumber: invoice.number,
                        billingReason: invoice.billing_reason,
                        periodStart: ((_a = invoice.lines.data[0]) === null || _a === void 0 ? void 0 : _a.period.start)
                            ? new Date(invoice.lines.data[0].period.start * 1000)
                            : null,
                        periodEnd: ((_b = invoice.lines.data[0]) === null || _b === void 0 ? void 0 : _b.period.end)
                            ? new Date(invoice.lines.data[0].period.end * 1000)
                            : null,
                    },
                },
            });
            console.log(`Payment recorded: ${invoice.amount_paid / 100} ${invoice.currency.toUpperCase()}`);
        });
    },
    handleSubscriptionUpdated(subscription) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log("🔄 Processing customer.subscription.updated webhook");
            const dbSubscription = yield prisma_1.prisma.subscription.findFirst({
                where: {
                    OR: [
                        { stripeSubscriptionId: subscription.id },
                        { stripeCustomerId: subscription.customer }
                    ]
                }
            });
            if (!dbSubscription) {
                console.error(`❌ Subscription not found for Stripe subscription ${subscription.id}`);
                return;
            }
            yield prisma_1.prisma.subscription.update({
                where: { id: dbSubscription.id },
                data: {
                    status: subscription.status.toUpperCase(),
                    currentPeriodStart: new Date(subscription.current_period_start * 1000),
                    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
                    cancelAtPeriodEnd: subscription.cancel_at_period_end,
                    // No trial for paid subscriptions
                    trialStart: null,
                    trialEnd: null,
                    updatedAt: new Date()
                }
            });
            console.log(`✅ Updated subscription ${dbSubscription.id} status to ${subscription.status}`);
        });
    },
    handleSubscriptionDeleted(subscription) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log("🔄 Processing customer.subscription.deleted webhook");
            const dbSubscription = yield prisma_1.prisma.subscription.findFirst({
                where: { stripeSubscriptionId: subscription.id }
            });
            if (!dbSubscription) {
                console.error(`❌ Subscription not found for Stripe subscription ${subscription.id}`);
                return;
            }
            yield prisma_1.prisma.subscription.update({
                where: { id: dbSubscription.id },
                data: {
                    status: 'CANCELED',
                    cancelledAt: new Date(),
                    cancellationReason: 'Cancelled from Stripe',
                    updatedAt: new Date()
                }
            });
            console.log(`✅ Marked subscription ${dbSubscription.id} as cancelled`);
        });
    },
    handleInvoicePaymentFailed(invoice) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            console.log("🔄 Processing invoice.payment_failed webhook");
            const subscription = yield prisma_1.prisma.subscription.findFirst({
                where: { stripeSubscriptionId: invoice.subscription },
                include: { plan: true }
            });
            if (!subscription) {
                console.error(`❌ Subscription not found for invoice ${invoice.id}`);
                return;
            }
            // 🚫 DO NOT mark FREE / TRIAL subscriptions as PAST_DUE
            if (subscription.status === 'TRIALING' ||
                subscription.plan.type === 'FREE') {
                console.log("⚠️ Trial or Free plan — skipping PAST_DUE update");
                return;
            }
            // ✅ Only PAID plans go to PAST_DUE
            yield prisma_1.prisma.subscription.update({
                where: { id: subscription.id },
                data: {
                    status: 'PAST_DUE',
                    updatedAt: new Date()
                }
            });
            yield prisma_1.prisma.payment.create({
                data: {
                    userId: subscription.userId,
                    planId: subscription.planId,
                    subscriptionId: subscription.id,
                    amount: invoice.amount_due / 100,
                    currency: invoice.currency.toUpperCase(),
                    status: 'FAILED',
                    paymentType: 'SUBSCRIPTION',
                    stripeInvoiceId: invoice.id,
                    stripeCustomerId: invoice.customer,
                    metadata: {
                        invoiceId: invoice.id,
                        failureMessage: (_a = invoice.last_finalization_error) === null || _a === void 0 ? void 0 : _a.message,
                        failureCode: (_b = invoice.last_finalization_error) === null || _b === void 0 ? void 0 : _b.code
                    }
                }
            });
            console.log(`✅ Marked subscription ${subscription.id} as past due`);
        });
    }
};
