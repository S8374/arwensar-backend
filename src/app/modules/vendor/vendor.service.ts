// src/modules/vendor/vendor.service.ts
import { Vendor, Supplier, AssessmentSubmission, Criticality, InvitationStatus } from "@prisma/client";
import { prisma } from "../../shared/prisma";
import httpStatus from "http-status";
import ApiError from "../../../error/ApiError";
import { calculateBIVScore } from "../../../logic/bivRiskCalculator";
import { mailtrapService } from "../../shared/mailtrap.service";
import { jwtHelper } from "../../helper/jwtHelper";
import { config } from "../../../config";
import { BulkImportResult, BulkImportSuppliersInput } from "./vendor.types";

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
    const totalAssessments = await prisma.assessment.count({
      where: {
        isActive: true
      }
    });
    const pendingSubmissions = supplier.assessmentSubmissions.filter(
      sub => sub.status === 'PENDING' || sub.status === 'UNDER_REVIEW'
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
        totalAssessments,
        averageScore: parseFloat(averageScore.toFixed(2)),

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
  // ========== GET SINGLE SUPPLIER PROGRESS ==========
  async getSingleSupplierProgress(supplierId: string, vendorId: string): Promise<any> {
    const supplier = await prisma.supplier.findFirst({
      where: {
        id: supplierId,
        vendorId,
        isDeleted: false
      },
      include: {
        assessmentSubmissions: {
          where: {
            status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED'] }
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
      throw new ApiError(httpStatus.NOT_FOUND, "Supplier not found");
    }

    // Calculate progress statistics
    const totalAssessments = supplier.assessmentSubmissions.length;
    const completedAssessments = supplier.assessmentSubmissions.filter(
      sub => sub.status === 'APPROVED'
    ).length;

    // Check if all required assessments are completed
    const initialAssessmentCompleted = supplier.assessmentSubmissions.some(
      sub => sub.assessment.stage === 'INITIAL' && sub.status === 'APPROVED'
    );
    const fullAssessmentCompleted = supplier.assessmentSubmissions.some(
      sub => sub.assessment.stage === 'FULL' && sub.status === 'APPROVED'
    );

    const isCompletedAll = initialAssessmentCompleted && fullAssessmentCompleted;
    const progressPercent = isCompletedAll ? 100 : (totalAssessments / 2) * 100;

    // Calculate BIV scores
    let overallBIVScore = null;
    let businessScore = null;
    let integrityScore = null;
    let availabilityScore = null;

    const latestApprovedSubmission = supplier.assessmentSubmissions.find(
      sub => sub.status === 'APPROVED'
    );

    if (latestApprovedSubmission) {
      overallBIVScore = latestApprovedSubmission.bivScore?.toNumber() || null;
      businessScore = latestApprovedSubmission.businessScore?.toNumber() || null;
      integrityScore = latestApprovedSubmission.integrityScore?.toNumber() || null;
      availabilityScore = latestApprovedSubmission.availabilityScore?.toNumber() || null;
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
      assessments: supplier.assessmentSubmissions.map(sub => ({
        id: sub.id,
        title: sub.assessment.title,
        stage: sub.assessment.stage,
        status: sub.status,
        score: sub.score?.toNumber(),
        submittedAt: sub.submittedAt
      }))
    };
  },
  // ========== BULK IMPORT SUPPLIERS ==========
  async bulkImportSuppliers(
    vendorId: string,
    payload: BulkImportSuppliersInput
  ): Promise<BulkImportResult> {
    // Check if vendor exists
    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
      include: {
        user: { select: { email: true } }
      }
    });

    if (!vendor) {
      throw new ApiError(httpStatus.NOT_FOUND, "Vendor not found");
    }

    const results: BulkImportResult['results'] = [];
    let successful = 0;
    let failed = 0;

    // Use transaction for better performance and consistency
    for (const supplierData of payload.suppliers) {
      try {
        // Check if supplier email already exists
        const existingSupplier = await prisma.supplier.findUnique({
          where: { email: supplierData.email.toLowerCase() }
        });

        if (existingSupplier) {
          results.push({
            supplier: supplierData,
            success: false,
            message: "Supplier with this email already exists",
          });
          failed++;
          continue;
        }

        // Generate invitation token
        const invitationToken = jwtHelper.generateToken(
          {
            email: supplierData.email.toLowerCase(),
            vendorId,
            type: 'supplier_invitation'
          },
          config.jwt.jwt_secret as string,
          '7d'
        );

        // Prepare supplier data
        const supplierCreateData = {
          name: supplierData.name,
          contactPerson: supplierData.contactPerson,
          email: supplierData.email.toLowerCase(),
          phone: supplierData.phone || "",
          category: supplierData.category,
          criticality: supplierData.criticality as Criticality,
          contractStartDate: new Date(supplierData.contractStartDate),
          contractEndDate: supplierData.contractEndDate ? new Date(supplierData.contractEndDate) : null,
          vendorId,
          invitationToken,
          invitationSentAt: new Date(),
          invitationStatus: InvitationStatus.SENT,
          isActive: false
        };

        // Create supplier
        const supplier = await prisma.supplier.create({
          data: supplierCreateData,
          include: {
            vendor: {
              select: {
                companyName: true,
                firstName: true,
                lastName: true
              }
            }
          }
        });

        // Send invitation email
        let invitationSent = false;
        try {
          await mailtrapService.sendHtmlEmail({
            to: supplierData.email.toLowerCase(),
            subject: `Invitation to Join ${vendor.companyName} on CyberNark`,
            html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">You're Invited to Join CyberNark!</h2>
              <p>${vendor.firstName} ${vendor.lastName} from <strong>${vendor.companyName}</strong> has invited you to join their supplier network on CyberNark.</p>
              
              <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
                <h3 style="margin-top: 0;">Supplier Details:</h3>
                <p><strong>Name:</strong> ${supplierData.name}</p>
                <p><strong>Contact Person:</strong> ${supplierData.contactPerson}</p>
                <p><strong>Category:</strong> ${supplierData.category}</p>
                <p><strong>Criticality:</strong> ${supplierData.criticality}</p>
                ${supplierData.contractStartDate ? `<p><strong>Contract Start:</strong> ${new Date(supplierData.contractStartDate).toLocaleDateString()}</p>` : ''}
                ${supplierData.contractEndDate ? `<p><strong>Contract End:</strong> ${new Date(supplierData.contractEndDate).toLocaleDateString()}</p>` : ''}
              </div>
              
              <p>To complete your registration and access the platform, please click the button below:</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${config.APP.WEBSITE}/supplier/register?token=${invitationToken}" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                  Complete Registration
                </a>
              </div>
              
              <p style="color: #666; font-size: 14px;">
                <strong>Note:</strong> This invitation link will expire in 7 days. If you have any questions, please contact ${vendor.companyName} directly.
              </p>
              
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
              <p style="color: #666; font-size: 12px;">© ${new Date().getFullYear()} CyberNark. All rights reserved.</p>
            </div>
          `
          });
          invitationSent = true;
        } catch (emailError) {
          console.error(`Failed to send email to ${supplierData.email}:`, emailError);
          // Continue even if email fails - supplier is created
        }

        results.push({
          supplier: supplierData,
          success: true,
          message: "Supplier created successfully",
          invitationSent,
        });
        successful++;

      } catch (error: any) {
        console.error(`Error creating supplier ${supplierData.email}:`, error);
        results.push({
          supplier: supplierData,
          success: false,
          message: error.message || "Failed to create supplier",
        });
        failed++;
      }
    }

    return {
      total: payload.suppliers.length,
      successful,
      failed,
      results,
    };
  },
  async resendInvitation(
    supplierId: string,
    vendorId: string
  ): Promise<{ supplier: Supplier; invitationSent: boolean; message: string }> {
    // Check if vendor exists
    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
      include: {
        user: {
          select: { email: true }
        }
      }
    });

    if (!vendor) {
      throw new ApiError(httpStatus.NOT_FOUND, "Vendor not found");
    }

    // Check if supplier exists and belongs to vendor
    const supplier = await prisma.supplier.findFirst({
      where: {
        id: supplierId,
        vendorId: vendorId,
        isDeleted: false,
        invitationStatus: {
          in: [InvitationStatus.PENDING, InvitationStatus.SENT, InvitationStatus.EXPIRED]
        }
      }
    });

    if (!supplier) {
      throw new ApiError(
        httpStatus.NOT_FOUND,
        "Supplier not found or invitation already accepted"
      );
    }

    // Check if supplier is already active (has user account)
    if (supplier.isActive) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Supplier is already active and has an account"
      );
    }

    // Generate new invitation token
    const invitationToken = jwtHelper.generateToken(
      {
        email: supplier.email,
        vendorId: vendorId,
        type: 'supplier_invitation'
      },
      config.jwt.jwt_secret as string,
      '7d' // Token valid for 7 days
    );

    const result = await prisma.$transaction(async (tx) => {
      // Update supplier with new token
      const updatedSupplier = await tx.supplier.update({
        where: { id: supplierId },
        data: {
          invitationToken: invitationToken,
          invitationSentAt: new Date(),
          invitationStatus: InvitationStatus.SENT,
          // Reset invitation accepted fields
          invitationAcceptedAt: null
        }
      });

      return updatedSupplier;
    });

    // Send invitation email
    try {
      await mailtrapService.sendHtmlEmail({
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
            <a href="${config.APP.WEBSITE}/supplier/register?token=${invitationToken}" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
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
    } catch (emailError) {
      console.error("Failed to resend invitation email:", emailError);
      return {
        supplier: result,
        invitationSent: false,
        message: "Invitation updated but failed to send email"
      };
    }
  }
};