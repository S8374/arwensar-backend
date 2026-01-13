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
exports.MonitoringQueueService = void 0;
// src/services/monitoring-queue.service.ts
const bullmq_1 = require("bullmq");
const redis_1 = require("../app/shared/redis");
const prisma_1 = require("../app/shared/prisma");
const notification_service_1 = require("../app/modules/notification/notification.service");
class MonitoringQueueService {
    constructor() {
        // Get Redis connection for BullMQ
        this.connection = (0, redis_1.getBullMQConnection)();
        // Main monitoring queue
        this.monitoringQueue = new bullmq_1.Queue('monitoring-queue', {
            connection: this.connection,
            defaultJobOptions: {
                removeOnComplete: 100,
                removeOnFail: 100,
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 5000
                }
            }
        });
        // Dedicated queues
        this.highRiskQueue = new bullmq_1.Queue('high-risk-monitoring', {
            connection: this.connection
        });
        this.contractQueue = new bullmq_1.Queue('contract-monitoring', {
            connection: this.connection
        });
        this.assessmentQueue = new bullmq_1.Queue('assessment-monitoring', {
            connection: this.connection
        });
        // Queue events for monitoring
        this.queueEvents = new bullmq_1.QueueEvents('monitoring-queue', {
            connection: this.connection
        });
        this.setupQueueEventListeners();
    }
    // ========== SETUP QUEUE EVENT LISTENERS ==========
    setupQueueEventListeners() {
        this.queueEvents.on("completed", ({ jobId, returnvalue }) => {
            console.log(`✅ Job ${jobId} completed successfully`);
        });
        this.queueEvents.on("failed", ({ jobId, failedReason }) => {
            console.error(`❌ Job ${jobId} failed:`, failedReason);
        });
        this.queueEvents.on("progress", ({ jobId, data }) => {
            console.log(`📈 Job ${jobId} progress:`, data);
        });
        this.queueEvents.on("stalled", ({ jobId }) => {
            console.warn(`⚠️ Job ${jobId} stalled`);
        });
    }
    // ========== CREATE WORKERS ==========
    createWorkers() {
        // Worker for main monitoring tasks
        new bullmq_1.Worker('monitoring-queue', (job) => __awaiter(this, void 0, void 0, function* () {
            console.log(`🔄 Processing job: ${job.name} (ID: ${job.id})`);
            try {
                switch (job.name) {
                    case 'checkHighRiskSuppliers':
                        yield this.processHighRiskSuppliers(job.data); //ok
                        break;
                    case 'checkExpiringContracts':
                        yield this.processExpiringContracts(job.data); //ok
                        break;
                    case 'checkIncompleteAssessments':
                        yield this.processIncompleteAssessments(job.data); //ok
                        break;
                    case 'checkNoAssessmentSuppliers':
                        yield this.processNoAssessmentSuppliers(job.data);
                        break;
                    case 'checkCriticalSuppliers':
                        yield this.processCriticalSuppliers(job.data);
                        break;
                    default:
                        throw new Error(`Unknown job type: ${job.name}`);
                }
                return { success: true, jobId: job.id, timestamp: new Date().toISOString() };
            }
            catch (error) {
                console.error(`❌ Error processing job ${job.id}:`, error);
                throw error; // Let BullMQ handle retries
            }
        }), {
            connection: this.connection,
            concurrency: 5,
            limiter: {
                max: 10,
                duration: 1000 // 10 jobs per second
            }
        });
        // Worker for high-risk monitoring
        new bullmq_1.Worker('high-risk-monitoring', (job) => __awaiter(this, void 0, void 0, function* () {
            console.log(`🔴 Processing high-risk job: ${job.id}`);
            yield this.processHighRiskSuppliers(job.data);
        }), {
            connection: this.connection,
            concurrency: 3
        });
        // Worker for contract monitoring
        new bullmq_1.Worker('contract-monitoring', (job) => __awaiter(this, void 0, void 0, function* () {
            console.log(`📅 Processing contract job: ${job.id}`);
            yield this.processExpiringContracts(job.data);
        }), {
            connection: this.connection,
            concurrency: 3
        });
        // Worker for assessment monitoring
        new bullmq_1.Worker('assessment-monitoring', (job) => __awaiter(this, void 0, void 0, function* () {
            console.log(`📝 Processing assessment job: ${job.id}`);
            yield this.processIncompleteAssessments(job.data);
        }), {
            connection: this.connection,
            concurrency: 3
        });
    }
    // ========== INITIALIZE MONITORING SYSTEM ==========
    initializeMonitoringSystem() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('🚀 Initializing BullMQ monitoring system...');
            try {
                // Create workers
                this.createWorkers();
                console.log('✅ Workers created');
                // Schedule recurring jobs
                yield this.scheduleRecurringJobs();
                console.log('✅ Recurring jobs scheduled');
                // Queue initial checks
                yield this.queueInitialChecks();
                console.log('✅ Initial checks queued');
                console.log('✅ BullMQ monitoring system initialized successfully');
            }
            catch (error) {
                console.error('❌ Failed to initialize monitoring system:', error);
                throw error;
            }
        });
    }
    // ========== SCHEDULE RECURRING JOBS ==========
    scheduleRecurringJobs() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const now = new Date();
                // Remove any existing recurring jobs first
                const repeatableJobs = yield this.monitoringQueue.getRepeatableJobs();
                for (const job of repeatableJobs) {
                    yield this.monitoringQueue.removeRepeatableByKey(job.key);
                }
                // High-risk supplier check - every 6 hours
                yield this.monitoringQueue.add('checkHighRiskSuppliers', { type: 'recurring', priority: 'high', timestamp: now.toISOString() }, {
                    jobId: 'high-risk-recurring',
                    repeat: {
                        pattern: '0 0 * * *',
                        tz: 'UTC'
                    },
                    priority: 1
                });
                // Contract expiry check - daily at 8 AM
                yield this.monitoringQueue.add('checkExpiringContracts', { type: 'recurring', priority: 'medium', timestamp: now.toISOString() }, {
                    jobId: 'contract-expiry-recurring',
                    repeat: {
                        pattern: '0 8 * * *',
                        tz: 'UTC'
                    },
                    priority: 2
                });
                // Assessment completion check - daily at 9 AM
                yield this.monitoringQueue.add('checkIncompleteAssessments', { type: 'recurring', priority: 'medium', timestamp: now.toISOString() }, {
                    jobId: 'assessment-completion-recurring',
                    repeat: {
                        pattern: '0 9 * * *',
                        tz: 'UTC'
                    },
                    priority: 2
                });
                // Critical suppliers check - daily at 11 AM
                yield this.monitoringQueue.add('checkCriticalSuppliers', { type: 'recurring', priority: 'high', timestamp: now.toISOString() }, {
                    jobId: 'critical-suppliers-recurring',
                    repeat: {
                        pattern: '0 11 * * *',
                        tz: 'UTC'
                    },
                    priority: 1
                });
                // Daily report generation - daily at 5 PM
                yield this.monitoringQueue.add('generateDailyReport', { type: 'recurring', priority: 'low', timestamp: now.toISOString() }, {
                    jobId: 'daily-report-recurring',
                    repeat: {
                        pattern: '0 17 * * *',
                        tz: 'UTC'
                    },
                    priority: 3
                });
            }
            catch (error) {
                console.error('❌ Error scheduling recurring jobs:', error);
                throw error;
            }
        });
    }
    // ========== QUEUE INITIAL CHECKS ==========
    queueInitialChecks() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const initialChecks = [
                    { name: 'checkHighRiskSuppliers', delay: 10000, priority: 1 },
                    { name: 'checkExpiringContracts', delay: 20000, priority: 2 },
                    { name: 'checkIncompleteAssessments', delay: 30000, priority: 2 },
                    { name: 'checkCriticalSuppliers', delay: 40000, priority: 1 }
                ];
                for (const check of initialChecks) {
                    yield this.monitoringQueue.add(check.name, { type: 'initial', timestamp: new Date().toISOString() }, {
                        delay: check.delay,
                        priority: check.priority
                    });
                }
            }
            catch (error) {
                console.error('❌ Error queuing initial checks:', error);
            }
        });
    }
    // ========== PROCESS HIGH RISK SUPPLIERS ==========
    processHighRiskSuppliers(data) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('🔍 Processing high-risk suppliers...');
            try {
                const highRiskSuppliers = yield prisma_1.prisma.supplier.findMany({
                    where: {
                        riskLevel: { in: ['HIGH', 'CRITICAL'] },
                        isDeleted: false,
                        isActive: true
                    },
                    include: {
                        vendor: {
                            include: {
                                user: { select: { id: true, email: true } }
                            }
                        },
                        user: { select: { id: true, email: true } }
                    },
                    take: 100
                });
                console.log(`📊 Found ${highRiskSuppliers.length} high-risk suppliers`);
                for (const supplier of highRiskSuppliers) {
                    yield this.sendRiskNotifications(supplier);
                }
            }
            catch (error) {
                console.error('❌ Error processing high-risk suppliers:', error);
                throw error;
            }
        });
    }
    // ========== SEND RISK NOTIFICATIONS ==========
    sendRiskNotifications(supplier) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            try {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                // Send to vendor
                if ((_b = (_a = supplier.vendor) === null || _a === void 0 ? void 0 : _a.user) === null || _b === void 0 ? void 0 : _b.id) {
                    //send first vendor 
                    const existingVendorNotification = yield prisma_1.prisma.notification.findFirst({
                        where: {
                            userId: supplier.vendor.user.id,
                            type: 'RISK_ALERT',
                            metadata: { path: ['supplierId'], equals: supplier.id },
                            createdAt: { gte: today }
                        }
                    });
                    if (!existingVendorNotification) {
                        yield notification_service_1.NotificationService.createNotification({
                            userId: supplier.vendor.user.id,
                            title: `🚨 High Risk Supplier: ${supplier.name}`,
                            message: `Supplier "${supplier.name}" is at ${supplier.riskLevel} risk level.`,
                            type: 'RISK_ALERT',
                            metadata: {
                                supplierId: supplier.id,
                                supplierName: supplier.name,
                                riskLevel: supplier.riskLevel
                            },
                            priority: 'HIGH'
                        });
                    }
                }
                // Send to supplier
                if ((_c = supplier.user) === null || _c === void 0 ? void 0 : _c.id) {
                    const existingSupplierNotification = yield prisma_1.prisma.notification.findFirst({
                        where: {
                            userId: supplier.user.id,
                            type: 'RISK_ALERT',
                            metadata: { path: ['supplierId'], equals: supplier.id },
                            createdAt: { gte: today }
                        }
                    });
                    if (!existingSupplierNotification) {
                        yield notification_service_1.NotificationService.createNotification({
                            userId: supplier.user.id,
                            title: `⚠️ Risk Level Update: ${supplier.riskLevel}`,
                            message: `Your risk level has been updated to ${supplier.riskLevel}.`,
                            type: 'RISK_ALERT',
                            metadata: {
                                supplierId: supplier.id,
                                riskLevel: supplier.riskLevel
                            },
                            priority: 'HIGH'
                        });
                    }
                }
            }
            catch (error) {
                console.error(`❌ Error sending risk notifications for supplier ${supplier.id}:`, error);
            }
        });
    }
    // ========== PROCESS EXPIRING CONTRACTS ==========
    processExpiringContracts(data) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('📅 Processing expiring contracts...');
            try {
                const today = new Date();
                const thirtyDaysFromNow = new Date();
                thirtyDaysFromNow.setDate(today.getDate() + 30);
                // 🔴 EXPIRED CONTRACTS
                const expiredContracts = yield prisma_1.prisma.supplier.findMany({
                    where: {
                        contractEndDate: {
                            lt: today
                        },
                        isDeleted: false,
                        isActive: true
                    },
                    include: {
                        vendor: { include: { user: true } },
                        user: true
                    }
                });
                console.log(`❌ Expired contracts found: ${expiredContracts.length}`);
                const expiringContracts = yield prisma_1.prisma.supplier.findMany({
                    where: {
                        contractEndDate: {
                            not: null,
                            gte: today,
                            lte: thirtyDaysFromNow
                        },
                        isDeleted: false,
                        isActive: true
                    },
                    include: {
                        vendor: {
                            include: {
                                user: { select: { id: true, email: true } }
                            }
                        },
                        user: { select: { id: true, email: true } }
                    },
                    take: 100
                });
                console.log(`📊 Found ${expiringContracts.length} expiring contracts`);
                for (const supplier of expiringContracts) {
                    yield this.sendContractNotifications(supplier);
                }
            }
            catch (error) {
                console.error('❌ Error processing expiring contracts:', error);
                throw error;
            }
        });
    }
    // ========== SEND CONTRACT NOTIFICATIONS ==========
    sendContractNotifications(supplier) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            try {
                const today = new Date();
                const daysLeft = Math.ceil((supplier.contractEndDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                // Check if notification was sent in last 3 days
                const threeDaysAgo = new Date();
                threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
                // Send to vendor
                if ((_b = (_a = supplier.vendor) === null || _a === void 0 ? void 0 : _a.user) === null || _b === void 0 ? void 0 : _b.id) {
                    const existingNotification = yield prisma_1.prisma.notification.findFirst({
                        where: {
                            userId: supplier.vendor.user.id,
                            type: daysLeft <= 7 ? 'CONTRACT_EXPIRY' : 'CONTRACT_EXPIRING_SOON',
                            metadata: { path: ['supplierId'], equals: supplier.id },
                            createdAt: { gte: threeDaysAgo }
                        }
                    });
                    if (!existingNotification) {
                        yield notification_service_1.NotificationService.createNotification({
                            userId: supplier.vendor.user.id,
                            title: `📅 Contract Expiry: ${supplier.name} (${daysLeft} days)`,
                            message: `Contract with "${supplier.name}" expires in ${daysLeft} days.`,
                            type: daysLeft <= 7 ? 'CONTRACT_EXPIRY' : 'CONTRACT_EXPIRING_SOON',
                            metadata: {
                                supplierId: supplier.id,
                                supplierName: supplier.name,
                                daysRemaining: daysLeft
                            },
                            priority: daysLeft <= 7 ? 'HIGH' : daysLeft <= 15 ? 'MEDIUM' : 'LOW'
                        });
                    }
                }
                // Send to supplier 
                if ((_c = supplier.user) === null || _c === void 0 ? void 0 : _c.id) {
                    const existingNotification = yield prisma_1.prisma.notification.findFirst({
                        where: {
                            userId: supplier.vendor.user.id,
                            type: daysLeft <= 7 ? 'CONTRACT_EXPIRY' : 'CONTRACT_EXPIRING_SOON',
                            metadata: { path: ['supplierId'], equals: supplier.id },
                            createdAt: { gte: threeDaysAgo }
                        }
                    });
                    if (!existingNotification) {
                        yield notification_service_1.NotificationService.createNotification({
                            userId: supplier.vendor.user.id,
                            title: `📅 Contract Expiry: ${supplier.name} (${daysLeft} days)`,
                            message: `Contract with "${supplier.name}" expires in ${daysLeft} days.`,
                            type: daysLeft <= 7 ? 'CONTRACT_EXPIRY' : 'CONTRACT_EXPIRING_SOON',
                            metadata: {
                                supplierId: supplier.id,
                                supplierName: supplier.name,
                                daysRemaining: daysLeft
                            },
                            priority: daysLeft <= 7 ? 'HIGH' : daysLeft <= 15 ? 'MEDIUM' : 'LOW'
                        });
                    }
                }
            }
            catch (error) {
                console.error(`❌ Error sending contract notifications for supplier ${supplier.id}:`, error);
            }
        });
    }
    // ========== PROCESS INCOMPLETE ASSESSMENTS ==========
    processIncompleteAssessments(data) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('📝 Processing incomplete assessments...');
            try {
                const suppliers = yield prisma_1.prisma.supplier.findMany({
                    where: {
                        isDeleted: false,
                        isActive: true,
                        assessmentSubmissions: {
                            some: {
                                status: { in: ['DRAFT', 'PENDING'] }
                            }
                        }
                    },
                    include: {
                        vendor: {
                            include: {
                                user: { select: { id: true, email: true } }
                            }
                        },
                        user: { select: { id: true, email: true } },
                        assessmentSubmissions: {
                            where: { status: { in: ['DRAFT', 'PENDING'] } },
                            take: 5
                        }
                    },
                    take: 50
                });
                console.log(`📊 Found ${suppliers.length} suppliers with incomplete assessments`);
                for (const supplier of suppliers) {
                    yield this.sendAssessmentReminders(supplier);
                }
            }
            catch (error) {
                console.error('❌ Error processing incomplete assessments:', error);
                throw error;
            }
        });
    }
    // ========== SEND ASSESSMENT REMINDERS ==========
    sendAssessmentReminders(supplier) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const twoDaysAgo = new Date();
                twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
                // Send to supplier
                if ((_a = supplier.user) === null || _a === void 0 ? void 0 : _a.id) {
                    const existingNotification = yield prisma_1.prisma.notification.findFirst({
                        where: {
                            userId: supplier.user.id,
                            type: 'ASSESSMENT_DUE',
                            metadata: { path: ['supplierId'], equals: supplier.id },
                            createdAt: { gte: twoDaysAgo }
                        }
                    });
                    if (!existingNotification) {
                        yield notification_service_1.NotificationService.createNotification({
                            userId: supplier.user.id,
                            title: `📝 Incomplete Assessments`,
                            message: `You have incomplete assessments. Please complete them.`,
                            type: 'ASSESSMENT_DUE',
                            priority: 'MEDIUM'
                        });
                    }
                }
            }
            catch (error) {
                console.error(`❌ Error sending assessment reminders for supplier ${supplier.id}:`, error);
            }
        });
    }
    // ========== PROCESS NO ASSESSMENT SUPPLIERS ==========
    processNoAssessmentSuppliers(data) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('🔍 Processing suppliers with no assessments...');
            try {
                const suppliers = yield prisma_1.prisma.supplier.findMany({
                    where: {
                        isDeleted: false,
                        isActive: true,
                        assessmentSubmissions: {
                            none: {}
                        }
                    },
                    include: {
                        vendor: {
                            include: {
                                user: { select: { id: true, email: true } }
                            }
                        }
                    },
                    take: 30
                });
                console.log(`📊 Found ${suppliers.length} suppliers with no assessments`);
                for (const supplier of suppliers) {
                    yield this.sendNoAssessmentNotification(supplier);
                }
            }
            catch (error) {
                console.error('❌ Error processing no-assessment suppliers:', error);
                throw error;
            }
        });
    }
    // ========== SEND NO ASSESSMENT NOTIFICATION ==========
    sendNoAssessmentNotification(supplier) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                const oneWeekAgo = new Date();
                oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
                if ((_b = (_a = supplier.vendor) === null || _a === void 0 ? void 0 : _a.user) === null || _b === void 0 ? void 0 : _b.id) {
                    const existingNotification = yield prisma_1.prisma.notification.findFirst({
                        where: {
                            userId: supplier.vendor.user.id,
                            type: 'ASSESSMENT_DUE',
                            metadata: { path: ['supplierId'], equals: supplier.id },
                            createdAt: { gte: oneWeekAgo }
                        }
                    });
                    if (!existingNotification) {
                        yield notification_service_1.NotificationService.createNotification({
                            userId: supplier.vendor.user.id,
                            title: `⚠️ No Assessments Started: ${supplier.name}`,
                            message: `Supplier "${supplier.name}" has not started any assessments.`,
                            type: 'ASSESSMENT_DUE',
                            priority: 'MEDIUM'
                        });
                    }
                }
            }
            catch (error) {
                console.error(`❌ Error sending no-assessment notification for supplier ${supplier.id}:`, error);
            }
        });
    }
    // ========== PROCESS CRITICAL SUPPLIERS ==========
    processCriticalSuppliers(data) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('🔴 Processing critical suppliers...');
            try {
                const today = new Date();
                const fifteenDaysFromNow = new Date();
                fifteenDaysFromNow.setDate(today.getDate() + 15);
                const criticalSuppliers = yield prisma_1.prisma.supplier.findMany({
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
                    },
                    include: {
                        vendor: {
                            include: {
                                user: { select: { id: true, email: true } }
                            }
                        },
                        user: { select: { id: true, email: true } }
                    },
                    take: 20
                });
                console.log(`📊 Found ${criticalSuppliers.length} critical suppliers`);
                for (const supplier of criticalSuppliers) {
                    yield this.sendCriticalSupplierNotification(supplier);
                }
            }
            catch (error) {
                console.error('❌ Error processing critical suppliers:', error);
                throw error;
            }
        });
    }
    // ========== SEND CRITICAL SUPPLIER NOTIFICATION ==========
    sendCriticalSupplierNotification(supplier) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            try {
                const today = new Date();
                const daysLeft = Math.ceil((supplier.contractEndDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                // Send to vendor
                if ((_b = (_a = supplier.vendor) === null || _a === void 0 ? void 0 : _a.user) === null || _b === void 0 ? void 0 : _b.id) {
                    yield notification_service_1.NotificationService.createNotification({
                        userId: supplier.vendor.user.id,
                        title: `🚨 CRITICAL: ${supplier.name}`,
                        message: `Supplier "${supplier.name}" has ${supplier.riskLevel} risk and contract expires in ${daysLeft} days.`,
                        type: 'RISK_ALERT',
                        priority: 'HIGH'
                    });
                }
                // Send to supplier
                if ((_c = supplier.user) === null || _c === void 0 ? void 0 : _c.id) {
                    yield notification_service_1.NotificationService.createNotification({
                        userId: supplier.user.id,
                        title: `⚠️ Urgent Action Required`,
                        message: `Your company has ${supplier.riskLevel} risk and contract expires in ${daysLeft} days.`,
                        type: 'RISK_ALERT',
                        priority: 'HIGH'
                    });
                }
            }
            catch (error) {
                console.error(`❌ Error sending critical notification for supplier ${supplier.id}:`, error);
            }
        });
    }
    // ========== MANUAL TRIGGER ==========
    manualTriggerCheck(type) {
        return __awaiter(this, void 0, void 0, function* () {
            const jobTypes = {
                'high-risk': 'checkHighRiskSuppliers',
                'contracts': 'checkExpiringContracts',
                'assessments': 'checkIncompleteAssessments',
                'critical': 'checkCriticalSuppliers',
                'report': 'generateDailyReport'
            };
            const jobName = jobTypes[type];
            if (!jobName) {
                throw new Error(`Invalid job type: ${type}`);
            }
            const job = yield this.monitoringQueue.add(jobName, {
                manualTrigger: true,
                triggeredAt: new Date().toISOString()
            }, {
                priority: 1
            });
            return { jobId: job.id, name: jobName, status: 'queued' };
        });
    }
    // ========== GET QUEUE STATS ==========
    getQueueStats() {
        return __awaiter(this, void 0, void 0, function* () {
            const [monitoringJobs, monitoringWorkers, highRiskJobs, contractJobs, assessmentJobs] = yield Promise.all([
                this.monitoringQueue.getJobCounts(),
                this.monitoringQueue.getWorkers(),
                this.highRiskQueue.getJobCounts(),
                this.contractQueue.getJobCounts(),
                this.assessmentQueue.getJobCounts()
            ]);
            return {
                monitoringQueue: {
                    jobs: monitoringJobs,
                    workers: monitoringWorkers.length
                },
                highRiskQueue: highRiskJobs,
                contractQueue: contractJobs,
                assessmentQueue: assessmentJobs,
                timestamp: new Date().toISOString()
            };
        });
    }
    // ========== GET JOB DETAILS ==========
    getJobDetails(jobId) {
        return __awaiter(this, void 0, void 0, function* () {
            const job = yield this.monitoringQueue.getJob(jobId);
            if (!job) {
                return null;
            }
            const state = yield job.getState();
            const progress = job.progress;
            return {
                id: job.id,
                name: job.name,
                data: job.data,
                state,
                progress,
                attemptsMade: job.attemptsMade,
                failedReason: job.failedReason,
                returnvalue: job.returnvalue,
                timestamp: job.timestamp,
                processedOn: job.processedOn,
                finishedOn: job.finishedOn
            };
        });
    }
    // ========== CLEANUP ==========
    cleanup() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('🧹 Cleaning up monitoring queues...');
            yield this.monitoringQueue.close();
            yield this.highRiskQueue.close();
            yield this.contractQueue.close();
            yield this.assessmentQueue.close();
            yield this.queueEvents.close();
            console.log('✅ Monitoring queues closed');
        });
    }
}
exports.MonitoringQueueService = MonitoringQueueService;
