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
exports.ReportService = void 0;
// src/modules/report/report.service.ts
const client_1 = require("@prisma/client");
const prisma_1 = require("../../shared/prisma");
const http_status_1 = __importDefault(require("http-status"));
const ApiError_1 = __importDefault(require("../../../error/ApiError"));
const mailtrap_service_1 = require("../../shared/mailtrap.service");
const pdfGenerator_1 = require("../../../utils/pdfGenerator");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const notification_service_1 = require("../notification/notification.service");
exports.ReportService = {
    // ========== VALIDATE USER PERMISSIONS ==========
    validateUserPermissions(userId, requestedVendorId, requestedSupplierId) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield prisma_1.prisma.user.findUnique({
                where: { id: userId },
                include: {
                    vendorProfile: {
                        select: { id: true }
                    },
                    supplierProfile: {
                        select: { id: true, vendorId: true }
                    }
                }
            });
            console.log("user", user);
            if (!user) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "User not found");
            }
            let finalVendorId;
            let finalSupplierId;
            // For ADMIN: Can access any vendor/supplier
            if (user.role === client_1.UserRole.ADMIN) {
                if (requestedVendorId) {
                    // Verify vendor exists
                    const vendor = yield prisma_1.prisma.vendor.findUnique({
                        where: { id: requestedVendorId }
                    });
                    if (!vendor) {
                        throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "Vendor not found");
                    }
                    finalVendorId = requestedVendorId;
                }
                if (requestedSupplierId) {
                    // Verify supplier exists and get its vendor
                    const supplier = yield prisma_1.prisma.supplier.findUnique({
                        where: { id: requestedSupplierId }
                    });
                    console.log("Reqested supplier", supplier);
                    if (!supplier) {
                        throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "Supplier not found");
                    }
                    finalSupplierId = requestedSupplierId;
                    if (!finalVendorId) {
                        finalVendorId = supplier.vendorId;
                    }
                }
            }
            // For VENDOR: Can only access their own vendors and their suppliers
            else if (user.role === client_1.UserRole.VENDOR) {
                if (!user.vendorProfile) {
                    throw new ApiError_1.default(http_status_1.default.FORBIDDEN, "Vendor profile not found");
                }
                finalVendorId = user.vendorProfile.id;
                // Vendor can't access other vendors
                if (requestedVendorId && requestedVendorId !== finalVendorId) {
                    throw new ApiError_1.default(http_status_1.default.FORBIDDEN, "Access to other vendor data is not allowed");
                }
                if (requestedSupplierId) {
                    // Verify supplier belongs to this vendor
                    const supplier = yield prisma_1.prisma.supplier.findFirst({
                        where: {
                            id: requestedSupplierId,
                            vendorId: finalVendorId
                        }
                    });
                    if (!supplier) {
                        throw new ApiError_1.default(http_status_1.default.FORBIDDEN, "Supplier does not belong to your vendor");
                    }
                    finalSupplierId = requestedSupplierId;
                }
            }
            // For SUPPLIER: Can only access their own data
            else if (user.role === client_1.UserRole.SUPPLIER) {
                if (!user.supplierProfile) {
                    throw new ApiError_1.default(http_status_1.default.FORBIDDEN, "Supplier profile not found");
                }
                finalSupplierId = user.supplierProfile.id;
                finalVendorId = user.supplierProfile.vendorId;
                console.log("finalSupplierId", finalSupplierId);
                console.log("finalVendorId", finalVendorId);
                // Supplier can only generate reports for themselves
                if (requestedSupplierId && requestedSupplierId !== finalSupplierId) {
                    throw new ApiError_1.default(http_status_1.default.FORBIDDEN, "Access to other supplier data is not allowed");
                }
            }
            return { finalVendorId, finalSupplierId, userRole: user.role };
        });
    },
    // ========== GENERATE REPORT ==========
    generateReport(userId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            // Validate permissions
            const { finalVendorId, finalSupplierId, userRole } = yield this.validateUserPermissions(userId, data.vendorId, data.supplierId);
            if (!finalVendorId) {
                throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, "Vendor ID is required to generate report");
            }
            // Verify vendor exists
            const vendor = yield prisma_1.prisma.vendor.findUnique({
                where: { id: finalVendorId }
            });
            if (!vendor) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "Vendor not found");
            }
            let reportData = {};
            let documentUrl = "";
            let filters = data.filters || {};
            // Map frontend report type to backend enum if needed
            let reportType;
            if (typeof data.reportType === 'string') {
                // Convert frontend string to enum
                switch (data.reportType.toUpperCase()) {
                    case 'RISK_ASSESSMENT':
                    case 'RISK':
                        reportType = client_1.ReportType.RISK_ASSESSMENT;
                        break;
                    case 'COMPLIANCE_REPORT':
                    case 'COMPLIANCE':
                        reportType = client_1.ReportType.COMPLIANCE_REPORT;
                        break;
                    case 'SUPPLIER_EVALUATION':
                    case 'SUPPLIER':
                        reportType = client_1.ReportType.SUPPLIER_EVALUATION;
                        break;
                    case 'FINANCIAL_ANALYSIS':
                    case 'FINANCIAL':
                        reportType = client_1.ReportType.FINANCIAL_ANALYSIS;
                        break;
                    case 'SECURITY_AUDIT':
                    case 'SECURITY':
                        reportType = client_1.ReportType.SECURITY_AUDIT;
                        break;
                    case 'PERFORMANCE_REVIEW':
                    case 'PERFORMANCE':
                        reportType = client_1.ReportType.PERFORMANCE_REVIEW;
                        break;
                    case 'INCIDENT_REPORT':
                    case 'INCIDENT':
                        reportType = client_1.ReportType.INCIDENT_REPORT;
                        break;
                    case 'CUSTOM':
                        reportType = client_1.ReportType.CUSTOM;
                        break;
                    default:
                        throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, `Invalid report type: ${data.reportType}`);
                }
            }
            else {
                reportType = data.reportType;
            }
            // Generate report based on type
            switch (reportType) {
                case client_1.ReportType.RISK_ASSESSMENT:
                    reportData = yield this.generateRiskAssessmentReport({
                        vendorId: finalVendorId,
                        supplierId: finalSupplierId
                    }, filters);
                    documentUrl = yield (0, pdfGenerator_1.generatePDF)({
                        title: data.title,
                        type: 'RISK_ASSESSMENT',
                        data: reportData,
                        template: 'risk-assessment',
                        vendorId: finalVendorId,
                        userId: userId
                    });
                    break;
                case client_1.ReportType.COMPLIANCE_REPORT:
                    reportData = yield this.generateComplianceReport({
                        vendorId: finalVendorId,
                        supplierId: finalSupplierId
                    }, filters);
                    documentUrl = yield (0, pdfGenerator_1.generatePDF)({
                        title: data.title,
                        type: 'COMPLIANCE',
                        data: reportData,
                        template: 'compliance',
                        vendorId: finalVendorId,
                        userId: userId
                    });
                    break;
                case client_1.ReportType.SUPPLIER_EVALUATION:
                    if (!finalSupplierId) {
                        throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, "Supplier ID is required for supplier evaluation report");
                    }
                    reportData = yield this.generateSupplierEvaluationReport({
                        vendorId: finalVendorId,
                        supplierId: finalSupplierId
                    }, filters);
                    documentUrl = yield (0, pdfGenerator_1.generatePDF)({
                        title: data.title,
                        type: 'SUPPLIER_EVALUATION',
                        data: reportData,
                        template: 'supplier-evaluation',
                        vendorId: finalVendorId,
                        userId: userId
                    });
                    break;
                case client_1.ReportType.FINANCIAL_ANALYSIS:
                    if (userRole !== client_1.UserRole.ADMIN) {
                        throw new ApiError_1.default(http_status_1.default.FORBIDDEN, "Only admin can generate financial analysis reports");
                    }
                    reportData = yield this.generateFinancialAnalysisReport({
                        vendorId: finalVendorId,
                        supplierId: finalSupplierId
                    }, filters);
                    documentUrl = yield (0, pdfGenerator_1.generatePDF)({
                        title: data.title,
                        type: 'FINANCIAL',
                        data: reportData,
                        template: 'financial',
                        vendorId: finalVendorId,
                        userId: userId
                    });
                    break;
                case client_1.ReportType.SECURITY_AUDIT:
                    reportData = yield this.generateSecurityAuditReport({
                        vendorId: finalVendorId,
                        supplierId: finalSupplierId
                    }, filters);
                    documentUrl = yield (0, pdfGenerator_1.generatePDF)({
                        title: data.title,
                        type: 'SECURITY_AUDIT',
                        data: reportData,
                        template: 'security-audit',
                        vendorId: finalVendorId,
                        userId: userId
                    });
                    break;
                case client_1.ReportType.PERFORMANCE_REVIEW:
                    reportData = yield this.generatePerformanceReviewReport({
                        vendorId: finalVendorId,
                        supplierId: finalSupplierId
                    }, filters);
                    documentUrl = yield (0, pdfGenerator_1.generatePDF)({
                        title: data.title,
                        type: 'PERFORMANCE_REVIEW',
                        data: reportData,
                        template: 'performance-review',
                        vendorId: finalVendorId,
                        userId: userId
                    });
                    break;
                case client_1.ReportType.INCIDENT_REPORT:
                    reportData = yield this.generateIncidentReport({
                        vendorId: finalVendorId,
                        supplierId: finalSupplierId
                    }, filters);
                    documentUrl = yield (0, pdfGenerator_1.generatePDF)({
                        title: data.title,
                        type: 'INCIDENT_REPORT',
                        data: reportData,
                        template: 'incident-report',
                        vendorId: finalVendorId,
                        userId: userId
                    });
                    break;
                case client_1.ReportType.CUSTOM:
                    reportData = yield this.generateVendorSummaryReport(finalVendorId, // vendorId
                    userId, // userId
                    {
                        vendorId: finalVendorId,
                        supplierId: finalSupplierId
                    }, filters // filters
                    );
                    documentUrl = yield (0, pdfGenerator_1.generatePDF)({
                        title: data.title,
                        type: 'VENDOR_SUMMARY',
                        data: reportData,
                        template: 'vendor-summary',
                        vendorId: finalVendorId,
                        userId: userId
                    });
                    break;
                default:
                    throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, `Invalid report type: ${data.reportType}`);
            }
            // Calculate actual file size
            let fileSize = 1024;
            if (documentUrl) {
                try {
                    const filePath = path_1.default.join(__dirname, '../..', documentUrl.replace('/', ''));
                    const stats = fs_1.default.statSync(filePath);
                    fileSize = stats.size;
                }
                catch (error) {
                    console.error("Could not get file size:", error);
                }
            }
            // Create report record
            const report = yield prisma_1.prisma.report.create({
                data: {
                    title: data.title,
                    reportType: reportType,
                    description: data.description,
                    documentUrl,
                    documentType: 'application/pdf',
                    fileSize,
                    parameters: data.parameters || {},
                    filters,
                    createdById: userId,
                    vendorId: finalVendorId,
                    supplierId: finalSupplierId || null,
                    status: client_1.ReportStatus.GENERATED
                }
            });
            // Create notification
            // await prisma.notification.create({
            //   data: {
            //     userId,
            //     title: "Report Generated",
            //     message: `Report "${data.title}" has been generated successfully`,
            //     type: 'REPORT_GENERATED',
            //     metadata: {
            //       reportId: report.id,
            //       reportType: report.reportType,
            //       documentUrl
            //     }
            //   }
            // });
            return report;
        });
    },
    // ========== GENERATE VENDOR SUMMARY REPORT (OVERALL SUPPLIERS) ==========
    generateVendorSummaryReport(vendorId, userId, data, filters) {
        return __awaiter(this, void 0, void 0, function* () {
            const where = {
                vendorId: data.vendorId,
                isDeleted: false
            };
            if (data.supplierId) {
                where.id = data.supplierId;
            }
            // Get vendor details
            const vendor = yield prisma_1.prisma.vendor.findUnique({
                where: { id: data.vendorId },
                select: {
                    companyName: true,
                    businessEmail: true,
                    contactNumber: true
                }
            });
            if (!vendor) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "Vendor not found");
            }
            // Get all suppliers
            const suppliers = yield prisma_1.prisma.supplier.findMany({
                where,
                include: {
                    vendor: {
                        select: {
                            companyName: true
                        }
                    },
                    assessmentSubmissions: {
                        where: {
                            status: 'APPROVED',
                            submittedAt: {
                                gte: filters.startDate || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
                                lte: filters.endDate || new Date()
                            }
                        },
                        orderBy: { submittedAt: 'desc' },
                        take: 1
                    }
                }
            });
            // Calculate summary statistics
            const totalSuppliers = suppliers.length;
            const activeSuppliers = suppliers.filter(s => s.isActive).length;
            const highRiskSuppliers = suppliers.filter(s => s.riskLevel === 'HIGH' || s.riskLevel === 'CRITICAL').length;
            // Calculate scores
            const averageBIVScore = totalSuppliers > 0 ?
                suppliers.reduce((sum, s) => { var _a; return sum + (((_a = s.bivScore) === null || _a === void 0 ? void 0 : _a.toNumber()) || 0); }, 0) / totalSuppliers : 0;
            const averageComplianceRate = totalSuppliers > 0 ?
                suppliers.reduce((sum, s) => { var _a; return sum + (((_a = s.complianceRate) === null || _a === void 0 ? void 0 : _a.toNumber()) || 0); }, 0) / totalSuppliers : 0;
            // Risk distribution
            const riskDistribution = suppliers.reduce((acc, supplier) => {
                const level = supplier.riskLevel || 'UNKNOWN';
                acc[level] = (acc[level] || 0) + 1;
                return acc;
            }, {});
            // Category breakdown
            const categoryBreakdown = suppliers.reduce((acc, supplier) => {
                var _a;
                const category = supplier.category || 'UNCATEGORIZED';
                if (!acc[category]) {
                    acc[category] = {
                        count: 0,
                        totalBIVScore: 0,
                        highRisk: 0
                    };
                }
                acc[category].count++;
                acc[category].totalBIVScore += ((_a = supplier.bivScore) === null || _a === void 0 ? void 0 : _a.toNumber()) || 0;
                if (supplier.riskLevel === 'HIGH' || supplier.riskLevel === 'CRITICAL') {
                    acc[category].highRisk++;
                }
                return acc;
            }, {});
            // Get recent problems
            const recentProblems = yield prisma_1.prisma.problem.findMany({
                where: {
                    vendorId: data.vendorId,
                    createdAt: {
                        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
                    }
                },
                orderBy: { createdAt: 'desc' },
                take: 10
            });
            // Get upcoming contract expiries
            const upcomingExpiries = suppliers.filter(s => s.contractEndDate &&
                s.contractEndDate < new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // Next 90 days
            ).map(s => ({
                id: s.id,
                name: s.name,
                contractEndDate: s.contractEndDate,
                daysRemaining: Math.ceil((s.contractEndDate.getTime() - new Date().getTime()) /
                    (1000 * 60 * 60 * 24))
            }));
            // Get overdue assessments
            const overdueAssessments = suppliers.filter(s => s.nextAssessmentDue &&
                s.nextAssessmentDue < new Date()).map(s => ({
                id: s.id,
                name: s.name,
                nextAssessmentDue: s.nextAssessmentDue,
                daysOverdue: Math.ceil((new Date().getTime() - s.nextAssessmentDue.getTime()) /
                    (1000 * 60 * 60 * 24))
            }));
            // Top performing suppliers
            const topPerformers = suppliers
                .filter(s => s.bivScore && s.bivScore.toNumber() > 70)
                .sort((a, b) => { var _a, _b; return (((_a = b.bivScore) === null || _a === void 0 ? void 0 : _a.toNumber()) || 0) - (((_b = a.bivScore) === null || _b === void 0 ? void 0 : _b.toNumber()) || 0); })
                .slice(0, 10)
                .map(s => {
                var _a;
                return ({
                    id: s.id,
                    name: s.name,
                    bivScore: (_a = s.bivScore) === null || _a === void 0 ? void 0 : _a.toNumber(),
                    riskLevel: s.riskLevel,
                    category: s.category
                });
            });
            return {
                generatedAt: new Date().toISOString(),
                vendor: {
                    id: data.vendorId,
                    name: vendor.companyName,
                    email: vendor.businessEmail
                },
                summary: {
                    totalSuppliers,
                    activeSuppliers,
                    highRiskSuppliers,
                    averageBIVScore: parseFloat(averageBIVScore.toFixed(2)),
                    averageComplianceRate: parseFloat(averageComplianceRate.toFixed(2)),
                    recentProblems: recentProblems.length,
                    upcomingExpiries: upcomingExpiries.length,
                    overdueAssessments: overdueAssessments.length
                },
                riskDistribution,
                categoryBreakdown: Object.entries(categoryBreakdown).map(([category, data]) => ({
                    category,
                    count: data.count,
                    averageBIVScore: parseFloat((data.totalBIVScore / data.count).toFixed(2)),
                    highRiskPercentage: parseFloat(((data.highRisk / data.count) * 100).toFixed(2))
                })),
                topPerformers,
                upcomingExpiries: upcomingExpiries.slice(0, 10),
                overdueAssessments: overdueAssessments.slice(0, 10),
                recentProblems: recentProblems.slice(0, 10).map(p => ({
                    id: p.id,
                    title: p.title,
                    status: p.status,
                    priority: p.priority,
                    createdAt: p.createdAt
                }))
            };
        });
    },
    // ========== GENERATE RISK ASSESSMENT REPORT ==========
    generateRiskAssessmentReport(data, filters) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const where = {
                vendorId: data.vendorId,
                isDeleted: false,
                isActive: true
            };
            if (data.supplierId) {
                where.id = data.supplierId;
            }
            if (filters.riskLevel && filters.riskLevel.length > 0) {
                where.riskLevel = { in: filters.riskLevel };
            }
            const suppliers = yield prisma_1.prisma.supplier.findMany({
                where,
                include: {
                    vendor: {
                        select: {
                            companyName: true,
                            businessEmail: true
                        }
                    }
                }
            });
            // Get assessment submissions separately for each supplier
            const suppliersWithSubmissions = yield Promise.all(suppliers.map((supplier) => __awaiter(this, void 0, void 0, function* () {
                const assessmentSubmissions = yield prisma_1.prisma.assessmentSubmission.findMany({
                    where: {
                        supplierId: supplier.id,
                        status: 'APPROVED',
                        submittedAt: {
                            gte: filters.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                            lte: filters.endDate || new Date()
                        }
                    },
                    orderBy: { submittedAt: 'desc' },
                    take: 1
                });
                return Object.assign(Object.assign({}, supplier), { assessmentSubmissions });
            })));
            const riskDistribution = suppliersWithSubmissions.reduce((acc, supplier) => {
                const level = supplier.riskLevel || 'UNKNOWN';
                acc[level] = (acc[level] || 0) + 1;
                return acc;
            }, {});
            const highRiskSuppliers = suppliersWithSubmissions
                .filter(s => s.riskLevel === 'HIGH' || s.riskLevel === 'CRITICAL')
                .map(s => {
                var _a, _b, _c, _d;
                return ({
                    id: s.id,
                    name: s.name,
                    email: s.email,
                    bivScore: (_a = s.bivScore) === null || _a === void 0 ? void 0 : _a.toNumber(),
                    businessScore: (_b = s.businessScore) === null || _b === void 0 ? void 0 : _b.toNumber(),
                    integrityScore: (_c = s.integrityScore) === null || _c === void 0 ? void 0 : _c.toNumber(),
                    availabilityScore: (_d = s.availabilityScore) === null || _d === void 0 ? void 0 : _d.toNumber(),
                    lastAssessmentDate: s.lastAssessmentDate,
                    vendorName: s.vendor.companyName
                });
            });
            const averageBIVScore = suppliersWithSubmissions.length > 0 ?
                suppliersWithSubmissions.reduce((sum, s) => { var _a; return sum + (((_a = s.bivScore) === null || _a === void 0 ? void 0 : _a.toNumber()) || 0); }, 0) / suppliersWithSubmissions.length : 0;
            const categoryBreakdown = suppliersWithSubmissions.reduce((acc, supplier) => {
                var _a;
                const category = supplier.category || 'UNCATEGORIZED';
                if (!acc[category]) {
                    acc[category] = {
                        count: 0,
                        totalBIVScore: 0,
                        highRisk: 0
                    };
                }
                acc[category].count++;
                acc[category].totalBIVScore += ((_a = supplier.bivScore) === null || _a === void 0 ? void 0 : _a.toNumber()) || 0;
                if (supplier.riskLevel === 'HIGH' || supplier.riskLevel === 'CRITICAL') {
                    acc[category].highRisk++;
                }
                return acc;
            }, {});
            return {
                generatedAt: new Date().toISOString(),
                vendor: {
                    id: data.vendorId,
                    name: ((_a = suppliersWithSubmissions[0]) === null || _a === void 0 ? void 0 : _a.vendor.companyName) || 'Unknown'
                },
                totalSuppliers: suppliersWithSubmissions.length,
                riskDistribution,
                averageBIVScore: parseFloat(averageBIVScore.toFixed(2)),
                highRiskSuppliers: highRiskSuppliers.slice(0, 20),
                categoryBreakdown: Object.entries(categoryBreakdown).map(([category, data]) => ({
                    category,
                    count: data.count,
                    averageBIVScore: parseFloat((data.totalBIVScore / data.count).toFixed(2)),
                    highRiskPercentage: parseFloat(((data.highRisk / data.count) * 100).toFixed(2))
                })),
                summary: {
                    lowRisk: riskDistribution.LOW || 0,
                    mediumRisk: riskDistribution.MEDIUM || 0,
                    highRisk: riskDistribution.HIGH || 0,
                    criticalRisk: riskDistribution.CRITICAL || 0,
                    totalHighRisk: (riskDistribution.HIGH || 0) + (riskDistribution.CRITICAL || 0)
                }
            };
        });
    },
    // ========== GENERATE COMPLIANCE REPORT ==========
    generateComplianceReport(data, filters) {
        return __awaiter(this, void 0, void 0, function* () {
            const where = {
                vendorId: data.vendorId,
                status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'PENDING'] }
            };
            if (data.supplierId) {
                where.supplierId = data.supplierId;
            }
            if (filters.startDate || filters.endDate) {
                where.submittedAt = {};
                if (filters.startDate)
                    where.submittedAt.gte = new Date(filters.startDate);
                if (filters.endDate)
                    where.submittedAt.lte = new Date(filters.endDate);
            }
            const submissions = yield prisma_1.prisma.assessmentSubmission.findMany({
                where,
                include: {
                    assessment: {
                        select: { title: true, stage: true }
                    },
                    supplier: {
                        select: { name: true, email: true }
                    }
                },
                orderBy: { submittedAt: 'desc' }
            });
            // Group by month and type
            const complianceByMonth = {};
            submissions.forEach(submission => {
                if (submission.submittedAt) {
                    const month = submission.submittedAt.toLocaleString('default', {
                        month: 'short',
                        year: 'numeric'
                    });
                    if (!complianceByMonth[month]) {
                        complianceByMonth[month] = { total: 0, approved: 0, initial: 0, full: 0 };
                    }
                    complianceByMonth[month].total++;
                    if (submission.status === 'APPROVED' || submission.status === 'PENDING') {
                        complianceByMonth[month].approved++;
                    }
                    if (submission.stage === 'INITIAL') {
                        complianceByMonth[month].initial++;
                    }
                    else {
                        complianceByMonth[month].full++;
                    }
                }
            });
            const totalSubmissions = submissions.length;
            const approvedSubmissions = submissions.filter(s => s.status === 'APPROVED').length;
            const initialAssessments = submissions.filter(s => s.stage === 'INITIAL').length;
            const fullAssessments = submissions.filter(s => s.stage === 'FULL').length;
            const complianceRate = totalSubmissions > 0 ?
                (approvedSubmissions / totalSubmissions) * 100 : 0;
            // Supplier compliance ranking
            const supplierCompliance = {};
            submissions.forEach(submission => {
                var _a;
                if (submission.supplier) {
                    const supplierId = submission.supplierId;
                    if (!supplierCompliance[supplierId]) {
                        supplierCompliance[supplierId] = {
                            name: submission.supplier.name,
                            total: 0,
                            approved: 0,
                            averageScore: 0,
                            lastAssessment: null
                        };
                    }
                    supplierCompliance[supplierId].total++;
                    if (submission.status === 'APPROVED' || submission.status === 'PENDING') {
                        supplierCompliance[supplierId].approved++;
                    }
                    supplierCompliance[supplierId].averageScore += ((_a = submission.score) === null || _a === void 0 ? void 0 : _a.toNumber()) || 0;
                    if (!supplierCompliance[supplierId].lastAssessment ||
                        (submission.submittedAt && submission.submittedAt > supplierCompliance[supplierId].lastAssessment)) {
                        supplierCompliance[supplierId].lastAssessment = submission.submittedAt;
                    }
                }
            });
            const topCompliantSuppliers = Object.entries(supplierCompliance)
                .map(([id, data]) => ({
                id,
                name: data.name,
                complianceRate: data.total > 0 ? (data.approved / data.total) * 100 : 0,
                averageScore: data.total > 0 ? data.averageScore / data.total : 0,
                lastAssessment: data.lastAssessment
            }))
                .sort((a, b) => b.complianceRate - a.complianceRate)
                .slice(0, 10);
            return {
                generatedAt: new Date().toISOString(),
                period: {
                    start: filters.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                    end: filters.endDate || new Date()
                },
                summary: {
                    totalSubmissions,
                    approvedSubmissions,
                    initialAssessments,
                    fullAssessments,
                    pendingReviews: submissions.filter(s => s.status === 'PENDING').length,
                    requiresAction: submissions.filter(s => s.status === 'REQUIRES_ACTION').length,
                    rejectedSubmissions: submissions.filter(s => s.status === 'REJECTED').length,
                    complianceRate: parseFloat(complianceRate.toFixed(2))
                },
                complianceByMonth,
                topCompliantSuppliers,
                recentSubmissions: submissions.slice(0, 10).map(s => {
                    var _a, _b;
                    return ({
                        id: s.id,
                        assessment: s.assessment.title,
                        supplier: ((_a = s.supplier) === null || _a === void 0 ? void 0 : _a.name) || 'Unknown',
                        stage: s.stage,
                        status: s.status,
                        score: (_b = s.score) === null || _b === void 0 ? void 0 : _b.toNumber(),
                        submittedAt: s.submittedAt
                    });
                })
            };
        });
    },
    // ========== GENERATE SUPPLIER EVALUATION REPORT ==========
    generateSupplierEvaluationReport(data, filters) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h;
            const supplier = yield prisma_1.prisma.supplier.findUnique({
                where: {
                    id: data.supplierId,
                    vendorId: data.vendorId
                },
                include: {
                    vendor: {
                        select: {
                            companyName: true,
                            businessEmail: true,
                            contactNumber: true
                        }
                    }
                }
            });
            if (!supplier) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "Supplier not found or not accessible");
            }
            // Get assessment submissions separately
            const assessmentSubmissions = yield prisma_1.prisma.assessmentSubmission.findMany({
                where: {
                    supplierId: data.supplierId,
                    status: 'APPROVED',
                    submittedAt: {
                        gte: filters.startDate || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
                        lte: filters.endDate || new Date()
                    }
                },
                include: {
                    assessment: {
                        select: { title: true, description: true, stage: true }
                    },
                    answers: {
                        include: {
                            question: {
                                select: {
                                    question: true,
                                    bivCategory: true,
                                    maxScore: true,
                                    evidenceRequired: true
                                }
                            }
                        }
                    }
                },
                orderBy: { submittedAt: 'desc' }
            });
            // Get supplier documents separately (using the Document model)
            const documents = yield prisma_1.prisma.document.findMany({
                where: {
                    supplierId: data.supplierId,
                    status: 'APPROVED',
                    category: {
                        in: ['Certificate', 'License', 'Compliance', 'Contract']
                    }
                },
                orderBy: { createdAt: 'desc' }
            });
            // Get supplier problems separately
            const startDate = filters.startDate || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
            const problems = yield prisma_1.prisma.problem.findMany({
                where: {
                    supplierId: data.supplierId,
                    createdAt: {
                        gte: startDate
                    }
                },
                orderBy: { createdAt: 'desc' }
            });
            // Calculate scores by category
            const categoryScores = {};
            const evidenceStatus = {
                BUSINESS: { required: 0, submitted: 0, approved: 0 },
                INTEGRITY: { required: 0, submitted: 0, approved: 0 },
                AVAILABILITY: { required: 0, submitted: 0, approved: 0 }
            };
            let totalScore = 0;
            let totalQuestions = 0;
            let totalEvidenceRequired = 0;
            let totalEvidenceSubmitted = 0;
            let totalEvidenceApproved = 0;
            assessmentSubmissions.forEach((submission) => {
                submission.answers.forEach((answer) => {
                    var _a, _b;
                    const category = answer.question.bivCategory || 'OTHER';
                    if (!categoryScores[category]) {
                        categoryScores[category] = { total: 0, count: 0, maxScore: 0 };
                    }
                    categoryScores[category].total += ((_a = answer.score) === null || _a === void 0 ? void 0 : _a.toNumber()) || 0;
                    categoryScores[category].count++;
                    categoryScores[category].maxScore += answer.question.maxScore;
                    // Track evidence status
                    if (answer.question.evidenceRequired) {
                        totalEvidenceRequired++;
                        const bivCat = answer.question.bivCategory;
                        if (bivCat && evidenceStatus[bivCat]) {
                            evidenceStatus[bivCat].required++;
                        }
                        if (answer.evidence) {
                            totalEvidenceSubmitted++;
                            if (bivCat && evidenceStatus[bivCat]) {
                                evidenceStatus[bivCat].submitted++;
                            }
                        }
                        if (answer.evidenceStatus === 'APPROVED') {
                            totalEvidenceApproved++;
                            if (bivCat && evidenceStatus[bivCat]) {
                                evidenceStatus[bivCat].approved++;
                            }
                        }
                    }
                    totalScore += ((_b = answer.score) === null || _b === void 0 ? void 0 : _b.toNumber()) || 0;
                    totalQuestions++;
                });
            });
            const averageScores = Object.entries(categoryScores).map(([category, data]) => ({
                category,
                averageScore: data.count > 0 ? data.total / data.count : 0,
                maxPossible: data.maxScore,
                percentage: data.count > 0 ? (data.total / data.maxScore) * 100 : 0
            }));
            const overallAverage = totalQuestions > 0 ? totalScore / totalQuestions : 0;
            const overallPercentage = totalQuestions > 0 ?
                (totalScore / assessmentSubmissions.reduce((sum, s) => { var _a; return sum + (((_a = s.assessment) === null || _a === void 0 ? void 0 : _a.stage) === 'INITIAL' ? 100 : 1000); }, 0)) * 100 : 0;
            // Problem statistics
            const problemStats = problems.reduce((acc, problem) => {
                const status = problem.status;
                acc[status] = (acc[status] || 0) + 1;
                return acc;
            }, {});
            // Calculate evidence completion rate
            const evidenceCompletionRate = totalEvidenceRequired > 0 ?
                (totalEvidenceApproved / totalEvidenceRequired) * 100 : 100;
            return {
                generatedAt: new Date().toISOString(),
                supplier: {
                    id: supplier.id,
                    name: supplier.name,
                    email: supplier.email,
                    contactPerson: supplier.contactPerson,
                    category: supplier.category,
                    criticality: supplier.criticality,
                    nis2Compliant: supplier.nis2Compliant,
                    contractStartDate: supplier.contractStartDate,
                    contractEndDate: supplier.contractEndDate,
                    totalContractValue: (_a = supplier.totalContractValue) === null || _a === void 0 ? void 0 : _a.toNumber(),
                    vendor: supplier.vendor
                },
                scores: {
                    overall: {
                        average: parseFloat(overallAverage.toFixed(2)),
                        percentage: parseFloat(overallPercentage.toFixed(2)),
                        riskLevel: supplier.riskLevel,
                        complianceRate: (_b = supplier.complianceRate) === null || _b === void 0 ? void 0 : _b.toNumber()
                    },
                    byCategory: averageScores,
                    bivBreakdown: {
                        businessScore: (_c = supplier.businessScore) === null || _c === void 0 ? void 0 : _c.toNumber(),
                        integrityScore: (_d = supplier.integrityScore) === null || _d === void 0 ? void 0 : _d.toNumber(),
                        availabilityScore: (_e = supplier.availabilityScore) === null || _e === void 0 ? void 0 : _e.toNumber(),
                        bivScore: (_f = supplier.bivScore) === null || _f === void 0 ? void 0 : _f.toNumber()
                    },
                    evidence: {
                        required: totalEvidenceRequired,
                        submitted: totalEvidenceSubmitted,
                        approved: totalEvidenceApproved,
                        completionRate: parseFloat(evidenceCompletionRate.toFixed(2)),
                        byCategory: evidenceStatus
                    }
                },
                assessments: {
                    total: assessmentSubmissions.length,
                    initial: assessmentSubmissions.filter(s => s.stage === 'INITIAL').length,
                    full: assessmentSubmissions.filter(s => s.stage === 'FULL').length,
                    lastAssessment: supplier.lastAssessmentDate,
                    nextAssessmentDue: supplier.nextAssessmentDue,
                    initialCompleted: supplier.initialAssessmentCompleted,
                    fullCompleted: supplier.fullAssessmentCompleted
                },
                documents: {
                    total: documents.length,
                    byCategory: documents.reduce((acc, doc) => {
                        const category = doc.category || 'Other';
                        acc[category] = (acc[category] || 0) + 1;
                        return acc;
                    }, {}),
                    expiringSoon: documents.filter(doc => doc.expiryDate && new Date(doc.expiryDate) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)).length
                },
                problems: {
                    total: problems.length,
                    byStatus: problemStats,
                    byPriority: problems.reduce((acc, p) => {
                        acc[p.priority] = (acc[p.priority] || 0) + 1;
                        return acc;
                    }, {}),
                    slaBreaches: problems.filter(p => p.slaBreached).length,
                    recent: problems.slice(0, 10).map(p => ({
                        id: p.id,
                        title: p.title,
                        status: p.status,
                        priority: p.priority,
                        createdAt: p.createdAt,
                        resolvedAt: p.resolvedAt
                    }))
                },
                performance: {
                    onTimeDeliveryRate: (_g = supplier.onTimeDeliveryRate) === null || _g === void 0 ? void 0 : _g.toNumber(),
                    averageResponseTime: supplier.averageResponseTime,
                    outstandingPayments: (_h = supplier.outstandingPayments) === null || _h === void 0 ? void 0 : _h.toNumber()
                },
                recommendations: this.generateSupplierRecommendations(supplier, averageScores, evidenceCompletionRate)
            };
        });
    },
    // ========== GENERATE FINANCIAL ANALYSIS REPORT ==========
    generateFinancialAnalysisReport(data, filters) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const where = {
                status: 'SUCCEEDED'
            };
            if (data.vendorId) {
                where.user = {
                    vendorProfile: {
                        id: data.vendorId
                    }
                };
            }
            if (filters.startDate || filters.endDate) {
                where.paidAt = {};
                if (filters.startDate)
                    where.paidAt.gte = new Date(filters.startDate);
                if (filters.endDate)
                    where.paidAt.lte = new Date(filters.endDate);
            }
            const payments = yield prisma_1.prisma.payment.findMany({
                where,
                include: {
                    user: {
                        include: {
                            vendorProfile: {
                                select: { companyName: true }
                            }
                        }
                    },
                    subscription: {
                        include: {
                            plan: true
                        }
                    }
                },
                orderBy: { paidAt: 'desc' }
            });
            // Filter valid payments
            const validPayments = payments.filter(p => { var _a; return (_a = p.subscription) === null || _a === void 0 ? void 0 : _a.plan; });
            // Group by vendor
            const revenueByVendor = {};
            validPayments.forEach(payment => {
                var _a;
                const vendorName = ((_a = payment.user.vendorProfile) === null || _a === void 0 ? void 0 : _a.companyName) || 'Unknown Vendor';
                if (!revenueByVendor[vendorName]) {
                    revenueByVendor[vendorName] = { name: vendorName, total: 0, payments: 0 };
                }
                revenueByVendor[vendorName].total += payment.amount.toNumber();
                revenueByVendor[vendorName].payments++;
            });
            // Revenue by month
            const revenueByMonth = {};
            validPayments.forEach(payment => {
                if (payment.paidAt) {
                    const month = payment.paidAt.toLocaleString('default', {
                        month: 'short',
                        year: 'numeric'
                    });
                    revenueByMonth[month] = (revenueByMonth[month] || 0) + payment.amount.toNumber();
                }
            });
            // Revenue by plan
            const revenueByPlan = {};
            validPayments.forEach(payment => {
                var _a, _b;
                const planName = ((_b = (_a = payment.subscription) === null || _a === void 0 ? void 0 : _a.plan) === null || _b === void 0 ? void 0 : _b.name) || 'Unknown Plan';
                if (!revenueByPlan[planName]) {
                    revenueByPlan[planName] = { name: planName, total: 0, customers: 0 };
                }
                revenueByPlan[planName].total += payment.amount.toNumber();
                revenueByPlan[planName].customers++;
            });
            const totalRevenue = validPayments.reduce((sum, payment) => sum + payment.amount.toNumber(), 0);
            const averagePayment = validPayments.length > 0 ?
                totalRevenue / validPayments.length : 0;
            // Get subscription statistics
            const subscriptions = yield prisma_1.prisma.subscription.findMany({
                where: {
                    status: 'ACTIVE'
                },
                include: {
                    plan: true,
                    user: {
                        include: {
                            vendorProfile: true
                        }
                    }
                }
            });
            const planDistribution = subscriptions.reduce((acc, sub) => {
                const planName = sub.plan.name;
                acc[planName] = (acc[planName] || 0) + 1;
                return acc;
            }, {});
            return {
                generatedAt: new Date().toISOString(),
                period: {
                    start: filters.startDate || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
                    end: filters.endDate || new Date()
                },
                summary: {
                    totalRevenue: parseFloat(totalRevenue.toFixed(2)),
                    totalPayments: validPayments.length,
                    averagePayment: parseFloat(averagePayment.toFixed(2)),
                    activeSubscriptions: subscriptions.length,
                    currency: ((_a = validPayments[0]) === null || _a === void 0 ? void 0 : _a.currency) || 'EUR'
                },
                revenueByMonth,
                revenueByVendor: Object.values(revenueByVendor)
                    .sort((a, b) => b.total - a.total)
                    .slice(0, 10),
                revenueByPlan: Object.values(revenueByPlan)
                    .sort((a, b) => b.total - a.total),
                planDistribution,
                topPayments: validPayments.slice(0, 10).map(p => {
                    var _a, _b, _c, _d;
                    return ({
                        id: p.id,
                        amount: p.amount.toNumber(),
                        currency: p.currency,
                        paidAt: p.paidAt,
                        vendor: ((_a = p.user.vendorProfile) === null || _a === void 0 ? void 0 : _a.companyName) || 'Unknown',
                        plan: ((_c = (_b = p.subscription) === null || _b === void 0 ? void 0 : _b.plan) === null || _c === void 0 ? void 0 : _c.name) || 'Unknown',
                        billingCycle: (_d = p.subscription) === null || _d === void 0 ? void 0 : _d.billingCycle
                    });
                })
            };
        });
    },
    // ========== GENERATE SECURITY AUDIT REPORT ==========
    generateSecurityAuditReport(data, filters) {
        return __awaiter(this, void 0, void 0, function* () {
            const where = {
                vendorId: data.vendorId,
                isDeleted: false
            };
            if (data.supplierId) {
                where.id = data.supplierId;
            }
            const suppliers = yield prisma_1.prisma.supplier.findMany({
                where,
                include: {
                    vendor: {
                        select: {
                            companyName: true
                        }
                    }
                }
            });
            // Get assessment submissions separately for each supplier
            const suppliersWithSecurityData = yield Promise.all(suppliers.map((supplier) => __awaiter(this, void 0, void 0, function* () {
                const securitySubmissions = yield prisma_1.prisma.assessmentSubmission.findMany({
                    where: {
                        supplierId: supplier.id,
                        status: 'APPROVED',
                        assessment: {
                            categories: {
                                some: {
                                    title: {
                                        contains: 'Security',
                                        mode: 'insensitive'
                                    }
                                }
                            }
                        }
                    },
                    include: {
                        answers: {
                            where: {
                                question: {
                                    bivCategory: {
                                        in: ['BUSINESS', 'INTEGRITY', 'AVAILABILITY']
                                    }
                                }
                            }
                        }
                    }
                });
                // Get security documents
                const securityDocuments = yield prisma_1.prisma.document.findMany({
                    where: {
                        supplierId: supplier.id,
                        category: {
                            in: ['Certificate', 'License', 'Compliance']
                        },
                        status: 'APPROVED'
                    }
                });
                return Object.assign(Object.assign({}, supplier), { securitySubmissions,
                    securityDocuments });
            })));
            // Calculate security metrics
            const securityMetrics = suppliersWithSecurityData.map(supplier => {
                const securitySubmissions = supplier.securitySubmissions;
                const securityDocuments = supplier.securityDocuments;
                let securityScore = 0;
                let totalSecurityQuestions = 0;
                securitySubmissions.forEach(submission => {
                    submission.answers.forEach(answer => {
                        var _a;
                        totalSecurityQuestions++;
                        securityScore += ((_a = answer.score) === null || _a === void 0 ? void 0 : _a.toNumber()) || 0;
                    });
                });
                const avgSecurityScore = totalSecurityQuestions > 0 ?
                    (securityScore / totalSecurityQuestions) * 10 : 0;
                return {
                    id: supplier.id,
                    name: supplier.name,
                    securityScore: parseFloat(avgSecurityScore.toFixed(2)),
                    securityDocuments: securityDocuments.length,
                    nis2Compliant: supplier.nis2Compliant,
                    lastAssessmentDate: supplier.lastAssessmentDate,
                    riskLevel: supplier.riskLevel
                };
            });
            const averageSecurityScore = securityMetrics.length > 0 ?
                securityMetrics.reduce((sum, s) => sum + s.securityScore, 0) / securityMetrics.length : 0;
            const nis2CompliantCount = securityMetrics.filter(s => s.nis2Compliant).length;
            const nis2ComplianceRate = securityMetrics.length > 0 ?
                (nis2CompliantCount / securityMetrics.length) * 100 : 0;
            return {
                generatedAt: new Date().toISOString(),
                vendorId: data.vendorId,
                totalSuppliers: suppliers.length,
                securityMetrics: {
                    averageSecurityScore: parseFloat(averageSecurityScore.toFixed(2)),
                    nis2ComplianceRate: parseFloat(nis2ComplianceRate.toFixed(2)),
                    nis2CompliantCount,
                    highRiskSuppliers: securityMetrics.filter(s => s.riskLevel === 'HIGH' || s.riskLevel === 'CRITICAL').length
                },
                suppliers: securityMetrics
                    .sort((a, b) => b.securityScore - a.securityScore)
                    .slice(0, 20),
                recommendations: [
                    nis2ComplianceRate < 80 ? "Consider implementing NIS2 compliance training for suppliers" : "",
                    averageSecurityScore < 70 ? "Review and strengthen security assessment criteria" : "",
                    "Regular security audits should be conducted every 6 months"
                ].filter(r => r)
            };
        });
    },
    // ========== GENERATE PERFORMANCE REVIEW REPORT ==========
    generatePerformanceReviewReport(data, filters) {
        return __awaiter(this, void 0, void 0, function* () {
            const where = {
                vendorId: data.vendorId,
                isDeleted: false
            };
            if (data.supplierId) {
                where.id = data.supplierId;
            }
            const suppliers = yield prisma_1.prisma.supplier.findMany({
                where,
                include: {
                    vendor: {
                        select: {
                            companyName: true
                        }
                    }
                }
            });
            // Get data separately for each supplier
            const suppliersWithPerformanceData = yield Promise.all(suppliers.map((supplier) => __awaiter(this, void 0, void 0, function* () {
                const submissions = yield prisma_1.prisma.assessmentSubmission.findMany({
                    where: {
                        supplierId: supplier.id,
                        status: 'APPROVED',
                        submittedAt: {
                            gte: filters.startDate || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
                        }
                    },
                    orderBy: { submittedAt: 'desc' }
                });
                const problems = yield prisma_1.prisma.problem.findMany({
                    where: {
                        supplierId: supplier.id,
                        createdAt: {
                            gte: filters.startDate || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
                        }
                    }
                });
                return Object.assign(Object.assign({}, supplier), { submissions,
                    problems });
            })));
            // Calculate performance metrics
            const performanceMetrics = suppliersWithPerformanceData.map(supplier => {
                var _a;
                const submissions = supplier.submissions;
                const problems = supplier.problems;
                const latestSubmission = submissions[0];
                const avgScore = submissions.length > 0 ?
                    submissions.reduce((sum, s) => { var _a; return sum + (((_a = s.score) === null || _a === void 0 ? void 0 : _a.toNumber()) || 0); }, 0) / submissions.length : 0;
                const openProblems = problems.filter(p => p.status !== 'RESOLVED' && p.status !== 'CLOSED').length;
                const slaBreaches = problems.filter(p => p.slaBreached).length;
                let performanceScore = avgScore;
                if (openProblems > 0)
                    performanceScore -= (openProblems * 5);
                if (slaBreaches > 0)
                    performanceScore -= (slaBreaches * 10);
                performanceScore = Math.max(0, performanceScore);
                return {
                    id: supplier.id,
                    name: supplier.name,
                    performanceScore: parseFloat(performanceScore.toFixed(2)),
                    averageAssessmentScore: parseFloat(avgScore.toFixed(2)),
                    totalProblems: problems.length,
                    openProblems,
                    slaBreaches,
                    onTimeDeliveryRate: (_a = supplier.onTimeDeliveryRate) === null || _a === void 0 ? void 0 : _a.toNumber(),
                    averageResponseTime: supplier.averageResponseTime,
                    lastAssessmentDate: (latestSubmission === null || latestSubmission === void 0 ? void 0 : latestSubmission.submittedAt) || supplier.lastAssessmentDate
                };
            });
            const overallPerformance = performanceMetrics.length > 0 ?
                performanceMetrics.reduce((sum, s) => sum + s.performanceScore, 0) / performanceMetrics.length : 0;
            const topPerformers = performanceMetrics
                .sort((a, b) => b.performanceScore - a.performanceScore)
                .slice(0, 10);
            const underPerformers = performanceMetrics
                .filter(s => s.performanceScore < 60)
                .sort((a, b) => a.performanceScore - b.performanceScore)
                .slice(0, 10);
            return {
                generatedAt: new Date().toISOString(),
                vendorId: data.vendorId,
                period: {
                    start: filters.startDate || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
                    end: filters.endDate || new Date()
                },
                summary: {
                    totalSuppliers: suppliers.length,
                    overallPerformance: parseFloat(overallPerformance.toFixed(2)),
                    suppliersWithIssues: performanceMetrics.filter(s => s.openProblems > 0 || s.slaBreaches > 0).length,
                    averageResponseTime: performanceMetrics.length > 0 ?
                        performanceMetrics.reduce((sum, s) => sum + (s.averageResponseTime || 0), 0) / performanceMetrics.length : 0
                },
                topPerformers,
                underPerformers,
                keyMetrics: {
                    averageOnTimeDelivery: performanceMetrics.length > 0 ?
                        performanceMetrics.reduce((sum, s) => sum + (s.onTimeDeliveryRate || 0), 0) / performanceMetrics.length : 0,
                    problemResolutionRate: performanceMetrics.length > 0 ?
                        ((performanceMetrics.reduce((sum, s) => sum + s.totalProblems, 0) -
                            performanceMetrics.reduce((sum, s) => sum + s.openProblems, 0)) /
                            performanceMetrics.reduce((sum, s) => sum + s.totalProblems, 0)) * 100 : 100
                }
            };
        });
    },
    // ========== GENERATE INCIDENT REPORT ==========
    generateIncidentReport(data, filters) {
        return __awaiter(this, void 0, void 0, function* () {
            const where = {
                vendorId: data.vendorId
            };
            if (data.supplierId) {
                where.supplierId = data.supplierId;
            }
            if (filters.startDate || filters.endDate) {
                where.createdAt = {};
                if (filters.startDate)
                    where.createdAt.gte = new Date(filters.startDate);
                if (filters.endDate)
                    where.createdAt.lte = new Date(filters.endDate);
            }
            // Get problems
            const problems = yield prisma_1.prisma.problem.findMany({
                where,
                include: {
                    reportedBy: {
                        select: { email: true }
                    },
                    assignedTo: {
                        select: { email: true }
                    },
                    messages: {
                        orderBy: { createdAt: 'desc' },
                        take: 1
                    }
                },
                orderBy: { createdAt: 'desc' }
            });
            // Get supplier details separately
            const problemsWithSuppliers = yield Promise.all(problems.map((problem) => __awaiter(this, void 0, void 0, function* () {
                const supplier = yield prisma_1.prisma.supplier.findUnique({
                    where: { id: problem.supplierId },
                    select: { name: true, email: true }
                });
                return Object.assign(Object.assign({}, problem), { supplier });
            })));
            // Group by type
            const problemsByType = problemsWithSuppliers.reduce((acc, problem) => {
                acc[problem.type] = (acc[problem.type] || 0) + 1;
                return acc;
            }, {});
            // Group by priority
            const problemsByPriority = problemsWithSuppliers.reduce((acc, problem) => {
                acc[problem.priority] = (acc[problem.priority] || 0) + 1;
                return acc;
            }, {});
            // Group by status
            const problemsByStatus = problemsWithSuppliers.reduce((acc, problem) => {
                acc[problem.status] = (acc[problem.status] || 0) + 1;
                return acc;
            }, {});
            // Calculate resolution times
            const resolvedProblems = problemsWithSuppliers.filter(p => p.resolvedAt && p.createdAt);
            const resolutionTimes = resolvedProblems.map(p => {
                const resolutionTime = p.resolvedAt.getTime() - p.createdAt.getTime();
                return resolutionTime / (1000 * 60 * 60 * 24); // Convert to days
            });
            const averageResolutionTime = resolutionTimes.length > 0 ?
                resolutionTimes.reduce((sum, time) => sum + time, 0) / resolutionTimes.length : 0;
            const slaBreaches = problemsWithSuppliers.filter(p => p.slaBreached).length;
            const slaBreachRate = problemsWithSuppliers.length > 0 ? (slaBreaches / problemsWithSuppliers.length) * 100 : 0;
            // Group by supplier
            const problemsBySupplier = {};
            problemsWithSuppliers.forEach(problem => {
                var _a;
                const supplierName = ((_a = problem.supplier) === null || _a === void 0 ? void 0 : _a.name) || 'Unknown';
                if (!problemsBySupplier[supplierName]) {
                    problemsBySupplier[supplierName] = { name: supplierName, count: 0, slaBreaches: 0 };
                }
                problemsBySupplier[supplierName].count++;
                if (problem.slaBreached) {
                    problemsBySupplier[supplierName].slaBreaches++;
                }
            });
            return {
                generatedAt: new Date().toISOString(),
                vendorId: data.vendorId,
                period: {
                    start: filters.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                    end: filters.endDate || new Date()
                },
                summary: {
                    totalProblems: problemsWithSuppliers.length,
                    openProblems: problemsWithSuppliers.filter(p => p.status !== 'RESOLVED' && p.status !== 'CLOSED').length,
                    resolvedProblems: problemsWithSuppliers.filter(p => p.status === 'RESOLVED' || p.status === 'CLOSED').length,
                    slaBreaches,
                    slaBreachRate: parseFloat(slaBreachRate.toFixed(2)),
                    averageResolutionTime: parseFloat(averageResolutionTime.toFixed(2))
                },
                breakdown: {
                    byType: problemsByType,
                    byPriority: problemsByPriority,
                    byStatus: problemsByStatus
                },
                topSuppliersWithIssues: Object.values(problemsBySupplier)
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 10),
                recentProblems: problemsWithSuppliers.slice(0, 10).map(p => {
                    var _a, _b;
                    return ({
                        id: p.id,
                        title: p.title,
                        type: p.type,
                        priority: p.priority,
                        status: p.status,
                        supplier: (_a = p.supplier) === null || _a === void 0 ? void 0 : _a.name,
                        reportedBy: (_b = p.reportedBy) === null || _b === void 0 ? void 0 : _b.email,
                        createdAt: p.createdAt,
                        resolvedAt: p.resolvedAt,
                        slaBreached: p.slaBreached
                    });
                })
            };
        });
    },
    // ========== GENERATE SUPPLIER RECOMMENDATIONS ==========
    generateSupplierRecommendations(supplier, categoryScores, evidenceCompletionRate) {
        const recommendations = [];
        // Check overall scores
        if (supplier.bivScore && supplier.bivScore < 40) {
            recommendations.push("Supplier is at high risk. Consider implementing immediate remediation actions and schedule a review meeting.");
        }
        if (supplier.businessScore && supplier.businessScore < 50) {
            recommendations.push("Business continuity planning needs improvement. Review disaster recovery procedures and conduct a business impact analysis.");
        }
        if (supplier.integrityScore && supplier.integrityScore < 50) {
            recommendations.push("Data integrity controls require strengthening. Implement additional verification measures and access controls.");
        }
        if (supplier.availabilityScore && supplier.availabilityScore < 50) {
            recommendations.push("Service availability needs enhancement. Review redundancy, backup systems, and consider implementing SLAs for uptime.");
        }
        // Check evidence completion
        if (evidenceCompletionRate < 80) {
            recommendations.push(`Evidence completion rate is low (${evidenceCompletionRate.toFixed(2)}%). Request missing evidence from supplier.`);
        }
        // Check NIS2 compliance
        if (!supplier.nis2Compliant) {
            recommendations.push("Supplier is not NIS2 compliant. Require NIS2 compliance assessment and implementation plan.");
        }
        // Check contract expiry
        if (supplier.contractEndDate) {
            const daysRemaining = Math.ceil((new Date(supplier.contractEndDate).getTime() - new Date().getTime()) /
                (1000 * 60 * 60 * 24));
            if (daysRemaining < 30) {
                recommendations.push(`Contract expires in ${daysRemaining} days. Initiate renewal process immediately.`);
            }
            else if (daysRemaining < 90) {
                recommendations.push(`Contract expires in ${daysRemaining} days. Start renewal discussions.`);
            }
        }
        // Check assessment frequency
        if (supplier.lastAssessmentDate) {
            const daysSinceLastAssessment = Math.ceil((new Date().getTime() - new Date(supplier.lastAssessmentDate).getTime()) /
                (1000 * 60 * 60 * 24));
            if (daysSinceLastAssessment > 365) {
                recommendations.push("Annual assessment overdue. Schedule new comprehensive risk assessment.");
            }
            else if (daysSinceLastAssessment > 180) {
                recommendations.push("Last assessment was more than 6 months ago. Consider interim review.");
            }
        }
        // Check outstanding payments
        if (supplier.outstandingPayments && supplier.outstandingPayments > 0) {
            recommendations.push(`Supplier has outstanding payments (${supplier.outstandingPayments.toFixed(2)}). Review payment terms and follow up.`);
        }
        // Check delivery performance
        if (supplier.onTimeDeliveryRate && supplier.onTimeDeliveryRate < 90) {
            recommendations.push(`On-time delivery rate is low (${supplier.onTimeDeliveryRate.toFixed(2)}%). Review logistics and delivery processes.`);
        }
        // Check response time
        if (supplier.averageResponseTime && supplier.averageResponseTime > 48) {
            recommendations.push(`Average response time is high (${supplier.averageResponseTime} hours). Implement communication protocol improvements.`);
        }
        // Add category-specific recommendations
        categoryScores.forEach(category => {
            if (category.percentage < 70) {
                recommendations.push(`${category.category} compliance needs improvement (${category.percentage.toFixed(2)}%). ` +
                    "Review related controls, provide training, and conduct follow-up assessment.");
            }
        });
        // Add positive recommendations for good performance
        if (supplier.bivScore && supplier.bivScore > 80) {
            recommendations.push("Supplier demonstrates excellent overall performance. Consider long-term partnership and potential strategic collaboration.");
        }
        if (evidenceCompletionRate > 95) {
            recommendations.push("Excellent evidence management. Supplier shows strong compliance documentation practices.");
        }
        // Limit to top recommendations
        return recommendations.slice(0, 8);
    },
    // ========== GET VENDOR REPORT OPTIONS ==========
    getVendorReportOptions(vendorId) {
        return __awaiter(this, void 0, void 0, function* () {
            const suppliers = yield prisma_1.prisma.supplier.findMany({
                where: {
                    vendorId,
                    isDeleted: false,
                    isActive: true
                },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    category: true,
                    criticality: true,
                    riskLevel: true,
                    bivScore: true,
                    lastAssessmentDate: true
                },
                orderBy: { name: 'asc' }
            });
            return {
                suppliers,
                totalSuppliers: suppliers.length,
                highRiskSuppliers: suppliers.filter(s => s.riskLevel === 'HIGH' || s.riskLevel === 'CRITICAL').length,
                overdueAssessments: suppliers.filter(s => s.lastAssessmentDate &&
                    (new Date().getTime() - s.lastAssessmentDate.getTime()) > (90 * 24 * 60 * 60 * 1000)).length
            };
        });
    },
    // ========== GET REPORTS ==========
    getReports(userId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, options = {}) {
            const { page = 1, limit = 20, type, status, vendorId, supplierId, sortBy = 'createdAt', sortOrder = 'desc' } = options;
            // Convert string values to numbers
            const pageNumber = Number(page);
            const limitNumber = Number(limit);
            const skip = (pageNumber - 1) * limitNumber;
            // Validate permissions
            const { finalVendorId, finalSupplierId } = yield this.validateUserPermissions(userId, vendorId, supplierId);
            const where = { isDeleted: false };
            // Apply permission-based filters
            if (finalVendorId) {
                where.vendorId = finalVendorId;
            }
            if (finalSupplierId) {
                where.supplierId = finalSupplierId;
            }
            if (type) {
                where.reportType = type;
            }
            if (status) {
                where.status = status;
            }
            console.log("Query where clause:", JSON.stringify(where, null, 2));
            console.log("Skip:", skip, "Take:", limitNumber);
            const [reports, total] = yield Promise.all([
                prisma_1.prisma.report.findMany({
                    where,
                    include: {
                        creator: {
                            select: {
                                id: true,
                                email: true,
                                role: true
                            }
                        },
                        generatedFor: {
                            select: {
                                id: true,
                                email: true
                            }
                        }
                    },
                    orderBy: { [sortBy]: sortOrder },
                    skip,
                    take: limitNumber // Use the converted number
                }),
                prisma_1.prisma.report.count({ where })
            ]);
            return {
                reports,
                meta: {
                    page: pageNumber,
                    limit: limitNumber,
                    total,
                    pages: Math.ceil(total / limitNumber)
                }
            };
        });
    },
    // ========== GET REPORT BY ID ==========
    getReportById(reportId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const report = yield prisma_1.prisma.report.findUnique({
                where: { id: reportId },
                include: {
                    creator: {
                        select: {
                            id: true,
                            email: true,
                            role: true
                        }
                    },
                    generatedFor: {
                        select: {
                            id: true,
                            email: true
                        }
                    }
                }
            });
            if (!report) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "Report not found");
            }
            // Validate permissions
            yield this.validateUserPermissions(userId, report.vendorId, report.supplierId || undefined);
            // Mark as viewed if not already
            if (!report.viewedAt) {
                yield prisma_1.prisma.report.update({
                    where: { id: reportId },
                    data: { viewedAt: new Date(), status: client_1.ReportStatus.VIEWED }
                });
            }
            return report;
        });
    },
    // ========== UPDATE REPORT ==========
    updateReport(reportId, userId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const report = yield prisma_1.prisma.report.findUnique({
                where: { id: reportId }
            });
            if (!report) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "Report not found");
            }
            // Check permissions
            if (report.createdById !== userId) {
                throw new ApiError_1.default(http_status_1.default.FORBIDDEN, "You can only update reports you created");
            }
            const updatedReport = yield prisma_1.prisma.report.update({
                where: { id: reportId },
                data: {
                    title: data.title,
                    description: data.description,
                    status: data.status
                }
            });
            return updatedReport;
        });
    },
    // ========== DELETE REPORT ==========
    deleteReport(reportId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const report = yield prisma_1.prisma.report.findUnique({
                where: { id: reportId }
            });
            if (!report) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "Report not found");
            }
            // Check permissions
            if (report.createdById !== userId) {
                throw new ApiError_1.default(http_status_1.default.FORBIDDEN, "You can only delete reports you created");
            }
            yield prisma_1.prisma.report.update({
                where: { id: reportId },
                data: { isDeleted: true }
            });
            return {
                message: "Report deleted successfully"
            };
        });
    },
    // ========== SEND REPORT ==========
    sendReport(reportId, userId, recipientEmail) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            const report = yield prisma_1.prisma.report.findUnique({
                where: { id: reportId },
                include: {
                    creator: {
                        select: { email: true }
                    }
                }
            });
            if (!report) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "Report not found");
            }
            // Check permissions
            yield this.validateUserPermissions(userId, report.vendorId, report.supplierId || undefined);
            let recipientUserId;
            if (recipientEmail) {
                const recipient = yield prisma_1.prisma.user.findUnique({
                    where: { email: recipientEmail }
                });
                if (!recipient) {
                    throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "Recipient not found");
                }
                recipientUserId = recipient.id;
                // Get vendor name for email
                const vendor = yield prisma_1.prisma.vendor.findUnique({
                    where: { id: report.vendorId },
                    select: { companyName: true }
                });
                // Send email with report
                try {
                    yield mailtrap_service_1.mailtrapService.sendHtmlEmail({
                        to: recipientEmail,
                        subject: `Report: ${report.title}`,
                        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">${report.title}</h2>
              <p>You have received a new report from ${(_a = report.creator) === null || _a === void 0 ? void 0 : _a.email}.</p>
              
              <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
                <p><strong>Report Type:</strong> ${report.reportType}</p>
                <p><strong>Vendor:</strong> ${(vendor === null || vendor === void 0 ? void 0 : vendor.companyName) || 'N/A'}</p>
                <p><strong>Generated On:</strong> ${report.createdAt.toLocaleDateString()}</p>
                ${report.description ? `<p><strong>Description:</strong> ${report.description}</p>` : ''}
              </div>
                          <p style="color: #666; font-size: 14px; margin-top: 30px;">
                This report contains confidential information. Please handle it with care and do not share with unauthorized parties.
              </p>
              
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
              <p style="color: #666; font-size: 12px;">© ${new Date().getFullYear()} CyberNark. All rights reserved.</p>
            </div>
          `
                    });
                }
                catch (error) {
                    console.error("Failed to send report email:", error);
                    throw new ApiError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, "Failed to send report email");
                }
            }
            // Update report status
            yield prisma_1.prisma.report.update({
                where: { id: reportId },
                data: {
                    status: client_1.ReportStatus.SENT,
                    sentAt: new Date(),
                    generatedForId: recipientUserId || null
                }
            });
            // Create notification for recipient
            if (recipientUserId) {
                yield notification_service_1.NotificationService.createNotification({
                    data: {
                        userId: recipientUserId,
                        title: "New Report Received",
                        message: `You have received a new report: "${report.title}" from ${(_b = report.creator) === null || _b === void 0 ? void 0 : _b.email}`,
                        type: 'REPORT_GENERATED',
                        metadata: {
                            reportId: report.id,
                            reportType: report.reportType,
                            sender: (_c = report.creator) === null || _c === void 0 ? void 0 : _c.email,
                            documentUrl: report.documentUrl
                        }
                    }
                });
            }
            return {
                message: recipientEmail ? "Report sent successfully" : "Report marked as sent"
            };
        });
    },
    // ========== GET REPORT STATISTICS ==========
    getReportStatistics(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield prisma_1.prisma.user.findUnique({
                where: { id: userId },
                select: { role: true, vendorId: true, supplierId: true }
            });
            const where = { isDeleted: false };
            if ((user === null || user === void 0 ? void 0 : user.role) === client_1.UserRole.VENDOR && user.vendorId) {
                where.vendorId = user.vendorId;
            }
            else if ((user === null || user === void 0 ? void 0 : user.role) === client_1.UserRole.SUPPLIER && user.supplierId) {
                where.supplierId = user.supplierId;
            }
            const [totalReports, byType, byStatus, recentReports] = yield Promise.all([
                prisma_1.prisma.report.count({ where }),
                prisma_1.prisma.report.groupBy({
                    by: ['reportType'],
                    where,
                    _count: true,
                    _max: { createdAt: true }
                }),
                prisma_1.prisma.report.groupBy({
                    by: ['status'],
                    where,
                    _count: true
                }),
                prisma_1.prisma.report.findMany({
                    where,
                    orderBy: { createdAt: 'desc' },
                    take: 5,
                    select: {
                        id: true,
                        title: true,
                        reportType: true,
                        status: true,
                        createdAt: true,
                        fileSize: true
                    }
                })
            ]);
            const typeStats = {};
            byType.forEach(item => {
                typeStats[item.reportType] = {
                    count: item._count,
                    latest: item._max.createdAt
                };
            });
            const statusStats = {};
            byStatus.forEach(item => {
                statusStats[item.status] = item._count;
            });
            // Calculate total file size
            const totalFileSize = recentReports.reduce((sum, report) => sum + (report.fileSize || 0), 0);
            return {
                totalReports,
                byType: typeStats,
                byStatus: statusStats,
                recentReports,
                storageUsage: {
                    total: totalFileSize,
                    average: recentReports.length > 0 ? totalFileSize / recentReports.length : 0
                }
            };
        });
    },
    // ========== BULK GENERATE REPORTS ==========
    bulkGenerateReports(userId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const { finalVendorId } = yield this.validateUserPermissions(userId, data.vendorId);
            if (!finalVendorId) {
                throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, "Vendor ID is required");
            }
            let suppliers = [];
            if (data.supplierIds && data.supplierIds.length > 0) {
                // Generate reports for specific suppliers
                suppliers = yield prisma_1.prisma.supplier.findMany({
                    where: {
                        id: { in: data.supplierIds },
                        vendorId: finalVendorId,
                        isDeleted: false
                    }
                });
            }
            else {
                // Generate reports for all suppliers
                suppliers = yield prisma_1.prisma.supplier.findMany({
                    where: {
                        vendorId: finalVendorId,
                        isDeleted: false
                    }
                });
            }
            if (suppliers.length === 0) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "No suppliers found");
            }
            const reports = [];
            // Generate report for each supplier
            for (const supplier of suppliers) {
                try {
                    const report = yield this.generateReport(userId, Object.assign(Object.assign({}, data), { supplierId: supplier.id, vendorId: finalVendorId, title: `${data.title} - ${supplier.name}` }));
                    reports.push(report);
                }
                catch (error) {
                    console.error(`Failed to generate report for supplier ${supplier.id}:`, error);
                    // Continue with other suppliers
                }
            }
            return {
                message: `Successfully generated ${reports.length} out of ${suppliers.length} reports`,
                reports
            };
        });
    },
    // ========== UPLOAD EXTERNAL REPORT ==========
    uploadExternalReport(userId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            // Validate permissions
            const { finalVendorId, finalSupplierId } = yield this.validateUserPermissions(userId, data.vendorId, data.supplierId);
            if (!finalVendorId) {
                throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, "Vendor ID is required");
            }
            const report = yield prisma_1.prisma.report.create({
                data: {
                    title: data.title,
                    reportType: data.reportType,
                    description: data.description,
                    documentUrl: data.documentUrl,
                    documentType: data.documentType,
                    fileSize: data.fileSize,
                    parameters: data.parameters || {},
                    createdById: userId,
                    vendorId: finalVendorId,
                    supplierId: finalSupplierId || null,
                    status: client_1.ReportStatus.GENERATED
                }
            });
            // Create notification
            yield notification_service_1.NotificationService.createNotification({
                data: {
                    userId,
                    title: "External Report Uploaded",
                    message: `External report "${data.title}" has been uploaded successfully`,
                    type: 'REPORT_GENERATED',
                    metadata: {
                        reportId: report.id,
                        reportType: data.reportType,
                        documentUrl: data.documentUrl
                    }
                }
            });
            return report;
        });
    }
};
