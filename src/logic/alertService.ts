// src/Logic/alertService.ts

import { NotificationService } from "../app/modules/notification/notification.service";
import { prisma } from "../app/shared/prisma";

export interface AlertConfig {
  checkCertificateExpiry: boolean;
  checkMissingEvidence: boolean;
  checkHighRisk: boolean;
  checkAssessmentDue: boolean;
  checkContractExpiry: boolean;
  checkSupplierInactivity: boolean;
}

export class AlertService {
  private static instance: AlertService;
  private config: AlertConfig;

  private constructor() {
    this.config = {
      checkCertificateExpiry: true,
      checkMissingEvidence: true,
      checkHighRisk: true,
      checkAssessmentDue: true,
      checkContractExpiry: true,
      checkSupplierInactivity: true
    };
  }

  static getInstance(): AlertService {
    if (!AlertService.instance) {
      AlertService.instance = new AlertService();
    }
    return AlertService.instance;
  }

  async runDailyChecks(): Promise<void> {
    console.log('🚨 Running daily alert checks...');
    
    try {
      const checks = [
        //this.checkCertificateExpiry(),
        this.checkMissingEvidence(),
        this.checkHighRiskSuppliers(),
        this.checkAssessmentDue(),
        this.checkContractExpiry(),
        this.checkSupplierInactivity()
      ];

      await Promise.all(checks);
      console.log('✅ Daily alert checks completed');
    } catch (error) {
      console.error('❌ Error running daily alerts:', error);
    }
  }

  // async checkCertificateExpiry(): Promise<void> {
  //   if (!this.config.checkCertificateExpiry) return;

  //   // Find certificates expiring in next 30 days
  //   const thirtyDaysFromNow = new Date();
  //   thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  //   // This would check certificate documents
  //   const expiringCertificates = await prisma.document.findMany({
  //     where: {
  //       type: 'certificate',
  //       // Assuming certificate expiry date is stored in metadata
  //       // This would need to be adapted based on actual data structure
  //     }
  //   });

  //   for (const certificate of expiringCertificates) {
  //     // Notify relevant users
  //     const vendor = await prisma.vendor.findFirst({
  //       where: {
  //         OR: [
  //           { id: certificate.vendorId },
  //           { suppliers: { some: { id: certificate.supplierId } } }
  //         ]
  //       },
  //       select: { userId: true }
  //     });

  //     if (vendor) {
  //       await NotificationService.createNotification({
  //         userId: vendor.userId,
  //         title: "Certificate Expiring Soon",
  //         message: `A certificate is expiring soon: ${certificate.name}`,
  //         type: 'CONTRACT_EXPIRING_SOON',
  //         metadata: {
  //           documentId: certificate.id,
  //           name: certificate.name,
  //           expiryDate: '2024-12-31' // This should come from certificate data
  //         },
  //         priority: 'MEDIUM'
  //       });
  //     }
  //   }
  // }

  async checkMissingEvidence(): Promise<void> {
    if (!this.config.checkMissingEvidence) return;

    // Find answers requiring evidence but missing it
    const missingEvidence = await prisma.assessmentAnswer.findMany({
      where: {
        question: {
          evidenceRequired: true
        },
        OR: [
          { evidence: null },
          { evidence: '' },
          { evidenceStatus: 'REQUESTED' }
        ],
        submission: {
          status: { not: 'DRAFT' }
        }
      },
      include: {
        question: true,
        submission: {
          include: {
            user: {
              select: { id: true, email: true }
            },
            assessment: {
              select: { title: true }
            }
          }
        }
      }
    });

    for (const answer of missingEvidence) {
      await NotificationService.createNotification({
        userId: answer.submission.user.id,
        title: "Missing Evidence Required",
        message: `Evidence required for question in assessment "${answer.submission.assessment.title}"`,
        type: 'EVIDENCE_REQUESTED',
        metadata: {
          answerId: answer.id,
          question: answer.question.question,
          assessmentId: answer.submission.assessmentId
        },
        priority: 'HIGH'
      });
    }
  }

  async checkHighRiskSuppliers(): Promise<void> {
    if (!this.config.checkHighRisk) return;

    // Find high risk suppliers
    const highRiskSuppliers = await prisma.supplier.findMany({
      where: {
        isActive: true,
        isDeleted: false,
        riskLevel: { in: ['HIGH', 'CRITICAL'] },
        vendor: {
          user: {
            notificationPreferences: {
              riskAlerts: true
            }
          }
        }
      },
      include: {
        vendor: {
          select: {
            userId: true,
            companyName: true
          }
        }
      }
    });

    for (const supplier of highRiskSuppliers) {
      await NotificationService.createNotification({
        userId: supplier.vendor.userId,
        title: "High Risk Supplier Alert",
        message: `Supplier "${supplier.name}" is at ${supplier.riskLevel} risk level`,
        type: 'RISK_ALERT',
        metadata: {
          supplierId: supplier.id,
          name: supplier.name,
          riskLevel: supplier.riskLevel,
          bivScore: supplier.bivScore?.toNumber()
        },
        priority: 'HIGH'
      });
    }
  }

