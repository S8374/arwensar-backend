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
exports.VendorService = void 0;
// src/modules/vendor/vendor.service.ts
const client_1 = require("@prisma/client");
const prisma_1 = require("../../shared/prisma");
const http_status_1 = __importDefault(require("http-status"));
const ApiError_1 = __importDefault(require("../../../error/ApiError"));
const bivRiskCalculator_1 = require("../../../logic/bivRiskCalculator");
const mailtrap_service_1 = require("../../shared/mailtrap.service");
const jwtHelper_1 = require("../../helper/jwtHelper");
const config_1 = require("../../../config");
const vendor_logic_1 = require("../../../logic/vendor.logic");
exports.VendorService = {
    // ========== GET VENDOR DASHBOARD STATS ==========
    getVendorDashboardStats(vendorId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            // Verify vendor exists
            const vendor = yield prisma_1.prisma.vendor.findUnique({
                where: { id: vendorId },
                include: {
                    user: {
                        select: {
                            id: true,
                            lastLoginAt: true
                        }
                    }
                }
            });
            if (!vendor) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "Vendor not found");
            }
            // Get today's date range
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            const thirtyDaysAgo = new Date(today);
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            // Get all active suppliers for this vendor
            const suppliers = yield prisma_1.prisma.supplier.findMany({
                where: {
                    vendorId,
                    isDeleted: false,
                    isActive: true
                },
                include: {
                    assessmentSubmissions: {
                        where: {
                            submittedAt: { not: null }
                        },
                        orderBy: { submittedAt: 'desc' },
                        take: 1
                    }
                }
            });
            // Get supplier IDs for batch queries
            const supplierIds = suppliers.map(s => s.id);
            // Execute all queries in parallel for performance
            const [assessments, problems, contracts, documents, activities, notifications] = yield Promise.all([
                // 1. Get all assessments for these suppliers
                prisma_1.prisma.assessmentSubmission.findMany({
                    where: {
                        supplierId: { in: supplierIds },
                        status: { in: ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', "PENDING"] }
                    },
                    include: {
                        assessment: {
                            select: {
                                title: true,
                                stage: true
                            }
                        }
                    },
                    orderBy: { submittedAt: 'desc' },
                    take: 20
                }),
                // 2. Get all active problems for these suppliers
                prisma_1.prisma.problem.findMany({
                    where: {
                        supplierId: { in: supplierIds },
                        status: { in: ['OPEN', 'IN_PROGRESS', 'ESCALATED'] }
                    }
                }),
                // 3. Get contract data for these suppliers
                prisma_1.prisma.supplier.findMany({
                    where: {
                        id: { in: supplierIds },
                        contractEndDate: { not: null }
                    },
                    select: {
                        id: true,
                        name: true,
                        contractEndDate: true,
                        contractStartDate: true,
                        totalContractValue: true,
                        outstandingPayments: true
                    },
                    orderBy: { contractEndDate: 'asc' }
                }),
                // 4. Get document statistics for these suppliers
                prisma_1.prisma.document.findMany({
                    where: {
                        OR: [
                            { vendorId: vendorId },
                            { supplierId: { in: supplierIds } }
                        ]
                    },
                    select: {
                        status: true,
                        expiryDate: true,
                        isVerified: true,
                        createdAt: true,
                        supplierId: true,
                        vendorId: true
                    }
                }),
                // 5. Get recent activities for vendor user
                prisma_1.prisma.activityLog.findMany({
                    where: {
                        userId: vendor.userId,
                        createdAt: { gte: thirtyDaysAgo }
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 50
                }),
                // 6. Get unread notifications for vendor user
                prisma_1.prisma.notification.count({
                    where: {
                        userId: vendor.userId,
                        isRead: false,
                        isDeleted: false
                    }
                })
            ]);
            // Enrich assessments with supplier names
            const enrichedAssessments = yield Promise.all(assessments.map((assessment) => __awaiter(this, void 0, void 0, function* () {
                const supplier = yield prisma_1.prisma.supplier.findUnique({
                    where: { id: assessment.supplierId },
                    select: { name: true, email: true }
                });
                return Object.assign(Object.assign({}, assessment), { supplier: supplier || { name: 'Unknown', email: 'Unknown' } });
            })));
            // Enrich problems with supplier names
            const enrichedProblems = yield Promise.all(problems.map((problem) => __awaiter(this, void 0, void 0, function* () {
                const supplier = yield prisma_1.prisma.supplier.findUnique({
                    where: { id: problem.supplierId },
                    select: { name: true, email: true }
                });
                const reportedByUser = yield prisma_1.prisma.user.findUnique({
                    where: { id: problem.reportedById },
                    select: { email: true, role: true }
                });
                return Object.assign(Object.assign({}, problem), { supplier: supplier || { name: 'Unknown', email: 'Unknown' }, reportedBy: reportedByUser || { email: 'Unknown', role: 'Unknown' } });
            })));
            const sendedAlertNotifications = yield prisma_1.prisma.notification.findMany({
                where: {
                    userId: vendor.userId,
                    isRead: false,
                    isDeleted: false
                }
            });
            // Filter documents that belong to this vendor
            const filteredDocuments = documents.filter(doc => {
                if (doc.vendorId === vendorId)
                    return true;
                if (doc.supplierId && supplierIds.includes(doc.supplierId))
                    return true;
                return false;
            });
            // Enrich suppliers with their problems count
            const suppliersWithProblems = yield Promise.all(suppliers.map((supplier) => __awaiter(this, void 0, void 0, function* () {
                const supplierProblems = yield prisma_1.prisma.problem.count({
                    where: {
                        supplierId: supplier.id,
                        status: { in: ['OPEN', 'IN_PROGRESS'] }
                    }
                });
                return Object.assign(Object.assign({}, supplier), { problemCount: supplierProblems });
            })));
            // ========== CALCULATE NIS2 COMPLIANCE ==========
            const nis2Compliance = (0, vendor_logic_1.calculateNIS2Compliance)(suppliers, today, yesterday);
            // ========== CALCULATE SUPPLIER STATS ==========
            const supplierStats = (0, vendor_logic_1.calculateSupplierStats)(suppliersWithProblems, vendorId, thirtyDaysAgo);
            // ========== CALCULATE ASSESSMENT STATS ==========
            const assessmentStats = (0, vendor_logic_1.calculateAssessmentStats)(enrichedAssessments, suppliers);
            // ========== CALCULATE PROBLEM STATS ==========
            const problemStats = (0, vendor_logic_1.calculateProblemStats)(enrichedProblems);
            // ========== CALCULATE CONTRACT STATS ==========
            const contractStats = (0, vendor_logic_1.calculateContractStats)(contracts, today, suppliers);
            // ========== CALCULATE COMPLIANCE OVERVIEW ==========
            const complianceOverview = (0, vendor_logic_1.calculateComplianceOverview)(suppliers);
            // ========== CALCULATE COMPLIANCE GAUGE ==========
            const complianceGauge = (0, vendor_logic_1.calculateComplianceGauge)(suppliers, enrichedAssessments, enrichedProblems, filteredDocuments, sendedAlertNotifications);
            // ========== CALCULATE ADDITIONAL STATS ==========
            const additionalStats = (0, vendor_logic_1.calculateAdditionalStats)(filteredDocuments, contracts, suppliers, activities, notifications, (_a = vendor.user) === null || _a === void 0 ? void 0 : _a.lastLoginAt);
            // ========== CALCULATE CHARTS DATA ==========
            const charts = (0, vendor_logic_1.calculateChartsData)(enrichedAssessments, enrichedProblems, suppliers, thirtyDaysAgo);
            // ========== CALCULATE RECENT UPDATES ==========
            const recentUpdates = (0, vendor_logic_1.calculateRecentUpdates)(enrichedAssessments, enrichedProblems, filteredDocuments, contracts, suppliers);
            return {
                nis2Compliance,
                supplierStats,
                assessmentStats,
                problemStats,
                contractStats,
                complianceOverview,
                complianceGauge,
                additionalStats,
                charts,
                recentUpdates
            };
        });
    },
    // ========== GET QUICK STATS (For dashboard cards) ==========
    getQuickStats(vendorId) {
        return __awaiter(this, void 0, void 0, function* () {
            const dashboardStats = yield this.getVendorDashboardStats(vendorId);
            return {
                // NIS2 Compliance Card
                nis2Score: dashboardStats.nis2Compliance.overallScore,
                nis2Trend: dashboardStats.nis2Compliance.trend,
                nis2Improvement: dashboardStats.nis2Compliance.todayImprovement,
                // Supplier Assessment Card
                pendingAssessments: dashboardStats.assessmentStats.pendingAssessments,
                assessmentCompletion: dashboardStats.assessmentStats.submissionRate,
                // Active Problems Card
                activeProblems: dashboardStats.problemStats.activeProblems,
                criticalProblems: dashboardStats.problemStats.criticalProblems,
                averageResolution: dashboardStats.problemStats.averageResolutionTime,
                // Expiring Contracts Card
                expiringContracts: dashboardStats.contractStats.expiringContracts,
                expiredContracts: dashboardStats.contractStats.expiredContracts,
                // Compliance Overview Card
                complianceOverview: {
                    lowRisk: dashboardStats.complianceOverview.lowRisk,
                    mediumRisk: dashboardStats.complianceOverview.mediumRisk,
                    highRisk: dashboardStats.complianceOverview.highRisk,
                    riskDistribution: dashboardStats.complianceOverview.riskDistribution
                },
                // Compliance Gauge Card
                complianceGauge: {
                    compliant: dashboardStats.complianceGauge.compliantSuppliers,
                    nonCompliant: dashboardStats.complianceGauge.nonCompliantSuppliers,
                    compliancePercentage: dashboardStats.complianceGauge.compliancePercentage,
                    nis2Compliant: dashboardStats.complianceGauge.nis2Compliant
                }
            };
        });
    },
    // ========== PROFILE MANAGEMENT ==========
    getVendorProfile(vendorId) {
        return __awaiter(this, void 0, void 0, function* () {
            const vendor = yield prisma_1.prisma.vendor.findUnique({
                where: { id: vendorId },
                include: {
                    user: {
                        include: {
                            subscription: {
                                include: {
                                    plan: true
                                }
                            },
                            notificationPreferences: true
                        }
                    }
                }
            });
            if (!vendor) {
                return null;
            }
            // Transform the response for better structure
            return {
                id: vendor.id,
                companyName: vendor.companyName,
                businessEmail: vendor.businessEmail,
                contactNumber: vendor.contactNumber,
                industryType: vendor.industryType,
                firstName: vendor.firstName,
                lastName: vendor.lastName,
                companyLogo: vendor.companyLogo,
                isActive: vendor.isActive,
                createdAt: vendor.createdAt,
                updatedAt: vendor.updatedAt,
                user: {
                    id: vendor.user.id,
                    email: vendor.user.email,
                    role: vendor.user.role,
                    status: vendor.user.status,
                    isVerified: vendor.user.isVerified,
                    createdAt: vendor.user.createdAt
                },
                subscription: vendor.user.subscription ? {
                    id: vendor.user.subscription.id,
                    status: vendor.user.subscription.status,
                    billingCycle: vendor.user.subscription.billingCycle,
                    currentPeriodStart: vendor.user.subscription.currentPeriodStart,
                    currentPeriodEnd: vendor.user.subscription.currentPeriodEnd,
                    trialStart: vendor.user.subscription.trialStart,
                    trialEnd: vendor.user.subscription.trialEnd,
                    plan: vendor.user.subscription.plan
                } : null,
                notificationPreferences: vendor.user.notificationPreferences
            };
        });
    },
    updateVendorProfile(vendorId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const vendor = yield prisma_1.prisma.vendor.findUnique({
                where: { id: vendorId }
            });
            if (!vendor) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "Vendor not found");
            }
            // Check if business email is being updated and if it's already taken
            if (data.businessEmail && data.businessEmail !== vendor.businessEmail) {
                const existingVendor = yield prisma_1.prisma.vendor.findUnique({
                    where: { businessEmail: data.businessEmail }
                });
                if (existingVendor) {
                    throw new ApiError_1.default(http_status_1.default.CONFLICT, "Business email already in use");
                }
            }
            const updatedVendor = yield prisma_1.prisma.vendor.update({
                where: { id: vendorId },
                data: {
                    companyName: data.companyName,
                    businessEmail: data.businessEmail,
                    contactNumber: data.contactNumber,
                    industryType: data.industryType,
                    firstName: data.firstName,
                    lastName: data.lastName,
                    companyLogo: data.companyLogo
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                            role: true,
                            status: true
                        }
                    }
                }
            });
            // Create activity log
            yield prisma_1.prisma.activityLog.create({
                data: {
                    userId: updatedVendor.userId,
                    action: "UPDATE_PROFILE",
                    entityType: "VENDOR",
                    entityId: vendorId,
                    details: { updatedFields: Object.keys(data) }
                }
            });
            return updatedVendor;
        });
    },
    // ========== SUPPLIER MANAGEMENT ==========
    getSuppliers(vendorId) {
        return __awaiter(this, void 0, void 0, function* () {
            return prisma_1.prisma.supplier.findMany({
                where: {
                    vendorId,
                    isDeleted: false
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                            status: true,
                            isVerified: true,
                        }
                    },
                    assessmentSubmissions: {
                        where: { status: 'APPROVED' },
                        orderBy: { submittedAt: 'desc' },
                        take: 1
                    },
                },
                orderBy: { createdAt: 'desc' }
            });
        });
    },
    getSupplierById(vendorId, supplierId) {
        return __awaiter(this, void 0, void 0, function* () {
            const supplier = yield prisma_1.prisma.supplier.findFirst({
                where: {
                    id: supplierId,
                    vendorId,
                    isDeleted: false
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                            status: true,
                            isVerified: true,
                            createdAt: true,
                            activityLogs: true
                        },
                    },
                    assessmentSubmissions: {
                        include: {
                            assessment: {
                                select: {
                                    id: true,
                                    title: true,
                                    description: true
                                }
                            },
                            answers: {
                                include: {
                                    question: {
                                        select: {
                                            id: true,
                                            question: true,
                                            questionId: true
                                        }
                                    }
                                }
                            }
                        },
                        orderBy: { createdAt: 'desc' }
                    },
                    vendor: {
                        select: {
                            id: true,
                            companyName: true,
                            firstName: true,
                            lastName: true
                        }
                    }
                },
            });
            if (!supplier) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "Supplier not found");
            }
            // Calculate statistics
            const totalSubmissions = supplier.assessmentSubmissions.length;
            const totalAssessments = yield prisma_1.prisma.assessment.count({
                where: {
                    isActive: true
                }
            });
            const pendingSubmissions = supplier.assessmentSubmissions.filter(sub => sub.status === 'PENDING' || sub.status === 'UNDER_REVIEW').length;
            const approvedSubmissions = supplier.assessmentSubmissions.filter(sub => sub.status === 'APPROVED').length;
            const averageScore = supplier.assessmentSubmissions.length > 0 ?
                supplier.assessmentSubmissions.reduce((acc, sub) => { var _a; return acc + (((_a = sub.score) === null || _a === void 0 ? void 0 : _a.toNumber()) || 0); }, 0) / supplier.assessmentSubmissions.length : 0;
            return Object.assign(Object.assign({}, supplier), { statistics: {
                    totalSubmissions,
                    pendingSubmissions,
                    approvedSubmissions,
                    totalAssessments,
                    averageScore: parseFloat(averageScore.toFixed(2)),
                } });
        });
    },
    // ========== ASSESSMENT REVIEW ==========
    reviewAssessment(vendorId, submissionId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const submission = yield prisma_1.prisma.assessmentSubmission.findFirst({
                where: {
                    id: submissionId,
                    vendorId,
                    status: { in: ['SUBMITTED', 'UNDER_REVIEW'] }
                },
                include: {
                    assessment: true,
                    answers: {
                        include: {
                            question: true
                        }
                    }
                }
            });
            if (!submission) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "Assessment submission not found");
            }
            const result = yield prisma_1.prisma.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                // Update submission status
                const updatedSubmission = yield tx.assessmentSubmission.update({
                    where: { id: submissionId },
                    data: {
                        status: data.status,
                        reviewedAt: new Date(),
                        reviewedBy: data.reviewedBy || vendorId,
                        reviewComments: data.reviewComments,
                        reviewerReport: data.reviewerReport
                    }
                });
                // If approved, update supplier scores
                if (data.status === 'APPROVED' && submission.supplierId) {
                    // Calculate BIV scores from answers
                    const businessAnswers = submission.answers.filter(a => a.question.bivCategory === 'BUSINESS');
                    const integrityAnswers = submission.answers.filter(a => a.question.bivCategory === 'INTEGRITY');
                    const availabilityAnswers = submission.answers.filter(a => a.question.bivCategory === 'AVAILABILITY');
                    const businessScore = businessAnswers.length > 0 ?
                        businessAnswers.reduce((sum, a) => { var _a; return sum + (((_a = a.score) === null || _a === void 0 ? void 0 : _a.toNumber()) || 0); }, 0) /
                            businessAnswers.length : 0;
                    const integrityScore = integrityAnswers.length > 0 ?
                        integrityAnswers.reduce((sum, a) => { var _a; return sum + (((_a = a.score) === null || _a === void 0 ? void 0 : _a.toNumber()) || 0); }, 0) /
                            integrityAnswers.length : 0;
                    const availabilityScore = availabilityAnswers.length > 0 ?
                        availabilityAnswers.reduce((sum, a) => { var _a; return sum + (((_a = a.score) === null || _a === void 0 ? void 0 : _a.toNumber()) || 0); }, 0) /
                            availabilityAnswers.length : 0;
                    const bivResult = (0, bivRiskCalculator_1.calculateBIVScore)({
                        businessScore,
                        integrityScore,
                        availabilityScore
                    });
                    // Update supplier with new scores
                    yield tx.supplier.update({
                        where: { id: submission.supplierId },
                        data: {
                            bivScore: bivResult.bivScore,
                            businessScore,
                            integrityScore,
                            availabilityScore,
                            riskLevel: bivResult.riskLevel,
                            lastAssessmentDate: new Date(),
                            complianceRate: data.complianceRate,
                            nis2Compliant: bivResult.bivScore >= 71 // NIS2 compliant if low risk
                        }
                    });
                }
                // Create notification for supplier
                if (submission.userId) {
                    yield tx.notification.create({
                        data: {
                            userId: submission.userId,
                            title: `Assessment ${data.status.toLowerCase()}`,
                            message: `Your assessment "${submission.assessment.title}" has been ${data.status.toLowerCase()}`,
                            type: data.status === 'APPROVED' ? 'ASSESSMENT_APPROVED' : 'ASSESSMENT_REJECTED',
                            metadata: {
                                submissionId,
                                assessmentId: submission.assessmentId,
                                status: data.status,
                                comments: data.reviewComments
                            }
                        }
                    });
                }
                return updatedSubmission;
            }));
            return result;
        });
    },
    // ========== EVIDENCE REVIEW ==========
    reviewEvidence(vendorId, answerId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const answer = yield prisma_1.prisma.assessmentAnswer.findFirst({
                where: {
                    id: answerId,
                    submission: {
                        vendorId
                    }
                },
                include: {
                    submission: true,
                    question: true
                }
            });
            if (!answer) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "Answer not found");
            }
            const updatedAnswer = yield prisma_1.prisma.assessmentAnswer.update({
                where: { id: answerId },
                data: {
                    evidenceStatus: data.status,
                    evidenceRejectionReason: data.rejectionReason,
                    score: data.score
                }
            });
            // Create notification for supplier
            if (data.status === 'REJECTED' && answer.submission.userId) {
                yield prisma_1.prisma.notification.create({
                    data: {
                        userId: answer.submission.userId,
                        title: "Evidence Rejected",
                        message: `Evidence for question "${answer.question.question}" has been rejected`,
                        type: 'EVIDENCE_REJECTED',
                        metadata: {
                            answerId,
                            questionId: answer.questionId,
                            rejectionReason: data.rejectionReason
                        }
                    }
                });
            }
            return updatedAnswer;
        });
    },
    // ========== UPLOAD DOCUMENT (with storage limit check) ==========
    uploadDocument(vendorId, file, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const fileSizeMB = file.size / (1024 * 1024); // Convert bytes to MB
            // Rest of the uploadDocument implementation...
            // [Your existing uploadDocument code]
        });
    },
    // ========== GET SINGLE SUPPLIER PROGRESS ==========
    getSingleSupplierProgress(supplierId, vendorId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            const supplier = yield prisma_1.prisma.supplier.findFirst({
                where: {
                    id: supplierId,
                    vendorId,
                    isDeleted: false
                },
                include: {
                    assessmentSubmissions: {
                        where: {
                            status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', "PENDING", "DRAFT", "ARCHIVED", "REJECTED"] }
                        },
                        include: {
                            assessment: {
                                select: {
                                    title: true,
                                    stage: true
                                }
                            }
                        },
                        orderBy: { submittedAt: 'desc' }
                    }
                }
            });
            if (!supplier) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "Supplier not found");
            }
            // Calculate progress statistics
            const totalAssessments = supplier.assessmentSubmissions.length;
            const completedAssessments = supplier.assessmentSubmissions.filter(sub => sub.status === 'APPROVED' && sub.stage === "FULL").length;
            // Check if all required assessments are completed
            const initialAssessmentCompleted = supplier.assessmentSubmissions.some(sub => sub.assessment.stage === 'INITIAL' && sub.status === 'APPROVED');
            const fullAssessmentCompleted = supplier.assessmentSubmissions.some(sub => sub.assessment.stage === 'FULL' && sub.status === 'APPROVED');
            const isCompletedAll = initialAssessmentCompleted && fullAssessmentCompleted;
            const progressPercent = isCompletedAll ? 100 : (totalAssessments / 2) * 100;
            // Calculate BIV scores
            let overallBIVScore = null;
            let businessScore = null;
            let integrityScore = null;
            let availabilityScore = null;
            const latestApprovedSubmission = supplier.assessmentSubmissions.find(sub => sub.status === 'APPROVED');
            if (latestApprovedSubmission) {
                overallBIVScore = ((_a = latestApprovedSubmission.bivScore) === null || _a === void 0 ? void 0 : _a.toNumber()) || null;
                businessScore = ((_b = latestApprovedSubmission.businessScore) === null || _b === void 0 ? void 0 : _b.toNumber()) || null;
                integrityScore = ((_c = latestApprovedSubmission.integrityScore) === null || _c === void 0 ? void 0 : _c.toNumber()) || null;
                availabilityScore = ((_d = latestApprovedSubmission.availabilityScore) === null || _d === void 0 ? void 0 : _d.toNumber()) || null;
            }
            return {
                supplierId: supplier.id,
                supplierName: supplier.name,
                totalAssessments,
                completedAssessments,
                isCompletedAll,
                progressPercent,
                riskLevel: supplier.riskLevel,
                overallBIVScore,
                businessScore,
                integrityScore,
                availabilityScore,
                nis2Compliant: supplier.nis2Compliant,
                lastAssessmentDate: supplier.lastAssessmentDate,
                nextAssessmentDue: supplier.nextAssessmentDue,
                assessments: supplier.assessmentSubmissions.map(sub => {
                    var _a;
                    return ({
                        id: sub.id,
                        title: sub.assessment.title,
                        stage: sub.assessment.stage,
                        status: sub.status,
                        score: (_a = sub.score) === null || _a === void 0 ? void 0 : _a.toNumber(),
                        submittedAt: sub.submittedAt
                    });
                })
            };
        });
    },
    // ========== BULK IMPORT SUPPLIERS ==========
    bulkImportSuppliers(vendorId, payload) {
        return __awaiter(this, void 0, void 0, function* () {
            // Check if vendor exists
            const vendor = yield prisma_1.prisma.vendor.findUnique({
                where: { id: vendorId },
                include: {
                    user: { select: { email: true, id: true } },
                },
            });
            if (!vendor || !vendor.user) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "Vendor not found");
            }
            const results = [];
            let successful = 0;
            let failed = 0;
            let skipped = 0;
            // Process suppliers in smaller batches for better performance
            const batchSize = 10;
            const batches = [];
            for (let i = 0; i < payload.suppliers.length; i += batchSize) {
                batches.push(payload.suppliers.slice(i, i + batchSize));
            }
            for (const batch of batches) {
                // Use transaction for each batch
                yield prisma_1.prisma.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                    for (const supplierData of batch) {
                        try {
                            // Check if supplier email already exists (for this vendor)
                            const existingSupplier = yield tx.supplier.findUnique({
                                where: { email: supplierData.email.toLowerCase() },
                            });
                            if (existingSupplier) {
                                // Check if it belongs to the same vendor
                                if (existingSupplier.vendorId === vendorId) {
                                    results.push({
                                        supplier: supplierData,
                                        success: false,
                                        message: "Supplier with this email already exists in your account",
                                    });
                                    failed++;
                                }
                                else {
                                    results.push({
                                        supplier: supplierData,
                                        success: false,
                                        message: "Supplier with this email already exists with another vendor",
                                    });
                                    failed++;
                                }
                                continue;
                            }
                            // Generate invitation token
                            const invitationToken = jwtHelper_1.jwtHelper.generateToken({
                                email: supplierData.email.toLowerCase(),
                                vendorId,
                                type: "supplier_invitation",
                            }, config_1.config.jwt.jwt_secret, "7d");
                            // Prepare supplier data
                            const supplierCreateData = {
                                name: supplierData.name,
                                contactPerson: supplierData.contactPerson,
                                email: supplierData.email.toLowerCase(),
                                phone: supplierData.phone || "",
                                category: supplierData.category,
                                criticality: supplierData.criticality,
                                contractStartDate: new Date(supplierData.contractStartDate),
                                contractEndDate: supplierData.contractEndDate
                                    ? new Date(supplierData.contractEndDate)
                                    : null,
                                vendorId,
                                invitationToken,
                                invitationSentAt: new Date(),
                                invitationStatus: client_1.InvitationStatus.SENT,
                                isActive: false,
                            };
                            // Create supplier
                            yield tx.supplier.create({
                                data: supplierCreateData,
                            });
                            // Try to send invitation email (don't fail the whole import if email fails)
                            let invitationSent = false;
                            try {
                                yield mailtrap_service_1.mailtrapService.sendHtmlEmail({
                                    to: supplierData.email.toLowerCase(),
                                    subject: `Invitation to Join ${vendor.companyName} on CyberNark`,
                                    html: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333;">You're Invited to Join CyberNark!</h2>
                    <p>${vendor.firstName || ""} ${vendor.lastName || ""} from <strong>${vendor.companyName}</strong> has invited you to join their supplier network on CyberNark.</p>
                    
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
                      <h3 style="margin-top: 0;">Supplier Details:</h3>
                      <p><strong>Name:</strong> ${supplierData.name}</p>
                      <p><strong>Contact Person:</strong> ${supplierData.contactPerson}</p>
                      <p><strong>Category:</strong> ${supplierData.category}</p>
                      <p><strong>Criticality:</strong> ${supplierData.criticality}</p>
                      ${supplierData.contractStartDate
                                        ? `<p><strong>Contract Start:</strong> ${new Date(supplierData.contractStartDate).toLocaleDateString()}</p>`
                                        : ""}
                      ${supplierData.contractEndDate
                                        ? `<p><strong>Contract End:</strong> ${new Date(supplierData.contractEndDate).toLocaleDateString()}</p>`
                                        : ""}
                    </div>
                    
                    <p>To complete your registration and access the platform, please click the button below:</p>
                    
                    <div style="text-align: center; margin: 30px 0;">
                      <a href="${config_1.config.APP.WEBSITE}/supplier/register?token=${invitationToken}" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                        Complete Registration
                      </a>
                    </div>
                    
                    <p style="color: #666; font-size: 14px;">
                      <strong>Note:</strong> This invitation link will expire in 7 days. If you have any questions, please contact ${vendor.companyName} directly.
                    </p>
                    
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="color: #666; font-size: 12px;">© ${new Date().getFullYear()} CyberNark. All rights reserved.</p>
                  </div>
                `,
                                });
                                invitationSent = true;
                            }
                            catch (emailError) {
                                console.error(`Failed to send email to ${supplierData.email}:`, emailError);
                                // Continue even if email fails
                            }
                            results.push({
                                supplier: supplierData,
                                success: true,
                                message: "Supplier created successfully",
                                invitationSent,
                            });
                            successful++;
                        }
                        catch (error) {
                            console.error(`Error creating supplier ${supplierData.email}:`, error);
                            results.push({
                                supplier: supplierData,
                                success: false,
                                message: error.message || "Failed to create supplier",
                            });
                            failed++;
                        }
                    }
                }));
            }
            return {
                total: payload.suppliers.length,
                successful,
                failed,
                results
            };
        });
    },
    resendInvitation(supplierId, vendorId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Check if vendor exists
            const vendor = yield prisma_1.prisma.vendor.findUnique({
                where: { id: vendorId },
                include: {
                    user: {
                        select: { email: true }
                    }
                }
            });
            if (!vendor) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "Vendor not found");
            }
            // Check if supplier exists and belongs to vendor
            const supplier = yield prisma_1.prisma.supplier.findFirst({
                where: {
                    id: supplierId,
                    vendorId: vendorId,
                    isDeleted: false,
                    invitationStatus: {
                        in: [client_1.InvitationStatus.PENDING, client_1.InvitationStatus.SENT, client_1.InvitationStatus.EXPIRED]
                    }
                }
            });
            if (!supplier) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "Supplier not found or invitation already accepted");
            }
            // Check if supplier is already active (has user account)
            if (supplier.isActive) {
                throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, "Supplier is already active and has an account");
            }
            // Generate new invitation token
            const invitationToken = jwtHelper_1.jwtHelper.generateToken({
                email: supplier.email,
                vendorId: vendorId,
                type: 'supplier_invitation'
            }, config_1.config.jwt.jwt_secret, '7d' // Token valid for 7 days
            );
            const result = yield prisma_1.prisma.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                // Update supplier with new token
                const updatedSupplier = yield tx.supplier.update({
                    where: { id: supplierId },
                    data: {
                        invitationToken: invitationToken,
                        invitationSentAt: new Date(),
                        invitationStatus: client_1.InvitationStatus.SENT,
                        // Reset invitation accepted fields
                        invitationAcceptedAt: null
                    }
                });
                return updatedSupplier;
            }));
            // Send invitation email
            try {
                yield mailtrap_service_1.mailtrapService.sendHtmlEmail({
                    to: supplier.email,
                    subject: `Invitation Reminder from ${vendor.companyName} on CyberNark`,
                    html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Invitation Reminder - Join CyberNark!</h2>
          <p>This is a reminder that ${vendor.firstName || ''} ${vendor.lastName || ''} from 
          <strong>${vendor.companyName}</strong> has invited you to join their supplier network on CyberNark.</p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Supplier Details:</h3>
            <p><strong>Name:</strong> ${supplier.name}</p>
            <p><strong>Contact Person:</strong> ${supplier.contactPerson}</p>
            <p><strong>Category:</strong> ${supplier.category}</p>
            <p><strong>Criticality:</strong> ${supplier.criticality}</p>
          </div>
          
          <p>To complete your registration and access the platform, please click the button below:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${config_1.config.APP.WEBSITE}/supplier/register?token=${invitationToken}" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
              Complete Registration
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px;">
            <strong>Note:</strong> This invitation link will expire in 7 days. If you have already registered, please ignore this email.
          </p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">© ${new Date().getFullYear()} CyberNark. All rights reserved.</p>
        </div>
      `
                });
                return {
                    supplier: result,
                    invitationSent: true,
                    message: "Invitation resent successfully"
                };
            }
            catch (emailError) {
                console.error("Failed to resend invitation email:", emailError);
                return {
                    supplier: result,
                    invitationSent: false,
                    message: "Invitation updated but failed to send email"
                };
            }
        });
    },
    getVendorSupplierContracts(vendorId) {
        return __awaiter(this, void 0, void 0, function* () {
            const today = new Date();
            const expiringSoonDate = new Date();
            expiringSoonDate.setDate(today.getDate() + 30); // 3 days threshold
            // Fetch suppliers for this vendor
            const suppliers = yield prisma_1.prisma.supplier.findMany({
                where: { vendorId },
                orderBy: { contractEndDate: 'asc' }, // soonest first
            });
            const expiredSuppliers = suppliers.filter(s => s.contractEndDate && s.contractEndDate < today);
            const expiringSoonSuppliers = suppliers.filter(s => s.contractEndDate && s.contractEndDate >= today && s.contractEndDate <= expiringSoonDate);
            const activeSuppliers = suppliers.filter(s => s.contractEndDate && s.contractEndDate > expiringSoonDate);
            return {
                totalSuppliers: suppliers.length,
                expiredCount: expiredSuppliers.length,
                expiringSoonCount: expiringSoonSuppliers.length,
                expiredSuppliers: expiredSuppliers.map(s => ({
                    id: s.id,
                    name: s.name,
                    contactPerson: s.contactPerson,
                    email: s.email,
                    phone: s.phone,
                    category: s.category,
                    criticality: s.criticality,
                    contractStartDate: s.contractStartDate,
                    contractEndDate: s.contractEndDate,
                    isActive: s.isActive,
                })),
                expiringSoonSuppliers: expiringSoonSuppliers.map(s => ({
                    id: s.id,
                    name: s.name,
                    contactPerson: s.contactPerson,
                    email: s.email,
                    phone: s.phone,
                    category: s.category,
                    criticality: s.criticality,
                    contractStartDate: s.contractStartDate,
                    contractEndDate: s.contractEndDate,
                    daysLeft: s.contractEndDate
                        ? Math.ceil((s.contractEndDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                        : null,
                    isActive: s.isActive,
                })),
                activeSuppliers: activeSuppliers.length,
            };
        });
    },
};
