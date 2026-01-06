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
exports.comprehensiveMonitorService = exports.ComprehensiveMonitorService = void 0;
// src/services/comprehensive-monitor.service.ts
const client_1 = require("@prisma/client");
const cron_1 = require("cron");
const notification_service_1 = require("../app/modules/notification/notification.service");
const prisma = new client_1.PrismaClient();
class ComprehensiveMonitorService {
    constructor() {
        this.riskCheckJob = null;
        this.contractCheckJob = null;
        this.assessmentReminderJob = null;
        this.riskUpdateJob = null;
    }
    // ========== START ALL MONITORS ==========
    startAllMonitors() {
        console.log('🚀 Starting comprehensive monitoring services...');
        // Risk checks every 6 hours
        this.riskCheckJob = new cron_1.CronJob('0 */6 * * *', () => {
            console.log('🔍 Running high-risk supplier check...');
            this.checkHighRiskSuppliers();
        });
        // Contract expiry checks daily at 8 AM
        this.contractCheckJob = new cron_1.CronJob('0 8 * * *', () => {
            console.log('📅 Running contract expiry check...');
            this.checkExpiringContracts();
        });
        // Assessment reminders every day at 9 AM
        this.assessmentReminderJob = new cron_1.CronJob('0 9 * * *', () => {
            console.log('📝 Running assessment completion check...');
            this.checkIncompleteAssessments();
        });
        this.riskCheckJob.start();
        this.contractCheckJob.start();
        this.assessmentReminderJob.start();
        console.log('✅ All monitoring services started');
        // Run initial checks after startup
        setTimeout(() => {
            this.checkHighRiskSuppliers();
            this.checkExpiringContracts();
            this.checkIncompleteAssessments();
            this.checkSuppliersWithNoAssessments();
        }, 15000);
    }
    // ========== STOP ALL MONITORS ==========
    stopAllMonitors() {
        if (this.riskCheckJob) {
            this.riskCheckJob.stop();
            console.log('⏹️ Risk check monitor stopped');
        }
        if (this.contractCheckJob) {
            this.contractCheckJob.stop();
            console.log('⏹️ Contract check monitor stopped');
        }
        if (this.assessmentReminderJob) {
            this.assessmentReminderJob.stop();
            console.log('⏹️ Assessment reminder monitor stopped');
        }
        if (this.riskUpdateJob) {
            this.riskUpdateJob.stop();
            console.log('⏹️ Risk update monitor stopped');
        }
    }
    // ========== CHECK HIGH RISK SUPPLIERS (EXISTING) ==========
    checkHighRiskSuppliers() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            try {
                console.log('🔄 Scanning for high-risk suppliers...');
                const highRiskSuppliers = yield prisma.supplier.findMany({
                    where: {
                        riskLevel: {
                            in: ['HIGH', 'CRITICAL']
                        },
                        isDeleted: false,
                        isActive: true,
                        vendor: {
                            isDeleted: false,
                            isActive: true
                        }
                    },
                    include: {
                        vendor: {
                            include: {
                                user: {
                                    select: {
                                        id: true,
                                        email: true
                                    }
                                }
                            }
                        },
                        user: {
                            select: {
                                id: true,
                                email: true
                            }
                        }
                    }
                });
                console.log(`📊 Found ${highRiskSuppliers.length} high-risk suppliers`);
                for (const supplier of highRiskSuppliers) {
                    try {
                        // ===============================
                        // 1️⃣ NOTIFICATION TO VENDOR
                        // ===============================
                        if ((_b = (_a = supplier.vendor) === null || _a === void 0 ? void 0 : _a.user) === null || _b === void 0 ? void 0 : _b.id) {
                            yield this.sendRiskNotificationToVendor(supplier);
                        }
                        // ===============================
                        // 2️⃣ NOTIFICATION TO SUPPLIER (if they have a user account)
                        // ===============================
                        if ((_c = supplier.user) === null || _c === void 0 ? void 0 : _c.id) {
                            yield this.sendRiskNotificationToSupplier(supplier);
                        }
                    }
                    catch (error) {
                        console.error(`❌ Error processing supplier ${supplier.id}:`, error);
                    }
                }
                // Send consolidated report if many high-risk suppliers
                if (highRiskSuppliers.length >= 3) {
                    yield this.sendConsolidatedRiskReport(highRiskSuppliers);
                }
            }
            catch (error) {
                console.error('❌ Error in checkHighRiskSuppliers:', error);
            }
        });
    }
    // ========== SEND RISK NOTIFICATION TO VENDOR (EXISTING) ==========
    sendRiskNotificationToVendor(supplier) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const vendorUserId = supplier.vendor.user.id;
            // Check if risk notification already sent today
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const existingNotification = yield prisma.notification.findFirst({
                where: {
                    userId: vendorUserId,
                    type: 'RISK_ALERT',
                    metadata: {
                        path: ['supplierId'],
                        equals: supplier.id
                    },
                    createdAt: {
                        gte: today
                    }
                }
            });
            if (existingNotification) {
                console.log(`⏭️ Risk alert already sent today to vendor for supplier: ${supplier.name}`);
                return;
            }
            // Create notification for vendor
            yield notification_service_1.NotificationService.createNotification({
                userId: vendorUserId,
                title: `🚨 High Risk Supplier: ${supplier.name}`,
                message: `Your supplier "${supplier.name}" has been identified as ${supplier.riskLevel} risk level. Immediate review recommended.`,
                type: 'RISK_ALERT',
                metadata: {
                    supplierId: supplier.id,
                    supplierName: supplier.name,
                    riskLevel: supplier.riskLevel,
                    overallScore: supplier.overallScore,
                    bivScore: supplier.bivScore,
                    lastAssessmentDate: (_a = supplier.lastAssessmentDate) === null || _a === void 0 ? void 0 : _a.toISOString(),
                    complianceRate: supplier.complianceRate,
                    vendorId: supplier.vendorId,
                    isSupplierUserExists: !!((_b = supplier.user) === null || _b === void 0 ? void 0 : _b.id)
                },
                priority: 'HIGH'
            });
            console.log(`✅ Risk alert sent to VENDOR for supplier: ${supplier.name}`);
        });
    }
    // ========== SEND RISK NOTIFICATION TO SUPPLIER (EXISTING) ==========
    sendRiskNotificationToSupplier(supplier) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const supplierUserId = supplier.user.id;
            // Check if risk notification already sent today
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const existingNotification = yield prisma.notification.findFirst({
                where: {
                    userId: supplierUserId,
                    type: 'RISK_ALERT',
                    metadata: {
                        path: ['supplierId'],
                        equals: supplier.id
                    },
                    createdAt: {
                        gte: today
                    }
                }
            });
            if (existingNotification) {
                console.log(`⏭️ Risk alert already sent today to supplier: ${supplier.name}`);
                return;
            }
            // Create notification for supplier
            yield notification_service_1.NotificationService.createNotification({
                userId: supplierUserId,
                title: `⚠️ Risk Level Update: ${supplier.riskLevel}`,
                message: `Your risk level has been updated to ${supplier.riskLevel}. Please review your compliance metrics and take necessary actions.`,
                type: 'RISK_ALERT',
                metadata: {
                    supplierId: supplier.id,
                    supplierName: supplier.name,
                    riskLevel: supplier.riskLevel,
                    overallScore: supplier.overallScore,
                    bivScore: supplier.bivScore,
                    complianceRate: supplier.complianceRate,
                    vendorName: (_a = supplier.vendor) === null || _a === void 0 ? void 0 : _a.companyName,
                    lastAssessmentDate: (_b = supplier.lastAssessmentDate) === null || _b === void 0 ? void 0 : _b.toISOString(),
                    recommendedActions: [
                        'Review security controls',
                        'Update compliance documents',
                        'Complete pending assessments',
                        'Contact vendor for support'
                    ]
                },
                priority: 'HIGH'
            });
            console.log(`✅ Risk alert sent to SUPPLIER: ${supplier.name}`);
        });
    }
    // ========== CHECK EXPIRING CONTRACTS (EXISTING) ==========
    checkExpiringContracts() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            try {
                console.log('🔄 Scanning for expiring contracts...');
                const today = new Date();
                const thirtyDaysFromNow = new Date();
                thirtyDaysFromNow.setDate(today.getDate() + 30);
                // Find contracts expiring within different timeframes
                const expiringContracts = yield prisma.supplier.findMany({
                    where: {
                        contractEndDate: {
                            not: null,
                            gte: today, // Not expired yet
                            lte: thirtyDaysFromNow // Within 30 days
                        },
                        isDeleted: false,
                        isActive: true,
                        vendor: {
                            isDeleted: false,
                            isActive: true
                        }
                    },
                    include: {
                        vendor: {
                            include: {
                                user: {
                                    select: {
                                        id: true,
                                        email: true
                                    }
                                }
                            }
                        },
                        user: {
                            select: {
                                id: true,
                                email: true
                            }
                        }
                    },
                    orderBy: {
                        contractEndDate: 'asc'
                    }
                });
                console.log(`📊 Found ${expiringContracts.length} contracts expiring within 30 days`);
                for (const supplier of expiringContracts) {
                    try {
                        const daysLeft = Math.ceil((supplier.contractEndDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                        // Determine notification type and priority based on days left
                        let notificationType;
                        let priority;
                        if (daysLeft <= 7) {
                            notificationType = 'CONTRACT_EXPIRY';
                            priority = 'HIGH';
                        }
                        else if (daysLeft <= 15) {
                            notificationType = 'CONTRACT_EXPIRING_SOON';
                            priority = 'MEDIUM';
                        }
                        else {
                            notificationType = 'CONTRACT_EXPIRING_SOON';
                            priority = 'LOW';
                        }
                        // ===============================
                        // 1️⃣ NOTIFICATION TO VENDOR
                        // ===============================
                        if ((_b = (_a = supplier.vendor) === null || _a === void 0 ? void 0 : _a.user) === null || _b === void 0 ? void 0 : _b.id) {
                            yield this.sendContractNotificationToVendor(supplier, daysLeft, notificationType, priority);
                        }
                        // ===============================
                        // 2️⃣ NOTIFICATION TO SUPPLIER (if they have a user account)
                        // ===============================
                        if ((_c = supplier.user) === null || _c === void 0 ? void 0 : _c.id) {
                            yield this.sendContractNotificationToSupplier(supplier, daysLeft, notificationType, priority);
                        }
                    }
                    catch (error) {
                        console.error(`❌ Error processing contract for supplier ${supplier.id}:`, error);
                    }
                }
            }
            catch (error) {
                console.error('❌ Error in checkExpiringContracts:', error);
            }
        });
    }
    // ========== SEND CONTRACT NOTIFICATION TO VENDOR (EXISTING) ==========
    sendContractNotificationToVendor(supplier, daysLeft, type, priority) {
        return __awaiter(this, void 0, void 0, function* () {
            const vendorUserId = supplier.vendor.user.id;
            // Check if notification already sent in the last 3 days for this contract
            const threeDaysAgo = new Date();
            threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
            const existingNotification = yield prisma.notification.findFirst({
                where: {
                    userId: vendorUserId,
                    type: type,
                    metadata: {
                        path: ['supplierId'],
                        equals: supplier.id
                    },
                    createdAt: {
                        gte: threeDaysAgo
                    }
                }
            });
            if (existingNotification) {
                console.log(`⏭️ Contract alert already sent recently to vendor for supplier: ${supplier.name}`);
                return;
            }
            const urgency = daysLeft <= 7 ? 'URGENT' : 'UPCOMING';
            const actionRequired = daysLeft <= 7 ? 'IMMEDIATE action required' : 'Plan for renewal';
            yield notification_service_1.NotificationService.createNotification({
                userId: vendorUserId,
                title: `📅 Contract Expiry: ${supplier.name} (${daysLeft} days)`,
                message: `Contract with "${supplier.name}" expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}. ${actionRequired}.`,
                type: type,
                metadata: {
                    supplierId: supplier.id,
                    supplierName: supplier.name,
                    contractEndDate: supplier.contractEndDate.toISOString(),
                    daysRemaining: daysLeft,
                    urgency: urgency,
                    vendorId: supplier.vendorId,
                    criticality: supplier.criticality,
                    riskLevel: supplier.riskLevel,
                    totalContractValue: supplier.totalContractValue,
                    contractDocument: supplier.contractDocument,
                    recommendedActions: [
                        'Initiate renewal process',
                        'Review performance metrics',
                        'Negotiate new terms if needed',
                        'Update vendor management system'
                    ]
                },
                priority: priority
            });
            console.log(`✅ Contract alert (${priority}) sent to VENDOR for supplier: ${supplier.name} (${daysLeft} days left)`);
        });
    }
    // ========== SEND CONTRACT NOTIFICATION TO SUPPLIER (EXISTING) ==========
    sendContractNotificationToSupplier(supplier, daysLeft, type, priority) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            const supplierUserId = supplier.user.id;
            // Check if notification already sent in the last 3 days
            const threeDaysAgo = new Date();
            threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
            const existingNotification = yield prisma.notification.findFirst({
                where: {
                    userId: supplierUserId,
                    type: type,
                    metadata: {
                        path: ['supplierId'],
                        equals: supplier.id
                    },
                    createdAt: {
                        gte: threeDaysAgo
                    }
                }
            });
            if (existingNotification) {
                console.log(`⏭️ Contract alert already sent recently to supplier: ${supplier.name}`);
                return;
            }
            const urgency = daysLeft <= 7 ? 'URGENT' : 'UPCOMING';
            const action = daysLeft <= 7 ? 'Contact vendor immediately' : 'Prepare for renewal discussion';
            yield notification_service_1.NotificationService.createNotification({
                userId: supplierUserId,
                title: `📝 Contract Expiry Notification (${daysLeft} days)`,
                message: `Your contract with ${(_a = supplier.vendor) === null || _a === void 0 ? void 0 : _a.companyName} expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}. ${action}.`,
                type: type,
                metadata: {
                    supplierId: supplier.id,
                    supplierName: supplier.name,
                    vendorName: (_b = supplier.vendor) === null || _b === void 0 ? void 0 : _b.companyName,
                    vendorEmail: (_c = supplier.vendor) === null || _c === void 0 ? void 0 : _c.businessEmail,
                    contractEndDate: supplier.contractEndDate.toISOString(),
                    daysRemaining: daysLeft,
                    urgency: urgency,
                    vendorId: supplier.vendorId,
                    contractStartDate: (_d = supplier.contractStartDate) === null || _d === void 0 ? void 0 : _d.toISOString(),
                    contractDocument: supplier.contractDocument,
                    contactPerson: supplier.contactPerson,
                    recommendedActions: [
                        'Review contract terms',
                        'Prepare renewal documents',
                        'Contact vendor representative',
                        'Update your company information'
                    ]
                },
                priority: priority
            });
            console.log(`✅ Contract alert (${priority}) sent to SUPPLIER: ${supplier.name} (${daysLeft} days left)`);
        });
    }
    // ========== SEND CONSOLIDATED RISK REPORT (EXISTING) ==========
    sendConsolidatedRiskReport(highRiskSuppliers) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                // Group suppliers by vendor
                const suppliersByVendor = {};
                highRiskSuppliers.forEach(supplier => {
                    var _a, _b;
                    if ((_b = (_a = supplier.vendor) === null || _a === void 0 ? void 0 : _a.user) === null || _b === void 0 ? void 0 : _b.id) {
                        if (!suppliersByVendor[supplier.vendor.user.id]) {
                            suppliersByVendor[supplier.vendor.user.id] = [];
                        }
                        suppliersByVendor[supplier.vendor.user.id].push(supplier);
                    }
                });
                // Send consolidated report to each vendor with 3+ high-risk suppliers
                for (const [vendorUserId, vendorSuppliers] of Object.entries(suppliersByVendor)) {
                    if (vendorSuppliers.length >= 3) {
                        const highRiskCount = vendorSuppliers.filter(s => s.riskLevel === 'HIGH').length;
                        const criticalCount = vendorSuppliers.filter(s => s.riskLevel === 'CRITICAL').length;
                        yield notification_service_1.NotificationService.createNotification({
                            userId: vendorUserId,
                            title: `📊 Multiple High-Risk Suppliers Alert`,
                            message: `You have ${vendorSuppliers.length} high-risk suppliers (${criticalCount} CRITICAL, ${highRiskCount} HIGH). Immediate attention required.`,
                            type: 'RISK_ALERT',
                            metadata: {
                                totalHighRiskSuppliers: vendorSuppliers.length,
                                criticalCount: criticalCount,
                                highCount: highRiskCount,
                                suppliers: vendorSuppliers.map(s => {
                                    var _a;
                                    return ({
                                        id: s.id,
                                        name: s.name,
                                        riskLevel: s.riskLevel,
                                        overallScore: s.overallScore,
                                        bivScore: s.bivScore,
                                        complianceRate: s.complianceRate,
                                        lastAssessmentDate: (_a = s.lastAssessmentDate) === null || _a === void 0 ? void 0 : _a.toISOString()
                                    });
                                }),
                                vendorId: vendorSuppliers[0].vendorId,
                                recommendation: 'Consider implementing enhanced monitoring or conducting risk mitigation workshops'
                            },
                            priority: 'HIGH'
                        });
                        console.log(`📋 Consolidated risk report sent to vendor: ${(_a = vendorSuppliers[0].vendor) === null || _a === void 0 ? void 0 : _a.companyName}`);
                    }
                }
            }
            catch (error) {
                console.error('❌ Error sending consolidated risk report:', error);
            }
        });
    }
    // ========== FIND SUPPLIERS WITH BOTH RISK AND EXPIRING CONTRACTS (EXISTING) ==========
    findCriticalSuppliers() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e;
            try {
                const today = new Date();
                const fifteenDaysFromNow = new Date();
                fifteenDaysFromNow.setDate(today.getDate() + 15);
                // Find suppliers with BOTH high risk AND expiring contracts
                const criticalSuppliers = yield prisma.supplier.findMany({
                    where: {
                        AND: [
                            {
                                riskLevel: {
                                    in: ['HIGH']
                                }
                            },
                            {
                                contractEndDate: {
                                    not: null,
                                    gte: today,
                                    lte: fifteenDaysFromNow
                                }
                            }
                        ],
                        isDeleted: false,
                        isActive: true,
                        vendor: {
                            isDeleted: false,
                            isActive: true
                        }
                    },
                    include: {
                        vendor: {
                            include: {
                                user: {
                                    select: {
                                        id: true,
                                        email: true
                                    }
                                }
                            }
                        },
                        user: {
                            select: {
                                id: true,
                                email: true
                            }
                        }
                    }
                });
                console.log(`🔴 Found ${criticalSuppliers.length} CRITICAL suppliers (High Risk + Expiring Contract)`);
                // Send urgent alerts for these critical cases
                for (const supplier of criticalSuppliers) {
                    const daysLeft = Math.ceil((supplier.contractEndDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    // Send to vendor
                    if ((_b = (_a = supplier.vendor) === null || _a === void 0 ? void 0 : _a.user) === null || _b === void 0 ? void 0 : _b.id) {
                        yield notification_service_1.NotificationService.createNotification({
                            userId: supplier.vendor.user.id,
                            title: `🚨 CRITICAL: ${supplier.name} - High Risk & Contract Expiring`,
                            message: `URGENT: Supplier "${supplier.name}" has ${supplier.riskLevel} risk level AND contract expires in ${daysLeft} days. Immediate action required.`,
                            type: 'RISK_ALERT',
                            metadata: {
                                supplierId: supplier.id,
                                supplierName: supplier.name,
                                riskLevel: supplier.riskLevel,
                                daysRemaining: daysLeft,
                                contractEndDate: supplier.contractEndDate.toISOString(),
                                overallScore: supplier.overallScore,
                                vendorId: supplier.vendorId,
                                criticality: 'DOUBLE_ALERT',
                                requiredActions: [
                                    'Schedule emergency review meeting',
                                    'Prepare risk mitigation plan',
                                    'Initiate contract renewal or termination',
                                    'Update business continuity plans'
                                ]
                            },
                            priority: 'HIGH'
                        });
                    }
                    // Send to supplier if they have account
                    if ((_c = supplier.user) === null || _c === void 0 ? void 0 : _c.id) {
                        yield notification_service_1.NotificationService.createNotification({
                            userId: supplier.user.id,
                            title: `⚠️ Urgent: Risk & Contract Review Required`,
                            message: `Your company has been flagged for ${supplier.riskLevel} risk level and contract expiry in ${daysLeft} days. Please contact vendor immediately.`,
                            type: 'RISK_ALERT',
                            metadata: {
                                supplierId: supplier.id,
                                supplierName: supplier.name,
                                riskLevel: supplier.riskLevel,
                                daysRemaining: daysLeft,
                                vendorName: (_d = supplier.vendor) === null || _d === void 0 ? void 0 : _d.companyName,
                                vendorContact: (_e = supplier.vendor) === null || _e === void 0 ? void 0 : _e.contactNumber,
                                recommendedActions: [
                                    'Contact vendor representative immediately',
                                    'Review and update compliance documents',
                                    'Prepare risk mitigation plan',
                                    'Schedule meeting for contract discussion'
                                ]
                            },
                            priority: 'HIGH'
                        });
                    }
                }
                return criticalSuppliers;
            }
            catch (error) {
                console.error('❌ Error finding critical suppliers:', error);
                return [];
            }
        });
    }
    // ========== NEW: CHECK INCOMPLETE ASSESSMENTS ==========
    checkIncompleteAssessments() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            try {
                console.log('🔄 Scanning for incomplete assessments...');
                // Find all suppliers with incomplete assessments
                const suppliersWithIncompleteAssessments = yield prisma.supplier.findMany({
                    where: {
                        isDeleted: false,
                        isActive: true,
                        invitationStatus: 'ACCEPTED', // Only accepted suppliers
                        vendor: {
                            isDeleted: false,
                            isActive: true
                        },
                        assessmentSubmissions: {
                            some: {
                                status: {
                                    in: ['DRAFT', 'PENDING']
                                }
                            }
                        }
                    },
                    include: {
                        vendor: {
                            include: {
                                user: {
                                    select: {
                                        id: true,
                                        email: true
                                    }
                                }
                            }
                        },
                        user: {
                            select: {
                                id: true,
                                email: true
                            }
                        },
                        assessmentSubmissions: {
                            where: {
                                status: {
                                    in: ['DRAFT', 'PENDING']
                                }
                            },
                            include: {
                                assessment: {
                                    select: {
                                        id: true,
                                        title: true,
                                        stage: true
                                    }
                                }
                            }
                        }
                    }
                });
                console.log(`📊 Found ${suppliersWithIncompleteAssessments.length} suppliers with incomplete assessments`);
                for (const supplier of suppliersWithIncompleteAssessments) {
                    try {
                        const incompleteCount = supplier.assessmentSubmissions.length;
                        const initialIncomplete = supplier.assessmentSubmissions.filter(sub => sub.stage === 'INITIAL' && sub.status !== 'PENDING').length;
                        const fullIncomplete = supplier.assessmentSubmissions.filter(sub => sub.stage === 'FULL' && sub.status !== 'PENDING').length;
                        // ===============================
                        // 1️⃣ NOTIFICATION TO SUPPLIER
                        // ===============================
                        if ((_a = supplier.user) === null || _a === void 0 ? void 0 : _a.id) {
                            yield this.sendAssessmentReminderToSupplier(supplier, incompleteCount, initialIncomplete, fullIncomplete);
                        }
                        // ===============================
                        // 2️⃣ NOTIFICATION TO VENDOR
                        // ===============================
                        if ((_c = (_b = supplier.vendor) === null || _b === void 0 ? void 0 : _b.user) === null || _c === void 0 ? void 0 : _c.id) {
                            yield this.sendAssessmentReminderToVendor(supplier, incompleteCount, initialIncomplete, fullIncomplete);
                        }
                    }
                    catch (error) {
                        console.error(`❌ Error processing supplier ${supplier.id}:`, error);
                    }
                }
            }
            catch (error) {
                console.error('❌ Error in checkIncompleteAssessments:', error);
            }
        });
    }
    // ========== NEW: SEND ASSESSMENT REMINDER TO SUPPLIER ==========
    sendAssessmentReminderToSupplier(supplier, totalIncomplete, initialIncomplete, fullIncomplete) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const supplierUserId = supplier.user.id;
            // Check if reminder already sent in last 2 days
            const twoDaysAgo = new Date();
            twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
            const existingNotification = yield prisma.notification.findFirst({
                where: {
                    userId: supplierUserId,
                    type: 'ASSESSMENT_DUE',
                    createdAt: {
                        gte: twoDaysAgo
                    },
                    metadata: {
                        path: ['supplierId'],
                        equals: supplier.id
                    }
                }
            });
            if (existingNotification) {
                console.log(`⏭️ Assessment reminder already sent recently to supplier: ${supplier.name}`);
                return;
            }
            // Prepare message based on assessment types
            let message = '';
            let priority = 'MEDIUM';
            if (initialIncomplete > 0 && fullIncomplete > 0) {
                message = `You have ${totalIncomplete} incomplete assessments (${initialIncomplete} Initial, ${fullIncomplete} Full). Please complete them to maintain compliance.`;
                priority = 'HIGH';
            }
            else if (initialIncomplete > 0) {
                message = `You have ${initialIncomplete} incomplete Initial Assessment(s). This is required to start working with ${(_a = supplier.vendor) === null || _a === void 0 ? void 0 : _a.companyName}.`;
                priority = 'HIGH';
            }
            else if (fullIncomplete > 0) {
                message = `You have ${fullIncomplete} incomplete Full Assessment(s). Complete them to improve your compliance rating.`;
                priority = 'MEDIUM';
            }
            try {
                yield notification_service_1.NotificationService.createNotification({
                    userId: supplierUserId,
                    title: `📝 Incomplete Assessments: ${totalIncomplete} pending`,
                    message: message,
                    type: 'ASSESSMENT_DUE',
                    metadata: {
                        supplierId: supplier.id,
                        supplierName: supplier.name,
                        totalIncompleteAssessments: totalIncomplete,
                        initialIncompleteCount: initialIncomplete,
                        fullIncompleteCount: fullIncomplete,
                        vendorId: supplier.vendorId,
                        vendorName: (_b = supplier.vendor) === null || _b === void 0 ? void 0 : _b.companyName,
                        incompleteAssessments: supplier.assessmentSubmissions.map((sub) => ({
                            id: sub.id,
                            assessmentId: sub.assessmentId,
                            assessmentTitle: sub.assessment.title,
                            stage: sub.stage,
                            status: sub.status,
                            progress: sub.progress
                        })),
                        lastReminderSent: new Date().toISOString(),
                        recommendedActions: [
                            'Login to your dashboard',
                            'Complete pending assessments',
                            'Contact vendor for support if needed',
                            'Upload required evidence documents'
                        ]
                    },
                    priority: priority
                });
                console.log(`✅ Assessment reminder sent to SUPPLIER: ${supplier.name} (${totalIncomplete} incomplete)`);
            }
            catch (error) {
                console.error(`❌ Failed to send assessment reminder to supplier ${supplierUserId}:`, error);
            }
        });
    }
    // ========== NEW: SEND ASSESSMENT REMINDER TO VENDOR ==========
    sendAssessmentReminderToVendor(supplier, totalIncomplete, initialIncomplete, fullIncomplete) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const vendorUserId = supplier.vendor.user.id;
            // Check if reminder already sent in last 3 days
            const threeDaysAgo = new Date();
            threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
            const existingNotification = yield prisma.notification.findFirst({
                where: {
                    userId: vendorUserId,
                    type: 'ASSESSMENT_DUE',
                    createdAt: {
                        gte: threeDaysAgo
                    },
                    metadata: {
                        path: ['supplierId'],
                        equals: supplier.id
                    }
                }
            });
            if (existingNotification) {
                console.log(`⏭️ Assessment reminder already sent recently to vendor for supplier: ${supplier.name}`);
                return;
            }
            // Determine urgency
            let urgency = '';
            let priority = 'MEDIUM';
            if (initialIncomplete > 0) {
                urgency = 'Initial assessment not completed - supplier cannot start work';
                priority = 'HIGH';
            }
            else if (fullIncomplete > 0 && totalIncomplete >= 2) {
                urgency = 'Multiple full assessments pending - compliance at risk';
                priority = 'HIGH';
            }
            else if (fullIncomplete > 0) {
                urgency = 'Full assessment pending';
                priority = 'MEDIUM';
            }
            try {
                yield notification_service_1.NotificationService.createNotification({
                    userId: vendorUserId,
                    title: `📋 Supplier Assessment Status: ${supplier.name}`,
                    message: `Supplier "${supplier.name}" has ${totalIncomplete} incomplete assessment(s). ${urgency}`,
                    type: 'ASSESSMENT_DUE',
                    metadata: {
                        supplierId: supplier.id,
                        supplierName: supplier.name,
                        supplierEmail: supplier.email,
                        totalIncompleteAssessments: totalIncomplete,
                        initialIncompleteCount: initialIncomplete,
                        fullIncompleteCount: fullIncomplete,
                        vendorId: supplier.vendorId,
                        supplierRiskLevel: supplier.riskLevel,
                        supplierComplianceRate: supplier.complianceRate,
                        incompleteAssessments: supplier.assessmentSubmissions.map((sub) => {
                            var _a;
                            return ({
                                id: sub.id,
                                assessmentId: sub.assessmentId,
                                assessmentTitle: sub.assessment.title,
                                stage: sub.stage,
                                status: sub.status,
                                progress: sub.progress,
                                startedAt: (_a = sub.startedAt) === null || _a === void 0 ? void 0 : _a.toISOString()
                            });
                        }),
                        lastAssessmentDate: (_a = supplier.lastAssessmentDate) === null || _a === void 0 ? void 0 : _a.toISOString(),
                        nextAssessmentDue: (_b = supplier.nextAssessmentDue) === null || _b === void 0 ? void 0 : _b.toISOString(),
                        recommendedActions: [
                            'Contact supplier for follow-up',
                            'Review assessment progress',
                            'Consider sending reminder email',
                            'Update supplier risk profile if needed'
                        ]
                    },
                    priority: priority
                });
                console.log(`✅ Assessment reminder sent to VENDOR for supplier: ${supplier.name} (${totalIncomplete} incomplete)`);
            }
            catch (error) {
                console.error(`❌ Failed to send assessment reminder to vendor ${vendorUserId}:`, error);
            }
        });
    }
    // ========== NEW: CHECK SUPPLIERS WITH NO ASSESSMENTS ==========
    checkSuppliersWithNoAssessments() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                console.log('🔄 Scanning for suppliers with no assessments...');
                const suppliersWithNoAssessments = yield prisma.supplier.findMany({
                    where: {
                        isDeleted: false,
                        isActive: true,
                        invitationStatus: 'ACCEPTED',
                        assessmentSubmissions: {
                            none: {} // No assessment submissions
                        },
                        vendor: {
                            isDeleted: false,
                            isActive: true
                        }
                    },
                    include: {
                        vendor: {
                            include: {
                                user: {
                                    select: {
                                        id: true,
                                        email: true
                                    }
                                }
                            }
                        },
                        user: {
                            select: {
                                id: true,
                                email: true
                            }
                        }
                    }
                });
                console.log(`📊 Found ${suppliersWithNoAssessments.length} suppliers with no assessments`);
                for (const supplier of suppliersWithNoAssessments) {
                    try {
                        // Get available assessments for this supplier
                        const availableAssessments = yield prisma.assessment.findMany({
                            where: {
                                vendorId: supplier.vendorId,
                                isActive: true
                            },
                            select: {
                                id: true,
                                title: true,
                                stage: true
                            }
                        });
                        if (availableAssessments.length === 0)
                            continue;
                        // ===============================
                        // NOTIFICATION TO VENDOR ONLY
                        // ===============================
                        if ((_b = (_a = supplier.vendor) === null || _a === void 0 ? void 0 : _a.user) === null || _b === void 0 ? void 0 : _b.id) {
                            yield this.sendNoAssessmentNotificationToVendor(supplier, availableAssessments);
                        }
                    }
                    catch (error) {
                        console.error(`❌ Error processing supplier ${supplier.id}:`, error);
                    }
                }
            }
            catch (error) {
                console.error('❌ Error in checkSuppliersWithNoAssessments:', error);
            }
        });
    }
    // ========== NEW: SEND NO ASSESSMENT NOTIFICATION TO VENDOR ==========
    sendNoAssessmentNotificationToVendor(supplier, availableAssessments) {
        return __awaiter(this, void 0, void 0, function* () {
            const vendorUserId = supplier.vendor.user.id;
            // Check if notification already sent in last week
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            const existingNotification = yield prisma.notification.findFirst({
                where: {
                    userId: vendorUserId,
                    type: 'ASSESSMENT_DUE',
                    createdAt: {
                        gte: oneWeekAgo
                    },
                    metadata: {
                        path: ['supplierId'],
                        equals: supplier.id
                    }
                }
            });
            if (existingNotification) {
                console.log(`⏭️ No-assessment notification already sent recently for supplier: ${supplier.name}`);
                return;
            }
            try {
                yield notification_service_1.NotificationService.createNotification({
                    userId: vendorUserId,
                    title: `⚠️ No Assessments Started: ${supplier.name}`,
                    message: `Supplier "${supplier.name}" has not started any assessments. ${availableAssessments.length} assessments are available.`,
                    type: 'ASSESSMENT_DUE',
                    metadata: {
                        supplierId: supplier.id,
                        supplierName: supplier.name,
                        supplierEmail: supplier.email,
                        daysSinceAcceptance: this.getDaysSince(supplier.invitationAcceptedAt),
                        availableAssessments: availableAssessments.map(assessment => ({
                            id: assessment.id,
                            title: assessment.title,
                            stage: assessment.stage
                        })),
                        vendorId: supplier.vendorId,
                        timestamp: new Date().toISOString(),
                        recommendedActions: [
                            'Send assessment reminder to supplier',
                            'Contact supplier directly',
                            'Check if assessments are assigned correctly',
                            'Verify supplier user account status'
                        ]
                    },
                    priority: 'MEDIUM'
                });
                console.log(`✅ No-assessment notification sent to VENDOR for supplier: ${supplier.name}`);
            }
            catch (error) {
                console.error(`❌ Failed to send no-assessment notification to vendor ${vendorUserId}:`, error);
            }
        });
    }
    // ========== HELPER: GET PREVIOUS RISK LEVEL ==========
    getPreviousRiskLevel(supplierId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Get previous assessment submission with risk level
                const previousSubmission = yield prisma.assessmentSubmission.findFirst({
                    where: {
                        supplierId: supplierId,
                        status: 'PENDING',
                        riskLevel: {
                            not: null
                        }
                    },
                    orderBy: {
                        submittedAt: 'desc'
                    },
                    skip: 1, // Skip the most recent one
                    select: {
                        riskLevel: true
                    }
                });
                return (previousSubmission === null || previousSubmission === void 0 ? void 0 : previousSubmission.riskLevel) || null;
            }
            catch (error) {
                console.error(`Error getting previous risk level for supplier ${supplierId}:`, error);
                return null;
            }
        });
    }
    // ========== HELPER: CHECK IF RISK INCREASED ==========
    isRiskIncreased(previousLevel, currentLevel) {
        if (!previousLevel)
            return false;
        const riskOrder = ['LOW', 'MEDIUM', 'HIGH'];
        const previousIndex = riskOrder.indexOf(previousLevel);
        const currentIndex = riskOrder.indexOf(currentLevel);
        return currentIndex > previousIndex && currentIndex !== -1 && previousIndex !== -1;
    }
    // ========== HELPER: GET DAYS SINCE DATE ==========
    getDaysSince(date) {
        if (!date)
            return 0;
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - date.getTime());
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
    // ========== MANUAL TRIGGER FUNCTIONS ==========
    manualCheckHighRiskSuppliers() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('🔧 Manual trigger: Checking high-risk suppliers');
            return yield this.checkHighRiskSuppliers();
        });
    }
    manualCheckExpiringContracts() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('🔧 Manual trigger: Checking expiring contracts');
            return yield this.checkExpiringContracts();
        });
    }
    manualFindCriticalSuppliers() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('🔧 Manual trigger: Finding critical suppliers');
            return yield this.findCriticalSuppliers();
        });
    }
    manualCheckIncompleteAssessments() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('🔧 Manual trigger: Checking incomplete assessments');
            return yield this.checkIncompleteAssessments();
        });
    }
    manualCheckNoAssessments() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('🔧 Manual trigger: Checking suppliers with no assessments');
            return yield this.checkSuppliersWithNoAssessments();
        });
    }
    // ========== GET MONITORING STATUS ==========
    getMonitoringStatus() {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
        return {
            riskMonitorRunning: ((_a = this.riskCheckJob) === null || _a === void 0 ? void 0 : _a.isCallbackRunning) || false,
            contractMonitorRunning: ((_b = this.contractCheckJob) === null || _b === void 0 ? void 0 : _b.isCallbackRunning) || false,
            assessmentReminderRunning: ((_c = this.assessmentReminderJob) === null || _c === void 0 ? void 0 : _c.isCallbackRunning) || false,
            riskUpdateMonitorRunning: ((_d = this.riskUpdateJob) === null || _d === void 0 ? void 0 : _d.isCallbackRunning) || false,
            riskSchedule: ((_f = (_e = this.riskCheckJob) === null || _e === void 0 ? void 0 : _e.cronTime) === null || _f === void 0 ? void 0 : _f.source) || 'Not running',
            contractSchedule: ((_h = (_g = this.contractCheckJob) === null || _g === void 0 ? void 0 : _g.cronTime) === null || _h === void 0 ? void 0 : _h.source) || 'Not running',
            assessmentSchedule: ((_k = (_j = this.assessmentReminderJob) === null || _j === void 0 ? void 0 : _j.cronTime) === null || _k === void 0 ? void 0 : _k.source) || 'Not running',
            riskUpdateSchedule: ((_m = (_l = this.riskUpdateJob) === null || _l === void 0 ? void 0 : _l.cronTime) === null || _m === void 0 ? void 0 : _m.source) || 'Not running',
            lastCheck: new Date().toISOString()
        };
    }
    // ========== GET COMPREHENSIVE STATS ==========
    getComprehensiveStats() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const today = new Date();
                const thirtyDaysFromNow = new Date();
                thirtyDaysFromNow.setDate(today.getDate() + 30);
                // FIX: Define fifteenDaysFromNow here
                const fifteenDaysFromNow = new Date();
                fifteenDaysFromNow.setDate(today.getDate() + 15);
                const [highRiskCount, expiringCount, incompleteAssessmentsCount, noAssessmentsCount, recentRiskUpdates, criticalCount] = yield Promise.all([
                    // High risk suppliers
                    prisma.supplier.count({
                        where: {
                            riskLevel: { in: ['HIGH', 'CRITICAL'] },
                            isDeleted: false,
                            isActive: true
                        }
                    }),
                    // Expiring contracts (within 30 days)
                    prisma.supplier.count({
                        where: {
                            contractEndDate: {
                                not: null,
                                gte: today,
                                lte: thirtyDaysFromNow
                            },
                            isDeleted: false,
                            isActive: true
                        }
                    }),
                    // Incomplete assessments
                    prisma.supplier.count({
                        where: {
                            isDeleted: false,
                            isActive: true,
                            invitationStatus: 'ACCEPTED',
                            assessmentSubmissions: {
                                some: {
                                    status: {
                                        in: ['DRAFT', 'PENDING']
                                    }
                                }
                            }
                        }
                    }),
                    // No assessments started
                    prisma.supplier.count({
                        where: {
                            isDeleted: false,
                            isActive: true,
                            invitationStatus: 'ACCEPTED',
                            assessmentSubmissions: {
                                none: {}
                            }
                        }
                    }),
                    // Recent risk updates (last 24 hours)
                    prisma.supplier.count({
                        where: {
                            updatedAt: {
                                gte: new Date(new Date().setHours(new Date().getHours() - 24))
                            },
                            riskLevel: { not: null },
                            isDeleted: false,
                            isActive: true
                        }
                    }),
                    // Critical suppliers (high risk + expiring contracts within 15 days)
                    prisma.supplier.count({
                        where: {
                            AND: [
                                { riskLevel: { in: ['HIGH', 'CRITICAL'] } },
                                {
                                    contractEndDate: {
                                        not: null,
                                        gte: today,
                                        lte: fifteenDaysFromNow
                                    }
                                }
                            ],
                            isDeleted: false,
                            isActive: true
                        }
                    })
                ]);
                return {
                    highRiskSuppliers: highRiskCount,
                    expiringContracts: expiringCount,
                    incompleteAssessments: incompleteAssessmentsCount,
                    noAssessmentsStarted: noAssessmentsCount,
                    recentRiskUpdates: recentRiskUpdates,
                    criticalSuppliers: criticalCount,
                    lastUpdated: new Date().toISOString()
                };
            }
            catch (error) {
                console.error('❌ Error getting comprehensive stats:', error);
                return null;
            }
        });
    }
}
exports.ComprehensiveMonitorService = ComprehensiveMonitorService;
// Export singleton instance
exports.comprehensiveMonitorService = new ComprehensiveMonitorService();
