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
            const nis2Compliance = this.calculateNIS2Compliance(suppliers, today, yesterday);
            // ========== CALCULATE SUPPLIER STATS ==========
            const supplierStats = this.calculateSupplierStats(suppliersWithProblems, vendorId, thirtyDaysAgo);
            // ========== CALCULATE ASSESSMENT STATS ==========
            const assessmentStats = this.calculateAssessmentStats(enrichedAssessments, suppliers);
            // ========== CALCULATE PROBLEM STATS ==========
            const problemStats = this.calculateProblemStats(enrichedProblems);
            // ========== CALCULATE CONTRACT STATS ==========
            const contractStats = this.calculateContractStats(contracts, today, suppliers);
            // ========== CALCULATE COMPLIANCE OVERVIEW ==========
            const complianceOverview = this.calculateComplianceOverview(suppliers);
            // ========== CALCULATE COMPLIANCE GAUGE ==========
            const complianceGauge = this.calculateComplianceGauge(suppliers, enrichedAssessments, enrichedProblems, filteredDocuments, sendedAlertNotifications);
            // ========== CALCULATE ADDITIONAL STATS ==========
            const additionalStats = this.calculateAdditionalStats(filteredDocuments, contracts, suppliers, activities, notifications, (_a = vendor.user) === null || _a === void 0 ? void 0 : _a.lastLoginAt);
            // ========== CALCULATE CHARTS DATA ==========
            const charts = this.calculateChartsData(enrichedAssessments, enrichedProblems, suppliers, thirtyDaysAgo);
            // ========== CALCULATE RECENT UPDATES ==========
            const recentUpdates = this.calculateRecentUpdates(enrichedAssessments, enrichedProblems, filteredDocuments, contracts, suppliers);
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
    // ========== CALCULATE NIS2 COMPLIANCE ==========
    calculateNIS2Compliance(suppliers, today, yesterday) {
        const compliantSuppliers = suppliers.filter(s => s.nis2Compliant).length;
        const nonCompliantSuppliers = suppliers.length - compliantSuppliers;
        // Calculate NIS2 compliance score (weighted average)
        let totalNIS2Score = 0;
        suppliers.forEach(supplier => {
            if (supplier.nis2Compliant) {
                totalNIS2Score += 100;
            }
            else if (supplier.bivScore) {
                // Use BIV score as proxy for NIS2 compliance
                totalNIS2Score += Math.min(supplier.bivScore.toNumber(), 100);
            }
            else {
                totalNIS2Score += 0;
            }
        });
        const overallScore = suppliers.length > 0 ? totalNIS2Score / suppliers.length : 0;
        // Calculate today's improvement (simplified - in real app, track historical data)
        const todayImprovement = Math.random() * 5; // Placeholder
        // Determine trend
        let trend = 'STABLE';
        if (todayImprovement > 1)
            trend = 'UP';
        else if (todayImprovement < -1)
            trend = 'DOWN';
        return {
            overallScore: parseFloat(overallScore.toFixed(2)),
            todayImprovement: parseFloat(todayImprovement.toFixed(2)),
            totalImprovement: parseFloat((overallScore - 50).toFixed(2)), // Placeholder
            trend,
            lastUpdated: new Date(),
            compliantSuppliers,
            nonCompliantSuppliers
        };
    },
    // ========== CALCULATE SUPPLIER STATS ==========
    calculateSupplierStats(suppliers, vendorId, thirtyDaysAgo) {
        const pendingInvitations = suppliers.filter(s => !s.userId && s.invitationStatus === 'PENDING').length;
        const recentAdditions = suppliers.filter(s => s.createdAt >= thirtyDaysAgo).length;
        return {
            totalSuppliers: suppliers.length,
            activeSuppliers: suppliers.filter(s => s.isActive).length,
            pendingInvitations,
            recentAdditions
        };
    },
    // ========== CALCULATE ASSESSMENT STATS ==========
    calculateAssessmentStats(assessments, suppliers) {
        const pendingAssessments = assessments.filter(a => a.status === 'DRAFT' || a.status === 'PENDING').length;
        const completedAssessments = assessments.filter(a => a.status === 'APPROVED').length;
        // Calculate overdue assessments (submitted > 7 days ago and not approved)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const overdueAssessments = assessments.filter(a => a.submittedAt &&
            a.submittedAt < sevenDaysAgo &&
            a.status !== 'APPROVED').length;
        // Calculate submission rate
        const totalRequiredAssessments = suppliers.length * 2; // Assuming 2 assessments per supplier
        const submissionRate = totalRequiredAssessments > 0 ?
            (completedAssessments / totalRequiredAssessments) * 100 : 0;
        // Get recent submissions
        const recentSubmissions = assessments
            .filter(a => a.submittedAt)
            .slice(0, 5)
            .map(a => {
            var _a, _b;
            return ({
                id: a.id,
                supplierName: ((_a = a.supplier) === null || _a === void 0 ? void 0 : _a.name) || 'Unknown',
                assessmentTitle: a.assessment.title,
                submittedAt: a.submittedAt || a.createdAt,
                score: ((_b = a.score) === null || _b === void 0 ? void 0 : _b.toNumber()) || null
            });
        });
        return {
            pendingAssessments,
            completedAssessments,
            overdueAssessments,
            submissionRate: parseFloat(submissionRate.toFixed(2)),
            recentSubmissions
        };
    },
    // ========== CALCULATE PROBLEM STATS ==========
    calculateProblemStats(problems) {
        const criticalProblems = problems.filter(p => p.priority === 'URGENT' || p.priority === 'HIGH').length;
        const problemsByPriority = {
            urgent: problems.filter(p => p.priority === 'URGENT').length,
            high: problems.filter(p => p.priority === 'HIGH').length,
            medium: problems.filter(p => p.priority === 'MEDIUM').length,
            low: problems.filter(p => p.priority === 'LOW').length
        };
        // Calculate average resolution time (simplified)
        const resolvedProblems = problems.filter(p => p.status === 'RESOLVED' && p.resolvedAt && p.createdAt);
        let totalResolutionTime = 0;
        resolvedProblems.forEach(p => {
            const resolutionTime = p.resolvedAt.getTime() - p.createdAt.getTime();
            totalResolutionTime += resolutionTime / (1000 * 60 * 60); // Convert to hours
        });
        const averageResolutionTime = resolvedProblems.length > 0 ?
            totalResolutionTime / resolvedProblems.length : 0;
        // Calculate unresolved overdue problems
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const unresolvedOverdue = problems.filter(p => p.status !== 'RESOLVED' &&
            p.createdAt < sevenDaysAgo).length;
        return {
            activeProblems: problems.length,
            criticalProblems,
            problemsByPriority,
            averageResolutionTime: parseFloat(averageResolutionTime.toFixed(2)),
            unresolvedOverdue
        };
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
    // ========== CALCULATE CONTRACT STATS ==========
    calculateContractStats(contracts, today, suppliers) {
        const thirtyDaysFromNow = new Date(today);
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
        // Filter contracts with end dates
        const contractsWithEndDate = contracts.filter(c => c.contractEndDate);
        // Categorize contracts
        const expiringContracts = contractsWithEndDate.filter(c => c.contractEndDate > today &&
            c.contractEndDate <= thirtyDaysFromNow);
        const expiredContracts = contractsWithEndDate.filter(c => c.contractEndDate < today);
        const activeContracts = contractsWithEndDate.filter(c => c.contractEndDate > thirtyDaysFromNow);
        // const contractsByStatus = {
        //   active: activeContracts.length,
        //   expiring: expiringContracts.length,
        //   expired: expiredContracts.length,
        //   terminated: contracts.filter(c => !c.contractEndDate).length,
        //   total: contracts.length
        // };
        // Get recent expirations (contracts expiring soon)
        const recentExpirations = expiringContracts
            .sort((a, b) => a.contractEndDate.getTime() - b.contractEndDate.getTime())
            .slice(0, 5)
            .map(c => {
            const daysRemaining = Math.ceil((c.contractEndDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            // Find supplier details
            const supplier = suppliers.find(s => s.id === c.supplierId) || {};
            return {
                id: c.id,
                supplierId: c.supplierId,
                supplierName: c.name || supplier.name || 'Unknown Supplier',
                supplierEmail: supplier.email || c.email || '',
                contactPerson: supplier.contactPerson || c.contactPerson || '',
                category: c.category || supplier.category || '',
                criticality: c.criticality || supplier.criticality || 'MEDIUM',
                contractStartDate: c.contractStartDate,
                endDate: c.contractEndDate,
                daysRemaining,
                contractValue: c.totalContractValue || supplier.totalContractValue || 0,
                outstandingPayments: c.outstandingPayments || supplier.outstandingPayments || 0,
                status: 'EXPIRING'
            };
        });
        // Get expired contract details
        const expiredContractsDetails = expiredContracts
            .sort((a, b) => b.contractEndDate.getTime() - a.contractEndDate.getTime())
            .slice(0, 10) // Show more expired contracts since they're important
            .map(c => {
            const daysExpired = Math.ceil((today.getTime() - c.contractEndDate.getTime()) / (1000 * 60 * 60 * 24));
            // Find supplier details
            const supplier = suppliers.find(s => s.id === c.supplierId) || {};
            return {
                id: c.id,
                supplierId: c.supplierId,
                supplierName: c.name || supplier.name || 'Unknown Supplier',
                supplierEmail: supplier.email || c.email || '',
                contactPerson: supplier.contactPerson || c.contactPerson || '',
                category: c.category || supplier.category || '',
                criticality: c.criticality || supplier.criticality || 'MEDIUM',
                contractStartDate: c.contractStartDate,
                endDate: c.contractEndDate,
                daysExpired,
                contractValue: c.totalContractValue || supplier.totalContractValue || 0,
                outstandingPayments: c.outstandingPayments || supplier.outstandingPayments || 0,
                status: 'EXPIRED',
                isActive: supplier.isActive !== undefined ? supplier.isActive : true,
                invitationStatus: supplier.invitationStatus || 'ACCEPTED',
                lastAssessmentDate: supplier.lastAssessmentDate,
                bivScore: supplier.bivScore,
            };
        });
        return {
            // Summary statistics
            expiringContracts: expiringContracts.length,
            expiredContracts: expiredContracts.length,
            totalContract: contracts.length,
            // Detailed lists
            recentExpirations, // Contracts expiring soon
            expiredContractsDetails, // Expired contracts with details      
            // Risk analysis
            highRiskExpired: expiredContracts.filter(c => c.criticality === 'HIGH' || c.criticality === 'CRITICAL').length,
            overdueRenewals: expiredContracts.filter(c => daysExpired(c.contractEndDate) > 30).length
        };
        // Helper function to calculate days expired
        function daysExpired(endDate) {
            return Math.ceil((today.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24));
        }
    },
    // ========== CALCULATE COMPLIANCE OVERVIEW ==========
    calculateComplianceOverview(suppliers) {
        const riskDistribution = {
            low: suppliers.filter(s => s.riskLevel === 'LOW').length,
            medium: suppliers.filter(s => s.riskLevel === 'MEDIUM').length,
            high: suppliers.filter(s => s.riskLevel === 'HIGH').length,
            critical: suppliers.filter(s => s.riskLevel === 'CRITICAL').length
        };
        const totalSuppliers = suppliers.length;
        // const lowRisk = totalSuppliers > 0 ? (riskDistribution.low / totalSuppliers) * 100 : 0;
        // const mediumRisk = totalSuppliers > 0 ? (riskDistribution.medium / totalSuppliers) * 100 : 0;
        // const highRisk = totalSuppliers > 0 ? ((riskDistribution.high + riskDistribution.critical) / totalSuppliers) * 100 : 0;
        const lowRisk = riskDistribution.low;
        const mediumRisk = riskDistribution.medium;
        const highRisk = riskDistribution.high;
        // Calculate average BIV score
        const totalBIVScore = suppliers.reduce((sum, s) => { var _a; return sum + (((_a = s.bivScore) === null || _a === void 0 ? void 0 : _a.toNumber()) || 0); }, 0);
        const averageBIVScore = suppliers.length > 0 ? totalBIVScore / suppliers.length : 0;
        // Get top risks (suppliers with lowest BIV scores)
        const topRisks = suppliers
            .filter(s => s.bivScore !== null)
            .sort((a, b) => { var _a, _b; return (((_a = a.bivScore) === null || _a === void 0 ? void 0 : _a.toNumber()) || 0) - (((_b = b.bivScore) === null || _b === void 0 ? void 0 : _b.toNumber()) || 0); })
            .slice(0, 5)
            .map(s => {
            var _a;
            return ({
                id: s.id,
                supplierName: s.name,
                bivScore: ((_a = s.bivScore) === null || _a === void 0 ? void 0 : _a.toNumber()) || 0,
                riskLevel: s.riskLevel || 'UNKNOWN',
                lastAssessment: s.lastAssessmentDate
            });
        });
        return {
            lowRisk: parseFloat(lowRisk.toFixed(2)),
            mediumRisk: parseFloat(mediumRisk.toFixed(2)),
            highRisk: parseFloat(highRisk.toFixed(2)),
            riskDistribution,
            averageBIVScore: parseFloat(averageBIVScore.toFixed(2)),
            topRisks
        };
    },
    // ========== CALCULATE COMPLIANCE GAUGE ==========
    calculateComplianceGauge(suppliers, assessments, problems, documents, sendedAlertNotifications) {
        // Define compliance criteria
        const compliantSuppliers = suppliers.filter(supplier => {
            // Check if supplier has at least one approved assessment
            // const hasApprovedAssessments = assessments.some(a =>
            //   a.supplierId === supplier.id && a.status === 'APPROVED'
            // );
            // Check if supplier has active problems
            console.log("Problem", problems);
            const hasActiveProblems = problems.some(p => p.supplierId === supplier.id && p.status == 'IN_PROGRESS' && p.status == 'OPEN');
            console.log("sendedAlertNotifications", sendedAlertNotifications);
            // Check if supplier has at least one notification sent
            const hasSentNotifications = sendedAlertNotifications.some(n => { var _a; return ((_a = n.metadata) === null || _a === void 0 ? void 0 : _a.supplierId) === supplier.id; });
            // Return true only if all conditions are satisfied
            return hasActiveProblems || hasSentNotifications;
        }).length;
        console.log("Compliant Suppliers Count:", compliantSuppliers);
        console.log("Total Supplier:", suppliers.length);
        const nonCompliantSuppliers = suppliers.length - compliantSuppliers;
        // const compliancePercentage = suppliers.length > 50 ?
        //   (compliantSuppliers / suppliers.length) * 100 : 0;
        let compliancePercentage = 0;
        // Each compliant supplier = 1%
        // So if compliantSuppliers = 1 → 1%, 2 → 2%, etc.
        if (compliantSuppliers > 0) {
            compliancePercentage = compliantSuppliers;
            // Cap at 100%
            if (compliancePercentage > 100)
                compliancePercentage = 100;
        }
        console.log("Compliance Percentage:", compliancePercentage, "%");
        console.log("Compliance Percentage:", compliancePercentage, "%");
        // Calculate NIS2 compliance status
        const nis2Compliant = suppliers.filter(s => s.nis2Compliant).length;
        const partiallyCompliant = suppliers.filter(s => s.bivScore && s.bivScore >= 50 && s.bivScore < 71).length;
        // Find suppliers needing improvement
        const improvementNeeded = suppliers
            .filter(s => {
            const supplierAssessments = assessments.filter(a => a.supplierId === s.id);
            const supplierProblems = problems.filter(p => p.supplierId === s.id);
            const supplierDocuments = documents.filter(d => d.supplierId === s.id);
            const missingAssessments = supplierAssessments.length === 0 ? 1 : 0;
            const expiredDocuments = supplierDocuments.filter(d => d.expiryDate && d.expiryDate < new Date()).length;
            const pendingProblems = supplierProblems.filter(p => p.status !== 'RESOLVED').length;
            return missingAssessments > 0 || expiredDocuments > 0 || pendingProblems > 0;
        })
            .slice(0, 5)
            .map(s => {
            const supplierAssessments = assessments.filter(a => a.supplierId === s.id);
            const supplierProblems = problems.filter(p => p.supplierId === s.id);
            const supplierDocuments = documents.filter(d => d.supplierId === s.id);
            return {
                supplierId: s.id,
                supplierName: s.name,
                missingAssessments: supplierAssessments.length === 0 ? 1 : 0,
                expiredDocuments: supplierDocuments.filter(d => d.expiryDate && d.expiryDate < new Date()).length,
                pendingProblems: supplierProblems.filter(p => p.status !== 'RESOLVED').length
            };
        });
        return {
            compliantSuppliers,
            nonCompliantSuppliers,
            compliancePercentage: parseFloat(compliancePercentage.toFixed(2)),
            nis2Compliant,
            partiallyCompliant,
            nonCompliant: nonCompliantSuppliers,
            improvementNeeded
        };
    },
    // ========== CALCULATE ADDITIONAL STATS ==========
    calculateAdditionalStats(documents, contracts, suppliers, activities, notifications, lastLoginAt) {
        // Document stats
        const totalDocuments = documents.length;
        const pendingReview = documents.filter(d => d.status === 'PENDING' || d.status === 'UNDER_REVIEW').length;
        const expiredDocuments = documents.filter(d => d.expiryDate && d.expiryDate < new Date()).length;
        const verificationRate = totalDocuments > 0 ?
            (documents.filter(d => d.isVerified).length / totalDocuments) * 100 : 0;
        // Financial stats
        const totalContractValue = contracts.reduce((sum, c) => { var _a; return sum + (((_a = c.totalContractValue) === null || _a === void 0 ? void 0 : _a.toNumber()) || 0); }, 0);
        const outstandingPayments = contracts.reduce((sum, c) => { var _a; return sum + (((_a = c.outstandingPayments) === null || _a === void 0 ? void 0 : _a.toNumber()) || 0); }, 0);
        const averageContractValue = contracts.length > 0 ?
            totalContractValue / contracts.length : 0;
        // Performance stats (simplified)
        const averageResponseTime = 24; // Placeholder - would calculate from problem response times
        const onTimeDeliveryRate = 95; // Placeholder
        const satisfactionScore = 8.5; // Placeholder
        // Activity stats
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const recentActivities = activities.filter(a => a.createdAt >= sevenDaysAgo).length;
        // Calculate login frequency (simplified)
        const loginFrequency = lastLoginAt ? 5 : 0; // Placeholder
        return {
            documentStats: {
                totalDocuments,
                pendingReview,
                expiredDocuments,
                verificationRate: parseFloat(verificationRate.toFixed(2))
            },
            financialStats: {
                totalContractValue: parseFloat(totalContractValue.toFixed(2)),
                outstandingPayments: parseFloat(outstandingPayments.toFixed(2)),
                averageContractValue: parseFloat(averageContractValue.toFixed(2))
            },
            performanceStats: {
                averageResponseTime,
                onTimeDeliveryRate,
                satisfactionScore
            },
            activityStats: {
                recentActivities,
                loginFrequency,
                notificationCount: notifications
            }
        };
    },
    // ========== CALCULATE CHARTS DATA ==========
    calculateChartsData(assessments, problems, suppliers, thirtyDaysAgo) {
        // Generate risk trend data (last 12 weeks)
        const riskTrend = [];
        for (let i = 11; i >= 0; i--) {
            const weekStart = new Date();
            weekStart.setDate(weekStart.getDate() - (i * 7));
            const weekLabel = weekStart.toLocaleDateString('default', { month: 'short', day: 'numeric' });
            // Simplified - in real app, you'd query historical data
            riskTrend.push({
                date: weekLabel,
                low: Math.floor(Math.random() * 20) + 10,
                medium: Math.floor(Math.random() * 15) + 5,
                high: Math.floor(Math.random() * 10) + 1,
                critical: Math.floor(Math.random() * 5)
            });
        }
        // Generate compliance progress (last 6 months)
        const complianceProgress = [];
        for (let i = 5; i >= 0; i--) {
            const month = new Date();
            month.setMonth(month.getMonth() - i);
            const monthLabel = month.toLocaleDateString('default', { month: 'short' });
            complianceProgress.push({
                month: monthLabel,
                complianceRate: Math.floor(Math.random() * 30) + 60,
                target: 80
            });
        }
        // Assessment completion by category
        const assessmentCompletion = [
            { category: 'Initial', completed: assessments.filter(a => a.stage === 'INITIAL' && a.status === 'APPROVED').length, pending: assessments.filter(a => a.stage === 'INITIAL' && a.status !== 'APPROVED').length },
            { category: 'Full', completed: assessments.filter(a => a.stage === 'FULL' && a.status === 'APPROVED').length, pending: assessments.filter(a => a.stage === 'FULL' && a.status !== 'APPROVED').length },
            { category: 'Security', completed: Math.floor(Math.random() * 15), pending: Math.floor(Math.random() * 5) },
            { category: 'Compliance', completed: Math.floor(Math.random() * 12), pending: Math.floor(Math.random() * 8) },
            { category: 'Business', completed: Math.floor(Math.random() * 20), pending: Math.floor(Math.random() * 10) }
        ];
        // Problem resolution trend (last 8 weeks)
        const problemResolution = [];
        for (let i = 7; i >= 0; i--) {
            const weekStart = new Date();
            weekStart.setDate(weekStart.getDate() - (i * 7));
            const weekLabel = `Week ${8 - i}`;
            problemResolution.push({
                week: weekLabel,
                resolved: Math.floor(Math.random() * 10) + 5,
                reported: Math.floor(Math.random() * 12) + 3
            });
        }
        return {
            riskTrend,
            complianceProgress,
            assessmentCompletion,
            problemResolution
        };
    },
    // ========== CALCULATE RECENT UPDATES ==========
    calculateRecentUpdates(assessments, problems, documents, contracts, suppliers) {
        const updates = [];
        // Add recent assessment submissions
        assessments
            .filter(a => a.submittedAt)
            .slice(0, 3)
            .forEach(a => {
            var _a;
            updates.push({
                type: 'ASSESSMENT',
                title: `New Assessment Submitted`,
                description: `${((_a = a.supplier) === null || _a === void 0 ? void 0 : _a.name) || 'Supplier'} submitted ${a.assessment.title}`,
                timestamp: a.submittedAt || a.createdAt,
                priority: a.score && a.score < 50 ? 'HIGH' : 'MEDIUM',
                actionRequired: a.status === 'SUBMITTED' || a.status === 'UNDER_REVIEW'
            });
        });
        // Add recent problems
        problems
            .filter(p => p.priority === 'URGENT' || p.priority === 'HIGH')
            .slice(0, 2)
            .forEach(p => {
            var _a;
            updates.push({
                type: 'PROBLEM',
                title: `${p.priority} Priority Problem`,
                description: `${((_a = p.supplier) === null || _a === void 0 ? void 0 : _a.name) || 'Supplier'}: ${p.title}`,
                timestamp: p.createdAt,
                priority: p.priority === 'URGENT' ? 'HIGH' : 'MEDIUM',
                actionRequired: true
            });
        });
        // Add expiring contracts
        const today = new Date();
        const sevenDaysFromNow = new Date();
        sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
        contracts
            .filter(c => c.contractEndDate && c.contractEndDate <= sevenDaysFromNow && c.contractEndDate > today)
            .slice(0, 2)
            .forEach(c => {
            const daysRemaining = Math.ceil((c.contractEndDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            updates.push({
                type: 'CONTRACT',
                title: `Contract Expiring Soon`,
                description: `${c.name}'s contract expires in ${daysRemaining} days`,
                timestamp: new Date(),
                priority: daysRemaining <= 3 ? 'HIGH' : 'MEDIUM',
                actionRequired: true
            });
        });
        // Add pending documents
        documents
            .filter(d => d.status === 'PENDING' || d.status === 'UNDER_REVIEW')
            .slice(0, 2)
            .forEach(d => {
            updates.push({
                type: 'DOCUMENT',
                title: `Document Pending Review`,
                description: `${d.name} requires review`,
                timestamp: d.createdAt,
                priority: 'MEDIUM',
                actionRequired: true
            });
        });
        // Sort by timestamp
        updates.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        return updates.slice(0, 10);
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
