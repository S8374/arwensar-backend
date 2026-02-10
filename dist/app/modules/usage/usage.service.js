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
exports.usageService = void 0;
const prisma_1 = require("../../shared/prisma");
const ApiError_1 = __importDefault(require("../../../error/ApiError"));
const http_status_1 = __importDefault(require("http-status"));
const getFeatures_1 = require("../../helper/getFeatures");
class UsageService {
    // ========== GET CURRENT USAGE ==========
    getCurrentUsage(subscriptionId) {
        return __awaiter(this, void 0, void 0, function* () {
            const currentMonth = new Date().getMonth() + 1;
            const currentYear = new Date().getFullYear();
            const usage = yield prisma_1.prisma.planLimitData.findUnique({
                where: { subscriptionId },
            });
            // If no usage record exists or it's from a previous month, create/refresh it
            if (!usage || (usage.month !== currentMonth && usage.year !== currentYear)) {
                return yield this.refreshMonthlyUsage(subscriptionId);
            }
            return usage;
        });
    }
    // ========== REFRESH MONTHLY USAGE ==========
    refreshMonthlyUsage(subscriptionId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g;
            const subscription = yield prisma_1.prisma.subscription.findUnique({
                where: { id: subscriptionId },
                include: { plan: true }
            });
            if (!subscription) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "Subscription not found");
            }
            const features = (0, getFeatures_1.getPlanFeatures)(subscription.plan);
            const isEnterprise = subscription.plan.type === "ENTERPRISE";
            const currentMonth = new Date().getMonth() + 1;
            const currentYear = new Date().getFullYear();
            // Get existing usage to carry over cumulative values for non-enterprise plans
            const existingUsage = yield prisma_1.prisma.planLimitData.findUnique({
                where: { subscriptionId }
            });
            if (existingUsage) {
                return yield prisma_1.prisma.planLimitData.update({
                    where: { subscriptionId },
                    data: isEnterprise
                        ? {
                            // Enterprise: reset to unlimited (null)
                            suppliersUsed: null,
                            assessmentsUsed: null,
                            messagesUsed: null,
                            documentReviewsUsed: null,
                            reportCreate: null,
                            reportsGeneratedUsed: null,
                            notificationsSend: null,
                            month: currentMonth,
                            year: currentYear,
                        }
                        : {
                            // Non-enterprise: cumulative + monthly refresh
                            suppliersUsed: existingUsage.suppliersUsed !== null
                                ? existingUsage.suppliersUsed + ((_a = features.supplierLimit) !== null && _a !== void 0 ? _a : 0)
                                : features.supplierLimit,
                            assessmentsUsed: existingUsage.assessmentsUsed !== null
                                ? existingUsage.assessmentsUsed + ((_b = features.assessmentLimit) !== null && _b !== void 0 ? _b : 0)
                                : features.assessmentLimit,
                            messagesUsed: existingUsage.messagesUsed !== null
                                ? existingUsage.messagesUsed + ((_c = features.messagesPerMonth) !== null && _c !== void 0 ? _c : 0)
                                : features.messagesPerMonth,
                            documentReviewsUsed: existingUsage.documentReviewsUsed !== null
                                ? existingUsage.documentReviewsUsed + ((_d = features.documentReviewsPerMonth) !== null && _d !== void 0 ? _d : 0)
                                : features.documentReviewsPerMonth,
                            reportCreate: existingUsage.reportCreate !== null
                                ? existingUsage.reportCreate + ((_e = features.reportCreate) !== null && _e !== void 0 ? _e : 0)
                                : features.reportCreate,
                            reportsGeneratedUsed: existingUsage.reportsGeneratedUsed !== null
                                ? existingUsage.reportsGeneratedUsed + ((_f = features.reportsGeneratedPerMonth) !== null && _f !== void 0 ? _f : 0)
                                : features.reportsGeneratedPerMonth,
                            notificationsSend: existingUsage.notificationsSend !== null
                                ? existingUsage.notificationsSend + ((_g = features.notificationsSend) !== null && _g !== void 0 ? _g : 0)
                                : features.notificationsSend,
                            month: currentMonth,
                            year: currentYear,
                        }
                });
            }
            else {
                return yield prisma_1.prisma.planLimitData.create({
                    data: isEnterprise
                        ? {
                            subscriptionId,
                            suppliersUsed: null,
                            assessmentsUsed: null,
                            messagesUsed: null,
                            documentReviewsUsed: null,
                            reportCreate: null,
                            reportsGeneratedUsed: null,
                            notificationsSend: null,
                            month: currentMonth,
                            year: currentYear,
                        }
                        : {
                            subscriptionId,
                            suppliersUsed: features.supplierLimit,
                            assessmentsUsed: features.assessmentLimit,
                            messagesUsed: features.messagesPerMonth,
                            documentReviewsUsed: features.documentReviewsPerMonth,
                            reportCreate: features.reportCreate,
                            reportsGeneratedUsed: features.reportsGeneratedPerMonth,
                            notificationsSend: features.notificationsSend,
                            month: currentMonth,
                            year: currentYear,
                        }
                });
            }
        });
    }
    // ========== VALIDATE SUBSCRIPTION STATUS ==========
    validateSubscription(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const subscription = yield prisma_1.prisma.subscription.findUnique({
                where: { userId },
                include: { plan: true }
            });
            if (!subscription) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "No active subscription found / Limit Expire");
            }
            // Check if subscription is active
            if (!['ACTIVE', 'TRIALING'].includes(subscription.status)) {
                throw new ApiError_1.default(http_status_1.default.FORBIDDEN, "Your subscription is not active");
            }
            // Check if trial has ended
            if (subscription.status === 'TRIALING' && subscription.trialEnd && subscription.trialEnd < new Date()) {
                throw new ApiError_1.default(http_status_1.default.FORBIDDEN, "Your trial period has ended");
            }
            // Check if subscription period has ended
            if (subscription.currentPeriodEnd && subscription.currentPeriodEnd < new Date()) {
                throw new ApiError_1.default(http_status_1.default.FORBIDDEN, "Your subscription has expired");
            }
            return subscription;
        });
    }
    // ========== DECREMENT USAGE ==========
    decrementUsage(userId_1, field_1) {
        return __awaiter(this, arguments, void 0, function* (userId, field, count = 1) {
            // Validate subscription
            const subscription = yield this.validateSubscription(userId);
            console.log("Decrement heare come...");
            // Enterprise plans have unlimited usage (null)
            if (subscription.plan.type === "ENTERPRISE") {
                return { success: true, remaining: null };
            }
            // Get current usage
            const usage = yield this.getCurrentUsage(subscription.id);
            console.log("Decrement heare come...");
            // Get current value
            const currentValue = usage[field];
            console.log("Decrement currentValue come...");
            if (currentValue === null) {
                // Unlimited for this field
                return { success: true, remaining: null };
            }
            if (currentValue < count) {
                throw new ApiError_1.default(http_status_1.default.PAYMENT_REQUIRED, {
                    message: `Insufficient ${this.getFieldDisplayName(field)}. Available: ${currentValue}, Required: ${count}`,
                    code: 'LIMIT_EXCEEDED',
                    limit: currentValue,
                    required: count,
                    field
                });
            }
            // Decrement the value
            const newValue = currentValue - count;
            console.log("Decrement newValue come...");
            yield prisma_1.prisma.planLimitData.update({
                where: { subscriptionId: subscription.id },
                data: { [field]: newValue }
            });
            return { success: true, remaining: newValue };
        });
    }
    // ========== CHECK USAGE WITHOUT DECREMENT ==========
    checkUsage(userId_1, field_1) {
        return __awaiter(this, arguments, void 0, function* (userId, field, count = 1) {
            try {
                const subscription = yield this.validateSubscription(userId);
                // Enterprise plans have unlimited usage
                if (subscription.plan.type === "ENTERPRISE") {
                    return { canProceed: true, remaining: null, limit: null };
                }
                const usage = yield this.getCurrentUsage(subscription.id);
                const currentValue = usage[field];
                if (currentValue === null) {
                    return { canProceed: true, remaining: null, limit: null };
                }
                if (currentValue < count) {
                    return {
                        canProceed: false,
                        remaining: currentValue,
                        limit: currentValue,
                        message: `Insufficient ${this.getFieldDisplayName(field)}. Available: ${currentValue}, Required: ${count}`
                    };
                }
                return {
                    canProceed: true,
                    remaining: currentValue,
                    limit: currentValue
                };
            }
            catch (error) {
                return {
                    canProceed: false,
                    message: error instanceof Error ? error.message : "Usage check failed"
                };
            }
        });
    }
    // ========== BULK SUPPLIER LIMIT CHECK ==========
    checkBulkSupplierLimit(userId, requiredCount) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const subscription = yield this.validateSubscription(userId);
                // Enterprise plans have unlimited suppliers
                if (subscription.plan.type === "ENTERPRISE") {
                    return { canProceed: true, limit: null, remaining: null };
                }
                const usage = yield this.getCurrentUsage(subscription.id);
                const currentSuppliers = usage.suppliersUsed;
                if (currentSuppliers === null) {
                    return { canProceed: true, limit: null, remaining: null };
                }
                if (currentSuppliers < requiredCount) {
                    return {
                        canProceed: false,
                        remaining: currentSuppliers,
                        limit: currentSuppliers,
                        message: `Cannot add ${requiredCount} suppliers. You have ${currentSuppliers} supplier slots remaining.`
                    };
                }
                return {
                    canProceed: true,
                    remaining: currentSuppliers,
                    limit: currentSuppliers
                };
            }
            catch (error) {
                return {
                    canProceed: false,
                    message: error instanceof Error ? error.message : "Bulk limit check failed"
                };
            }
        });
    }
    // ========== GET REMAINING LIMITS ==========
    getRemainingLimits(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const subscription = yield prisma_1.prisma.subscription.findUnique({
                where: { userId },
                include: { plan: true, PlanLimitData: true }
            });
            if (!subscription) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "No subscription found");
            }
            const usage = subscription.PlanLimitData || (yield this.getCurrentUsage(subscription.id));
            const user = yield prisma_1.prisma.user.findUnique({
                where: { id: userId }
            });
            const isAllFeaturesAccess = (user === null || user === void 0 ? void 0 : user.allFeaturesAccess) || false;
            // Get all usage values
            const limits = {
                suppliersUsed: usage.suppliersUsed,
                assessmentsUsed: usage.assessmentsUsed,
                messagesUsed: usage.messagesUsed,
                documentReviewsUsed: usage.documentReviewsUsed,
                reportCreate: usage.reportCreate,
                reportsGeneratedUsed: usage.reportsGeneratedUsed,
                notificationsSend: usage.notificationsSend,
            };
            return {
                isAllFeaturesAccess,
                limits,
                subscription: {
                    id: subscription.id,
                    status: subscription.status,
                    plan: subscription.plan,
                }
            };
        });
    }
    // ========== RESET EXPIRED SUBSCRIPTION ==========
    resetExpiredSubscription(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const subscription = yield prisma_1.prisma.subscription.findUnique({
                where: { userId },
                include: { plan: true }
            });
            if (!subscription)
                return;
            const isExpired = subscription.currentPeriodEnd && subscription.currentPeriodEnd < new Date();
            const isTrialExpired = subscription.status === 'TRIALING' &&
                subscription.trialEnd &&
                subscription.trialEnd < new Date();
            if (isExpired || isTrialExpired) {
                // Reset usage to minimum/zero
                yield prisma_1.prisma.planLimitData.update({
                    where: { subscriptionId: subscription.id },
                    data: {
                        suppliersUsed: 0,
                        assessmentsUsed: 0,
                        messagesUsed: 0,
                        documentReviewsUsed: 0,
                        reportCreate: 0,
                        reportsGeneratedUsed: 0,
                        notificationsSend: 0,
                    }
                });
                // Update subscription status
                yield prisma_1.prisma.subscription.update({
                    where: { id: subscription.id },
                    data: {
                        status: isTrialExpired ? 'EXPIRED' : 'CANCELED',
                        updatedAt: new Date()
                    }
                });
            }
        });
    }
    // ========== HANDLE PLAN UPGRADE/DOWNGRADE ==========
    handlePlanChange(subscriptionId, newPlanId, previousPlanId) {
        return __awaiter(this, void 0, void 0, function* () {
            const [newPlan, subscription] = yield Promise.all([
                prisma_1.prisma.plan.findUnique({ where: { id: newPlanId } }),
                prisma_1.prisma.subscription.findUnique({
                    where: { id: subscriptionId },
                    include: { PlanLimitData: true }
                })
            ]);
            if (!newPlan || !subscription) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "Plan or subscription not found");
            }
            const features = (0, getFeatures_1.getPlanFeatures)(newPlan);
            const isEnterprisePlan = newPlan.type === "ENTERPRISE";
            const existingUsage = subscription.PlanLimitData;
            if (existingUsage) {
                // Update existing usage with cumulative addition
                yield prisma_1.prisma.planLimitData.update({
                    where: { subscriptionId },
                    data: isEnterprisePlan
                        ? {
                            // Enterprise: set to unlimited (null)
                            suppliersUsed: null,
                            assessmentsUsed: null,
                            messagesUsed: null,
                            documentReviewsUsed: null,
                            reportCreate: null,
                            reportsGeneratedUsed: null,
                            notificationsSend: null,
                        }
                        : {
                            // Cumulative addition for non-enterprise plans
                            suppliersUsed: existingUsage.suppliersUsed !== null && features.supplierLimit !== null
                                ? existingUsage.suppliersUsed + features.supplierLimit
                                : features.supplierLimit,
                            assessmentsUsed: existingUsage.assessmentsUsed !== null && features.assessmentLimit !== null
                                ? existingUsage.assessmentsUsed + features.assessmentLimit
                                : features.assessmentLimit,
                            messagesUsed: existingUsage.messagesUsed !== null && features.messagesPerMonth !== null
                                ? existingUsage.messagesUsed + features.messagesPerMonth
                                : features.messagesPerMonth,
                            documentReviewsUsed: existingUsage.documentReviewsUsed !== null && features.documentReviewsPerMonth !== null
                                ? existingUsage.documentReviewsUsed + features.documentReviewsPerMonth
                                : features.documentReviewsPerMonth,
                            reportCreate: existingUsage.reportCreate !== null && features.reportCreate !== null
                                ? existingUsage.reportCreate + features.reportCreate
                                : features.reportCreate,
                            reportsGeneratedUsed: existingUsage.reportsGeneratedUsed !== null && features.reportsGeneratedPerMonth !== null
                                ? existingUsage.reportsGeneratedUsed + features.reportsGeneratedPerMonth
                                : features.reportsGeneratedPerMonth,
                            notificationsSend: existingUsage.notificationsSend !== null && features.notificationsSend !== null
                                ? existingUsage.notificationsSend + features.notificationsSend
                                : features.notificationsSend,
                        }
                });
            }
            else {
                // Create new usage record
                yield prisma_1.prisma.planLimitData.create({
                    data: isEnterprisePlan
                        ? {
                            subscriptionId,
                            suppliersUsed: null,
                            assessmentsUsed: null,
                            messagesUsed: null,
                            documentReviewsUsed: null,
                            reportCreate: null,
                            reportsGeneratedUsed: null,
                            notificationsSend: null,
                        }
                        : {
                            subscriptionId,
                            suppliersUsed: features.supplierLimit,
                            assessmentsUsed: features.assessmentLimit,
                            messagesUsed: features.messagesPerMonth,
                            documentReviewsUsed: features.documentReviewsPerMonth,
                            reportCreate: features.reportCreate,
                            reportsGeneratedUsed: features.reportsGeneratedPerMonth,
                            notificationsSend: features.notificationsSend,
                        }
                });
            }
        });
    }
    // ========== HELPER METHODS ==========
    getFieldDisplayName(field) {
        const fieldNames = {
            suppliersUsed: 'supplier slots',
            assessmentsUsed: 'assessment reviews',
            messagesUsed: 'messages',
            documentReviewsUsed: 'document reviews',
            reportCreate: 'report creation',
            reportsGeneratedUsed: 'report generation',
            notificationsSend: 'notifications'
        };
        return fieldNames[field] || field;
    }
    // ========== MIDDLEWARE FOR ROUTES ==========
    decrementMiddleware(userId_1, field_1) {
        return __awaiter(this, arguments, void 0, function* (userId, field, count = 1) {
            const result = yield this.decrementUsage(userId, field, count);
            if (!result.success) {
                throw new ApiError_1.default(http_status_1.default.PAYMENT_REQUIRED, `Insufficient ${this.getFieldDisplayName(field)} available. Please upgrade your plan.`);
            }
            return result;
        });
    }
}
exports.usageService = new UsageService();
