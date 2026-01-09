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
exports.AssessmentService = void 0;
const prisma_1 = require("../../shared/prisma");
const http_status_1 = __importDefault(require("http-status"));
const notification_service_1 = require("../notification/notification.service");
const ApiError_1 = __importDefault(require("../../../error/ApiError"));
const bivRiskCalculator_1 = require("../../../logic/bivRiskCalculator");
const mailtrap_service_1 = require("../../shared/mailtrap.service");
exports.AssessmentService = {
    // ========== GET ASSESSMENTS ==========
    getAssessments(userId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, options = {}) {
            const { page = 1, limit = 20, stage, isActive, isTemplate, sortBy = 'createdAt', sortOrder = 'desc' } = options;
            const skip = (page - 1) * limit;
            const where = { isActive: true };
            if (stage) {
                where.stage = stage;
            }
            if (isActive !== undefined) {
                where.isActive = isActive === 'true';
            }
            if (isTemplate !== undefined) {
                where.isTemplate = isTemplate === 'true';
            }
            const [assessments, total] = yield Promise.all([
                prisma_1.prisma.assessment.findMany({
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
                prisma_1.prisma.assessment.count({ where })
            ]);
            return {
                assessments: assessments.map(assessment => (Object.assign(Object.assign({}, assessment), { totalQuestions: assessment.categories.reduce((sum, category) => sum + category.questions.length, 0) }))),
                meta: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            };
        });
    },
    // ========== GET ASSESSMENT BY ID ==========
    getAssessmentById(assessmentId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const assessment = yield prisma_1.prisma.assessment.findUnique({
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
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "Assessment not found");
            }
            // Get user's submission if userId provided
            let userSubmission = null;
            if (userId) {
                userSubmission = yield prisma_1.prisma.assessmentSubmission.findFirst({
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
            return Object.assign(Object.assign({}, assessment), { userSubmission, totalQuestions: assessment.categories.reduce((sum, category) => sum + category.questions.length, 0), totalPoints: assessment.totalPoints });
        });
    },
    // ========== GET SUBMISSIONS ==========
    getSubmissions(userId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, options = {}) {
            const { page = 1, limit = 20, status, stage, assessmentId, supplierId, sortBy = 'createdAt', sortOrder = 'desc' } = options;
            const skip = (page - 1) * limit;
            const user = yield prisma_1.prisma.user.findUnique({
                where: { id: userId },
                select: { role: true, vendorId: true, supplierId: true }
            });
            if (!user) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "User not found");
            }
            const where = {};
            if (user.role === 'VENDOR' && user.vendorId) {
                where.vendorId = user.vendorId;
            }
            else if (user.role === 'SUPPLIER' && user.supplierId) {
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
            const [submissions, total] = yield Promise.all([
                prisma_1.prisma.assessmentSubmission.findMany({
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
                prisma_1.prisma.assessmentSubmission.count({ where })
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
        });
    },
    // ========== GET SUBMISSION BY ID ==========
    getSubmissionById(submissionId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const submission = yield prisma_1.prisma.assessmentSubmission.findUnique({
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
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "Submission not found");
            }
            // Check permissions
            const user = yield prisma_1.prisma.user.findUnique({
                where: { id: userId },
                select: { role: true, vendorId: true, supplierId: true }
            });
            if (!user) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "User not found");
            }
            const canView = submission.userId === userId ||
                (user.role === 'VENDOR' && submission.vendorId === user.vendorId) ||
                (user.role === 'ADMIN');
            if (!canView) {
                throw new ApiError_1.default(http_status_1.default.FORBIDDEN, "You don't have permission to view this submission");
            }
            // Calculate progress and statistics
            const totalQuestions = submission.assessment.categories.reduce((sum, category) => sum + category.questions.length, 0);
            const answeredQuestions = submission.answers.length;
            const progress = totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0;
            // Calculate evidence statistics
            const evidenceQuestions = submission.answers.filter(answer => answer.question.evidenceRequired);
            const submittedEvidence = evidenceQuestions.filter(answer => answer.evidence && answer.evidence.trim() !== '');
            const approvedEvidence = evidenceQuestions.filter(answer => answer.evidenceStatus === 'APPROVED');
            const pendingEvidence = evidenceQuestions.filter(answer => answer.evidenceStatus === 'PENDING' || answer.evidenceStatus === 'SUBMITTED');
            // Calculate BIV scores
            const bivScores = this.calculateBIVScores(submission.answers);
            return Object.assign(Object.assign({}, submission), { statistics: {
                    totalQuestions,
                    answeredQuestions,
                    progress,
                    evidenceRequired: evidenceQuestions.length,
                    evidenceSubmitted: submittedEvidence.length,
                    evidenceApproved: approvedEvidence.length,
                    evidencePending: pendingEvidence.length
                }, bivScores });
        });
    },
    // ========== CALCULATE BIV SCORES ==========
    calculateBIVScores(answers) {
        if (!answers || answers.length === 0) {
            return {
                businessScore: 0,
                integrityScore: 0,
                availabilityScore: 0,
                bivScore: 0,
                riskLevel: 'HIGH',
                breakdown: { business: 0, integrity: 0, availability: 0 }
            };
        }
        console.log("Raw answers received:", answers);
        // Filter answers by category (case-insensitive, safe access)
        const businessAnswers = answers.filter((a) => { var _a; return (((_a = a.question) === null || _a === void 0 ? void 0 : _a.bivCategory) || '').toUpperCase() === 'BUSINESS'; });
        const integrityAnswers = answers.filter((a) => { var _a; return (((_a = a.question) === null || _a === void 0 ? void 0 : _a.bivCategory) || '').toUpperCase() === 'INTEGRITY'; });
        const availabilityAnswers = answers.filter((a) => { var _a; return (((_a = a.question) === null || _a === void 0 ? void 0 : _a.bivCategory) || '').toUpperCase() === 'AVAILABILITY'; });
        console.log("Business answers:", businessAnswers.length);
        console.log("Integrity answers:", integrityAnswers.length);
        console.log("Availability answers:", availabilityAnswers.length);
        const calculateCategoryScore = (categoryAnswers) => {
            if (categoryAnswers.length === 0)
                return 0;
            let totalScore = 0;
            let totalMaxScore = 0;
            categoryAnswers.forEach((ans) => {
                var _a;
                // Handle score (string, number, or Decimal)
                const score = ans.score;
                const numScore = typeof score === 'string' ? parseFloat(score) :
                    (score === null || score === void 0 ? void 0 : score.toNumber) ? score.toNumber() :
                        Number(score) || 0;
                // Handle maxScore — it's on the answer, not question!
                const maxScore = ans.maxScore || ((_a = ans.question) === null || _a === void 0 ? void 0 : _a.maxScore) || 10;
                totalScore += numScore;
                totalMaxScore += maxScore;
            });
            return totalMaxScore > 0
                ? parseFloat(((totalScore / totalMaxScore) * 100).toFixed(2))
                : 0;
        };
        const businessScore = calculateCategoryScore(businessAnswers);
        const integrityScore = calculateCategoryScore(integrityAnswers);
        const availabilityScore = calculateCategoryScore(availabilityAnswers);
        // Use your existing BIV calculator
        const bivResult = (0, bivRiskCalculator_1.calculateBIVScore)({
            businessScore,
            integrityScore,
            availabilityScore
        });
        return {
            businessScore,
            integrityScore,
            availabilityScore,
            bivScore: bivResult.bivScore,
            riskLevel: bivResult.riskLevel,
            breakdown: bivResult.breakdown
        };
    },
    // ========== START ASSESSMENT ==========
    startAssessment(userId, assessmentId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Check if assessment exists and is active
            const assessment = yield prisma_1.prisma.assessment.findUnique({
                where: { id: assessmentId, isActive: true }
            });
            console.log("Assessment found:", assessment);
            if (!assessment) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "Assessment not found or inactive");
            }
            // Get user info
            const user = yield prisma_1.prisma.user.findUnique({
                where: { id: userId },
                select: { role: true, supplierId: true, vendorId: true }
            });
            if (!user) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "User not found");
            }
            if (user.role !== 'SUPPLIER') {
                throw new ApiError_1.default(http_status_1.default.FORBIDDEN, "Only suppliers can start assessments");
            }
            if (!user.supplierId) {
                throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, "Supplier profile not found");
            }
            const supplier = yield prisma_1.prisma.supplier.findUnique({
                where: { id: user.supplierId },
                select: { vendorId: true }
            });
            if (!supplier) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "Supplier not found");
            }
            // Check for existing submission
            const existingSubmission = yield prisma_1.prisma.assessmentSubmission.findFirst({
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
            const totalQuestions = yield prisma_1.prisma.assessmentQuestion.count({
                where: {
                    category: {
                        assessmentId
                    }
                }
            });
            // Create new submission
            const submission = yield prisma_1.prisma.assessmentSubmission.create({
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
                const vendor = yield prisma_1.prisma.vendor.findUnique({
                    where: { id: supplier.vendorId },
                    select: { userId: true }
                });
                if (vendor) {
                    yield notification_service_1.NotificationService.createNotification({
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
        });
    },
    // ========== SAVE ANSWER ==========
    saveAnswer(submissionId, questionId, userId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            // Allow saving answers in DRAFT, REJECTED, or REQUIRES_ACTION states
            const editableStatuses = [
                "DRAFT",
                "REJECTED",
                "REQUIRES_ACTION",
            ];
            const submission = yield prisma_1.prisma.assessmentSubmission.findFirst({
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
                throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, "Submission not found or not editable. It may have been approved or is under review.");
            }
            const question = yield prisma_1.prisma.assessmentQuestion.findUnique({
                where: { id: questionId },
            });
            if (!question) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "Question not found");
            }
            // Calculate score
            let score = 0;
            console.log("Data answer .........................", data);
            // Check if the user actually provided the answer, comments, and evidence
            const Answer = data.answer;
            const hasComment = Boolean(data.comments && data.comments.trim());
            const hasEvidence = Boolean(data.evidence && data.evidence.trim());
            console.log(".................", Answer, hasComment, hasEvidence);
            if (Answer === "YES" && hasComment && hasEvidence) {
                score = question.maxScore;
            }
            else if (Answer === "YES" && !hasComment && hasEvidence) {
                score = question.maxScore * 0.8;
            }
            else if (Answer === "YES" && hasComment && !hasEvidence) {
                score = question.maxScore * 0.6;
            }
            else if (Answer === "YES" && !hasComment && !hasEvidence) {
                score = question.maxScore * 0.5;
            }
            else if (Answer === "PARTIAL" && hasComment && hasEvidence) {
                score = question.maxScore * 0.8;
            }
            else if (Answer === "PARTIAL" && !hasComment && hasEvidence) {
                score = question.maxScore * 0.8;
            }
            else if (Answer === "PARTIAL" && hasComment && !hasEvidence) {
                score = question.maxScore * 0.6;
            }
            else if (Answer === "PARTIAL" && !hasComment && !hasEvidence) {
                score = question.maxScore * 0.5;
            }
            // no
            else if (Answer === "NO" && hasComment && hasEvidence) {
                score = question.maxScore * 0.6;
            }
            else if (Answer === "NO" && !hasComment && hasEvidence) {
                score = question.maxScore * 0.5;
            }
            else if (Answer === "NO" && hasComment && !hasEvidence) {
                score = question.maxScore * 0.3;
            }
            else if (Answer === "NO" && !hasComment && !hasEvidence) {
                score = question.maxScore * 0.2;
            }
            else if (Answer === "NOT_APPLICABLE" && !hasComment && hasEvidence) {
                score = question.maxScore * 0.5;
            }
            else if (Answer === "NOT_APPLICABLE" && hasComment && !hasEvidence) {
                score = question.maxScore * 0.3;
            }
            console.log("Questions Secore singel", score);
            const answerData = {
                answer: data.answer,
                score,
                maxScore: question.maxScore,
                comments: data.comments || null,
            };
            if (data.evidence) {
                answerData.evidence = data.evidence;
                if (question.evidenceRequired) {
                    answerData.evidenceStatus = "SUBMITTED";
                }
            }
            const existingAnswer = yield prisma_1.prisma.assessmentAnswer.findFirst({
                where: { submissionId, questionId },
            });
            let answer;
            if (existingAnswer) {
                answer = yield prisma_1.prisma.assessmentAnswer.update({
                    where: { id: existingAnswer.id },
                    data: answerData,
                });
            }
            else {
                answer = yield prisma_1.prisma.assessmentAnswer.create({
                    data: Object.assign(Object.assign({}, answerData), { submissionId,
                        questionId }),
                });
                // Update submission progress
                const newAnsweredCount = submission.answeredQuestions + 1; // It's a number!
                const progress = Math.round((newAnsweredCount / submission.totalQuestions) * 100);
                yield prisma_1.prisma.assessmentSubmission.update({
                    where: { id: submissionId },
                    data: {
                        answeredQuestions: newAnsweredCount,
                        progress,
                    },
                });
            }
            return answer;
        });
    },
    // ========== SUBMIT ASSESSMENT ==========
    submitAssessment(submissionId, userId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const submittableStatuses = [
                "DRAFT",
                "REJECTED",
                "REQUIRES_ACTION",
            ];
            const submission = yield prisma_1.prisma.assessmentSubmission.findFirst({
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
                throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, "Submission not found or not submittable. It may be under review or already approved.");
            }
            // Validate all questions are answered
            if (submission.answeredQuestions < submission.totalQuestions) {
                throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, `Please answer all ${submission.totalQuestions} questions. Currently answered: ${submission.answeredQuestions}.`);
            }
            // Recalculate BIV scores
            const bivScores = this.calculateBIVScores(submission.answers);
            // === CALCULATE OVERALL SCORE ===
            let totalScore = 0;
            let totalMaxScore = 0;
            submission.answers.forEach((ans) => {
                if (ans.score !== null && ans.score !== undefined && ans.maxScore > 0) {
                    totalScore += ans.score.toNumber();
                    totalMaxScore += ans.maxScore;
                }
            });
            // FIXED: Check if totalMaxScore > 0, not < 0
            const overallScore = totalMaxScore > 0 ? (totalScore / totalMaxScore) * 90 : 0;
            console.log("Final Calculation:", {
                totalScore,
                totalMaxScore,
                overallScore,
                percentage: overallScore.toFixed(2) + "%"
            });
            // Determine risk score (numeric for sorting/ranking)
            const riskScore = bivScores.riskLevel === "HIGH" ? 3 : bivScores.riskLevel === "MEDIUM" ? 2 : 1;
            const result = yield prisma_1.prisma.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                // Update submission with calculated scores
                const updatedSubmission = yield tx.assessmentSubmission.update({
                    where: { id: submissionId },
                    data: {
                        status: "PENDING",
                        submittedAt: new Date(),
                        score: overallScore, // ← This is the overall percentage
                        businessScore: bivScores.businessScore,
                        integrityScore: bivScores.integrityScore,
                        availabilityScore: bivScores.availabilityScore,
                        bivScore: bivScores.bivScore,
                        riskLevel: bivScores.riskLevel,
                        riskBreakdown: bivScores.breakdown,
                        riskScore,
                        // Clear previous review data on re-submission
                        reviewedAt: null,
                        reviewedBy: null,
                        reviewComments: null,
                        reviewerReport: null,
                    },
                });
                // === UPDATE SUPPLIER WITH ALL SCORES INCLUDING OVERALLSCORE ===
                if (submission.supplierId) {
                    yield tx.supplier.update({
                        where: { id: submission.supplierId },
                        data: {
                            // NOW INCLUDING overallScore!
                            overallScore: overallScore,
                            bivScore: bivScores.bivScore,
                            businessScore: bivScores.businessScore,
                            integrityScore: bivScores.integrityScore,
                            availabilityScore: bivScores.availabilityScore,
                            riskLevel: bivScores.riskLevel,
                            lastAssessmentDate: new Date(),
                            nis2Compliant: bivScores.bivScore >= 71, // optional: update on submit
                        },
                    });
                }
                // Notify vendor
                if (submission.vendorId) {
                    const vendor = yield tx.vendor.findUnique({
                        where: { id: submission.vendorId },
                        select: { userId: true, companyName: true },
                    });
                    if (vendor === null || vendor === void 0 ? void 0 : vendor.userId) {
                        yield notification_service_1.NotificationService.createNotification({
                            userId: vendor.userId,
                            title: "New Assessment Submitted",
                            message: `Supplier has submitted assessment: "${submission.assessment.title}"`,
                            type: "ASSESSMENT_SUBMITTED",
                            metadata: {
                                submissionId: submission.id,
                                assessmentId: submission.assessmentId,
                                supplierId: submission.supplierId,
                                overallScore: overallScore.toFixed(1),
                                riskLevel: bivScores.riskLevel,
                                isResubmission: submission.status !== "DRAFT",
                            },
                        });
                    }
                }
                return updatedSubmission;
            }));
            return result;
        });
    },
    // ========== CALCULATE RISK SCORE ==========
    calculateRiskScore(riskLevel) {
        switch (riskLevel) {
            case 'LOW': return 1;
            case 'MEDIUM': return 2;
            case 'HIGH': return 3;
            default: return 2;
        }
    },
    // ========== UPDATE ASSESSMENT COMPLETION STATUS ==========
    updateAssessmentCompletionStatus(submission) {
        return __awaiter(this, void 0, void 0, function* () {
            const supplier = yield prisma_1.prisma.supplier.findUnique({
                where: { id: submission.supplierId }
            });
            if (!supplier)
                return;
            const updateData = {};
            if (submission.assessment.stage === 'INITIAL') {
                updateData.initialAssessmentCompleted = true;
            }
            else if (submission.assessment.stage === 'FULL') {
                updateData.fullAssessmentCompleted = true;
                // Check if NIS2 compliant (both initial and full completed)
                const hasInitial = yield prisma_1.prisma.assessmentSubmission.findFirst({
                    where: {
                        supplierId: submission.supplierId,
                        assessment: { stage: 'INITIAL' },
                        status: 'APPROVED'
                    }
                });
                if (hasInitial) {
                    updateData.nis2Compliant = true;
                }
            }
            if (Object.keys(updateData).length > 0) {
                yield prisma_1.prisma.supplier.update({
                    where: { id: submission.supplierId },
                    data: updateData
                });
            }
        });
    },
    // ========== NOTIFY VENDOR OF SUBMISSION ==========
    // async notifyVendorOfSubmission(submission: any, result: any): Promise<void> {
    //   if (!submission.vendorId) return;
    //   const vendor = await prisma.vendor.findUnique({
    //     where: { id: submission.vendorId },
    //     include: { user: true }
    //   });
    //   if (!vendor?.user) return;
    //   // Create notification
    //   await NotificationService.createNotification({
    //     userId: vendor.user.id,
    //     title: "Assessment Submitted",
    //     message: `Supplier has submitted assessment: "${submission.assessment.title}"`,
    //     type: 'ASSESSMENT_SUBMITTED',
    //     metadata: {
    //       submissionId: submission.id,
    //       assessmentId: submission.assessment.id,
    //       supplierId: submission.supplierId,
    //       score: result.overallScore,
    //       riskLevel: result.bivResult.riskLevel,
    //       bivScore: result.bivResult.bivScore
    //     }
    //   });
    //   // Send email notification
    //   try {
    //     const supplier = await prisma.supplier.findUnique({
    //       where: { id: submission.supplierId },
    //       select: { name: true }
    //     });
    //     await mailtrapService.sendHtmlEmail({
    //       to: vendor.user.email,
    //       subject: `Assessment Submitted: ${submission.assessment.title}`,
    //       html: `
    //         <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    //           <h2 style="color: #333;">Assessment Submitted</h2>
    //           <p>${supplier?.name || 'A supplier'} has submitted an assessment for your review.</p>
    //           <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
    //             <h3 style="margin-top: 0;">Assessment Details:</h3>
    //             <p><strong>Assessment:</strong> ${submission.assessment.title}</p>
    //             <p><strong>Supplier:</strong> ${supplier?.name || 'Unknown'}</p>
    //             <p><strong>Score:</strong> ${result.overallScore.toFixed(1)}%</p>
    //             <p><strong>BIV Score:</strong> ${result.bivResult.bivScore.toFixed(1)}%</p>
    //             <p><strong>Risk Level:</strong> <span style="color: ${result.bivResult.riskLevel === 'HIGH' ? '#dc3545' :
    //           result.bivResult.riskLevel === 'MEDIUM' ? '#ffc107' : '#28a745'
    //         }">${result.bivResult.riskLevel}</span></p>
    //             <p><strong>Submitted At:</strong> ${new Date().toLocaleString()}</p>
    //           </div>
    //           <p>BIV Breakdown:</p>
    //           <ul>
    //             <li><strong>Business:</strong> ${result.bivResult.breakdown.business.toFixed(1)}%</li>
    //             <li><strong>Integrity:</strong> ${result.bivResult.breakdown.integrity.toFixed(1)}%</li>
    //             <li><strong>Availability:</strong> ${result.bivResult.breakdown.availability.toFixed(1)}%</li>
    //           </ul>
    //           <div style="text-align: center; margin: 30px 0;">
    //             <a href="${process.env.FRONTEND_URL}/vendor/assessments/submissions/${submission.id}" 
    //                style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
    //               Review Assessment
    //             </a>
    //           </div>
    //           <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
    //           <p style="color: #666; font-size: 12px;">© ${new Date().getFullYear()} CyberNark. All rights reserved.</p>
    //         </div>
    //       `
    //     });
    //   } catch (error) {
    //     console.error("Failed to send assessment submission email:", error);
    //   }
    // },
    // ========== REVIEW ASSESSMENT ==========
    reviewAssessment(submissionId, reviewerId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const submission = yield prisma_1.prisma.assessmentSubmission.findFirst({
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
            if (!submission) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "Submission not found or not available for review");
            }
            // Check if user is authorized to review
            const reviewer = yield prisma_1.prisma.user.findUnique({
                where: { id: reviewerId },
                select: { role: true, vendorId: true }
            });
            if (!reviewer) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "Reviewer not found");
            }
            if (reviewer.role !== 'VENDOR' && reviewer.role !== 'ADMIN') {
                throw new ApiError_1.default(http_status_1.default.FORBIDDEN, "Only vendors and admins can review assessments");
            }
            if (reviewer.role === 'VENDOR' && submission.vendorId !== reviewer.vendorId) {
                throw new ApiError_1.default(http_status_1.default.FORBIDDEN, "You can only review assessments from your suppliers");
            }
            const result = yield prisma_1.prisma.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                var _a, _b, _c, _d, _e;
                const updatedSubmission = yield tx.assessmentSubmission.update({
                    where: {
                        id: submission.id
                    },
                    data: {
                        status: data.status,
                        reviewedAt: new Date(),
                        reviewedBy: reviewerId,
                        reviewComments: data.reviewComments,
                        reviewerReport: data.reviewerReport,
                        complianceRate: data.complianceRate
                    }
                });
                // Update supplier scores dynamically
                if (submission.supplierId) {
                    // Fetch current supplier scores (to apply penalty on existing values)
                    const supplier = yield tx.supplier.findUnique({
                        where: { id: submission.supplierId },
                        select: {
                            overallScore: true,
                            bivScore: true,
                            businessScore: true,
                            integrityScore: true,
                            availabilityScore: true,
                            riskLevel: true
                        }
                    });
                    let updateData = {
                        lastAssessmentDate: new Date(),
                        nis2Compliant: submission.bivScore && submission.bivScore.toNumber() >= 71
                    };
                    if (data.status === 'APPROVED') {
                        // On approval: Use the submission's calculated scores as new values
                        const overall = Number(data.scores.overallScore) || 0;
                        updateData = Object.assign(Object.assign({}, updateData), { overallScore: overall, bivScore: Number(data.scores.bivScore) || 0, businessScore: Number(data.scores.businessScore) || 0, integrityScore: Number(data.scores.integrityScore) || 0, availabilityScore: Number(data.scores.availabilityScore) || 0, riskLevel: overall >= 80 ? 'LOW' : overall >= 60 ? 'MEDIUM' : 'HIGH', nis2Compliant: Number(data.scores.bivScore || 0) >= 71 });
                    }
                    else if (data.status === 'REJECTED' || data.status === 'REQUIRES_ACTION') {
                        // On rejection: Apply penalty - decrease scores dynamically (e.g., 10-20% reduction)
                        // You can customize the penalty factor (here: 15% decrease)
                        const penaltyFactor = 0.85; // 15% decrease (multiply by 0.85)
                        const currentOverall = ((_a = supplier === null || supplier === void 0 ? void 0 : supplier.overallScore) === null || _a === void 0 ? void 0 : _a.toNumber()) || 0;
                        const currentBIV = ((_b = supplier === null || supplier === void 0 ? void 0 : supplier.bivScore) === null || _b === void 0 ? void 0 : _b.toNumber()) || 0;
                        const currentBusiness = ((_c = supplier === null || supplier === void 0 ? void 0 : supplier.businessScore) === null || _c === void 0 ? void 0 : _c.toNumber()) || 0;
                        const currentIntegrity = ((_d = supplier === null || supplier === void 0 ? void 0 : supplier.integrityScore) === null || _d === void 0 ? void 0 : _d.toNumber()) || 0;
                        const currentAvailability = ((_e = supplier === null || supplier === void 0 ? void 0 : supplier.availabilityScore) === null || _e === void 0 ? void 0 : _e.toNumber()) || 0;
                        const newOverall = Math.max(0, currentOverall * penaltyFactor);
                        const newBIV = Math.max(0, currentBIV * penaltyFactor);
                        const newBusiness = Math.max(0, currentBusiness * penaltyFactor);
                        const newIntegrity = Math.max(0, currentIntegrity * penaltyFactor);
                        const newAvailability = Math.max(0, currentAvailability * penaltyFactor);
                        updateData = Object.assign(Object.assign({}, updateData), { overallScore: newOverall, bivScore: newBIV, businessScore: newBusiness, integrityScore: newIntegrity, availabilityScore: newAvailability, 
                            // Update riskLevel - likely worsens
                            riskLevel: newOverall >= 80 ? 'LOW' : newOverall >= 50 ? 'MEDIUM' : 'HIGH' // Adjust thresholds as per your system
                         });
                    }
                    yield tx.supplier.update({
                        where: { id: submission.supplierId },
                        data: updateData
                    });
                }
                // Create notification for supplier
                if (submission.userId) {
                    yield notification_service_1.NotificationService.createNotification({
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
                }
                return updatedSubmission;
            }));
            return result;
        });
    },
    // ========== REVIEW EVIDENCE ==========
    reviewEvidence(answerId, reviewerId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const answer = yield prisma_1.prisma.assessmentAnswer.findFirst({
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
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "Answer not found");
            }
            if (!answer.question.evidenceRequired) {
                throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, "This question does not require evidence");
            }
            // Check if user is authorized to review
            const reviewer = yield prisma_1.prisma.user.findUnique({
                where: { id: reviewerId },
                select: { role: true, vendorId: true }
            });
            if (!reviewer) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "Reviewer not found");
            }
            if (reviewer.role !== 'VENDOR' && reviewer.role !== 'ADMIN') {
                throw new ApiError_1.default(http_status_1.default.FORBIDDEN, "Only vendors and admins can review evidence");
            }
            if (reviewer.role === 'VENDOR' && answer.submission.vendorId !== reviewer.vendorId) {
                throw new ApiError_1.default(http_status_1.default.FORBIDDEN, "You can only review evidence from your suppliers");
            }
            const updatedAnswer = yield prisma_1.prisma.assessmentAnswer.update({
                where: { id: answerId },
                data: {
                    evidenceStatus: data.status,
                    score: data.score,
                    evidenceRejectionReason: data.rejectionReason
                }
            });
            // Create notification for supplier
            if (data.status === 'REJECTED' && answer.submission.userId) {
                yield notification_service_1.NotificationService.createNotification({
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
                    yield mailtrap_service_1.mailtrapService.sendHtmlEmail({
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
                }
                catch (error) {
                    console.error("Failed to send evidence rejection email:", error);
                }
            }
            return updatedAnswer;
        });
    },
    // ========== GET ASSESSMENT STATISTICS ==========
    getAssessmentStatistics(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const user = yield prisma_1.prisma.user.findUnique({
                where: { id: userId },
                select: { role: true, vendorId: true, supplierId: true }
            });
            if (!user) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "User not found");
            }
            const where = {};
            if (user.role === 'VENDOR' && user.vendorId) {
                where.vendorId = user.vendorId;
            }
            else if (user.role === 'SUPPLIER' && user.supplierId) {
                where.supplierId = user.supplierId;
                where.userId = userId;
            }
            const [totalSubmissions, byStatus, byStage, averageScore, pendingReviews, recentSubmissions] = yield Promise.all([
                prisma_1.prisma.assessmentSubmission.count({ where }),
                prisma_1.prisma.assessmentSubmission.groupBy({
                    by: ['status'],
                    where,
                    _count: true
                }),
                prisma_1.prisma.assessmentSubmission.groupBy({
                    by: ['stage'],
                    where,
                    _count: true
                }),
                prisma_1.prisma.assessmentSubmission.aggregate({
                    where: Object.assign(Object.assign({}, where), { score: { not: null } }),
                    _avg: { score: true }
                }),
                prisma_1.prisma.assessmentSubmission.count({
                    where: Object.assign(Object.assign({}, where), { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } })
                }),
                prisma_1.prisma.assessmentSubmission.findMany({
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
            const statusStats = {};
            byStatus.forEach(item => {
                statusStats[item.status] = item._count;
            });
            const stageStats = {};
            byStage.forEach(item => {
                stageStats[item.stage] = item._count;
            });
            return {
                totalSubmissions,
                byStatus: statusStats,
                byStage: stageStats,
                averageScore: ((_a = averageScore._avg.score) === null || _a === void 0 ? void 0 : _a.toNumber()) || 0,
                pendingReviews,
                recentSubmissions: recentSubmissions.map(sub => {
                    var _a;
                    return ({
                        id: sub.id,
                        assessment: sub.assessment.title,
                        user: sub.user.email,
                        status: sub.status,
                        score: (_a = sub.score) === null || _a === void 0 ? void 0 : _a.toNumber(),
                        submittedAt: sub.submittedAt
                    });
                })
            };
        });
    },
    // ========== REQUEST EVIDENCE ==========
    requestEvidence(answerId, reviewerId, reason) {
        return __awaiter(this, void 0, void 0, function* () {
            const answer = yield prisma_1.prisma.assessmentAnswer.findFirst({
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
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "Answer not found");
            }
            if (!answer.question.evidenceRequired) {
                throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, "This question does not require evidence");
            }
            // Check if user is authorized
            const reviewer = yield prisma_1.prisma.user.findUnique({
                where: { id: reviewerId },
                select: { role: true, vendorId: true }
            });
            if (!reviewer) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "Reviewer not found");
            }
            if (reviewer.role !== 'VENDOR' && reviewer.role !== 'ADMIN') {
                throw new ApiError_1.default(http_status_1.default.FORBIDDEN, "Only vendors and admins can request evidence");
            }
            if (reviewer.role === 'VENDOR' && answer.submission.vendorId !== reviewer.vendorId) {
                throw new ApiError_1.default(http_status_1.default.FORBIDDEN, "You can only request evidence from your suppliers");
            }
            const updatedAnswer = yield prisma_1.prisma.assessmentAnswer.update({
                where: { id: answerId },
                data: {
                    evidenceStatus: 'REQUESTED',
                    evidenceRejectionReason: reason
                }
            });
            // Create notification for supplier
            if (answer.submission.userId) {
                yield notification_service_1.NotificationService.createNotification({
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
                    yield mailtrap_service_1.mailtrapService.sendHtmlEmail({
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
                }
                catch (error) {
                    console.error("Failed to send evidence request email:", error);
                }
            }
            return updatedAnswer;
        });
    },
    // Also, make sure you have the correct method in your service:
    getDraftSubmissionById(submissionId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            // First get the submission
            const submission = yield prisma_1.prisma.assessmentSubmission.findUnique({
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
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "Submission not found");
            }
            // Check if it's a draft
            if (submission.status !== 'DRAFT') {
                throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, "This is not a draft submission");
            }
            // Get user to check permissions
            const user = yield prisma_1.prisma.user.findUnique({
                where: { id: userId }
            });
            if (!user) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "User not found");
            }
            // Check permissions
            const canView = submission.userId === userId ||
                (user.role === 'VENDOR' && submission.vendorId === user.vendorId) ||
                (user.role === 'ADMIN');
            if (!canView) {
                throw new ApiError_1.default(http_status_1.default.FORBIDDEN, "You don't have permission to view this draft");
            }
            // Calculate progress
            const totalQuestions = submission.assessment.categories.reduce((sum, category) => sum + category.questions.length, 0);
            const progress = totalQuestions > 0
                ? Math.round((submission.answeredQuestions / totalQuestions) * 100)
                : 0;
            // Group answers by category for easier display
            const answersByCategory = {};
            submission.answers.forEach((answer) => {
                const categoryId = answer.question.categoryId;
                if (!answersByCategory[categoryId]) {
                    answersByCategory[categoryId] = [];
                }
                answersByCategory[categoryId].push(answer);
            });
            return Object.assign(Object.assign({}, submission), { progress,
                totalQuestions, answeredQuestions: submission.answeredQuestions, answersByCategory, canContinue: submission.status === 'DRAFT' && progress < 100, timeInDraft: {
                    days: Math.floor((new Date().getTime() - submission.updatedAt.getTime()) / (1000 * 60 * 60 * 24)),
                    hours: Math.floor((new Date().getTime() - submission.updatedAt.getTime()) / (1000 * 60 * 60)),
                    lastUpdated: submission.updatedAt
                } });
        });
    },
    removeEvidence(questionId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const answer = yield prisma_1.prisma.assessmentAnswer.findFirst({
                where: { questionId },
                include: {
                    submission: {
                        include: {
                            user: { select: { id: true } }
                        }
                    }
                }
            });
            if (!answer) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "Answer not found");
            }
            const user = yield prisma_1.prisma.user.findUnique({
                where: { id: userId },
                select: { role: true, vendorId: true }
            });
            if (!user) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "User not found");
            }
            const canRemove = answer.submission.user.id === userId ||
                (user.role === 'VENDOR' &&
                    answer.submission.vendorId === user.vendorId) ||
                user.role === 'ADMIN';
            if (!canRemove) {
                throw new ApiError_1.default(http_status_1.default.FORBIDDEN, "You don't have permission to remove this evidence");
            }
            // ✅ CORRECT update
            return prisma_1.prisma.assessmentAnswer.updateMany({
                where: { questionId }, // ✅ FIXED
                data: {
                    evidence: null,
                    evidenceStatus: 'PENDING'
                }
            });
        });
    },
    // ========== GET SUBMISSIONS BY USER ID ==========
    getSubmissionsByUserId(userId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, options = {}) {
            const { page = 1, limit = 20, status, stage, assessmentId, supplierId, sortBy = 'createdAt', sortOrder = 'desc' } = options;
            const skip = (page - 1) * limit;
            const where = {
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
            const [submissions, total] = yield Promise.all([
                prisma_1.prisma.assessmentSubmission.findMany({
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
                prisma_1.prisma.assessmentSubmission.count({ where })
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
        });
    }
};
