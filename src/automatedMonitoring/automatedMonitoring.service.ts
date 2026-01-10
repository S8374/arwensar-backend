// src/services/monitoring-queue.service.ts
import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import { getBullMQConnection } from '../app/shared/redis';
import { prisma } from '../app/shared/prisma';
import { NotificationService } from '../app/modules/notification/notification.service';

export class MonitoringQueueService {
  private monitoringQueue: Queue;
  private highRiskQueue: Queue;
  private contractQueue: Queue;
  private assessmentQueue: Queue;
  private queueEvents: QueueEvents;

  private connection: any;

  constructor() {
    // Get Redis connection for BullMQ
    this.connection = getBullMQConnection();

    // Main monitoring queue
    this.monitoringQueue = new Queue('monitoring-queue', {
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
    this.highRiskQueue = new Queue('high-risk-monitoring', {
      connection: this.connection
    });
    this.contractQueue = new Queue('contract-monitoring', {
      connection: this.connection
    });
    this.assessmentQueue = new Queue('assessment-monitoring', {
      connection: this.connection
    });

    // Queue events for monitoring
    this.queueEvents = new QueueEvents('monitoring-queue', {
      connection: this.connection
    });

    this.setupQueueEventListeners();
  }

  // ========== SETUP QUEUE EVENT LISTENERS ==========
  private setupQueueEventListeners() {
    this.queueEvents.on(
      "completed",
      ({ jobId, returnvalue }: { jobId: string; returnvalue: unknown }) => {
        console.log(`✅ Job ${jobId} completed successfully`);
      }
    );

    this.queueEvents.on(
      "failed",
      ({ jobId, failedReason }: { jobId: string; failedReason?: string }) => {
        console.error(`❌ Job ${jobId} failed:`, failedReason);
      }
    );

    this.queueEvents.on(
      "progress",
      ({ jobId, data }: { jobId: string; data: unknown }) => {
        console.log(`📈 Job ${jobId} progress:`, data);
      }
    );

    this.queueEvents.on(
      "stalled",
      ({ jobId }: { jobId: string }) => {
        console.warn(`⚠️ Job ${jobId} stalled`);
      }
    );
  }


  // ========== CREATE WORKERS ==========
  private createWorkers() {
    // Worker for main monitoring tasks
    new Worker('monitoring-queue', async (job: Job) => {
      console.log(`🔄 Processing job: ${job.name} (ID: ${job.id})`);

      try {
        switch (job.name) {
          case 'checkHighRiskSuppliers':
            await this.processHighRiskSuppliers(job.data); //ok
            break;
          case 'checkExpiringContracts':
            await this.processExpiringContracts(job.data); //ok
            break;
          case 'checkIncompleteAssessments':
            await this.processIncompleteAssessments(job.data); //ok
            break;
          case 'checkNoAssessmentSuppliers':
            await this.processNoAssessmentSuppliers(job.data);
            break;
          case 'checkCriticalSuppliers':
            await this.processCriticalSuppliers(job.data);
            break;
          default:
            throw new Error(`Unknown job type: ${job.name}`);
        }

        return { success: true, jobId: job.id, timestamp: new Date().toISOString() };
      } catch (error) {
        console.error(`❌ Error processing job ${job.id}:`, error);
        throw error; // Let BullMQ handle retries
      }
    }, {
      connection: this.connection,
      concurrency: 5,
      limiter: {
        max: 10,
        duration: 1000 // 10 jobs per second
      }
    });

    // Worker for high-risk monitoring
    new Worker('high-risk-monitoring', async (job: Job) => {
      console.log(`🔴 Processing high-risk job: ${job.id}`);
      await this.processHighRiskSuppliers(job.data);
    }, {
      connection: this.connection,
      concurrency: 3
    });

    // Worker for contract monitoring
    new Worker('contract-monitoring', async (job: Job) => {
      console.log(`📅 Processing contract job: ${job.id}`);
      await this.processExpiringContracts(job.data);
    }, {
      connection: this.connection,
      concurrency: 3
    });

    // Worker for assessment monitoring
    new Worker('assessment-monitoring', async (job: Job) => {
      console.log(`📝 Processing assessment job: ${job.id}`);
      await this.processIncompleteAssessments(job.data);
    }, {
      connection: this.connection,
      concurrency: 3
    });
  }

  // ========== INITIALIZE MONITORING SYSTEM ==========
  async initializeMonitoringSystem() {
    console.log('🚀 Initializing BullMQ monitoring system...');

    try {
      // Create workers
      this.createWorkers();
      console.log('✅ Workers created');

      // Schedule recurring jobs
      await this.scheduleRecurringJobs();
      console.log('✅ Recurring jobs scheduled');

      // Queue initial checks
      await this.queueInitialChecks();
      console.log('✅ Initial checks queued');

      console.log('✅ BullMQ monitoring system initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize monitoring system:', error);
      throw error;
    }
  }

  // ========== SCHEDULE RECURRING JOBS ==========
  private async scheduleRecurringJobs() {
    try {
      const now = new Date();

      // Remove any existing recurring jobs first
      const repeatableJobs = await this.monitoringQueue.getRepeatableJobs();
      for (const job of repeatableJobs) {
        await this.monitoringQueue.removeRepeatableByKey(job.key);
      }

      // High-risk supplier check - every 6 hours
      await this.monitoringQueue.add(
        'checkHighRiskSuppliers',
        { type: 'recurring', priority: 'high', timestamp: now.toISOString() },
        {
          jobId: 'high-risk-recurring',
          repeat: {
            pattern: '0 */6 * * *',

            tz: 'UTC'
          },
          priority: 1
        }
      );

      // Contract expiry check - daily at 8 AM
      await this.monitoringQueue.add(
        'checkExpiringContracts',
        { type: 'recurring', priority: 'medium', timestamp: now.toISOString() },
        {
          jobId: 'contract-expiry-recurring',
          repeat: {
            pattern: '0 8 * * *',
            tz: 'UTC'
          },
          priority: 2
        }
      );

      // Assessment completion check - daily at 9 AM
      await this.monitoringQueue.add(
        'checkIncompleteAssessments',
        { type: 'recurring', priority: 'medium', timestamp: now.toISOString() },
        {
          jobId: 'assessment-completion-recurring',
          repeat: {
            pattern: '0 9 * * *',
            tz: 'UTC'
          },
          priority: 2
        }
      );

      // Critical suppliers check - daily at 11 AM
      await this.monitoringQueue.add(
        'checkCriticalSuppliers',
        { type: 'recurring', priority: 'high', timestamp: now.toISOString() },
        {
          jobId: 'critical-suppliers-recurring',
          repeat: {
            pattern: '0 11 * * *',
            tz: 'UTC'
          },
          priority: 1
        }
      );

      // Daily report generation - daily at 5 PM
      await this.monitoringQueue.add(
        'generateDailyReport',
        { type: 'recurring', priority: 'low', timestamp: now.toISOString() },
        {
          jobId: 'daily-report-recurring',
          repeat: {
            pattern: '0 17 * * *',
            tz: 'UTC'
          },
          priority: 3
        }
      );

    } catch (error) {
      console.error('❌ Error scheduling recurring jobs:', error);
      throw error;
    }
  }

  // ========== QUEUE INITIAL CHECKS ==========
  private async queueInitialChecks() {
    try {
      const initialChecks = [
        { name: 'checkHighRiskSuppliers', delay: 10000, priority: 1 },
        { name: 'checkExpiringContracts', delay: 20000, priority: 2 },
        { name: 'checkIncompleteAssessments', delay: 30000, priority: 2 },
        { name: 'checkCriticalSuppliers', delay: 40000, priority: 1 }
      ];

      for (const check of initialChecks) {
        await this.monitoringQueue.add(
          check.name,
          { type: 'initial', timestamp: new Date().toISOString() },
          {
            delay: check.delay,
            priority: check.priority
          }
        );
      }

    } catch (error) {
      console.error('❌ Error queuing initial checks:', error);
    }
  }

  // ========== PROCESS HIGH RISK SUPPLIERS ==========
  private async processHighRiskSuppliers(data: any) {
    console.log('🔍 Processing high-risk suppliers...');

    try {
      const highRiskSuppliers = await prisma.supplier.findMany({
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
        await this.sendRiskNotifications(supplier);
      }



    } catch (error) {
      console.error('❌ Error processing high-risk suppliers:', error);

      throw error;
    }
  }

  // ========== SEND RISK NOTIFICATIONS ==========
  private async sendRiskNotifications(supplier: any) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Send to vendor
      if (supplier.vendor?.user?.id) {

        //send first vendor 

        const existingVendorNotification = await prisma.notification.findFirst({
          where: {
            userId: supplier.vendor.user.id,
            type: 'RISK_ALERT',
            metadata: { path: ['supplierId'], equals: supplier.id },
            createdAt: { gte: today }
          }
        });

        if (!existingVendorNotification) {
          await NotificationService.createNotification({
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
      if (supplier.user?.id) {
        const existingSupplierNotification = await prisma.notification.findFirst({
          where: {
            userId: supplier.user.id,
            type: 'RISK_ALERT',
            metadata: { path: ['supplierId'], equals: supplier.id },
            createdAt: { gte: today }
          }
        });

        if (!existingSupplierNotification) {
          await NotificationService.createNotification({
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
    } catch (error) {
      console.error(`❌ Error sending risk notifications for supplier ${supplier.id}:`, error);
    }
  }

  // ========== PROCESS EXPIRING CONTRACTS ==========
  private async processExpiringContracts(data: any) {
    console.log('📅 Processing expiring contracts...');

    try {
      const today = new Date();
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(today.getDate() + 30);
      // 🔴 EXPIRED CONTRACTS
      const expiredContracts = await prisma.supplier.findMany({
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

      const expiringContracts = await prisma.supplier.findMany({
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
        await this.sendContractNotifications(supplier);
      }



    } catch (error) {
      console.error('❌ Error processing expiring contracts:', error);

      throw error;
    }
  }

  // ========== SEND CONTRACT NOTIFICATIONS ==========
  private async sendContractNotifications(supplier: any) {
    try {
      const today = new Date();
      const daysLeft = Math.ceil(
        (supplier.contractEndDate!.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Check if notification was sent in last 3 days
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      // Send to vendor
      if (supplier.vendor?.user?.id) {
        const existingNotification = await prisma.notification.findFirst({
          where: {
            userId: supplier.vendor.user.id,
            type: daysLeft <= 7 ? 'CONTRACT_EXPIRY' : 'CONTRACT_EXPIRING_SOON',
            metadata: { path: ['supplierId'], equals: supplier.id },
            createdAt: { gte: threeDaysAgo }
          }
        });

        if (!existingNotification) {
          await NotificationService.createNotification({
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
      if (supplier.user?.id) {
        const existingNotification = await prisma.notification.findFirst({
          where: {
            userId: supplier.vendor.user.id,
            type: daysLeft <= 7 ? 'CONTRACT_EXPIRY' : 'CONTRACT_EXPIRING_SOON',
            metadata: { path: ['supplierId'], equals: supplier.id },
            createdAt: { gte: threeDaysAgo }
          }
        });

        if (!existingNotification) {
          await NotificationService.createNotification({
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
    } catch (error) {
      console.error(`❌ Error sending contract notifications for supplier ${supplier.id}:`, error);
    }
  }

  // ========== PROCESS INCOMPLETE ASSESSMENTS ==========
  private async processIncompleteAssessments(data: any) {
    console.log('📝 Processing incomplete assessments...');

    try {
      const suppliers = await prisma.supplier.findMany({
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
        await this.sendAssessmentReminders(supplier);
      }



    } catch (error) {
      console.error('❌ Error processing incomplete assessments:', error);

      throw error;
    }
  }

  // ========== SEND ASSESSMENT REMINDERS ==========
  private async sendAssessmentReminders(supplier: any) {
    try {
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      // Send to supplier
      if (supplier.user?.id) {
        const existingNotification = await prisma.notification.findFirst({
          where: {
            userId: supplier.user.id,
            type: 'ASSESSMENT_DUE',
            metadata: { path: ['supplierId'], equals: supplier.id },
            createdAt: { gte: twoDaysAgo }
          }
        });

        if (!existingNotification) {
          await NotificationService.createNotification({
            userId: supplier.user.id,
            title: `📝 Incomplete Assessments`,
            message: `You have incomplete assessments. Please complete them.`,
            type: 'ASSESSMENT_DUE',
            priority: 'MEDIUM'
          });
        }
      }

    } catch (error) {
      console.error(`❌ Error sending assessment reminders for supplier ${supplier.id}:`, error);
    }
  }

  // ========== PROCESS NO ASSESSMENT SUPPLIERS ==========
  private async processNoAssessmentSuppliers(data: any) {
    console.log('🔍 Processing suppliers with no assessments...');

    try {
      const suppliers = await prisma.supplier.findMany({
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
        await this.sendNoAssessmentNotification(supplier);
      }


    } catch (error) {
      console.error('❌ Error processing no-assessment suppliers:', error);

      throw error;
    }
  }

  // ========== SEND NO ASSESSMENT NOTIFICATION ==========
  private async sendNoAssessmentNotification(supplier: any) {
    try {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      if (supplier.vendor?.user?.id) {
        const existingNotification = await prisma.notification.findFirst({
          where: {
            userId: supplier.vendor.user.id,
            type: 'ASSESSMENT_DUE',
            metadata: { path: ['supplierId'], equals: supplier.id },
            createdAt: { gte: oneWeekAgo }
          }
        });

        if (!existingNotification) {
          await NotificationService.createNotification({
            userId: supplier.vendor.user.id,
            title: `⚠️ No Assessments Started: ${supplier.name}`,
            message: `Supplier "${supplier.name}" has not started any assessments.`,
            type: 'ASSESSMENT_DUE',
            priority: 'MEDIUM'
          });
        }
      }
    } catch (error) {
      console.error(`❌ Error sending no-assessment notification for supplier ${supplier.id}:`, error);
    }
  }

  // ========== PROCESS CRITICAL SUPPLIERS ==========
  private async processCriticalSuppliers(data: any) {
    console.log('🔴 Processing critical suppliers...');

    try {
      const today = new Date();
      const fifteenDaysFromNow = new Date();
      fifteenDaysFromNow.setDate(today.getDate() + 15);

      const criticalSuppliers = await prisma.supplier.findMany({
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
        await this.sendCriticalSupplierNotification(supplier);
      }



    } catch (error) {
      console.error('❌ Error processing critical suppliers:', error);

      throw error;
    }
  }

  // ========== SEND CRITICAL SUPPLIER NOTIFICATION ==========
  private async sendCriticalSupplierNotification(supplier: any) {
    try {
      const today = new Date();
      const daysLeft = Math.ceil(
        (supplier.contractEndDate!.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Send to vendor
      if (supplier.vendor?.user?.id) {
        await NotificationService.createNotification({
          userId: supplier.vendor.user.id,
          title: `🚨 CRITICAL: ${supplier.name}`,
          message: `Supplier "${supplier.name}" has ${supplier.riskLevel} risk and contract expires in ${daysLeft} days.`,
          type: 'RISK_ALERT',
          priority: 'HIGH'
        });
      }

      // Send to supplier
      if (supplier.user?.id) {
        await NotificationService.createNotification({
          userId: supplier.user.id,
          title: `⚠️ Urgent Action Required`,
          message: `Your company has ${supplier.riskLevel} risk and contract expires in ${daysLeft} days.`,
          type: 'RISK_ALERT',
          priority: 'HIGH'
        });
      }
    } catch (error) {
      console.error(`❌ Error sending critical notification for supplier ${supplier.id}:`, error);
    }
  }

  // ========== MANUAL TRIGGER ==========
  async manualTriggerCheck(type: string) {
    const jobTypes: Record<string, string> = {
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

    const job = await this.monitoringQueue.add(jobName, {
      manualTrigger: true,
      triggeredAt: new Date().toISOString()
    }, {
      priority: 1
    });

    return { jobId: job.id, name: jobName, status: 'queued' };
  }

  // ========== GET QUEUE STATS ==========
  async getQueueStats() {
    const [
      monitoringJobs,
      monitoringWorkers,
      highRiskJobs,
      contractJobs,
      assessmentJobs
    ] = await Promise.all([
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
  }

  // ========== GET JOB DETAILS ==========
  async getJobDetails(jobId: string) {
    const job = await this.monitoringQueue.getJob(jobId);
    if (!job) {
      return null;
    }

    const state = await job.getState();
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
  }

  // ========== CLEANUP ==========
  async cleanup() {
    console.log('🧹 Cleaning up monitoring queues...');

    await this.monitoringQueue.close();
    await this.highRiskQueue.close();
    await this.contractQueue.close();
    await this.assessmentQueue.close();
    await this.queueEvents.close();

    console.log('✅ Monitoring queues closed');
  }
}