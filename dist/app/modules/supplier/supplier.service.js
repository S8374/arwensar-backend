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
exports.SupplierService = void 0;
// src/modules/supplier/supplier.service.ts
const client_1 = require("@prisma/client");
const prisma_1 = require("../../shared/prisma");
const http_status_1 = __importDefault(require("http-status"));
const jwtHelper_1 = require("../../helper/jwtHelper");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const mailtrap_service_1 = require("../../shared/mailtrap.service");
const ApiError_1 = __importDefault(require("../../../error/ApiError"));
const config_1 = require("../../../config");
const bivRiskCalculator_1 = require("../../../logic/bivRiskCalculator");
exports.SupplierService = {
    // ========== DASHBOARD ==========
    getDashboardStats(supplierId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const supplier = yield prisma_1.prisma.supplier.findUnique({
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
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "Supplier not found");
            }
            const totalAssessments = supplier.assessmentSubmissions.length;
            const pendingAssessments = supplier.assessmentSubmissions.filter(sub => sub.status === 'DRAFT' || sub.status === 'SUBMITTED' || sub.status === 'PENDING').length;
            const completedAssessments = supplier.assessmentSubmissions.filter(sub => sub.status === 'APPROVED').length;
            const averageScore = completedAssessments > 0 ?
                supplier.assessmentSubmissions
                    .filter(sub => sub.status === 'APPROVED')
                    .reduce((sum, sub) => { var _a; return sum + (((_a = sub.score) === null || _a === void 0 ? void 0 : _a.toNumber()) || 0); }, 0) /
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
                bivScore: ((_a = supplier.bivScore) === null || _a === void 0 ? void 0 : _a.toNumber()) || null,
                nextAssessmentDue: supplier.nextAssessmentDue,
                recentSubmissions: supplier.assessmentSubmissions.slice(0, 5).map(sub => {
                    var _a;
                    return ({
                        id: sub.id,
                        assessmentTitle: sub.assessment.title,
                        status: sub.status,
                        submittedAt: sub.submittedAt || sub.createdAt,
                        score: ((_a = sub.score) === null || _a === void 0 ? void 0 : _a.toNumber()) || null
                    });
                }),
                nis2Status: {
                    isCompliant: supplier.nis2Compliant,
                    progress: Math.round((completedAssessmentsCount / requiredAssessments) * 100),
                    requiredAssessments,
                    completedAssessments: completedAssessmentsCount
                }
            };
        });
    },
    // ========== CREATE SUPPLIER (VENDOR) ==========
    createSupplier(vendorId, payload) {
        return __awaiter(this, void 0, void 0, function* () {
            // Check if vendor exists
            const vendor = yield prisma_1.prisma.vendor.findUnique({
                where: { id: vendorId },
                include: {
                    user: { select: { email: true } }
                }
            });
            if (!vendor) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "Vendor not found");
            }
            // Check if supplier email already exists
            const existingSupplier = yield prisma_1.prisma.supplier.findUnique({
                where: { email: payload.email }
            });
            if (existingSupplier) {
                throw new ApiError_1.default(http_status_1.default.CONFLICT, "Supplier with this email already exists");
            }
            // Generate invitation token
            const invitationToken = jwtHelper_1.jwtHelper.generateToken({
                email: payload.email,
                vendorId,
                type: 'supplier_invitation'
            }, config_1.config.jwt.jwt_secret, '7d');
            // FIX: Use the proper enum value
            const supplierData = {
                name: payload.name,
                contactPerson: payload.contactPerson,
                email: payload.email,
                phone: payload.phone,
                category: payload.category,
                criticality: payload.criticality,
                contractStartDate: new Date(payload.contractStartDate),
                contractEndDate: payload.contractEndDate ? new Date(payload.contractEndDate) : null,
                contractDocument: payload.contractDocument,
                documentType: payload.documentType,
                vendorId,
                invitationToken,
                invitationSentAt: new Date(),
                invitationStatus: client_1.InvitationStatus.SENT, // FIX: Use enum value instead of string
                isActive: false
            };
            const supplier = yield prisma_1.prisma.supplier.create({
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
                yield mailtrap_service_1.mailtrapService.sendHtmlEmail({
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
      `
                });
                return {
                    supplier,
                    invitationSent: true,
                    message: "Supplier created and invitation email sent successfully"
                };
            }
            catch (emailError) {
                console.error("Failed to send invitation email:", emailError);
                return {
                    supplier,
                    invitationSent: false,
                    message: "Supplier created but failed to send invitation email"
                };
            }
        });
    },
    // ========== COMPLETE SUPPLIER REGISTRATION ==========
    completeSupplierRegistration(payload) {
        return __awaiter(this, void 0, void 0, function* () {
            let decodedToken;
            try {
                decodedToken = jwtHelper_1.jwtHelper.verifyToken(payload.invitationToken, config_1.config.jwt.jwt_secret);
            }
            catch (error) {
                throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, "Invalid or expired invitation token");
            }
            if (decodedToken.type !== 'supplier_invitation') {
                throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, "Invalid invitation token");
            }
            const supplier = yield prisma_1.prisma.supplier.findUnique({
                where: {
                    email: decodedToken.email,
                    invitationToken: payload.invitationToken,
                    isActive: false
                }
            });
            if (!supplier) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "Supplier invitation not found or already used");
            }
            const hashPassword = yield bcryptjs_1.default.hash(payload.password, 10);
            const result = yield prisma_1.prisma.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                // Create user for supplier
                const user = yield tx.user.create({
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
                const updatedSupplier = yield tx.supplier.update({
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
                yield tx.user.update({
                    where: { id: user.id },
                    data: { supplierId: updatedSupplier.id }
                });
                // Create notification preferences
                yield tx.notificationPreferences.create({
                    data: { userId: user.id }
                });
                return { supplier: updatedSupplier, user };
            }));
            // Send welcome email
            try {
                mailtrap_service_1.mailtrapService.sendHtmlEmail({
                    to: supplier.email,
                    subject: "Welcome to CyberNark!",
                    html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Welcome to CyberNark! 🎉</h2>
            <p>Your supplier account has been successfully created and activated.</p>
            <p>You can now log in to your dashboard and start completing assessments.</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${config_1.config.APP.WEBSITE}/supplier/login" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
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
            }
            catch (error) {
                console.error("Failed to send welcome email:", error);
            }
            return result;
        });
    },
    // ========== VERIFY INVITATION TOKEN ==========
    verifyInvitationToken(token) {
        return __awaiter(this, void 0, void 0, function* () {
            let decodedToken;
            try {
                decodedToken = jwtHelper_1.jwtHelper.verifyToken(token, config_1.config.jwt.jwt_secret);
            }
            catch (error) {
                throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, "Invalid or expired invitation token");
            }
            if (decodedToken.type !== 'supplier_invitation') {
                throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, "Invalid invitation token");
            }
            const supplier = yield prisma_1.prisma.supplier.findUnique({
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
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "Invitation not found or already used");
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
        });
    },
    // ========== GET SUPPLIER PROFILE ==========
    getSupplierProfile(supplierId) {
        return __awaiter(this, void 0, void 0, function* () {
            const supplier = yield prisma_1.prisma.supplier.findUnique({
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
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "Supplier not found");
            }
            return supplier;
        });
    },
    // ========== UPDATE SUPPLIER PROFILE ==========
    updateSupplierProfile(supplierId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const supplier = yield prisma_1.prisma.supplier.findUnique({
                where: { id: supplierId }
            });
            if (!supplier) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "Supplier not found");
            }
            const updateData = Object.assign({}, data);
            // Handle date conversions
            if (data.contractStartDate) {
                updateData.contractStartDate = new Date(data.contractStartDate);
            }
            if (data.contractEndDate) {
                updateData.contractEndDate = new Date(data.contractEndDate);
            }
            const updatedSupplier = yield prisma_1.prisma.supplier.update({
                where: { id: supplierId },
                data: updateData
            });
            return updatedSupplier;
        });
    },
    // ========== GET ASSESSMENTS ==========
    getAssessments(supplierId) {
        return __awaiter(this, void 0, void 0, function* () {
            const assessments = yield prisma_1.prisma.assessment.findMany({
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
                var _a, _b;
                const latestSubmission = assessment.submissions[0];
                return {
                    id: assessment.id,
                    examId: assessment.examId,
                    title: assessment.title,
                    description: assessment.description,
                    stage: assessment.stage,
                    totalPoints: assessment.totalPoints,
                    passingScore: (_a = assessment.passingScore) === null || _a === void 0 ? void 0 : _a.toNumber(),
                    timeLimit: assessment.timeLimit,
                    categories: assessment.categories,
                    submission: latestSubmission ? {
                        id: latestSubmission.id,
                        status: latestSubmission.status,
                        progress: latestSubmission.progress,
                        score: (_b = latestSubmission.score) === null || _b === void 0 ? void 0 : _b.toNumber(),
                        submittedAt: latestSubmission.submittedAt,
                        startedAt: latestSubmission.startedAt
                    } : null
                };
            });
        });
    },
    // ========== START ASSESSMENT ==========
    startAssessment(supplierId, assessmentId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log("Starting assessment for supplier:", supplierId, "assessment:", assessmentId);
            // Check if assessment exists and is active
            const assessment = yield prisma_1.prisma.assessment.findUnique({
                where: {
                    id: assessmentId,
                    isActive: true
                }
            });
            console.log("Found assessment:", assessment);
            if (!assessment) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "Assessment not found");
            }
            // Get supplier
            const supplier = yield prisma_1.prisma.supplier.findUnique({
                where: { id: supplierId },
                include: { vendor: true }
            });
            console.log("Found supplier:", supplier);
            if (!supplier) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "Supplier not found");
            }
            // Check for existing submission
            const existingSubmission = yield prisma_1.prisma.assessmentSubmission.findFirst({
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
            const totalQuestions = yield prisma_1.prisma.assessmentQuestion.count({
                where: {
                    category: {
                        assessmentId
                    }
                }
            });
            console.log("Total questions:", totalQuestions);
            // Create new submission
            const submission = yield prisma_1.prisma.assessmentSubmission.create({
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
            return submission;
        });
    },
    // ========== SAVE ASSESSMENT ANSWER ==========
    saveAnswer(submissionId, questionId, data, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const submission = yield prisma_1.prisma.assessmentSubmission.findFirst({
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
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "Submission not found");
            }
            const question = yield prisma_1.prisma.assessmentQuestion.findUnique({
                where: { id: questionId }
            });
            if (!question) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "Question not found");
            }
            // Calculate score based on answer
            let score = 0;
            if (data.answer === 'YES')
                score = question.maxScore;
            else if (data.answer === 'PARTIAL')
                score = question.maxScore * 0.5;
            else if (data.answer === 'NO')
                score = 0;
            const answerData = {
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
            const existingAnswer = yield prisma_1.prisma.assessmentAnswer.findFirst({
                where: {
                    submissionId,
                    questionId
                }
            });
            let answer;
            if (existingAnswer) {
                // Update existing answer
                answer = yield prisma_1.prisma.assessmentAnswer.update({
                    where: { id: existingAnswer.id },
                    data: answerData
                });
            }
            else {
                // Create new answer
                answer = yield prisma_1.prisma.assessmentAnswer.create({
                    data: Object.assign(Object.assign({}, answerData), { submissionId,
                        questionId })
                });
                // Update submission counts
                const answeredCount = submission.answers.length + 1;
                const progress = Math.round((answeredCount / submission.totalQuestions) * 100);
                yield prisma_1.prisma.assessmentSubmission.update({
                    where: { id: submissionId },
                    data: {
                        answeredQuestions: answeredCount,
                        progress
                    }
                });
            }
            return answer;
        });
    },
    // ========== SUBMIT ASSESSMENT ==========
    submitAssessment(submissionId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const submission = yield prisma_1.prisma.assessmentSubmission.findFirst({
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
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "Submission not found or already submitted");
            }
            // Check if all required questions are answered
            const requiredQuestions = yield prisma_1.prisma.assessmentQuestion.count({
                where: {
                    category: {
                        assessmentId: submission.assessmentId
                    }
                }
            });
            const answeredRequiredQuestions = submission.answers.filter(answer => answer.answer !== null).length;
            if (answeredRequiredQuestions < requiredQuestions) {
                throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, `Please answer all required questions. ${answeredRequiredQuestions}/${requiredQuestions} answered.`);
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
                    }
                    else if (answer.question.bivCategory === 'INTEGRITY') {
                        integrityScore += answer.score.toNumber();
                        integrityCount++;
                    }
                    else if (answer.question.bivCategory === 'AVAILABILITY') {
                        availabilityScore += answer.score.toNumber();
                        availabilityCount++;
                    }
                }
            }
            const finalScore = totalMaxScore > 0 ? (totalScore / totalMaxScore) * 100 : 0;
            const avgBusinessScore = businessCount > 0 ? (businessScore / businessCount) : 0;
            const avgIntegrityScore = integrityCount > 0 ? (integrityScore / integrityCount) : 0;
            const avgAvailabilityScore = availabilityCount > 0 ? (availabilityScore / availabilityCount) : 0;
            const bivResult = (0, bivRiskCalculator_1.calculateBIVScore)({
                businessScore: avgBusinessScore,
                integrityScore: avgIntegrityScore,
                availabilityScore: avgAvailabilityScore
            });
            const result = yield prisma_1.prisma.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                // Update submission
                const updatedSubmission = yield tx.assessmentSubmission.update({
                    where: { id: submissionId },
                    data: {
                        status: 'SUBMITTED',
                        submittedAt: new Date(),
                        score: finalScore,
                        businessScore: avgBusinessScore,
                        integrityScore: avgIntegrityScore,
                        availabilityScore: avgAvailabilityScore,
                        bivScore: bivResult.bivScore,
                        riskLevel: bivResult.riskLevel,
                        riskBreakdown: bivResult.breakdown
                    }
                });
                // Update supplier
                yield tx.supplier.update({
                    where: { id: submission.supplierId },
                    data: {
                        bivScore: bivResult.bivScore,
                        businessScore: avgBusinessScore,
                        integrityScore: avgIntegrityScore,
                        availabilityScore: avgAvailabilityScore,
                        riskLevel: bivResult.riskLevel,
                        lastAssessmentDate: new Date(),
                        initialAssessmentCompleted: submission.stage === 'INITIAL',
                        fullAssessmentCompleted: submission.stage === 'FULL',
                        nis2Compliant: bivResult.bivScore >= 71
                    }
                });
                // Create notification for vendor
                if (submission.vendorId) {
                    const vendor = yield tx.vendor.findUnique({
                        where: { id: submission.vendorId },
                        select: { userId: true }
                    });
                    if (vendor) {
                        yield tx.notification.create({
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
            }));
            return result;
        });
    }
};
