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
exports.AdminService = void 0;
const http_status_1 = __importDefault(require("http-status"));
const prisma_1 = require("../../shared/prisma");
const ApiError_1 = __importDefault(require("../../../error/ApiError"));
const stripe_service_1 = require("../../shared/stripe.service");
const paginationHelper_1 = require("../../helper/paginationHelper");
const notification_service_1 = require("../notification/notification.service");
const mailtrap_service_1 = require("../../shared/mailtrap.service");
exports.AdminService = {
    // ========== DASHBOARD ==========
    getDashboardStats() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            const [totalVendors, totalSuppliers, subscriptions, payments, pendingVerifications, vendors] = yield Promise.all([
                prisma_1.prisma.vendor.count({ where: { isDeleted: false } }),
                prisma_1.prisma.supplier.count({ where: { isDeleted: false } }),
                prisma_1.prisma.subscription.findMany({
                    where: { status: 'ACTIVE' },
                    include: { plan: true }
                }),
                prisma_1.prisma.payment.findMany({
                    where: {
                        status: 'SUCCEEDED',
                        paidAt: {
                            gte: new Date(new Date().getFullYear(), 0, 1)
                        }
                    }
                }),
                prisma_1.prisma.user.count({ where: { isVerified: false } }),
                prisma_1.prisma.vendor.findMany({
                    where: { isDeleted: false },
                    include: { user: true },
                    orderBy: { createdAt: 'desc' },
                    take: 5
                })
            ]);
            const suppliers = yield prisma_1.prisma.supplier.findMany({
                where: {
                    isDeleted: false,
                    isActive: true,
                    bivScore: { not: null }
                },
                include: {
                    vendor: { select: { companyName: true } },
                    user: { select: { email: true } }
                },
                orderBy: { bivScore: 'asc' },
                take: 10
            });
            const riskDistribution = yield prisma_1.prisma.supplier.groupBy({
                by: ['riskLevel'],
                where: {
                    isDeleted: false,
                    isActive: true,
                    riskLevel: { not: null }
                },
                _count: true
            });
            const totalRevenue = payments.reduce((sum, payment) => sum + payment.amount.toNumber(), 0);
            // Generate revenue chart (last 6 months)
            const revenueChart = [];
            const now = new Date();
            for (let i = 5; i >= 0; i--) {
                const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const monthName = month.toLocaleString('default', { month: 'short' });
                const monthRevenue = payments
                    .filter(p => p.paidAt &&
                    p.paidAt.getMonth() === month.getMonth() &&
                    p.paidAt.getFullYear() === month.getFullYear())
                    .reduce((sum, p) => sum + p.amount.toNumber(), 0);
                revenueChart.push({
                    month: monthName,
                    revenue: monthRevenue
                });
            }
            return {
                totalVendors,
                totalSuppliers,
                totalActiveSubscriptions: subscriptions.length,
                totalRevenue,
                pendingVerifications,
                recentVendors: vendors.map(v => ({
                    id: v.id,
                    companyName: v.companyName,
                    email: v.businessEmail,
                    createdAt: v.createdAt
                })),
                topSuppliers: suppliers.map(s => {
                    var _a;
                    return ({
                        id: s.id,
                        name: s.name,
                        email: s.email,
                        bivScore: ((_a = s.bivScore) === null || _a === void 0 ? void 0 : _a.toNumber()) || null,
                        riskLevel: s.riskLevel,
                        vendorName: s.vendor.companyName
                    });
                }),
                riskDistribution: {
                    high: ((_a = riskDistribution.find(r => r.riskLevel === 'HIGH')) === null || _a === void 0 ? void 0 : _a._count) || 0,
                    medium: ((_b = riskDistribution.find(r => r.riskLevel === 'MEDIUM')) === null || _b === void 0 ? void 0 : _b._count) || 0,
                    low: ((_c = riskDistribution.find(r => r.riskLevel === 'LOW')) === null || _c === void 0 ? void 0 : _c._count) || 0
                },
                revenueChart
            };
        });
    },
    // Helper to map your BillingCycle enum to Stripe interval
    mapBillingCycleToStripeInterval(billingCycle) {
        const map = {
            MONTHLY: "month",
            YEARLY: "year",
            WEEKLY: "week",
            DAILY: "day",
        };
        const interval = map[billingCycle.toUpperCase()];
        if (!interval) {
            throw new Error(`Invalid billing cycle: ${billingCycle}. Must be MONTHLY, YEARLY, WEEKLY, or DAILY`);
        }
        return interval;
    },
    // ========== PLANS MANAGEMENT ==========
    createPlan(data) {
        return __awaiter(this, void 0, void 0, function* () {
            const existing = yield prisma_1.prisma.plan.findFirst({
                where: {
                    OR: [{ name: data.name }, { type: data.type }],
                    isDeleted: false,
                },
            });
            if (existing) {
                throw new ApiError_1.default(http_status_1.default.CONFLICT, "Plan with this name or type already exists");
            }
            let stripeProductId = null;
            let stripePriceId = null;
            try {
                // Create Product
                const product = yield stripe_service_1.stripeService.stripe.products.create({
                    name: data.name,
                    description: data.description || null,
                    metadata: {
                        planType: data.type,
                        billingCycle: data.billingCycle,
                    },
                    active: true,
                });
                stripeProductId = product.id;
                // Create Price — CORRECT INTERVAL
                const price = yield stripe_service_1.stripeService.stripe.prices.create({
                    product: product.id,
                    unit_amount: Math.round(data.price * 100),
                    currency: (data.currency || "eur").toLowerCase(),
                    recurring: {
                        interval: this.mapBillingCycleToStripeInterval(data.billingCycle),
                    },
                    metadata: {
                        planType: data.type,
                    },
                });
                stripePriceId = price.id;
            }
            catch (stripeError) {
                console.error("Stripe creation failed:", stripeError);
                throw new ApiError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, `Failed to create plan in Stripe: ${stripeError.message}`);
            }
            // Save in DB
            const plan = yield prisma_1.prisma.plan.create({
                data: {
                    name: data.name,
                    description: data.description,
                    type: data.type,
                    billingCycle: data.billingCycle,
                    price: data.price,
                    currency: data.currency || "EUR",
                    supplierLimit: data.supplierLimit,
                    assessmentLimit: data.assessmentLimit,
                    storageLimit: data.storageLimit,
                    userLimit: data.userLimit,
                    features: data.features || {},
                    trialDays: data.trialDays || 14,
                    isActive: true,
                    isPopular: data.isPopular || false,
                    stripeProductId,
                    stripePriceId,
                },
            });
            return plan;
        });
    },
    updatePlan(planId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            const plan = yield prisma_1.prisma.plan.findUnique({ where: { id: planId } });
            if (!plan)
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "Plan not found");
            if (plan.isDeleted)
                throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, "Cannot update deleted plan");
            let newStripePriceId = plan.stripePriceId;
            try {
                // Update Product
                if (plan.stripeProductId) {
                    yield stripe_service_1.stripeService.stripe.products.update(plan.stripeProductId, {
                        name: data.name || plan.name,
                        description: (_a = data.description) !== null && _a !== void 0 ? _a : plan.description,
                        active: (_b = data.isActive) !== null && _b !== void 0 ? _b : plan.isActive,
                    });
                }
                // If price or billing cycle changed → create NEW price
                if (data.price !== undefined ||
                    data.billingCycle !== undefined) {
                    const newPrice = yield stripe_service_1.stripeService.stripe.prices.create({
                        product: plan.stripeProductId,
                        unit_amount: Math.round(((_c = data.price) !== null && _c !== void 0 ? _c : plan.price) * 100),
                        currency: (data.currency || plan.currency).toLowerCase(),
                        recurring: {
                            interval: this.mapBillingCycleToStripeInterval(data.billingCycle || plan.billingCycle),
                        },
                        metadata: { planType: data.type || plan.type },
                    });
                    newStripePriceId = newPrice.id;
                    // Archive old price
                    if (plan.stripePriceId) {
                        yield stripe_service_1.stripeService.stripe.prices.update(plan.stripePriceId, { active: false }).catch(() => { });
                    }
                }
            }
            catch (stripeError) {
                console.error("Stripe update failed:", stripeError);
                throw new ApiError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, `Failed to sync with Stripe: ${stripeError.message}`);
            }
            console.log("Find update data ", plan);
            // Update DB
            const updatedPlan = yield prisma_1.prisma.plan.update({
                where: { id: planId },
                data: {
                    name: data.name,
                    description: data.description,
                    type: data.type,
                    billingCycle: data.billingCycle,
                    price: data.price,
                    currency: data.currency,
                    supplierLimit: data.supplierLimit,
                    assessmentLimit: data.assessmentLimit,
                    storageLimit: data.storageLimit,
                    userLimit: data.userLimit,
                    features: data.features,
                    trialDays: data.trialDays,
                    isActive: data.isActive,
                    isPopular: data.isPopular,
                    stripePriceId: newStripePriceId,
                },
            });
            console.log("Updated data", updatedPlan);
            return updatedPlan;
        });
    },
    // ========== DELETE PLAN (Soft-delete DB + Fully Archive in Stripe) ==========
    deletePlan(planId) {
        return __awaiter(this, void 0, void 0, function* () {
            const plan = yield prisma_1.prisma.plan.findUnique({
                where: { id: planId },
            });
            if (!plan) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "Plan not found");
            }
            if (plan.isDeleted) {
                throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, "Plan is already deleted");
            }
            // Prevent deletion if any active subscription uses this plan
            const activeSubs = yield prisma_1.prisma.subscription.count({
                where: {
                    planId,
                    status: { in: ["ACTIVE", "TRIALING", "PAST_DUE"] },
                },
            });
            if (activeSubs > 0) {
                throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, `Cannot delete "${plan.name}" — ${activeSubs} active subscription(s) are using it.`);
            }
            // ========================
            // ARCHIVE IN STRIPE (Product + Price)
            // ========================
            try {
                // 1. Archive the PRICE (if exists)
                if (plan.stripePriceId) {
                    yield stripe_service_1.stripeService.stripe.prices.update(plan.stripePriceId, {
                        active: false,
                    });
                    console.log(`Stripe Price archived: ${plan.stripePriceId}`);
                }
                // 2. Archive the PRODUCT (if exists)
                if (plan.stripeProductId) {
                    yield stripe_service_1.stripeService.stripe.products.update(plan.stripeProductId, {
                        active: false,
                    });
                    console.log(`Stripe Product archived: ${plan.stripeProductId}`);
                }
            }
            catch (stripeError) {
                // Handle common non-fatal errors
                if (stripeError.code === "resource_missing") {
                    console.warn(`Stripe resource not found (already deleted?): ${stripeError.param}`);
                }
                else if (stripeError.type === "invalid_request_error") {
                    console.warn(`Stripe request ignored (possibly already archived): ${stripeError.message}`);
                }
                else {
                    console.error("Unexpected Stripe error during archive:", stripeError);
                    // Continue anyway — local soft-delete is most important
                }
            }
            // ========================
            // SOFT-DELETE IN DATABASE
            // ========================
            const deletedPlan = yield prisma_1.prisma.plan.update({
                where: { id: planId },
                data: {
                    isDeleted: true,
                    isActive: false,
                    // Optional: clear Stripe IDs to prevent reuse
                    stripePriceId: null,
                    stripeProductId: null,
                },
            });
            console.log(`Plan "${deletedPlan.name}" fully deactivated: DB soft-deleted + Stripe archived`);
            return deletedPlan;
        });
    },
    getAllPlans() {
        return __awaiter(this, void 0, void 0, function* () {
            return prisma_1.prisma.plan.findMany({
                where: { isDeleted: false },
                orderBy: { price: 'asc' }
            });
        });
    },
    getPlanById(planId) {
        return __awaiter(this, void 0, void 0, function* () {
            return prisma_1.prisma.plan.findUnique({
                where: { id: planId, isDeleted: false }
            });
        });
    },
    // ========== ASSESSMENTS MANAGEMENT ==========
    createAssessment(data) {
        return __awaiter(this, void 0, void 0, function* () {
            // Check if assessment with same examId exists
            const existingAssessment = yield prisma_1.prisma.assessment.findUnique({
                where: { examId: data.examId }
            });
            if (existingAssessment) {
                throw new ApiError_1.default(http_status_1.default.CONFLICT, "Assessment with this exam ID already exists");
            }
            // Validate that createdBy user exists
            const user = yield prisma_1.prisma.user.findUnique({
                where: { id: data.createdBy }
            });
            if (!user) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "User not found");
            }
            if (!data.vendorId) {
                throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, "vendorId is required");
            }
            const assessment = yield prisma_1.prisma.assessment.create({
                data: {
                    examId: data.examId,
                    title: data.title,
                    description: data.description,
                    isActive: data.isActive !== undefined ? data.isActive : true,
                    isTemplate: data.isTemplate || false,
                    stage: data.stage || 'FULL',
                    totalPoints: data.totalPoints || 100,
                    passingScore: data.passingScore,
                    timeLimit: data.timeLimit,
                    createdByUser: { connect: { id: data.createdBy } },
                    vendorId: data.vendorId, // ✅ required
                    categories: {
                        create: data.categories.map((category) => ({
                            categoryId: category.categoryId,
                            title: category.title,
                            description: category.description,
                            order: category.order || 1,
                            weight: category.weight,
                            maxScore: category.maxScore || 100,
                            questions: {
                                create: category.questions.map((question) => ({
                                    questionId: question.questionId,
                                    question: question.question,
                                    description: question.description,
                                    order: question.order || 1,
                                    isDocument: question.isDocument || false,
                                    isInputField: question.isInputField || false,
                                    answerType: question.answerType || 'YES',
                                    weight: question.weight,
                                    maxScore: question.maxScore || 10,
                                    helpText: question.helpText,
                                    bivCategory: question.bivCategory,
                                    evidenceRequired: question.evidenceRequired || false
                                }))
                            }
                        }))
                    }
                },
                include: {
                    categories: { include: { questions: true } },
                    createdByUser: { select: { id: true, email: true, role: true } }
                }
            });
            return assessment;
        });
    },
    updateAssessment(assessmentId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const assessment = yield prisma_1.prisma.assessment.findUnique({
                where: { id: assessmentId }
            });
            if (!assessment) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "Assessment not found");
            }
            const updatedAssessment = yield prisma_1.prisma.assessment.update({
                where: { id: assessmentId },
                data: {
                    title: data.title,
                    description: data.description,
                    isActive: data.isActive,
                    isTemplate: data.isTemplate,
                    stage: data.stage,
                    totalPoints: data.totalPoints,
                    passingScore: data.passingScore,
                    timeLimit: data.timeLimit,
                    updatedBy: data.updatedBy
                },
                include: {
                    categories: {
                        include: {
                            questions: true
                        }
                    }
                }
            });
            return updatedAssessment;
        });
    },
    deleteAssessment(assessmentId) {
        return __awaiter(this, void 0, void 0, function* () {
            const assessment = yield prisma_1.prisma.assessment.findUnique({
                where: { id: assessmentId }
            });
            if (!assessment) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "Assessment not found");
            }
            // Check if assessment has submissions
            const submissionsCount = yield prisma_1.prisma.assessmentSubmission.count({
                where: { assessmentId }
            });
            if (submissionsCount > 0) {
                throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, "Cannot delete assessment with existing submissions");
            }
            const deletedAssessment = yield prisma_1.prisma.assessment.update({
                where: { id: assessmentId },
                data: { isActive: false }
            });
            return deletedAssessment;
        });
    },
    getAllAssessments() {
        return __awaiter(this, void 0, void 0, function* () {
            return prisma_1.prisma.assessment.findMany({
                where: { isActive: true },
                include: {
                    categories: {
                        include: {
                            questions: true
                        }
                    },
                    createdByUser: {
                        select: {
                            id: true,
                            email: true,
                            role: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            });
        });
    },
    getAssessmentById(assessmentId) {
        return __awaiter(this, void 0, void 0, function* () {
            return prisma_1.prisma.assessment.findUnique({
                where: { id: assessmentId },
                include: {
                    categories: {
                        include: {
                            questions: true
                        }
                    },
                    createdByUser: {
                        select: {
                            id: true,
                            email: true,
                            role: true
                        }
                    }
                }
            });
        });
    },
    // ========== USER MANAGEMENT ==========
    getAllVendors() {
        return __awaiter(this, void 0, void 0, function* () {
            const vendors = yield prisma_1.prisma.vendor.findMany({
                where: { isDeleted: false },
                include: {
                    user: {
                        include: {
                            subscription: {
                                include: {
                                    plan: {
                                        select: {
                                            id: true,
                                            name: true,
                                            type: true,
                                            price: true,
                                            currency: true,
                                            supplierLimit: true
                                        }
                                    }
                                }
                            }
                        }
                    },
                    suppliers: {
                        where: { isDeleted: false },
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            isActive: true,
                            riskLevel: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            });
            return vendors;
        });
    },
    getAllSuppliers() {
        return __awaiter(this, void 0, void 0, function* () {
            return prisma_1.prisma.supplier.findMany({
                where: { isDeleted: false },
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                            role: true,
                            status: true,
                            isVerified: false,
                            createdAt: true
                        }
                    },
                    vendor: {
                        select: {
                            id: true,
                            companyName: true,
                            businessEmail: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            });
        });
    },
    deleteSupplierPermanently(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return prisma_1.prisma.supplier.delete({
                where: { id },
            });
        });
    },
    updateUserStatus(userId, status) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield prisma_1.prisma.user.findUnique({
                where: { id: userId }
            });
            if (!user) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "User not found");
            }
            const updatedUser = yield prisma_1.prisma.user.update({
                where: { id: userId },
                data: { status: status }
            });
            return updatedUser;
        });
    },
    // ========== REPORTS ==========
    generateSystemReport(type, filters) {
        return __awaiter(this, void 0, void 0, function* () {
            let reportData = {};
            switch (type) {
                case 'FINANCIAL_ANALYSIS':
                    const payments = yield prisma_1.prisma.payment.findMany({
                        where: {
                            status: 'SUCCEEDED',
                            paidAt: {
                                gte: new Date(new Date().setFullYear(new Date().getFullYear() - 1))
                            }
                        },
                        include: {
                            user: {
                                select: { email: true }
                            },
                            subscription: {
                                include: {
                                    plan: true
                                }
                            }
                        }
                    });
                    const revenueByMonth = payments.reduce((acc, payment) => {
                        var _a;
                        const month = (_a = payment.paidAt) === null || _a === void 0 ? void 0 : _a.toLocaleString('default', { month: 'long', year: 'numeric' });
                        if (month) {
                            acc[month] = (acc[month] || 0) + payment.amount.toNumber();
                        }
                        return acc;
                    }, {});
                    // Fix: Handle null subscription
                    const topPlans = payments
                        .filter(p => { var _a; return (_a = p.subscription) === null || _a === void 0 ? void 0 : _a.plan; }) // Filter out null subscriptions
                        .map(p => p.subscription.plan.name) // Use non-null assertion after filtering
                        .filter((name, index, self) => self.indexOf(name) === index) // Get unique names
                        .slice(0, 5);
                    reportData = {
                        totalRevenue: payments.reduce((sum, p) => sum + p.amount.toNumber(), 0),
                        totalPayments: payments.length,
                        revenueByMonth,
                        topPlans
                    };
                    break;
                case 'RISK_ASSESSMENT':
                    const suppliers = yield prisma_1.prisma.supplier.findMany({
                        where: {
                            isDeleted: false,
                            isActive: true,
                            bivScore: { not: null }
                        },
                        include: {
                            vendor: {
                                select: { companyName: true }
                            },
                            assessmentSubmissions: {
                                where: { status: 'APPROVED' },
                                orderBy: { createdAt: 'desc' },
                                take: 1
                            }
                        }
                    });
                    const riskBreakdown = suppliers.reduce((acc, supplier) => {
                        const level = supplier.riskLevel || 'UNKNOWN';
                        acc[level] = (acc[level] || 0) + 1;
                        return acc;
                    }, {});
                    const averageBIVScore = suppliers.length > 0
                        ? suppliers.reduce((sum, s) => { var _a; return sum + (((_a = s.bivScore) === null || _a === void 0 ? void 0 : _a.toNumber()) || 0); }, 0) / suppliers.length
                        : 0;
                    reportData = {
                        totalSuppliers: suppliers.length,
                        riskBreakdown,
                        averageBIVScore: parseFloat(averageBIVScore.toFixed(2)),
                        highRiskSuppliers: suppliers
                            .filter(s => s.riskLevel === 'HIGH')
                            .map(s => {
                            var _a;
                            return ({
                                id: s.id,
                                name: s.name,
                                email: s.email,
                                bivScore: (_a = s.bivScore) === null || _a === void 0 ? void 0 : _a.toNumber(),
                                vendor: s.vendor.companyName
                            });
                        }),
                        lowRiskSuppliers: suppliers
                            .filter(s => s.riskLevel === 'LOW')
                            .slice(0, 10)
                    };
                    break;
                case 'COMPLIANCE_REPORT':
                    const submissions = yield prisma_1.prisma.assessmentSubmission.findMany({
                        where: {
                            submittedAt: {
                                gte: new Date(new Date().setMonth(new Date().getMonth() - 6))
                            }
                        },
                        include: {
                            assessment: {
                                select: { title: true }
                            },
                            user: {
                                select: { email: true }
                            }
                        }
                    });
                    const complianceByMonth = submissions.reduce((acc, submission) => {
                        var _a;
                        const month = (_a = submission.submittedAt) === null || _a === void 0 ? void 0 : _a.toLocaleString('default', { month: 'long', year: 'numeric' });
                        if (month) {
                            if (!acc[month]) {
                                acc[month] = { total: 0, approved: 0 };
                            }
                            acc[month].total++;
                            if (submission.status === 'APPROVED') {
                                acc[month].approved++;
                            }
                        }
                        return acc;
                    }, {});
                    const approvedSubmissionsCount = submissions.filter(s => s.status === 'APPROVED').length;
                    const complianceRate = submissions.length > 0
                        ? (approvedSubmissionsCount / submissions.length) * 100
                        : 0;
                    reportData = {
                        totalSubmissions: submissions.length,
                        approvedSubmissions: approvedSubmissionsCount,
                        complianceRate: parseFloat(complianceRate.toFixed(2)),
                        complianceByMonth,
                        pendingReviews: submissions.filter(s => s.status === 'UNDER_REVIEW').length
                    };
                    break;
                default:
                    throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, "Invalid report type");
            }
            return reportData;
        });
    }
    //============= USER ==================
    ,
    getAllUsers() {
        return __awaiter(this, arguments, void 0, function* (filters = {}, paginationOptions = {}) {
            const { page, limit, skip, sortBy, sortOrder } = paginationHelper_1.paginationHelper.calculatePagination(paginationOptions);
            const where = {};
            // Apply filters
            if (filters.role) {
                where.role = filters.role;
            }
            if (filters.status) {
                where.status = filters.status;
            }
            if (filters.vendorId) {
                where.vendorId = filters.vendorId;
            }
            if (filters.supplierId) {
                where.supplierId = filters.supplierId;
            }
            if (filters.isVerified !== undefined) {
                where.isVerified = filters.isVerified;
            }
            if (filters.search) {
                where.OR = [
                    { email: { contains: filters.search, mode: 'insensitive' } },
                    { phoneNumber: { contains: filters.search, mode: 'insensitive' } }
                ];
            }
            if (filters.createdAtFrom || filters.createdAtTo) {
                where.createdAt = {};
                if (filters.createdAtFrom)
                    where.createdAt.gte = new Date(filters.createdAtFrom);
                if (filters.createdAtTo)
                    where.createdAt.lte = new Date(filters.createdAtTo);
            }
            if (filters.lastLoginFrom || filters.lastLoginTo) {
                where.lastLoginAt = {};
                if (filters.lastLoginFrom)
                    where.lastLoginAt.gte = new Date(filters.lastLoginFrom);
                if (filters.lastLoginTo)
                    where.lastLoginAt.lte = new Date(filters.lastLoginTo);
            }
            const [users, total] = yield Promise.all([
                prisma_1.prisma.user.findMany({
                    where,
                    include: {
                        vendorProfile: {
                            select: {
                                id: true,
                                companyName: true,
                                businessEmail: true,
                                isActive: true
                            }
                        },
                        supplierProfile: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                vendor: {
                                    select: {
                                        id: true,
                                        companyName: true
                                    }
                                }
                            }
                        },
                        notificationPreferences: {
                            select: {
                                id: true,
                                emailNotifications: true
                            }
                        },
                        subscription: {
                            select: {
                                id: true,
                                status: true,
                                plan: {
                                    select: {
                                        name: true,
                                        type: true
                                    }
                                }
                            }
                        },
                        _count: {
                            select: {
                                activityLogs: true,
                                notifications: true
                            }
                        }
                    },
                    orderBy: { [sortBy]: sortOrder },
                    skip,
                    take: limit
                }),
                prisma_1.prisma.user.count({ where })
            ]);
            return {
                users,
                meta: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            };
        });
    },
    updateUser(userId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield prisma_1.prisma.user.findUnique({
                where: { id: userId }
            });
            if (!user) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "User not found");
            }
            // Check if email is being changed and if it's already taken
            if (data.email && data.email !== user.email) {
                const existingUser = yield prisma_1.prisma.user.findUnique({
                    where: { email: data.email }
                });
                if (existingUser) {
                    throw new ApiError_1.default(http_status_1.default.CONFLICT, "Email already in use");
                }
            }
            // Role change restrictions
            if (data.role && data.role !== user.role) {
                // Check if user has active profile that conflicts with role change
                if (user.role === 'VENDOR' && user.vendorId) {
                    throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, "Cannot change role of a user with vendor profile");
                }
                if (user.role === 'SUPPLIER' && user.supplierId) {
                    throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, "Cannot change role of a user with supplier profile");
                }
            }
            const updatedUser = yield prisma_1.prisma.user.update({
                where: { id: userId },
                data: {
                    email: data.email,
                    role: data.role,
                    status: data.status,
                    profileImage: data.profileImage,
                    phoneNumber: data.phoneNumber,
                    needPasswordChange: data.needPasswordChange,
                    isVerified: data.isVerified
                },
                include: {
                    vendorProfile: true,
                    supplierProfile: true
                }
            });
            // Create activity log
            yield prisma_1.prisma.activityLog.create({
                data: {
                    userId: updatedUser.id,
                    action: "USER_UPDATED",
                    entityType: "USER",
                    entityId: userId,
                    details: {
                        updatedBy: "ADMIN", // This should come from request context
                        changes: Object.keys(data)
                    }
                }
            });
            return updatedUser;
        });
    },
    deleteUser(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield prisma_1.prisma.user.findUnique({
                where: { id: userId },
                include: {
                    vendorProfile: true,
                    supplierProfile: true,
                    subscription: true
                }
            });
            if (!user) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "User not found");
            }
            // Check for active relationships that prevent deletion
            if (user.role === 'VENDOR' && user.vendorProfile) {
                // Check for active suppliers
                const activeSuppliers = yield prisma_1.prisma.supplier.count({
                    where: {
                        vendorId: user.vendorProfile.id,
                        isDeleted: false,
                        isActive: true
                    }
                });
                if (activeSuppliers > 0) {
                    throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, "Cannot delete vendor with active suppliers. Please deactivate or transfer suppliers first.");
                }
                // Check for active subscription
                if (user.subscription) {
                    throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, "Cannot delete user with active subscription. Cancel subscription first.");
                }
            }
            if (user.role === 'SUPPLIER' && user.supplierProfile) {
                // Check for pending assessments
                const pendingAssessments = yield prisma_1.prisma.assessmentSubmission.count({
                    where: {
                        supplierId: user.supplierProfile.id,
                        status: { in: ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW'] }
                    }
                });
                if (pendingAssessments > 0) {
                    throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, "Cannot delete supplier with pending assessments. Please complete or cancel assessments first.");
                }
                // Check for open problems
                const openProblems = yield prisma_1.prisma.problem.count({
                    where: {
                        supplierId: user.supplierProfile.id,
                        status: { in: ['OPEN', 'IN_PROGRESS'] }
                    }
                });
                if (openProblems > 0) {
                    throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, "Cannot delete supplier with open problems. Please resolve problems first.");
                }
            }
            yield prisma_1.prisma.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                // Soft delete user
                yield tx.user.update({
                    where: { id: userId },
                    data: {
                        status: 'DELETED',
                        email: `${user.email}_deleted_${Date.now()}`, // Change email to avoid conflicts
                        vendorId: null,
                        supplierId: null
                    }
                });
                // Soft delete vendor profile if exists
                if (user.vendorProfile) {
                    yield tx.vendor.update({
                        where: { id: user.vendorProfile.id },
                        data: {
                            isDeleted: true,
                            isActive: false
                        }
                    });
                }
                // Soft delete supplier profile if exists
                if (user.supplierProfile) {
                    yield tx.supplier.update({
                        where: { id: user.supplierProfile.id },
                        data: {
                            isDeleted: true,
                            isActive: false,
                            invitationStatus: 'REVOKED'
                        }
                    });
                }
                // Create activity log
                yield tx.activityLog.create({
                    data: {
                        userId,
                        action: "USER_DELETED",
                        entityType: "USER",
                        entityId: userId,
                        details: {
                            deletedBy: "ADMIN", // This should come from request context
                            originalEmail: user.email,
                            role: user.role
                        }
                    }
                });
            }));
            return {
                message: "User deleted successfully"
            };
        });
    },
    toggleUserBlock(userId, block, reason) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield prisma_1.prisma.user.findUnique({
                where: { id: userId }
            });
            if (!user) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "User not found");
            }
            if (user.status === 'DELETED') {
                throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, "Cannot block/unblock a deleted user");
            }
            const newStatus = block ? 'SUSPENDED' : 'ACTIVE';
            const updatedUser = yield prisma_1.prisma.user.update({
                where: { id: userId },
                data: {
                    status: newStatus,
                    needPasswordChange: block ? true : false // Force password change if blocked
                }
            });
            // Create activity log
            yield prisma_1.prisma.activityLog.create({
                data: {
                    userId,
                    action: block ? "USER_BLOCKED" : "USER_UNBLOCKED",
                    entityType: "USER",
                    entityId: userId,
                    details: {
                        actionBy: "ADMIN",
                        reason,
                        previousStatus: user.status,
                        newStatus
                    }
                }
            });
            // Send notification to user
            yield notification_service_1.NotificationService.createNotification({
                userId,
                title: block ? "Account Suspended" : "Account Reactivated",
                message: block
                    ? `Your account has been suspended. Reason: ${reason || 'Violation of terms of service'}`
                    : "Your account has been reactivated and is now active.",
                type: 'SYSTEM_ALERT',
                priority: 'HIGH',
                metadata: {
                    action: block ? 'BLOCKED' : 'UNBLOCKED',
                    reason,
                    timestamp: new Date().toISOString()
                }
            });
            // Send email notification
            try {
                yield mailtrap_service_1.mailtrapService.sendHtmlEmail({
                    to: user.email,
                    subject: block ? "Account Suspended - CyberNark" : "Account Reactivated - CyberNark",
                    html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">${block ? 'Account Suspended' : 'Account Reactivated'}</h2>
            
            ${block ? `
              <p>Your CyberNark account has been suspended.</p>
              ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
              <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <p><strong>Important:</strong> You will need to reset your password when your account is reactivated.</p>
              </div>
            ` : `
              <p>Your CyberNark account has been reactivated and is now active.</p>
              <p>You can now log in to your account.</p>
            `}
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL}/loginvendor" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                Go to Login
              </a>
            </div>
            
            ${block ? `
              <p style="color: #666; font-size: 14px;">
                If you believe this is a mistake, please contact our support team.
              </p>
            ` : ''}
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">© ${new Date().getFullYear()} CyberNark. All rights reserved.</p>
          </div>
        `
                });
            }
            catch (error) {
                console.error("Failed to send account status email:", error);
            }
            return updatedUser;
        });
    },
    // =============== Delete Permanently User ==================
    permanentDeleteUser(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const user = yield prisma_1.prisma.user.findUnique({
                where: { id: userId },
                include: {
                    vendorProfile: true,
                    supplierProfile: true,
                    subscription: true
                }
            });
            if (!user) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "User not found");
            }
            let totalDeletedCount = 0;
            const deletedCounts = {
                user: 0,
                vendor: 0,
                supplier: 0,
                subscription: 0,
                payments: 0,
                invoices: 0,
                assessments: 0,
                assessmentCategories: 0,
                assessmentQuestions: 0,
                assessmentSubmissions: 0,
                assessmentAnswers: 0,
                reports: 0,
                problems: 0,
                problemMessages: 0,
                notifications: 0,
                notificationPreferences: 0,
                documents: 0,
                activityLogs: 0,
                otps: 0
            };
            try {
                // Delete in proper order (reverse of creation)
                // Start with related records that have foreign keys to user
                // 1. Delete OTPs
                const otpResult = yield prisma_1.prisma.oTP.deleteMany({
                    where: { userId }
                });
                deletedCounts.otps = otpResult.count;
                totalDeletedCount += otpResult.count;
                // 2. Delete Activity Logs
                const activityLogsResult = yield prisma_1.prisma.activityLog.deleteMany({
                    where: { userId }
                });
                deletedCounts.activityLogs = activityLogsResult.count;
                totalDeletedCount += activityLogsResult.count;
                // 3. Delete Notifications and Preferences
                const notificationsResult = yield prisma_1.prisma.notification.deleteMany({
                    where: { userId }
                });
                deletedCounts.notifications = notificationsResult.count;
                totalDeletedCount += notificationsResult.count;
                // Delete notification preferences
                const preferencesResult = yield prisma_1.prisma.notificationPreferences.deleteMany({
                    where: { userId }
                });
                deletedCounts.notificationPreferences = preferencesResult.count;
                totalDeletedCount += preferencesResult.count;
                // 4. Delete Problem Messages
                const problemMessagesResult = yield prisma_1.prisma.problemMessage.deleteMany({
                    where: { senderId: userId }
                });
                deletedCounts.problemMessages = problemMessagesResult.count;
                totalDeletedCount += problemMessagesResult.count;
                // 5. Delete Problems (where user is reporter or assignee)
                const problemsResult = yield prisma_1.prisma.problem.deleteMany({
                    where: {
                        OR: [
                            { reportedById: userId },
                            { assignedToId: userId }
                        ]
                    }
                });
                deletedCounts.problems = problemsResult.count;
                totalDeletedCount += problemsResult.count;
                // 6. Delete Documents
                const documentsResult = yield prisma_1.prisma.document.deleteMany({
                    where: { uploadedById: userId }
                });
                deletedCounts.documents = documentsResult.count;
                totalDeletedCount += documentsResult.count;
                // 7. Handle Assessment-related deletions
                if (user.role === 'SUPPLIER') {
                    // Delete assessment answers
                    const assessmentAnswersResult = yield prisma_1.prisma.assessmentAnswer.deleteMany({
                        where: {
                            submission: { userId }
                        }
                    });
                    deletedCounts.assessmentAnswers = assessmentAnswersResult.count;
                    totalDeletedCount += assessmentAnswersResult.count;
                    // Delete assessment submissions
                    const submissionsResult = yield prisma_1.prisma.assessmentSubmission.deleteMany({
                        where: { userId }
                    });
                    deletedCounts.assessmentSubmissions = submissionsResult.count;
                    totalDeletedCount += submissionsResult.count;
                }
                if (user.role === 'VENDOR') {
                    // Vendor-specific deletions
                    const vendorId = (_a = user.vendorProfile) === null || _a === void 0 ? void 0 : _a.id;
                    if (vendorId) {
                        // Get all suppliers of this vendor to delete their data
                        const suppliers = yield prisma_1.prisma.supplier.findMany({
                            where: { vendorId },
                            select: { id: true, userId: true }
                        });
                        for (const supplier of suppliers) {
                            if (supplier.userId) {
                                // Delete supplier's assessment answers
                                const supplierAnswersResult = yield prisma_1.prisma.assessmentAnswer.deleteMany({
                                    where: {
                                        submission: { supplierId: supplier.id }
                                    }
                                });
                                deletedCounts.assessmentAnswers += supplierAnswersResult.count;
                                totalDeletedCount += supplierAnswersResult.count;
                                // Delete supplier's submissions
                                const supplierSubmissionsResult = yield prisma_1.prisma.assessmentSubmission.deleteMany({
                                    where: { supplierId: supplier.id }
                                });
                                deletedCounts.assessmentSubmissions += supplierSubmissionsResult.count;
                                totalDeletedCount += supplierSubmissionsResult.count;
                            }
                        }
                        // Delete vendor's assessments and related data
                        const assessments = yield prisma_1.prisma.assessment.findMany({
                            where: { vendorId },
                            select: { id: true }
                        });
                        for (const assessment of assessments) {
                            // Delete assessment answers
                            const assessmentAnswersResult = yield prisma_1.prisma.assessmentAnswer.deleteMany({
                                where: {
                                    submission: { assessmentId: assessment.id }
                                }
                            });
                            deletedCounts.assessmentAnswers += assessmentAnswersResult.count;
                            totalDeletedCount += assessmentAnswersResult.count;
                            // Delete assessment submissions
                            const assessmentSubmissionsResult = yield prisma_1.prisma.assessmentSubmission.deleteMany({
                                where: { assessmentId: assessment.id }
                            });
                            deletedCounts.assessmentSubmissions += assessmentSubmissionsResult.count;
                            totalDeletedCount += assessmentSubmissionsResult.count;
                            // Delete assessment questions
                            const questionsResult = yield prisma_1.prisma.assessmentQuestion.deleteMany({
                                where: {
                                    category: { assessmentId: assessment.id }
                                }
                            });
                            deletedCounts.assessmentQuestions += questionsResult.count;
                            totalDeletedCount += questionsResult.count;
                            // Delete assessment categories
                            const categoriesResult = yield prisma_1.prisma.assessmentCategory.deleteMany({
                                where: { assessmentId: assessment.id }
                            });
                            deletedCounts.assessmentCategories += categoriesResult.count;
                            totalDeletedCount += categoriesResult.count;
                        }
                        // Delete assessments
                        const assessmentsResult = yield prisma_1.prisma.assessment.deleteMany({
                            where: { vendorId }
                        });
                        deletedCounts.assessments = assessmentsResult.count;
                        totalDeletedCount += assessmentsResult.count;
                    }
                }
                // 8. Delete Reports
                const reportsResult = yield prisma_1.prisma.report.deleteMany({
                    where: {
                        OR: [
                            { createdById: userId },
                            { generatedForId: userId }
                        ]
                    }
                });
                deletedCounts.reports = reportsResult.count;
                totalDeletedCount += reportsResult.count;
                // 9. Delete Payments and Invoices
                if (user.subscription) {
                    const subscriptionId = user.subscription.id;
                    // Delete payments
                    const paymentsResult = yield prisma_1.prisma.payment.deleteMany({
                        where: { subscriptionId }
                    });
                    deletedCounts.payments = paymentsResult.count;
                    totalDeletedCount += paymentsResult.count;
                }
                // 10. Delete Payments made by user
                const userPaymentsResult = yield prisma_1.prisma.payment.deleteMany({
                    where: { userId }
                });
                deletedCounts.payments += userPaymentsResult.count;
                totalDeletedCount += userPaymentsResult.count;
                // 11. Delete Subscription
                if (user.subscription) {
                    yield prisma_1.prisma.subscription.delete({
                        where: { id: user.subscription.id }
                    });
                    deletedCounts.subscription = 1;
                    totalDeletedCount += 1;
                }
                // 12. Delete Supplier Profile and related user if exists
                if (user.supplierProfile) {
                    const supplierId = user.supplierProfile.id;
                    // Delete supplier problems
                    yield prisma_1.prisma.problem.deleteMany({
                        where: { supplierId }
                    });
                    // Delete supplier documents
                    yield prisma_1.prisma.document.deleteMany({
                        where: { supplierId }
                    });
                    // Delete supplier from supplier table
                    yield prisma_1.prisma.supplier.delete({
                        where: { id: supplierId }
                    });
                    deletedCounts.supplier = 1;
                    totalDeletedCount += 1;
                }
                // 13. Delete Vendor Profile and all related data
                if (user.vendorProfile) {
                    const vendorId = user.vendorProfile.id;
                    // Get all suppliers of this vendor
                    const vendorSuppliers = yield prisma_1.prisma.supplier.findMany({
                        where: { vendorId },
                        select: { id: true, userId: true }
                    });
                    // Delete each supplier and their user
                    for (const supplier of vendorSuppliers) {
                        if (supplier.userId && supplier.userId !== userId) {
                            // Delete supplier's user separately (this will trigger cascade)
                            try {
                                yield this.permanentDeleteUser(supplier.userId);
                            }
                            catch (error) {
                                console.warn(`Failed to delete supplier user ${supplier.userId}:`, error);
                            }
                        }
                        // Delete supplier record
                        yield prisma_1.prisma.supplier.delete({
                            where: { id: supplier.id }
                        });
                    }
                    // Delete vendor reports
                    yield prisma_1.prisma.report.deleteMany({
                        where: { vendorId }
                    });
                    // Delete vendor documents
                    yield prisma_1.prisma.document.deleteMany({
                        where: { vendorId }
                    });
                    // Delete vendor from vendor table
                    yield prisma_1.prisma.vendor.delete({
                        where: { id: vendorId }
                    });
                    deletedCounts.vendor = 1;
                    totalDeletedCount += 1;
                }
                // 14. Finally delete the User
                yield prisma_1.prisma.user.delete({
                    where: { id: userId }
                });
                deletedCounts.user = 1;
                totalDeletedCount += 1;
                return {
                    message: `User permanently deleted. ${totalDeletedCount} records removed from database.`,
                    deletedCount: totalDeletedCount,
                };
            }
            catch (error) {
                console.error("Error during user deletion:", error);
                throw new ApiError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, "Failed to delete user. Please try again or contact support.");
            }
        });
    },
    // ========== BULK OPERATIONS ==========
    bulkUpdateUsers(userIds, data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (userIds.length === 0) {
                throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, "No user IDs provided");
            }
            // Validate email uniqueness if email is being updated
            if (data.email) {
                const existingUsers = yield prisma_1.prisma.user.findMany({
                    where: {
                        email: data.email,
                        id: { notIn: userIds }
                    }
                });
                if (existingUsers.length > 0) {
                    throw new ApiError_1.default(http_status_1.default.CONFLICT, "Email already in use by other users");
                }
            }
            const result = yield prisma_1.prisma.user.updateMany({
                where: {
                    id: { in: userIds },
                    status: { not: 'DELETED' } // Don't update deleted users
                },
                data
            });
            // Create activity logs for each user
            const activityLogs = userIds.map(userId => ({
                userId,
                action: "BULK_USER_UPDATE",
                entityType: "USER",
                entityId: userId,
                details: {
                    updatedFields: Object.keys(data),
                    bulkUpdate: true,
                    affectedUsers: userIds.length
                },
                createdAt: new Date()
            }));
            yield prisma_1.prisma.activityLog.createMany({
                data: activityLogs
            });
            return {
                message: `${result.count} users updated successfully`,
                count: result.count
            };
        });
    },
    bulkDeleteUsers(userIds) {
        return __awaiter(this, void 0, void 0, function* () {
            if (userIds.length === 0) {
                throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, "No user IDs provided");
            }
            // Check for users that cannot be deleted
            const users = yield prisma_1.prisma.user.findMany({
                where: {
                    id: { in: userIds },
                    OR: [
                        { status: 'DELETED' },
                        {
                            vendorProfile: {
                                suppliers: {
                                    some: {
                                        isDeleted: false,
                                        isActive: true
                                    }
                                }
                            }
                        },
                        {
                            subscription: {
                                status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] }
                            }
                        }
                    ]
                },
                select: {
                    id: true,
                    email: true,
                    role: true
                }
            });
            if (users.length > 0) {
                const problematicUsers = users.map(u => `${u.email} (${u.role})`).join(', ');
                throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, `Cannot delete the following users: ${problematicUsers}. They may have active relationships.`);
            }
            const result = yield prisma_1.prisma.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                // Update users
                const updateResult = yield tx.user.updateMany({
                    where: {
                        id: { in: userIds }
                    },
                    data: {
                        status: 'DELETED',
                        email: {
                            set: `${Date.now()}_deleted_email@example.com` // <-- dynamic string
                        }
                    }
                });
                // Update vendor profiles
                yield tx.vendor.updateMany({
                    where: {
                        userId: { in: userIds }
                    },
                    data: {
                        isDeleted: true,
                        isActive: false
                    }
                });
                // Update supplier profiles
                yield tx.supplier.updateMany({
                    where: {
                        userId: { in: userIds }
                    },
                    data: {
                        isDeleted: true,
                        isActive: false,
                        invitationStatus: 'REVOKED'
                    }
                });
                // Create activity logs
                const activityLogs = userIds.map(userId => ({
                    userId,
                    action: "BULK_USER_DELETION",
                    entityType: "USER",
                    entityId: userId,
                    details: {
                        bulkDelete: true,
                        totalDeleted: userIds.length
                    },
                    createdAt: new Date()
                }));
                yield tx.activityLog.createMany({
                    data: activityLogs
                });
                return updateResult;
            }));
            return {
                message: `${result.count} users deleted successfully`,
                count: result.count
            };
        });
    },
    bulkBlockUsers(userIds, block, reason) {
        return __awaiter(this, void 0, void 0, function* () {
            if (userIds.length === 0) {
                throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, "No user IDs provided");
            }
            const status = block ? 'SUSPENDED' : 'ACTIVE';
            const result = yield prisma_1.prisma.user.updateMany({
                where: {
                    id: { in: userIds },
                    status: { not: 'DELETED' }
                },
                data: {
                    status,
                    needPasswordChange: block ? true : false
                }
            });
            const activityLogs = userIds.map(userId => ({
                userId,
                action: block ? "BULK_USER_BLOCK" : "BULK_USER_UNBLOCK",
                entityType: "USER",
                entityId: userId,
                details: {
                    bulkAction: true,
                    newStatus: status,
                    reason,
                    affectedUsers: userIds.length
                },
                createdAt: new Date()
            }));
            yield prisma_1.prisma.activityLog.createMany({
                data: activityLogs
            });
            yield notification_service_1.NotificationService.createNotification({
                userIds,
                title: block ? "Account Suspended" : "Account Reactivated",
                message: block
                    ? `Your account has been suspended. Reason: ${reason || 'Violation of terms of service'}`
                    : "Your account has been reactivated and is now active.",
                type: 'SYSTEM_ALERT',
                priority: 'HIGH',
                metadata: {
                    action: block ? 'BULK_BLOCKED' : 'BULK_UNBLOCKED',
                    reason,
                    timestamp: new Date().toISOString()
                }
            });
            return {
                message: `${result.count} users ${block ? 'blocked' : 'unblocked'} successfully`,
                count: result.count
            };
        });
    },
    // ========== BULK VERIFY USERS ==========
    bulkVerifyUsers(userIds) {
        return __awaiter(this, void 0, void 0, function* () {
            if (userIds.length === 0) {
                throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, "No user IDs provided");
            }
            const result = yield prisma_1.prisma.user.updateMany({
                where: {
                    id: { in: userIds },
                    isVerified: false
                },
                data: {
                    isVerified: true,
                    emailVerifiedAt: new Date()
                }
            });
            const activityLogs = userIds.map(userId => ({
                userId,
                action: "BULK_EMAIL_VERIFIED",
                entityType: "USER",
                entityId: userId,
                details: {
                    bulkVerification: true,
                    verifiedBy: "ADMIN",
                    affectedUsers: userIds.length
                },
                createdAt: new Date()
            }));
            yield prisma_1.prisma.activityLog.createMany({
                data: activityLogs
            });
            return {
                message: `${result.count} users verified successfully`,
                count: result.count
            };
        });
    },
    // ========== DEACTIVATE INACTIVE USERS ==========
    deactivateInactiveUsers() {
        return __awaiter(this, arguments, void 0, function* (inactiveDays = 90) {
            const cutoffDate = new Date(Date.now() - inactiveDays * 24 * 60 * 60 * 1000);
            const result = yield prisma_1.prisma.user.updateMany({
                where: {
                    status: 'ACTIVE',
                    lastLoginAt: { lt: cutoffDate },
                    isVerified: true,
                    role: { not: 'ADMIN' } // Don't deactivate admins automatically
                },
                data: {
                    status: 'INACTIVE'
                }
            });
            if (result.count > 0) {
                yield prisma_1.prisma.activityLog.create({
                    data: {
                        userId: "SYSTEM", // <-- required field
                        action: "AUTO_DEACTIVATE_INACTIVE",
                        entityType: "SYSTEM",
                        entityId: "INACTIVE_USERS",
                        details: {
                            count: result.count,
                            inactiveDays,
                            cutoffDate: cutoffDate.toISOString()
                        }
                    }
                });
            }
            return {
                message: `${result.count} inactive users deactivated`,
                count: result.count
            };
        });
    },
    // ========== EXPORT USERS TO CSV ==========
    exportUsersToCSV() {
        return __awaiter(this, arguments, void 0, function* (filters = {}) {
            const users = yield prisma_1.prisma.user.findMany({
                where: this.buildWhereClause(filters),
                include: {
                    vendorProfile: {
                        select: {
                            companyName: true,
                            businessEmail: true
                        }
                    },
                    supplierProfile: {
                        select: {
                            name: true,
                            vendor: {
                                select: {
                                    companyName: true
                                }
                            }
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            });
            const headers = [
                'ID',
                'Email',
                'Role',
                'Status',
                'Verified',
                'Company/Supplier Name',
                'Phone Number',
                'Created At',
                'Last Login',
                'Profile Image'
            ];
            const rows = users.map(user => {
                var _a, _b;
                return [
                    user.id,
                    user.email,
                    user.role,
                    user.status,
                    user.isVerified ? 'Yes' : 'No',
                    user.role === 'VENDOR'
                        ? (_a = user.vendorProfile) === null || _a === void 0 ? void 0 : _a.companyName
                        : user.role === 'SUPPLIER'
                            ? (_b = user.supplierProfile) === null || _b === void 0 ? void 0 : _b.name
                            : 'N/A',
                    user.phoneNumber || 'N/A',
                    user.createdAt.toISOString(),
                    user.lastLoginAt ? user.lastLoginAt.toISOString() : 'Never',
                    user.profileImage || 'No image'
                ];
            });
            const csvData = [
                headers.join(','),
                ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
            ].join('\n');
            return {
                csvData,
                count: users.length
            };
        });
    },
    // ========== HELPER: BUILD WHERE CLAUSE ==========
    buildWhereClause(filters) {
        const where = {};
        if (filters.role) {
            where.role = filters.role;
        }
        if (filters.status) {
            where.status = filters.status;
        }
        if (filters.isVerified !== undefined) {
            where.isVerified = filters.isVerified;
        }
        if (filters.search) {
            where.OR = [
                { email: { contains: filters.search, mode: 'insensitive' } },
                { phoneNumber: { contains: filters.search, mode: 'insensitive' } }
            ];
        }
        if (filters.createdAtFrom || filters.createdAtTo) {
            where.createdAt = {};
            if (filters.createdAtFrom)
                where.createdAt.gte = new Date(filters.createdAtFrom);
            if (filters.createdAtTo)
                where.createdAt.lte = new Date(filters.createdAtTo);
        }
        return where;
    },
    getUserById(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield prisma_1.prisma.user.findUnique({
                where: { id: userId },
                include: {
                    vendorProfile: {
                        select: {
                            id: true,
                            companyName: true,
                            businessEmail: true,
                            isActive: true,
                            suppliers: true
                        },
                    },
                    supplierProfile: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                    subscription: true,
                    _count: {
                        select: {
                            activityLogs: true,
                            notifications: true,
                        },
                    },
                },
            });
            if (!user) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "User not found");
            }
            return user;
        });
    }
};