  async checkAssessmentDue(): Promise<void> {
    if (!this.config.checkAssessmentDue) return;

    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    // Find suppliers with assessments due soon
    const dueAssessments = await prisma.supplier.findMany({
      where: {
        isActive: true,
        isDeleted: false,
        nextAssessmentDue: {
          lte: sevenDaysFromNow,
          gte: new Date()
        }
      },
      include: {
        user: {
          select: { id: true, email: true }
        },
        vendor: {
          select: {
            userId: true,
            companyName: true
          }
        }
      }
    });

    for (const supplier of dueAssessments) {
      if (supplier.user) {
        await NotificationService.createNotification({
          userId: supplier.user.id,
          title: "Assessment Due Soon",
          message: `Your next assessment is due on ${supplier.nextAssessmentDue?.toLocaleDateString()}`,
          type: 'ASSESSMENT_DUE',
          metadata: {
            supplierId: supplier.id,
            dueDate: supplier.nextAssessmentDue,
            daysRemaining: Math.ceil(
              (supplier.nextAssessmentDue!.getTime() - new Date().getTime()) / 
              (1000 * 60 * 60 * 24)
            )
          },
          priority: 'MEDIUM'
        });
      }

      // Notify vendor as well
      await NotificationService.createNotification({
        userId: supplier.vendor.userId,
        title: "Supplier Assessment Due",
        message: `Supplier "${supplier.name}" has an assessment due soon`,
        type: 'ASSESSMENT_DUE',
        metadata: {
          supplierId: supplier.id,
          name: supplier.name,
          dueDate: supplier.nextAssessmentDue
        },
        priority: 'MEDIUM'
      });
    }
  }

  async checkContractExpiry(): Promise<void> {
    if (!this.config.checkContractExpiry) return;

    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    // Find contracts expiring soon
    const expiringContracts = await prisma.supplier.findMany({
      where: {
        isActive: true,
        isDeleted: false,
        contractEndDate: {
          lte: thirtyDaysFromNow,
          gte: new Date()
        },
        vendor: {
          user: {
            notificationPreferences: {
              contractReminders: true
            }
          }
        }
      },
      include: {
        vendor: {
          select: {
            userId: true,
            companyName: true
          }
        }
      }
    });

    for (const supplier of expiringContracts) {
      const daysRemaining = Math.ceil(
        (supplier.contractEndDate!.getTime() - new Date().getTime()) / 
        (1000 * 60 * 60 * 24)
      );

      await NotificationService.createNotification({
        userId: supplier.vendor.userId,
        title: "Contract Expiring Soon",
        message: `Contract with "${supplier.name}" expires in ${daysRemaining} days`,
        type: 'CONTRACT_EXPIRING_SOON',
        metadata: {
          supplierId: supplier.id,
          name: supplier.name,
          expiryDate: supplier.contractEndDate,
          daysRemaining
        },
        priority: daysRemaining < 7 ? 'HIGH' : 'MEDIUM'
      });
    }
  }

  async checkSupplierInactivity(): Promise<void> {
    if (!this.config.checkSupplierInactivity) return;

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    // Find inactive suppliers
    const inactiveSuppliers = await prisma.supplier.findMany({
      where: {
        isActive: true,
        isDeleted: false,
        lastAssessmentDate: {
          lt: ninetyDaysAgo
        },
        OR: [
          { nextAssessmentDue: null },
          { nextAssessmentDue: { lt: new Date() } }
        ]
      },
      include: {
        vendor: {
          select: {
            userId: true,
            companyName: true
          }
        }
      }
    });

    for (const supplier of inactiveSuppliers) {
      const daysInactive = Math.ceil(
        (new Date().getTime() - (supplier.lastAssessmentDate?.getTime() || new Date().getTime())) / 
        (1000 * 60 * 60 * 24)
      );

      await NotificationService.createNotification({
        userId: supplier.vendor.userId,
        title: "Supplier Inactivity Alert",
        message: `Supplier "${supplier.name}" has been inactive for ${daysInactive} days`,
        type: 'SYSTEM_ALERT',
        metadata: {
          supplierId: supplier.id,
          name: supplier.name,
          daysInactive,
          lastAssessmentDate: supplier.lastAssessmentDate
        },
        priority: 'MEDIUM'
      });
    }
  }

  async checkNewMessages(): Promise<void> {
    // This would be triggered when new messages arrive
    // Implementation depends on real-time messaging system
  }

  async checkSLACompliance(): Promise<void> {
    // Check for SLA breaches in problems
    // This could integrate with the ProblemService.checkSLABreaches()
  }

  updateConfig(newConfig: Partial<AlertConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig(): AlertConfig {
    return { ...this.config };
  }
}

export const alertService = AlertService.getInstance();