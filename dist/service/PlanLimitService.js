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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlanLimitService = void 0;
// src/services/PlanLimitService.ts
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
class PlanLimitService {
    // Get current usage for a vendor
    static getCurrentUsage(vendorId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const vendor = yield prisma.vendor.findUnique({
                where: { id: vendorId },
                include: {
                    user: {
                        include: {
                            subscription: {
                                include: {
                                    plan: true,
                                    PlanLimitData: true,
                                },
                            },
                        },
                    },
                },
            });
            if (!vendor || !((_a = vendor.user) === null || _a === void 0 ? void 0 : _a.subscription)) {
                throw new Error('Vendor or subscription not found');
            }
            const subscription = vendor.user.subscription;
            const plan = subscription.plan;
            const usage = subscription.PlanLimitData;
            const currentMonth = new Date().getMonth() + 1;
            const currentYear = new Date().getFullYear();
            // Check if usage needs reset (new month)
            if (!usage ||
                usage.month !== currentMonth ||
                usage.year !== currentYear) {
                // Reset usage for new month
                const features = this.getPlanFeatures(plan);
                const resetUsage = yield prisma.planLimitData.upsert({
                    where: { subscriptionId: subscription.id },
                    update: {
                        suppliersUsed: 0,
                        assessmentsUsed: 0,
                        messagesUsed: 0,
                        documentReviewsUsed: 0,
                        reportCreate: 0,
                        reportsGeneratedUsed: 0,
                        notificationsSend: 0,
                        test: 0,
                        month: currentMonth,
                        year: currentYear,
                    },
                    create: {
                        subscriptionId: subscription.id,
                        suppliersUsed: 0,
                        assessmentsUsed: 0,
                        messagesUsed: 0,
                        documentReviewsUsed: 0,
                        reportCreate: 0,
                        reportsGeneratedUsed: 0,
                        notificationsSend: 0,
                        test: 0,
                        month: currentMonth,
                        year: currentYear,
                    },
                });
                return {
                    plan: plan,
                    usage: resetUsage,
                    limits: features,
                    subscription: subscription,
                };
            }
            const features = this.getPlanFeatures(plan);
            return {
                plan: plan,
                usage: usage,
                limits: features,
                subscription: subscription,
            };
        });
    }
    // Check and increment usage
    static checkAndIncrementUsage(vendorId_1, limitType_1) {
        return __awaiter(this, arguments, void 0, function* (vendorId, limitType, incrementBy = 1) {
            var _a, _b;
            const current = yield this.getCurrentUsage(vendorId);
            const usage = current.usage;
            const limits = current.limits;
            const limitKeyMap = {
                messagesPerMonth: 'messagesUsed',
                documentReviewsPerMonth: 'documentReviewsUsed',
                reportCreate: 'reportCreate',
                reportsGeneratedPerMonth: 'reportsGeneratedUsed',
                notificationsSend: 'notificationsSend',
            };
            const usageField = limitKeyMap[limitType];
            const currentUsed = (_a = usage[usageField]) !== null && _a !== void 0 ? _a : 0; // Handle null case
            const planLimit = (_b = limits[limitType]) !== null && _b !== void 0 ? _b : 0; // Handle null case
            // Unlimited (null) always allowed
            if (planLimit === null) {
                return { allowed: true, remaining: -1 };
            }
            // Check if limit is exceeded
            if (planLimit !== -1 && currentUsed + incrementBy > planLimit) {
                return {
                    allowed: false,
                    remaining: Math.max(0, planLimit - currentUsed),
                    message: `${limitType} limit exceeded. Available: ${Math.max(0, planLimit - currentUsed)}, Requested: ${incrementBy}`
                };
            }
            // Increment usage if not unlimited
            if (planLimit !== -1) {
                yield prisma.planLimitData.update({
                    where: { id: usage.id },
                    data: {
                        [usageField]: currentUsed + incrementBy,
                    },
                });
            }
            return {
                allowed: true,
                remaining: planLimit === -1 ? -1 : planLimit - (currentUsed + incrementBy),
            };
        });
    }
    // Check supplier creation
    static checkSupplierCreation(vendorId_1) {
        return __awaiter(this, arguments, void 0, function* (vendorId, count = 1) {
            var _a;
            const current = yield this.getCurrentUsage(vendorId);
            const plan = current.plan;
            // Get total suppliers count for this vendor
            const totalSuppliers = yield prisma.supplier.count({
                where: {
                    vendorId: vendorId,
                    isDeleted: false,
                },
            });
            const currentUsed = totalSuppliers;
            const planLimit = (_a = plan.supplierLimit) !== null && _a !== void 0 ? _a : 0; // Handle null case
            // Unlimited (null) always allowed
            if (planLimit === null) {
                return { allowed: true, remaining: -1 };
            }
            // Check if limit is exceeded
            if (planLimit !== -1 && currentUsed + count > planLimit) {
                return {
                    allowed: false,
                    remaining: Math.max(0, planLimit - currentUsed),
                    message: `Supplier limit exceeded. Available: ${Math.max(0, planLimit - currentUsed)}, Requested: ${count}`
                };
            }
            return {
                allowed: true,
                remaining: planLimit === -1 ? -1 : planLimit - (currentUsed + count),
            };
        });
    }
    // Check assessment limit
    static checkAssessmentLimit(vendorId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const current = yield this.getCurrentUsage(vendorId);
            const usage = current.usage;
            const plan = current.plan;
            const currentUsed = (_a = usage.assessmentsUsed) !== null && _a !== void 0 ? _a : 0; // Handle null case
            const planLimit = (_b = plan.assessmentLimit) !== null && _b !== void 0 ? _b : 0; // Handle null case
            // Unlimited (null) always allowed
            if (planLimit === null) {
                return { allowed: true, remaining: -1 };
            }
            // Check if limit is exceeded
            if (planLimit !== -1 && currentUsed + 1 > planLimit) {
                return {
                    allowed: false,
                    remaining: Math.max(0, planLimit - currentUsed),
                    message: `Assessment limit exceeded. Available: ${Math.max(0, planLimit - currentUsed)}`
                };
            }
            // Increment usage if not unlimited
            if (planLimit !== -1) {
                yield prisma.planLimitData.update({
                    where: { id: usage.id },
                    data: {
                        assessmentsUsed: currentUsed + 1,
                    },
                });
            }
            return {
                allowed: true,
                remaining: planLimit === -1 ? -1 : planLimit - (currentUsed + 1),
            };
        });
    }
    // Get remaining limits for all features
    static getRemainingLimits(vendorId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f;
            const current = yield this.getCurrentUsage(vendorId);
            const usage = current.usage;
            const limits = current.limits;
            const plan = current.plan;
            // Get supplier count
            const totalSuppliers = yield prisma.supplier.count({
                where: {
                    vendorId: vendorId,
                    isDeleted: false,
                },
            });
            const result = {};
            // Supplier limit
            const supplierLimit = plan.supplierLimit;
            result.suppliers = {
                used: totalSuppliers,
                limit: supplierLimit,
                remaining: supplierLimit === null ? null : (supplierLimit === -1 ? -1 : Math.max(0, supplierLimit - totalSuppliers)),
                isUnlimited: supplierLimit === null || supplierLimit === -1,
            };
            // Assessment limit
            const assessmentLimit = plan.assessmentLimit;
            const assessmentsUsed = (_a = usage.assessmentsUsed) !== null && _a !== void 0 ? _a : 0;
            result.assessments = {
                used: assessmentsUsed,
                limit: assessmentLimit,
                remaining: assessmentLimit === null ? null : (assessmentLimit === -1 ? -1 : Math.max(0, assessmentLimit - assessmentsUsed)),
                isUnlimited: assessmentLimit === null || assessmentLimit === -1,
            };
            // Other limits
            const otherLimits = {
                messagesPerMonth: { used: (_b = usage.messagesUsed) !== null && _b !== void 0 ? _b : 0, limit: limits.messagesPerMonth },
                documentReviewsPerMonth: { used: (_c = usage.documentReviewsUsed) !== null && _c !== void 0 ? _c : 0, limit: limits.documentReviewsPerMonth },
                reportCreate: { used: (_d = usage.reportCreate) !== null && _d !== void 0 ? _d : 0, limit: limits.reportCreate },
                reportsGeneratedPerMonth: { used: (_e = usage.reportsGeneratedUsed) !== null && _e !== void 0 ? _e : 0, limit: limits.reportsGeneratedPerMonth },
                notificationsSend: { used: (_f = usage.notificationsSend) !== null && _f !== void 0 ? _f : 0, limit: limits.notificationsSend },
            };
            Object.entries(otherLimits).forEach(([key, { used, limit }]) => {
                result[key] = {
                    used,
                    limit,
                    remaining: limit === null ? null : (limit === -1 ? -1 : Math.max(0, limit - used)),
                    isUnlimited: limit === null || limit === -1,
                };
            });
            return result;
        });
    }
    // Check subscription status
    static checkSubscriptionStatus(vendorId) {
        return __awaiter(this, void 0, void 0, function* () {
            const current = yield this.getCurrentUsage(vendorId);
            const subscription = current.subscription;
            if (!subscription) {
                return {
                    isActive: false,
                    message: 'No subscription found',
                    subscription: null,
                };
            }
            // Check subscription status
            const validStatuses = ['ACTIVE', 'TRIALING'];
            if (!validStatuses.includes(subscription.status)) {
                return {
                    isActive: false,
                    message: `Subscription is ${subscription.status.toLowerCase()}`,
                    subscription,
                };
            }
            // Check if subscription period has ended
            if (subscription.currentPeriodEnd && subscription.currentPeriodEnd < new Date()) {
                return {
                    isActive: false,
                    message: 'Subscription has expired',
                    subscription,
                };
            }
            return {
                isActive: true,
                subscription,
            };
        });
    }
    // Helper function to extract features from plan
    static getPlanFeatures(plan) {
        var _a, _b, _c, _d, _e;
        const features = typeof plan.features === 'string'
            ? JSON.parse(plan.features)
            : plan.features || {};
        return {
            supplierLimit: plan.supplierLimit,
            assessmentLimit: plan.assessmentLimit,
            messagesPerMonth: (_a = features.messagesPerMonth) !== null && _a !== void 0 ? _a : null,
            documentReviewsPerMonth: (_b = features.documentReviewsPerMonth) !== null && _b !== void 0 ? _b : null,
            reportCreate: (_c = features.reportCreate) !== null && _c !== void 0 ? _c : null,
            reportsGeneratedPerMonth: (_d = features.reportsGeneratedPerMonth) !== null && _d !== void 0 ? _d : null,
            notificationsSend: (_e = features.notificationsSend) !== null && _e !== void 0 ? _e : null,
        };
    }
    // Middleware for route protection
    static createLimitMiddleware(limitType, incrementBy = 1) {
        return (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            try {
                const vendorId = (_b = (_a = req.user) === null || _a === void 0 ? void 0 : _a.vendorProfile) === null || _b === void 0 ? void 0 : _b.id;
                if (!vendorId) {
                    return res.status(401).json({
                        success: false,
                        message: 'Vendor not found',
                    });
                }
                // First check subscription status
                const subscriptionCheck = yield this.checkSubscriptionStatus(vendorId);
                if (!subscriptionCheck.isActive) {
                    return res.status(403).json({
                        success: false,
                        message: subscriptionCheck.message || 'Subscription is not active',
                    });
                }
                let checkResult;
                if (limitType === 'supplierLimit') {
                    // For supplier creation, count is determined by the request
                    const count = ((_c = req.body.suppliers) === null || _c === void 0 ? void 0 : _c.length) || 1;
                    checkResult = yield this.checkSupplierCreation(vendorId, count);
                }
                else if (limitType === 'assessmentLimit') {
                    checkResult = yield this.checkAssessmentLimit(vendorId);
                }
                else {
                    checkResult = yield this.checkAndIncrementUsage(vendorId, limitType, incrementBy);
                }
                if (!checkResult.allowed) {
                    return res.status(429).json({
                        success: false,
                        message: checkResult.message || 'Plan limit exceeded',
                        remaining: checkResult.remaining,
                    });
                }
                // Attach limit info to request for logging
                req.limitInfo = {
                    limitType,
                    remaining: checkResult.remaining,
                    allowed: checkResult.allowed,
                };
                next();
            }
            catch (error) {
                console.error('Limit middleware error:', error);
                return res.status(500).json({
                    success: false,
                    message: 'Error checking plan limits',
                    error: error.message,
                });
            }
        });
    }
}
exports.PlanLimitService = PlanLimitService;
