// src/modules/vendor/vendor.service.ts
import { Vendor, Supplier, AssessmentSubmission, Criticality } from "@prisma/client";
import { prisma } from "../../shared/prisma";
import httpStatus from "http-status";
import ApiError from "../../../error/ApiError";
import { calculateBIVScore } from "../../../logic/bivRiskCalculator";

export interface VendorDashboardStats {
  totalSuppliers: number;
  activeSuppliers: number;
  pendingAssessments: number;
  nonCompliantSuppliers: number;
  complianceOverview: {
    low: number;
    medium: number;
    high: number;
  };
  contractExpiring: Array<{
    id: string;
    name: string;
    contractEndDate: Date;
    daysRemaining: number;
  }>;
  nis2Compliance: {
    todayImproved: number;
    todayDecreased: number;
    overall: number;
  };
  recentSubmissions: Array<{
    id: string;
    supplierName: string;
    assessmentTitle: string;
    status: string;
    submittedAt: Date;
    score: number | null;
  }>;
}

export const VendorService = {
  // ========== DASHBOARD ==========
  async getDashboardStats(vendorId: string): Promise<VendorDashboardStats> {
    const [
      suppliers,
      submissions,
      contractExpiring
    ] = await Promise.all([
      prisma.supplier.findMany({
        where: {
          vendorId,
          isDeleted: false,
          isActive: true
        },
        include: {
          assessmentSubmissions: {
            where: { status: 'SUBMITTED' },
            take: 1
          }
        }
      }),
      prisma.assessmentSubmission.findMany({
        where: {
          vendorId,
          status: { in: ['SUBMITTED', 'UNDER_REVIEW'] }
        },
        include: {
          assessment: { select: { title: true } },
          user: { select: { email: true } }
        },
        orderBy: { submittedAt: 'desc' },
        take: 10
      }),
      prisma.supplier.findMany({
        where: {
          vendorId,
          isDeleted: false,
          isActive: true,
          contractEndDate: {
            not: null,
            gte: new Date(),
            lte: new Date(new Date().setDate(new Date().getDate() + 30))
          }
        },
        orderBy: { contractEndDate: 'asc' },
        take: 5
      })
    ]);

    const riskDistribution = await prisma.supplier.groupBy({
      by: ['riskLevel'],
      where: {
        vendorId,
        isDeleted: false,
        isActive: true,
        riskLevel: { not: null }
      },
      _count: true
    });

    // Calculate NIS2 compliance changes
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todaySubmissions = await prisma.assessmentSubmission.findMany({
      where: {
        vendorId,
        submittedAt: { gte: today },
        status: 'APPROVED'
      },
      select: { bivScore: true, supplierId: true }
    });

    let todayImproved = 0;
    let todayDecreased = 0;

    for (const submission of todaySubmissions) {
      if (submission.bivScore) {
        const supplier = await prisma.supplier.findUnique({
          where: { id: submission.supplierId },
          select: { bivScore: true }
        });

        if (supplier?.bivScore && submission.bivScore > supplier.bivScore) {
          todayImproved++;
        } else if (supplier?.bivScore && submission.bivScore < supplier.bivScore) {
          todayDecreased++;
        }
      }
    }

    const nis2CompliantSuppliers = suppliers.filter(s => s.nis2Compliant).length;
    const overallNIS2Compliance = suppliers.length > 0 ?
      (nis2CompliantSuppliers / suppliers.length) * 100 : 0;

    return {
      totalSuppliers: suppliers.length,
      activeSuppliers: suppliers.filter(s => s.isActive).length,
      pendingAssessments: submissions.filter(s => s.status === 'SUBMITTED').length,
      nonCompliantSuppliers: suppliers.filter(s =>
        s.riskLevel === 'HIGH' || s.riskLevel === 'CRITICAL'
      ).length,
      complianceOverview: {
        low: riskDistribution.find(r => r.riskLevel === 'LOW')?._count || 0,
        medium: riskDistribution.find(r => r.riskLevel === 'MEDIUM')?._count || 0,
        high: riskDistribution.find(r => r.riskLevel === 'HIGH')?._count || 0
      },
      contractExpiring: contractExpiring.map(supplier => ({
        id: supplier.id,
        name: supplier.name,
        contractEndDate: supplier.contractEndDate!,
        daysRemaining: Math.ceil(
          (supplier.contractEndDate!.getTime() - new Date().getTime()) /
          (1000 * 60 * 60 * 24)
        )
      })),
      nis2Compliance: {
        todayImproved,
        todayDecreased,
        overall: parseFloat(overallNIS2Compliance.toFixed(2))
      },
      recentSubmissions: submissions.map(submission => ({
        id: submission.id,
        supplierName: submission.user.email,
        assessmentTitle: submission.assessment.title,
        status: submission.status,
        submittedAt: submission.submittedAt || submission.createdAt,
        score: submission.score?.toNumber() || null
      }))
    };
  },

  // ========== PROFILE MANAGEMENT ==========
async getVendorProfile(vendorId: string): Promise<any> {
    const vendor = await prisma.vendor.findUnique({
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
        usedSuppliers: vendor.user.subscription.usedSuppliers,
        usedAssessments: vendor.user.subscription.usedAssessments,
        plan: vendor.user.subscription.plan
      } : null,
      notificationPreferences: vendor.user.notificationPreferences
    };
  },
  

  async updateVendorProfile(vendorId: string, data: any): Promise<Vendor> {
    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId }
    });

    if (!vendor) {
      throw new ApiError(httpStatus.NOT_FOUND, "Vendor not found");
    }

    // Check if business email is being updated and if it's already taken
    if (data.businessEmail && data.businessEmail !== vendor.businessEmail) {
      const existingVendor = await prisma.vendor.findUnique({
        where: { businessEmail: data.businessEmail }
      });

      if (existingVendor) {
        throw new ApiError(httpStatus.CONFLICT, "Business email already in use");
      }
    }

    const updatedVendor = await prisma.vendor.update({
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
    await prisma.activityLog.create({
      data: {
        userId: updatedVendor.userId,
        action: "UPDATE_PROFILE",
        entityType: "VENDOR",
        entityId: vendorId,
        details: { updatedFields: Object.keys(data) }
      }
    });

    return updatedVendor;
  },

  // ========== SUPPLIER MANAGEMENT ==========
  async getSuppliers(vendorId: string): Promise<Supplier[]> {
    return prisma.supplier.findMany({
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
            isVerified: true
          }
        },
        assessmentSubmissions: {
          where: { status: 'APPROVED' },
          orderBy: { submittedAt: 'desc' },
          take: 1
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  },

  async getSupplierById(vendorId: string, supplierId: string): Promise<any> {
    const supplier = await prisma.supplier.findFirst({
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
            createdAt: true
          }
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
      }
    });

    if (!supplier) {
      throw new ApiError(httpStatus.NOT_FOUND, "Supplier not found");
    }

    // Calculate statistics
    const totalSubmissions = supplier.assessmentSubmissions.length;
    const pendingSubmissions = supplier.assessmentSubmissions.filter(
      sub => sub.status === 'SUBMITTED' || sub.status === 'UNDER_REVIEW'
    ).length;
    const approvedSubmissions = supplier.assessmentSubmissions.filter(
      sub => sub.status === 'APPROVED'
    ).length;

    const averageScore = supplier.assessmentSubmissions.length > 0 ?
      supplier.assessmentSubmissions.reduce((acc, sub) =>
        acc + (sub.score?.toNumber() || 0), 0
      ) / supplier.assessmentSubmissions.length : 0;

    return {
      ...supplier,
      statistics: {
        totalSubmissions,
        pendingSubmissions,
        approvedSubmissions,
        averageScore: parseFloat(averageScore.toFixed(2)),
        totalAssessments: totalSubmissions
      }
    };
  },

  // ========== ASSESSMENT REVIEW ==========
  async reviewAssessment(
    vendorId: string,
    submissionId: string,
    data: any
  ): Promise<any> {
    const submission = await prisma.assessmentSubmission.findFirst({
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
      throw new ApiError(httpStatus.NOT_FOUND, "Assessment submission not found");
    }

    const result = await prisma.$transaction(async (tx) => {
      // Update submission status
      const updatedSubmission = await tx.assessmentSubmission.update({
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
        const businessAnswers = submission.answers.filter(
          a => a.question.bivCategory === 'BUSINESS'
        );
        const integrityAnswers = submission.answers.filter(
          a => a.question.bivCategory === 'INTEGRITY'
        );
        const availabilityAnswers = submission.answers.filter(
          a => a.question.bivCategory === 'AVAILABILITY'
        );

        const businessScore = businessAnswers.length > 0 ?
          businessAnswers.reduce((sum, a) => sum + (a.score?.toNumber() || 0), 0) /
          businessAnswers.length : 0;

        const integrityScore = integrityAnswers.length > 0 ?
          integrityAnswers.reduce((sum, a) => sum + (a.score?.toNumber() || 0), 0) /
          integrityAnswers.length : 0;

        const availabilityScore = availabilityAnswers.length > 0 ?
          availabilityAnswers.reduce((sum, a) => sum + (a.score?.toNumber() || 0), 0) /
          availabilityAnswers.length : 0;

        const bivResult = calculateBIVScore({
          businessScore,
          integrityScore,
          availabilityScore
        });

        // Update supplier with new scores
        await tx.supplier.update({
          where: { id: submission.supplierId },
          data: {
            bivScore: bivResult.bivScore,
            businessScore,
            integrityScore,
            availabilityScore,
            riskLevel: bivResult.riskLevel as any,
            lastAssessmentDate: new Date(),
            complianceRate: data.complianceRate,
            nis2Compliant: bivResult.bivScore >= 71 // NIS2 compliant if low risk
          }
        });
      }

      // Create notification for supplier
      if (submission.userId) {
        await tx.notification.create({
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
    });

    return result;
  },

  // ========== EVIDENCE REVIEW ==========
  async reviewEvidence(
    vendorId: string,
    answerId: string,
    data: any
  ): Promise<any> {
    const answer = await prisma.assessmentAnswer.findFirst({
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
      throw new ApiError(httpStatus.NOT_FOUND, "Answer not found");
    }

    const updatedAnswer = await prisma.assessmentAnswer.update({
      where: { id: answerId },
      data: {
        evidenceStatus: data.status,
        evidenceRejectionReason: data.rejectionReason,
        score: data.score
      }
    });

    // Create notification for supplier
    if (data.status === 'REJECTED' && answer.submission.userId) {
      await prisma.notification.create({
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
  },
  // ========== UPLOAD DOCUMENT (with storage limit check) ==========
  async uploadDocument(
    vendorId: string,
    file: any,
    data: any
  ) {
    const fileSizeMB = file.size / (1024 * 1024); // Convert bytes to MB

  

    // Rest of the uploadDocument implementation...
    // [Your existing uploadDocument code]
  },

};