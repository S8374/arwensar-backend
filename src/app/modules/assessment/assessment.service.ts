// src/modules/assessment/assessment.service.ts
import { Assessment, AssessmentSubmission, AssessmentAnswer, EvidenceStatus } from "@prisma/client";
import { prisma } from "../../shared/prisma";
import httpStatus from "http-status";
import { NotificationService } from "../notification/notification.service";
import ApiError from "../../../error/ApiError";
import { calculateBIVScore } from "../../../logic/bivRiskCalculator";
import { mailtrapService } from "../../shared/mailtrap.service";

export interface AssessmentProgress {
  totalQuestions: number;
  answeredQuestions: number;
  progress: number;
  requiredEvidenceCount: number;
  submittedEvidenceCount: number;
  pendingReviewCount: number;
}

export const AssessmentService = {
  // ========== GET ASSESSMENTS ==========
  async getAssessments(userId: string, options: any = {}): Promise<{ assessments: any[]; meta: any }> {
    const {
      page = 1,
      limit = 20,
      stage,
      isActive,
      isTemplate,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = options;

    const skip = (page - 1) * limit;

    const where: any = { isActive: true };

    if (stage) {
      where.stage = stage;
    }

    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    if (isTemplate !== undefined) {
      where.isTemplate = isTemplate === 'true';
    }

    const [assessments, total] = await Promise.all([
      prisma.assessment.findMany({
        where,
        include: {
          categories: {
            include: {
              questions: {
                orderBy: { order: 'asc' }
              }
            },
            orderBy: { order: 'asc' }
          },
          createdByUser: {
            select: {
              id: true,
              email: true,
              role: true
            }
          },
          _count: {
            select: {
              submissions: true
            }
          }
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit
      }),
      prisma.assessment.count({ where })
    ]);

    return {
      assessments: assessments.map(assessment => ({
        ...assessment,
        totalQuestions: assessment.categories.reduce(
          (sum, category) => sum + category.questions.length, 0
        )
      })),
      meta: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  },

  // ========== GET ASSESSMENT BY ID ==========
  async getAssessmentById(assessmentId: string, userId?: string): Promise<any> {
    const assessment = await prisma.assessment.findUnique({
      where: {
        id: assessmentId,
        isActive: true

      },
      include: {
        categories: {
          include: {
            questions: {
              orderBy: { order: 'asc' }
            }
          },
          orderBy: { order: 'asc' }
        },
        createdByUser: {
          select: {
            id: true,
            email: true,
            role: true
          }
        }
      }
    });

    if (!assessment) {
      throw new ApiError(httpStatus.NOT_FOUND, "Assessment not found");
    }

    // Get user's submission if userId provided
    let userSubmission = null;
    if (userId) {
      userSubmission = await prisma.assessmentSubmission.findFirst({
        where: {
          assessmentId,
          userId
        },
        include: {
          answers: {
            include: {
              question: {
                select: {
                  id: true,
                  question: true,
                  bivCategory: true
                }
              }
            }
          }
        }
      });
    }

    return {
      ...assessment,
      userSubmission,
      totalQuestions: assessment.categories.reduce(
        (sum, category) => sum + category.questions.length, 0
      ),
      totalPoints: assessment.totalPoints
    };
  },

  // ========== GET SUBMISSIONS ==========
  async getSubmissions(userId: string, options: any = {}): Promise<{ submissions: any[]; meta: any }> {
    const {
      page = 1,
      limit = 20,
      status,
      stage,
      assessmentId,
      supplierId,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = options;

    const skip = (page - 1) * limit;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, vendorId: true, supplierId: true }
    });

    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, "User not found");
    }

    const where: any = {};

    if (user.role === 'VENDOR' && user.vendorId) {
      where.vendorId = user.vendorId;
    } else if (user.role === 'SUPPLIER' && user.supplierId) {
      where.supplierId = user.supplierId;
      where.userId = userId;
    }

    if (status) {
      where.status = status;
    }

    if (stage) {
      where.stage = stage;
    }

    if (assessmentId) {
      where.assessmentId = assessmentId;
    }

    if (supplierId) {
      where.supplierId = supplierId;
    }

    const [submissions, total] = await Promise.all([
      prisma.assessmentSubmission.findMany({
        where,
        include: {
          assessment: {
            select: {
              id: true,
              title: true,
              description: true,
              stage: true
            }
          },
          user: {
            select: {
              id: true,
              email: true,
              role: true
            }
          },
          supplier: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          answers: {
            include: {
              question: {
                select: {
                  id: true,
                  question: true,
                  bivCategory: true
                }
              }
            }
          }
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit
      }),
      prisma.assessmentSubmission.count({ where })
    ]);

    return {
      submissions,
      meta: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  },

  // ========== GET SUBMISSION BY ID ==========
  async getSubmissionById(submissionId: string, userId: string): Promise<any> {
    const submission = await prisma.assessmentSubmission.findUnique({
      where: { id: submissionId },
      include: {
        assessment: {
          include: {
            categories: {
              include: {
                questions: {
                  orderBy: { order: 'asc' }
                }
              },
              orderBy: { order: 'asc' }
            }
          }
        },
        user: {
          select: {
            id: true,
            email: true,
            role: true
          }
        },
        supplier: {
          select: {
            id: true,
            name: true,
            email: true,
            vendor: {
              select: {
                id: true,
                companyName: true
              }
            }
          }
        },
        answers: {
          include: {
            question: {
              select: {
                id: true,
                question: true,
                description: true,
                bivCategory: true,
                evidenceRequired: true,
                maxScore: true
              }
            }
          }
        }
      }
    });

    if (!submission) {
      throw new ApiError(httpStatus.NOT_FOUND, "Submission not found");
    }

    // Check permissions
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, vendorId: true, supplierId: true }
    });

    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, "User not found");
    }

    const canView =
      submission.userId === userId ||
      (user.role === 'VENDOR' && submission.vendorId === user.vendorId) ||
      (user.role === 'ADMIN');

    if (!canView) {
      throw new ApiError(httpStatus.FORBIDDEN, "You don't have permission to view this submission");
    }

    // Calculate progress and statistics
    const totalQuestions = submission.assessment.categories.reduce(
      (sum, category) => sum + category.questions.length, 0
    );

    const answeredQuestions = submission.answers.length;
    const progress = totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0;

    // Calculate evidence statistics
    const evidenceQuestions = submission.answers.filter(
      answer => answer.question.evidenceRequired
    );
    const submittedEvidence = evidenceQuestions.filter(
      answer => answer.evidence && answer.evidence.trim() !== ''
    );
    const approvedEvidence = evidenceQuestions.filter(
      answer => answer.evidenceStatus === 'APPROVED'
    );
    const pendingEvidence = evidenceQuestions.filter(
      answer => answer.evidenceStatus === 'PENDING' || answer.evidenceStatus === 'SUBMITTED'
    );

    // Calculate BIV scores
    const bivScores = this.calculateBIVScores(submission.answers);

    return {
      ...submission,
      statistics: {
        totalQuestions,
        answeredQuestions,
        progress,
        evidenceRequired: evidenceQuestions.length,
        evidenceSubmitted: submittedEvidence.length,
        evidenceApproved: approvedEvidence.length,
        evidencePending: pendingEvidence.length
      },
      bivScores
    };
  },

  // ========== CALCULATE BIV SCORES ==========
  calculateBIVScores(answers: any[]): any {
    const businessAnswers = answers.filter(a => a.question.bivCategory === 'BUSINESS');
    const integrityAnswers = answers.filter(a => a.question.bivCategory === 'INTEGRITY');
    const availabilityAnswers = answers.filter(a => a.question.bivCategory === 'AVAILABILITY');

    const calculateCategoryScore = (categoryAnswers: any[]) => {
      if (categoryAnswers.length === 0) return 0;

      const totalScore = categoryAnswers.reduce(
        (sum, answer) => sum + (answer.score?.toNumber() || 0), 0
      );
      const totalMaxScore = categoryAnswers.reduce(
        (sum, answer) => sum + (answer.question.maxScore || 10), 0
      );

      return totalMaxScore > 0 ? (totalScore / totalMaxScore) * 100 : 0;
    };

    const businessScore = calculateCategoryScore(businessAnswers);
    const integrityScore = calculateCategoryScore(integrityAnswers);
    const availabilityScore = calculateCategoryScore(availabilityAnswers);

    const bivResult = calculateBIVScore({
      businessScore,
      integrityScore,
      availabilityScore
    });

    return {
      businessScore: parseFloat(businessScore.toFixed(2)),
      integrityScore: parseFloat(integrityScore.toFixed(2)),
      availabilityScore: parseFloat(availabilityScore.toFixed(2)),
      bivScore: bivResult.bivScore,
      riskLevel: bivResult.riskLevel,
      breakdown: bivResult.breakdown
    };
  },

  // ========== START ASSESSMENT ==========
  async startAssessment(userId: string, assessmentId: string): Promise<AssessmentSubmission> {
    // Check if assessment exists and is active
    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId, isActive: true }
    });
    console.log("Assessment found:", assessment);
    if (!assessment) {
      throw new ApiError(httpStatus.NOT_FOUND, "Assessment not found or inactive");
    }

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, supplierId: true, vendorId: true }
    });

    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, "User not found");
    }

    if (user.role !== 'SUPPLIER') {
      throw new ApiError(httpStatus.FORBIDDEN, "Only suppliers can start assessments");
    }

    if (!user.supplierId) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Supplier profile not found");
    }

    const supplier = await prisma.supplier.findUnique({
      where: { id: user.supplierId },
      select: { vendorId: true }
    });

    if (!supplier) {
      throw new ApiError(httpStatus.NOT_FOUND, "Supplier not found");
    }

    // Check for existing submission
    const existingSubmission = await prisma.assessmentSubmission.findFirst({
      where: {
        assessmentId,
        userId,
        status: { in: ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW'] }
      }
    });

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

    // Create new submission
    const submission = await prisma.assessmentSubmission.create({
      data: {
        assessmentId,
        userId,
        supplierId: user.supplierId,
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

    // Create notification for vendor
    if (supplier.vendorId) {
      const vendor = await prisma.vendor.findUnique({
        where: { id: supplier.vendorId },
        select: { userId: true }
      });

      if (vendor) {
        await NotificationService.createNotification({
          userId: vendor.userId,
          title: "Assessment Started",
          message: `Supplier has started assessment: "${assessment.title}"`,
          type: 'ASSESSMENT_SUBMITTED',
          metadata: {
            submissionId: submission.id,
            assessmentId: assessment.id,
            supplierId: user.supplierId
          }
        });
      }
    }

    return submission;
  },

  // ========== SAVE ANSWER ==========
  // ========== SAVE ANSWER ==========
  async saveAnswer(
    submissionId: string,
    questionId: string,
    userId: string,
    data: any
  ): Promise<AssessmentAnswer> {
    // Allow saving answers in DRAFT, REJECTED, or REQUIRES_ACTION states
    const editableStatuses: ("DRAFT" | "REJECTED" | "REQUIRES_ACTION")[] = [
      "DRAFT",
      "REJECTED",
      "REQUIRES_ACTION",
    ];

    const submission = await prisma.assessmentSubmission.findFirst({
      where: {
        id: submissionId,
        userId,
        status: { in: editableStatuses },
      },
      include: {
        answers: true,
      },
    });

    if (!submission) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Submission not found or not editable. It may have been approved or is under review."
      );
    }

    const question = await prisma.assessmentQuestion.findUnique({
      where: { id: questionId },
    });

    if (!question) {
      throw new ApiError(httpStatus.NOT_FOUND, "Question not found");
    }

    // Calculate score
    let score = 0;
    switch (data.answer) {
      case "YES":
        score = question.maxScore;
        break;
      case "PARTIAL":
        score = question.maxScore * 0.5;
        break;
      case "NO":
        score = 0;
        break;
      case "NOT_APPLICABLE":
      case "NA":
        score = question.maxScore;
        break;
    }

    const answerData: any = {
      answer: data.answer,
      score,
      maxScore: question.maxScore,
      comments: data.comments || null,
    };

    // Handle evidence
    if (data.evidence) {
      answerData.evidence = data.evidence;
      if (question.evidenceRequired) {
        answerData.evidenceStatus = "SUBMITTED";
      }
    }

    const existingAnswer = await prisma.assessmentAnswer.findFirst({
      where: { submissionId, questionId },
    });

    let answer;
    if (existingAnswer) {
      answer = await prisma.assessmentAnswer.update({
        where: { id: existingAnswer.id },
        data: answerData,
      });
    } else {
      answer = await prisma.assessmentAnswer.create({
        data: {
          ...answerData,
          submissionId,
          questionId,
        },
      });

      // Update submission progress
      const newAnsweredCount = submission.answeredQuestions + 1; // It's a number!
      const progress = Math.round((newAnsweredCount / submission.totalQuestions) * 100);

      await prisma.assessmentSubmission.update({
        where: { id: submissionId },
        data: {
          answeredQuestions: newAnsweredCount,
          progress,
        },
      });
    }

    return answer;
  },

  // ========== SUBMIT ASSESSMENT ==========
 // ========== SUBMIT ASSESSMENT ==========
async submitAssessment(submissionId: string, userId: string, data?: any): Promise<AssessmentSubmission> {
  // Allow submission from these statuses
  const submittableStatuses: ("DRAFT" | "REJECTED" | "REQUIRES_ACTION")[] = [
    "DRAFT",
    "REJECTED",
    "REQUIRES_ACTION",
  ];

  const submission = await prisma.assessmentSubmission.findFirst({
    where: {
      id: submissionId,
      userId,
      status: { in: submittableStatuses },
    },
    include: {
      assessment: true,
      answers: {
        include: {
          question: true,
        },
      },
    },
  });

  if (!submission) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Submission not found or not submittable. It may be under review or already approved."
    );
  }

  // Validate all questions are answered
  if (submission.answeredQuestions < submission.totalQuestions) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Please answer all ${submission.totalQuestions} questions. Currently answered: ${submission.answeredQuestions}.`
    );
  }

  // Recalculate BIV scores
  const bivScores = this.calculateBIVScores(submission.answers);

  // Calculate overall percentage score
  let totalScore = 0;
  let totalMaxScore = 0;
  submission.answers.forEach((ans) => {
    if (ans.score !== null && ans.score !== undefined) {
      totalScore += ans.score.toNumber();
      totalMaxScore += ans.maxScore;
    }
  });
  const finalScore = totalMaxScore > 0 ? (totalScore / totalMaxScore) * 100 : 0;

  // Determine risk score
  const riskScore = bivScores.riskLevel === "HIGH" ? 3 : bivScores.riskLevel === "MEDIUM" ? 2 : 1;

  const result = await prisma.$transaction(async (tx) => {
    const updatedSubmission = await tx.assessmentSubmission.update({
      where: { id: submissionId },
      data: {
        status: "PENDING",
        submittedAt: new Date(),
        score: finalScore,
        businessScore: bivScores.businessScore,
        integrityScore: bivScores.integrityScore,
        availabilityScore: bivScores.availabilityScore,
        bivScore: bivScores.bivScore,
        riskLevel: bivScores.riskLevel,
        riskBreakdown: bivScores.breakdown,
        riskScore,
        // Clear previous review data when re-submitting
        reviewedAt: null,
        reviewedBy: null,
        reviewComments: null,
        reviewerReport: null,
      },
    });

    // Update supplier with latest scores
    await tx.supplier.update({
      where: { id: submission.supplierId },
      data: {
        bivScore: bivScores.bivScore,
        businessScore: bivScores.businessScore,
        integrityScore: bivScores.integrityScore,
        availabilityScore: bivScores.availabilityScore,
        riskLevel: bivScores.riskLevel,
        lastAssessmentDate: new Date(),
        // Only mark as completed if approved later — not on submit
      },
    });

    // Notify vendor
    if (submission.vendorId) {
      const vendor = await tx.vendor.findUnique({
        where: { id: submission.vendorId },
        select: { userId: true, companyName: true },
      });

      if (vendor?.userId) {
        await NotificationService.createNotification({
          userId: vendor.userId,
          title: "Assessment Re-Submitted",
          message: `Supplier has re-submitted assessment: "${submission.assessment.title}"`,
          type: "ASSESSMENT_SUBMITTED",
          metadata: {
            submissionId: submission.id,
            assessmentId: submission.assessmentId,
            supplierId: submission.supplierId,
            score: finalScore,
            riskLevel: bivScores.riskLevel,
            isResubmission: true,
          },
        });

        // Optional: Send email
        try {
          const vendorUser = await tx.user.findUnique({
            where: { id: vendor.userId },
            select: { email: true },
          });

          if (vendorUser?.email) {
            await mailtrapService.sendHtmlEmail({
              to: vendorUser.email,
              subject: `Assessment Re-Submitted: ${submission.assessment.title}`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2>Assessment Re-Submitted</h2>
                  <p>A supplier has updated and re-submitted their assessment.</p>
                  <div style="background:#f8f9fa;padding:20px;border-radius:8px;">
                    <p><strong>Assessment:</strong> ${submission.assessment.title}</p>
                    <p><strong>Score:</strong> ${finalScore.toFixed(1)}%</p>
                    <p><strong>Risk Level:</strong> ${bivScores.riskLevel}</p>
                  </div>
                  <p>Please review the updated responses.</p>
                  <a href="${process.env.FRONTEND_URL}/vendor/assessments/submissions/${submissionId}"
                     style="background:#007bff;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;margin:20px 0;">
                    Review Submission
                  </a>
                </div>
              `,
            });
          }
        } catch (error) {
          console.error("Failed to send re-submission email:", error);
        }
      }
    }

    return updatedSubmission;
  });

  return result;
},

  // ========== REVIEW ASSESSMENT ==========
  async reviewAssessment(
    submissionId: string,
    reviewerId: string,
    data: any
  ): Promise<AssessmentSubmission> {
    const submission = await prisma.assessmentSubmission.findFirst({
      where: {
        assessmentId: submissionId,
        status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'REQUIRES_ACTION', 'PENDING'] }
      },
      include: {
        assessment: true,
        answers: true,
        user: {
          select: {
            id: true,
            email: true
          }
        }
      }
    });
    console.log("submission", submission)
    if (!submission) {
      throw new ApiError(httpStatus.NOT_FOUND, "Submission not found or not available for review");
    }

    // Check if user is authorized to review
    const reviewer = await prisma.user.findUnique({
      where: { id: reviewerId },
      select: { role: true, vendorId: true }
    });

    if (!reviewer) {
      throw new ApiError(httpStatus.NOT_FOUND, "Reviewer not found");
    }

    if (reviewer.role !== 'VENDOR' && reviewer.role !== 'ADMIN') {
      throw new ApiError(httpStatus.FORBIDDEN, "Only vendors and admins can review assessments");
    }

    if (reviewer.role === 'VENDOR' && submission.vendorId !== reviewer.vendorId) {
      throw new ApiError(httpStatus.FORBIDDEN, "You can only review assessments from your suppliers");
    }

    const result = await prisma.$transaction(async (tx) => {
      // Update submission
      const updatedSubmission = await tx.assessmentSubmission.updateMany({
        where: { assessmentId: submissionId },
        data: {
          status: data.status,
          reviewedAt: new Date(),
          reviewedBy: reviewerId,
          reviewComments: data.reviewComments,
          reviewerReport: data.reviewerReport,
          complianceRate: data.complianceRate
        }
      });

      // If approved, update supplier with final scores
      if (data.status === 'APPROVED') {
        await tx.supplier.update({
          where: { id: submission.supplierId },
          data: {
            lastAssessmentDate: new Date(),
            nis2Compliant: submission.bivScore && submission.bivScore.toNumber() >= 71
          }
        });
      }

      // Create notification for supplier
      if (submission.userId) {
        await NotificationService.createNotification({
          userId: submission.userId,
          title: `Assessment ${data.status.toLowerCase()}`,
          message: `Your assessment "${submission.assessment.title}" has been ${data.status.toLowerCase()}`,
          type: data.status === 'APPROVED' ? 'ASSESSMENT_APPROVED' : 'ASSESSMENT_REJECTED',
          metadata: {
            submissionId: submission.id,
            assessmentId: submission.assessmentId,
            status: data.status,
            comments: data.reviewComments,
            reviewedBy: reviewer.role
          }
        });

        // Send email to supplier
        try {
          await mailtrapService.sendHtmlEmail({
            to: submission.user.email,
            subject: `Assessment ${data.status}: ${submission.assessment.title}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #333;">Assessment ${data.status}</h2>
                <p>Your assessment "${submission.assessment.title}" has been ${data.status.toLowerCase()}.</p>
                
                ${data.reviewComments ? `
                  <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
                    <h3 style="margin-top: 0;">Review Comments:</h3>
                    <p>${data.reviewComments}</p>
                  </div>
                ` : ''}
                
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${process.env.FRONTEND_URL}/assessments/submissions/${submissionId}" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                    View Assessment
                  </a>
                </div>
                
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="color: #666; font-size: 12px;">© ${new Date().getFullYear()} CyberNark. All rights reserved.</p>
              </div>
            `
          });
        } catch (error) {
          console.error("Failed to send assessment review email:", error);
        }
      }

      return updatedSubmission;
    });

    return result;
  },

  // ========== REVIEW EVIDENCE ==========
  async reviewEvidence(
    answerId: string,
    reviewerId: string,
    data: any
  ): Promise<AssessmentAnswer> {
    const answer = await prisma.assessmentAnswer.findFirst({
      where: { id: answerId },
      include: {
        question: true,
        submission: {
          include: {
            assessment: true,
            user: {
              select: {
                id: true,
                email: true
              }
            }
          }
        }
      }
    });

    if (!answer) {
      throw new ApiError(httpStatus.NOT_FOUND, "Answer not found");
    }

    if (!answer.question.evidenceRequired) {
      throw new ApiError(httpStatus.BAD_REQUEST, "This question does not require evidence");
    }

    // Check if user is authorized to review
    const reviewer = await prisma.user.findUnique({
      where: { id: reviewerId },
      select: { role: true, vendorId: true }
    });

    if (!reviewer) {
      throw new ApiError(httpStatus.NOT_FOUND, "Reviewer not found");
    }

    if (reviewer.role !== 'VENDOR' && reviewer.role !== 'ADMIN') {
      throw new ApiError(httpStatus.FORBIDDEN, "Only vendors and admins can review evidence");
    }

    if (reviewer.role === 'VENDOR' && answer.submission.vendorId !== reviewer.vendorId) {
      throw new ApiError(httpStatus.FORBIDDEN, "You can only review evidence from your suppliers");
    }

    const updatedAnswer = await prisma.assessmentAnswer.update({
      where: { id: answerId },
      data: {
        evidenceStatus: data.status,
        score: data.score,
        evidenceRejectionReason: data.rejectionReason
      }
    });

    // Create notification for supplier
    if (data.status === 'REJECTED' && answer.submission.userId) {
      await NotificationService.createNotification({
        userId: answer.submission.userId,
        title: "Evidence Rejected",
        message: `Evidence for question in assessment "${answer.submission.assessment.title}" has been rejected`,
        type: 'EVIDENCE_REJECTED',
        metadata: {
          answerId: answer.id,
          question: answer.question.question,
          rejectionReason: data.rejectionReason,
          assessmentId: answer.submission.assessmentId
        }
      });

      // Send email to supplier
      try {
        await mailtrapService.sendHtmlEmail({
          to: answer.submission.user.email,
          subject: "Evidence Rejected",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">Evidence Rejected</h2>
              <p>Your evidence for a question in assessment "${answer.submission.assessment.title}" has been rejected.</p>
              
              <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
                <h3 style="margin-top: 0;">Details:</h3>
                <p><strong>Question:</strong> ${answer.question.question}</p>
                <p><strong>Rejection Reason:</strong> ${data.rejectionReason}</p>
              </div>
              
              <p>Please update your evidence and resubmit.</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.FRONTEND_URL}/assessments/submissions/${answer.submission.id}" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                  Update Evidence
                </a>
              </div>
              
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
              <p style="color: #666; font-size: 12px;">© ${new Date().getFullYear()} CyberNark. All rights reserved.</p>
            </div>
          `
        });
      } catch (error) {
        console.error("Failed to send evidence rejection email:", error);
      }
    }

    return updatedAnswer;
  },

  // ========== GET ASSESSMENT STATISTICS ==========
  async getAssessmentStatistics(userId: string): Promise<any> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, vendorId: true, supplierId: true }
    });

    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, "User not found");
    }

    const where: any = {};

    if (user.role === 'VENDOR' && user.vendorId) {
      where.vendorId = user.vendorId;
    } else if (user.role === 'SUPPLIER' && user.supplierId) {
      where.supplierId = user.supplierId;
      where.userId = userId;
    }

    const [
      totalSubmissions,
      byStatus,
      byStage,
      averageScore,
      pendingReviews,
      recentSubmissions
    ] = await Promise.all([
      prisma.assessmentSubmission.count({ where }),
      prisma.assessmentSubmission.groupBy({
        by: ['status'],
        where,
        _count: true
      }),
      prisma.assessmentSubmission.groupBy({
        by: ['stage'],
        where,
        _count: true
      }),
      prisma.assessmentSubmission.aggregate({
        where: { ...where, score: { not: null } },
        _avg: { score: true }
      }),
      prisma.assessmentSubmission.count({
        where: {
          ...where,
          status: { in: ['SUBMITTED', 'UNDER_REVIEW'] }
        }
      }),
      prisma.assessmentSubmission.findMany({
        where,
        include: {
          assessment: {
            select: { title: true }
          },
          user: {
            select: { email: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 5
      })
    ]);

    const statusStats: Record<string, number> = {};
    byStatus.forEach(item => {
      statusStats[item.status] = item._count;
    });

    const stageStats: Record<string, number> = {};
    byStage.forEach(item => {
      stageStats[item.stage] = item._count;
    });

    return {
      totalSubmissions,
      byStatus: statusStats,
      byStage: stageStats,
      averageScore: averageScore._avg.score?.toNumber() || 0,
      pendingReviews,
      recentSubmissions: recentSubmissions.map(sub => ({
        id: sub.id,
        assessment: sub.assessment.title,
        user: sub.user.email,
        status: sub.status,
        score: sub.score?.toNumber(),
        submittedAt: sub.submittedAt
      }))
    };
  },

  // ========== REQUEST EVIDENCE ==========
  async requestEvidence(
    answerId: string,
    reviewerId: string,
    reason: string
  ): Promise<AssessmentAnswer> {
    const answer = await prisma.assessmentAnswer.findFirst({
      where: { id: answerId },
      include: {
        question: true,
        submission: {
          include: {
            assessment: true,
            user: {
              select: {
                id: true,
                email: true
              }
            }
          }
        }
      }
    });

    if (!answer) {
      throw new ApiError(httpStatus.NOT_FOUND, "Answer not found");
    }

    if (!answer.question.evidenceRequired) {
      throw new ApiError(httpStatus.BAD_REQUEST, "This question does not require evidence");
    }

    // Check if user is authorized
    const reviewer = await prisma.user.findUnique({
      where: { id: reviewerId },
      select: { role: true, vendorId: true }
    });

    if (!reviewer) {
      throw new ApiError(httpStatus.NOT_FOUND, "Reviewer not found");
    }

    if (reviewer.role !== 'VENDOR' && reviewer.role !== 'ADMIN') {
      throw new ApiError(httpStatus.FORBIDDEN, "Only vendors and admins can request evidence");
    }

    if (reviewer.role === 'VENDOR' && answer.submission.vendorId !== reviewer.vendorId) {
      throw new ApiError(httpStatus.FORBIDDEN, "You can only request evidence from your suppliers");
    }

    const updatedAnswer = await prisma.assessmentAnswer.update({
      where: { id: answerId },
      data: {
        evidenceStatus: 'REQUESTED',
        evidenceRejectionReason: reason
      }
    });

    // Create notification for supplier
    if (answer.submission.userId) {
      await NotificationService.createNotification({
        userId: answer.submission.userId,
        title: "Evidence Requested",
        message: `Additional evidence requested for question in assessment "${answer.submission.assessment.title}"`,
        type: 'EVIDENCE_REQUESTED',
        metadata: {
          answerId: answer.id,
          question: answer.question.question,
          reason: reason,
          assessmentId: answer.submission.assessmentId
        }
      });

      // Send email to supplier
      try {
        await mailtrapService.sendHtmlEmail({
          to: answer.submission.user.email,
          subject: "Additional Evidence Requested",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">Additional Evidence Requested</h2>
              <p>Additional evidence has been requested for a question in assessment "${answer.submission.assessment.title}".</p>
              
              <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
                <h3 style="margin-top: 0;">Details:</h3>
                <p><strong>Question:</strong> ${answer.question.question}</p>
                <p><strong>Reason:</strong> ${reason}</p>
              </div>
              
              <p>Please provide the requested evidence to complete your assessment.</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.FRONTEND_URL}/assessments/submissions/${answer.submission.id}" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                  Provide Evidence
                </a>
              </div>
              
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
              <p style="color: #666; font-size: 12px;">© ${new Date().getFullYear()} CyberNark. All rights reserved.</p>
            </div>
          `
        });
      } catch (error) {
        console.error("Failed to send evidence request email:", error);
      }
    }

    return updatedAnswer;
  },
  // Also, make sure you have the correct method in your service:
  async getDraftSubmissionById(submissionId: string, userId: string): Promise<any> {
    // First get the submission
    const submission = await prisma.assessmentSubmission.findUnique({
      where: { id: submissionId },
      include: {
        assessment: {
          include: {
            categories: {
              include: {
                questions: {
                  orderBy: { order: 'asc' }
                }
              },
              orderBy: { order: 'asc' }
            }
          }
        },
        user: {
          select: {
            id: true,
            email: true,
            role: true
          }
        },
        supplier: {
          select: {
            id: true,
            name: true,
            email: true,
            vendor: {
              select: {
                id: true,
                companyName: true
              }
            }
          }
        },
        answers: {
          include: {
            question: {
              select: {
                id: true,
                question: true,
                description: true,
                bivCategory: true,
                evidenceRequired: true,
                maxScore: true
              }
            }
          }
        }
      }
    });

    if (!submission) {
      throw new ApiError(httpStatus.NOT_FOUND, "Submission not found");
    }

    // Check if it's a draft
    if (submission.status !== 'DRAFT') {
      throw new ApiError(httpStatus.BAD_REQUEST, "This is not a draft submission");
    }

    // Get user to check permissions
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, "User not found");
    }

    // Check permissions
    const canView =
      submission.userId === userId ||
      (user.role === 'VENDOR' && submission.vendorId === user.vendorId) ||
      (user.role === 'ADMIN');

    if (!canView) {
      throw new ApiError(httpStatus.FORBIDDEN, "You don't have permission to view this draft");
    }

    // Calculate progress
    const totalQuestions = submission.assessment.categories.reduce(
      (sum: number, category: any) => sum + category.questions.length, 0
    );
    const progress = totalQuestions > 0
      ? Math.round((submission.answeredQuestions / totalQuestions) * 100)
      : 0;

    // Group answers by category for easier display
    const answersByCategory: Record<string, any[]> = {};
    submission.answers.forEach((answer: any) => {
      const categoryId = answer.question.categoryId;
      if (!answersByCategory[categoryId]) {
        answersByCategory[categoryId] = [];
      }
      answersByCategory[categoryId].push(answer);
    });

    return {
      ...submission,
      progress,
      totalQuestions,
      answeredQuestions: submission.answeredQuestions,
      answersByCategory,
      canContinue: submission.status === 'DRAFT' && progress < 100,
      timeInDraft: {
        days: Math.floor(
          (new Date().getTime() - submission.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
        ),
        hours: Math.floor(
          (new Date().getTime() - submission.updatedAt.getTime()) / (1000 * 60 * 60)
        ),
        lastUpdated: submission.updatedAt
      }
    };
  }
  ,
  // src/modules/assessment/assessment.service.ts (add this method)
  async removeEvidence(
    answerId: string,
    userId: string
  ): Promise<AssessmentAnswer> {
    const answer = await prisma.assessmentAnswer.findFirst({
      where: { id: answerId },
      include: {
        submission: {
          include: {
            user: {
              select: { id: true }
            }
          }
        }
      }
    });

    if (!answer) {
      throw new ApiError(httpStatus.NOT_FOUND, "Answer not found");
    }

    // Check permissions
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, vendorId: true, supplierId: true }
    });

    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, "User not found");
    }

    const canRemove =
      answer.submission.user.id === userId ||
      (user.role === 'VENDOR' && answer.submission.vendorId === user.vendorId) ||
      user.role === 'ADMIN';

    if (!canRemove) {
      throw new ApiError(httpStatus.FORBIDDEN, "You don't have permission to remove this evidence");
    }

    // Simply update the database without Cloudinary deletion
    const updatedAnswer = await prisma.assessmentAnswer.update({
      where: { id: answerId },
      data: {
        evidence: null,
        evidenceStatus: 'PENDING'
      }
    });


    return updatedAnswer;
  },
  // ========== GET SUBMISSIONS BY USER ID ==========
  async getSubmissionsByUserId(
    userId: string,
    options: any = {}
  ): Promise<{ submissions: any[]; meta: any }> {
    const {
      page = 1,
      limit = 20,
      status,
      stage,
      assessmentId,
      supplierId,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = options;

    const skip = (page - 1) * limit;

    const where: any = {
      userId: userId // Filter by the provided userId
    };

    // Apply additional filters if provided
    if (status) {
      where.status = status;
    }
    if (stage) {
      where.stage = stage;
    }
    if (assessmentId) {
      where.assessmentId = assessmentId;
    }
    if (supplierId) {
      where.supplierId = supplierId;
    }

    const [submissions, total] = await Promise.all([
      prisma.assessmentSubmission.findMany({
        where,
        include: {
          assessment: {
            select: {
              id: true,
              title: true,
              description: true,
              stage: true
            }
          },
          user: {
            select: {
              id: true,
              email: true,
              role: true
            }
          },
          supplier: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          answers: {
            include: {
              question: {
                select: {
                  id: true,
                  question: true,
                  bivCategory: true
                }
              }
            }
          }
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit
      }),
      prisma.assessmentSubmission.count({ where })
    ]);

    return {
      submissions,
      meta: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }


};