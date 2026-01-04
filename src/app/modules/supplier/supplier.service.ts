// src/modules/supplier/supplier.service.ts
import { Supplier, Criticality, User, AssessmentSubmission, InvitationStatus } from "@prisma/client";
import { prisma } from "../../shared/prisma";
import httpStatus from "http-status";
import { jwtHelper } from "../../helper/jwtHelper";
import bcrypt from "bcryptjs";
import { mailtrapService } from "../../shared/mailtrap.service";
import ApiError from "../../../error/ApiError";
import { config } from "../../../config";
import { calculateBIVScore } from "../../../logic/bivRiskCalculator";

export interface SupplierDashboardStats {
  totalAssessments: number;
  pendingAssessments: number;
  completedAssessments: number;
  averageScore: number;
  riskLevel: Criticality | null;
  bivScore: number | null;
  nextAssessmentDue: Date | null;
  recentSubmissions: Array<{
    id: string;
    assessmentTitle: string;
    status: string;
    submittedAt: Date;
    score: number | null;
  }>;
  nis2Status: {
    isCompliant: boolean | null; // Change this to allow null
    progress: number;
    requiredAssessments: number;
    completedAssessments: number;
  };
}

export const SupplierService = {
  // ========== DASHBOARD ==========
  async getDashboardStats(supplierId: string): Promise<SupplierDashboardStats> {
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
      include: {
        assessmentSubmissions: {
          include: {
            assessment: {
              select: {
                id: true,
                title: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!supplier) {
      throw new ApiError(httpStatus.NOT_FOUND, "Supplier not found");
    }

    const totalAssessments = supplier.assessmentSubmissions.length;
    const pendingAssessments = supplier.assessmentSubmissions.filter(
      sub => sub.status === 'DRAFT' || sub.status === 'SUBMITTED' || sub.status === 'PENDING'
    ).length;
    const completedAssessments = supplier.assessmentSubmissions.filter(
      sub => sub.status === 'APPROVED'
    ).length;

    const averageScore = completedAssessments > 0 ?
      supplier.assessmentSubmissions
        .filter(sub => sub.status === 'APPROVED')
        .reduce((sum, sub) => sum + (sub.score?.toNumber() || 0), 0) /
      completedAssessments : 0;

    // Calculate NIS2 status
    const requiredAssessments = 2; // Initial + Full assessment
    const initialCompleted = supplier.initialAssessmentCompleted ? 1 : 0;
    const fullCompleted = supplier.fullAssessmentCompleted ? 1 : 0;
    const completedAssessmentsCount = initialCompleted + fullCompleted;

    return {
      totalAssessments,
      pendingAssessments,
      completedAssessments,
      averageScore: parseFloat(averageScore.toFixed(2)),
      riskLevel: supplier.riskLevel,
      bivScore: supplier.bivScore?.toNumber() || null,
      nextAssessmentDue: supplier.nextAssessmentDue,
      recentSubmissions: supplier.assessmentSubmissions.slice(0, 5).map(sub => ({
        id: sub.id,
        assessmentTitle: sub.assessment.title,
        status: sub.status,
        submittedAt: sub.submittedAt || sub.createdAt,
        score: sub.score?.toNumber() || null
      })),
      nis2Status: {
        isCompliant: supplier.nis2Compliant,
        progress: Math.round((completedAssessmentsCount / requiredAssessments) * 100),
        requiredAssessments,
        completedAssessments: completedAssessmentsCount
      }
    };
  },

  // ========== CREATE SUPPLIER (VENDOR) ==========
  async createSupplier(
    vendorId: string,
    payload: any
  ) {

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

    // Check if supplier email already exists
  const existingSupplier = await prisma.supplier.findUnique({
  where: { email: payload.email }
}); 

    if (existingSupplier) {
      throw new ApiError(httpStatus.CONFLICT, "Supplier with this email already exists");
    }

    // Generate invitation token
    const invitationToken = jwtHelper.generateToken(
      {
        email: payload.email,
        vendorId,
        type: 'supplier_invitation'
      },
      config.jwt.jwt_secret as string,
      '7d'
    );

    // FIX: Use the proper enum value
    const supplierData = {
      name: payload.name,
      contactPerson: payload.contactPerson,
      email: payload.email,
      phone: payload.phone,
      category: payload.category,
      criticality: payload.criticality as Criticality,
      contractStartDate: new Date(payload.contractStartDate),
      contractEndDate: payload.contractEndDate ? new Date(payload.contractEndDate) : null,
      contractDocument: payload.contractDocument,
      documentType: payload.documentType,
      vendorId,
      invitationToken,
      invitationSentAt: new Date(),
      invitationStatus: InvitationStatus.SENT, // FIX: Use enum value instead of string
      isActive: false
    };

    const supplier = await prisma.supplier.create({
      data: supplierData,
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
    try {
      await mailtrapService.sendHtmlEmail({ // FIX: Added await
        to: payload.email,
        subject: `Invitation to Join ${vendor.companyName} on CyberNark`,
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">You're Invited to Join CyberNark!</h2>
          <p>${vendor.firstName} ${vendor.lastName} from <strong>${vendor.companyName}</strong> has invited you to join their supplier network on CyberNark.</p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Supplier Details:</h3>
            <p><strong>Name:</strong> ${payload.name}</p>
            <p><strong>Contact Person:</strong> ${payload.contactPerson}</p>
            <p><strong>Category:</strong> ${payload.category}</p>
            <p><strong>Criticality:</strong> ${payload.criticality}</p>
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

      return {
        supplier,
        invitationSent: true,
        message: "Supplier created and invitation email sent successfully"
      };
    } catch (emailError) {
      console.error("Failed to send invitation email:", emailError);
      return {
        supplier,
        invitationSent: false,
        message: "Supplier created but failed to send invitation email"
      };
    }
  }
  ,
  // ========== COMPLETE SUPPLIER REGISTRATION ==========
  async completeSupplierRegistration(payload: any): Promise<{ supplier: Supplier; user: User }> {
    let decodedToken;
    try {
      decodedToken = jwtHelper.verifyToken(
        payload.invitationToken,
        config.jwt.jwt_secret as string
      ) as any;
    } catch (error) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid or expired invitation token");
    }

    if (decodedToken.type !== 'supplier_invitation') {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid invitation token");
    }

    const supplier = await prisma.supplier.findUnique({
      where: {
        email: decodedToken.email,
        invitationToken: payload.invitationToken,
        isActive: false
      }
    });

    if (!supplier) {
      throw new ApiError(httpStatus.NOT_FOUND, "Supplier invitation not found or already used");
    }

    const hashPassword = await bcrypt.hash(payload.password, 10);

    const result = await prisma.$transaction(async (tx) => {
      // Create user for supplier
      const user = await tx.user.create({
        data: {
          email: supplier.email,
          password: hashPassword,
          role: "SUPPLIER",
          isVerified: true,
          needPasswordChange: false,
          status: "ACTIVE"
        }
      });

      // Update supplier with user ID and mark as active
      const updatedSupplier = await tx.supplier.update({
        where: { id: supplier.id },
        data: {
          userId: user.id,
          isActive: true,
          invitationToken: null,
          invitationStatus: 'ACCEPTED',
          invitationAcceptedAt: new Date()
        }
      });

      // Update user with supplierId
      await tx.user.update({
        where: { id: user.id },
        data: { supplierId: updatedSupplier.id }
      });

      // Create notification preferences
      await tx.notificationPreferences.create({
        data: { userId: user.id }
      });

      return { supplier: updatedSupplier, user };
    });

    // Send welcome email
    try {
      mailtrapService.sendHtmlEmail({
        to: supplier.email,
        subject: "Welcome to CyberNark!",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Welcome to CyberNark! 🎉</h2>
            <p>Your supplier account has been successfully created and activated.</p>
            <p>You can now log in to your dashboard and start completing assessments.</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${config.APP.WEBSITE}/supplier/login" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                Go to Dashboard
              </a>
            </div>
            
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <h3 style="margin-top: 0;">Next Steps:</h3>
              <ol>
                <li>Complete your initial risk assessment</li>
                <li>Upload required documents and evidence</li>
                <li>Review and submit assessments for approval</li>
                <li>Monitor your compliance status</li>
              </ol>
            </div>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">© ${new Date().getFullYear()} CyberNark. All rights reserved.</p>
          </div>
        `
      });
    } catch (error) {
      console.error("Failed to send welcome email:", error);
    }

    return result;
  },

  // ========== VERIFY INVITATION TOKEN ==========
  async verifyInvitationToken(token: string): Promise<any> {
    let decodedToken;
    try {
      decodedToken = jwtHelper.verifyToken(
        token,
        config.jwt.jwt_secret as string
      ) as any;
    } catch (error) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid or expired invitation token");
    }

    if (decodedToken.type !== 'supplier_invitation') {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid invitation token");
    }

    const supplier = await prisma.supplier.findUnique({
      where: {
        email: decodedToken.email,
        invitationToken: token,
        isActive: false
      },
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

    if (!supplier) {
      throw new ApiError(httpStatus.NOT_FOUND, "Invitation not found or already used");
    }

    return {
      supplier: {
        id: supplier.id,
        name: supplier.name,
        contactPerson: supplier.contactPerson,
        email: supplier.email,
        vendor: supplier.vendor
      },
      isValid: true
    };
  },

  // ========== GET SUPPLIER PROFILE ==========
  async getSupplierProfile(supplierId: string): Promise<any> {
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            status: true,
            isVerified: true,
            createdAt: true
          }
        },
        vendor: {
          select: {
            id: true,
            companyName: true,
            businessEmail: true,
            contactNumber: true
          }
        }
      }
    });

    if (!supplier) {
      throw new ApiError(httpStatus.NOT_FOUND, "Supplier not found");
    }

    return supplier;
  },

  // ========== UPDATE SUPPLIER PROFILE ==========
  async updateSupplierProfile(supplierId: string, data: any): Promise<Supplier> {
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId }
    });

    if (!supplier) {
      throw new ApiError(httpStatus.NOT_FOUND, "Supplier not found");
    }

    const updateData: any = { ...data };

    // Handle date conversions
    if (data.contractStartDate) {
      updateData.contractStartDate = new Date(data.contractStartDate);
    }
    if (data.contractEndDate) {
      updateData.contractEndDate = new Date(data.contractEndDate);
    }

    const updatedSupplier = await prisma.supplier.update({
      where: { id: supplierId },
      data: updateData
    });

    return updatedSupplier;
  },

  // ========== GET ASSESSMENTS ==========
  async getAssessments(supplierId: string): Promise<any[]> {
    const assessments = await prisma.assessment.findMany({
      where: {
        isActive: true,
        submissions: {
          some: {
            supplierId
          }
        }
      },
      include: {
        submissions: {
          where: { supplierId },
          orderBy: { createdAt: 'desc' },
          take: 1
        },
        categories: {
          include: {
            questions: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return assessments.map(assessment => {
      const latestSubmission = assessment.submissions[0];
      return {
        id: assessment.id,
        examId: assessment.examId,
        title: assessment.title,
        description: assessment.description,
        stage: assessment.stage,
        totalPoints: assessment.totalPoints,
        passingScore: assessment.passingScore?.toNumber(),
        timeLimit: assessment.timeLimit,
        categories: assessment.categories,
        submission: latestSubmission ? {
          id: latestSubmission.id,
          status: latestSubmission.status,
          progress: latestSubmission.progress,
          score: latestSubmission.score?.toNumber(),
          submittedAt: latestSubmission.submittedAt,
          startedAt: latestSubmission.startedAt
        } : null
      };
    });
  },

  // ========== START ASSESSMENT ==========
  async startAssessment(
    supplierId: string,
    assessmentId: string,
    userId: string
  ): Promise<AssessmentSubmission> {
    console.log("Starting assessment for supplier:", supplierId, "assessment:", assessmentId);

    // Check if assessment exists and is active
    const assessment = await prisma.assessment.findUnique({
      where: {
        id: assessmentId,
        isActive: true
      }
    });

    console.log("Found assessment:", assessment);

    if (!assessment) {
      throw new ApiError(httpStatus.NOT_FOUND, "Assessment not found");
    }

    // Get supplier
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
      include: { vendor: true }
    });

    console.log("Found supplier:", supplier);

    if (!supplier) {
      throw new ApiError(httpStatus.NOT_FOUND, "Supplier not found");
    }

    // Check for existing submission
    const existingSubmission = await prisma.assessmentSubmission.findFirst({
      where: {
        supplierId,
        assessmentId,
        status: { in: ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW'] }
      }
    });

    console.log("Existing submission:", existingSubmission);

    if (existingSubmission) {
      return existingSubmission;
    }

    // Get total questions count
    const totalQuestions = await prisma.assessmentQuestion.count({
      where: {
        category: {
          assessmentId
        }
      }
    });

    console.log("Total questions:", totalQuestions);

    // Create new submission
    const submission = await prisma.assessmentSubmission.create({
      data: {
        assessmentId,
        userId,
        supplierId,
        vendorId: supplier.vendorId,
        stage: assessment.stage,
        totalQuestions,
        answeredQuestions: 0,
        progress: 0,
        status: 'DRAFT',
        startedAt: new Date()
      },
      include: {
        assessment: {
          select: {
            id: true,
            title: true,
            description: true
          }
        }
      }
    });

    console.log("Created submission:", submission);

    return submission
  },

  // ========== SAVE ASSESSMENT ANSWER ==========
  async saveAnswer(
    submissionId: string,
    questionId: string,
    data: any,
    userId: string
  ): Promise<any> {
    const submission = await prisma.assessmentSubmission.findFirst({
      where: {
        id: submissionId,
        userId,
        status: { in: ['DRAFT', 'SUBMITTED'] }
      },
      include: {
        answers: true
      }
    });

    if (!submission) {
      throw new ApiError(httpStatus.NOT_FOUND, "Submission not found");
    }

    const question = await prisma.assessmentQuestion.findUnique({
      where: { id: questionId }
    });

    if (!question) {
      throw new ApiError(httpStatus.NOT_FOUND, "Question not found");
    }

    // Calculate score based on answer
    let score = 0;
    if (data.answer === 'YES') score = question.maxScore;
    else if (data.answer === 'PARTIAL') score = question.maxScore * 0.5;
    else if (data.answer === 'NO') score = 0;

    const answerData: any = {
      answer: data.answer,
      evidence: data.evidence,
      comments: data.comments,
      score,
      maxScore: question.maxScore
    };

    // Handle evidence upload
    if (data.evidence && question.evidenceRequired) {
      answerData.evidenceStatus = 'SUBMITTED';
    }

    // Check if answer already exists
    const existingAnswer = await prisma.assessmentAnswer.findFirst({
      where: {
        submissionId,
        questionId
      }
    });

    let answer;
    if (existingAnswer) {
      // Update existing answer
      answer = await prisma.assessmentAnswer.update({
        where: { id: existingAnswer.id },
        data: answerData
      });
    } else {
      // Create new answer
      answer = await prisma.assessmentAnswer.create({
        data: {
          ...answerData,
          submissionId,
          questionId
        }
      });

      // Update submission counts
      const answeredCount = submission.answers.length + 1;
      const progress = Math.round((answeredCount / submission.totalQuestions) * 100);

      await prisma.assessmentSubmission.update({
        where: { id: submissionId },
        data: {
          answeredQuestions: answeredCount,
          progress
        }
      });
    }

    return answer;
  },

  // ========== SUBMIT ASSESSMENT ==========
  async submitAssessment(
    submissionId: string,
    userId: string
  ): Promise<AssessmentSubmission> {
    const submission = await prisma.assessmentSubmission.findFirst({
      where: {
        id: submissionId,
        userId,
        status: 'DRAFT'
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
      throw new ApiError(httpStatus.NOT_FOUND, "Submission not found or already submitted");
    }

    // Check if all required questions are answered
    const requiredQuestions = await prisma.assessmentQuestion.count({
      where: {
        category: {
          assessmentId: submission.assessmentId
        }
      }
    });

    const answeredRequiredQuestions = submission.answers.filter(
      answer => answer.answer !== null
    ).length;

    if (answeredRequiredQuestions < requiredQuestions) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Please answer all required questions. ${answeredRequiredQuestions}/${requiredQuestions} answered.`
      );
    }

    // Calculate scores
    let totalScore = 0;
    let totalMaxScore = 0;
    let businessScore = 0;
    let integrityScore = 0;
    let availabilityScore = 0;
    let businessCount = 0;
    let integrityCount = 0;
    let availabilityCount = 0;

    for (const answer of submission.answers) {
      if (answer.score !== null) {
        totalScore += answer.score.toNumber();
        totalMaxScore += answer.maxScore;

        // Categorize by BIV
        if (answer.question.bivCategory === 'BUSINESS') {
          businessScore += answer.score.toNumber();
          businessCount++;
        } else if (answer.question.bivCategory === 'INTEGRITY') {
          integrityScore += answer.score.toNumber();
          integrityCount++;
        } else if (answer.question.bivCategory === 'AVAILABILITY') {
          availabilityScore += answer.score.toNumber();
          availabilityCount++;
        }
      }
    }

    const finalScore = totalMaxScore > 0 ? (totalScore / totalMaxScore) * 100 : 0;
    const avgBusinessScore = businessCount > 0 ? (businessScore / businessCount) : 0;
    const avgIntegrityScore = integrityCount > 0 ? (integrityScore / integrityCount) : 0;
    const avgAvailabilityScore = availabilityCount > 0 ? (availabilityScore / availabilityCount) : 0;

    const bivResult = calculateBIVScore({
      businessScore: avgBusinessScore,
      integrityScore: avgIntegrityScore,
      availabilityScore: avgAvailabilityScore
    });

    const result = await prisma.$transaction(async (tx) => {
      // Update submission
      const updatedSubmission = await tx.assessmentSubmission.update({
        where: { id: submissionId },
        data: {
          status: 'SUBMITTED',
          submittedAt: new Date(),
          score: finalScore,
          businessScore: avgBusinessScore,
          integrityScore: avgIntegrityScore,
          availabilityScore: avgAvailabilityScore,
          bivScore: bivResult.bivScore,
          riskLevel: bivResult.riskLevel as any,
          riskBreakdown: bivResult.breakdown
        }
      });

      // Update supplier
      await tx.supplier.update({
        where: { id: submission.supplierId },
        data: {
          bivScore: bivResult.bivScore,
          businessScore: avgBusinessScore,
          integrityScore: avgIntegrityScore,
          availabilityScore: avgAvailabilityScore,
          riskLevel: bivResult.riskLevel as any,
          lastAssessmentDate: new Date(),
          initialAssessmentCompleted: submission.stage === 'INITIAL',
          fullAssessmentCompleted: submission.stage === 'FULL',
          nis2Compliant: bivResult.bivScore >= 71
        }
      });

      // Create notification for vendor
      if (submission.vendorId) {
        const vendor = await tx.vendor.findUnique({
          where: { id: submission.vendorId },
          select: { userId: true }
        });

        if (vendor) {
          await tx.notification.create({
            data: {
              userId: vendor.userId,
              title: "New Assessment Submitted",
              message: `Supplier ${submission.supplierId} has submitted assessment "${submission.assessment.title}"`,
              type: 'ASSESSMENT_SUBMITTED',
              metadata: {
                submissionId,
                assessmentId: submission.assessmentId,
                supplierId: submission.supplierId,
                score: finalScore
              }
            }
          });
        }
      }

      return updatedSubmission;
    });

    return result;
  }

};