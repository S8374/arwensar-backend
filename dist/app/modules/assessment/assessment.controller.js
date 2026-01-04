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
exports.AssessmentController = void 0;
const sendResponse_1 = __importDefault(require("../../shared/sendResponse"));
const http_status_1 = __importDefault(require("http-status"));
const assessment_service_1 = require("./assessment.service");
const catchAsync_1 = __importDefault(require("../../shared/catchAsync"));
const getAssessments = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    if (!userId) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.UNAUTHORIZED,
            success: false,
            message: "User ID not found",
            data: null
        });
    }
    const result = yield assessment_service_1.AssessmentService.getAssessments(userId, req.query);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Assessments retrieved successfully",
        data: result.assessments,
        meta: result.meta
    });
}));
const getAssessmentById = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    const { assessmentId } = req.params;
    if (!userId) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.UNAUTHORIZED,
            success: false,
            message: "User ID not found",
            data: null
        });
    }
    const assessment = yield assessment_service_1.AssessmentService.getAssessmentById(assessmentId, userId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Assessment retrieved successfully",
        data: assessment
    });
}));
const getSubmissions = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    console.log("Hits.................................................");
   
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    if (!userId) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.UNAUTHORIZED,
            success: false,
            message: "User ID not found",
            data: null
        });
    }
    const result = yield assessment_service_1.AssessmentService.getSubmissions(userId, req.query); // ✅ Correct
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Submissions retrieved successfully",
        data: result.submissions,
        meta: result.meta
    });
}));
const getSubmissionById = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    const { submissionId } = req.params;
    if (!userId) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.UNAUTHORIZED,
            success: false,
            message: "User ID not found",
            data: null
        });
    }
    const submission = yield assessment_service_1.AssessmentService.getSubmissionById(submissionId, userId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Submission retrieved successfully",
        data: submission
    });
}));
const startAssessment = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    const { assessmentId } = req.body;
    console.log("Starting assessment", assessmentId, userId);
    if (!userId) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.UNAUTHORIZED,
            success: false,
            message: "User ID not found",
            data: null
        });
    }
    const submission = yield assessment_service_1.AssessmentService.startAssessment(userId, assessmentId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Assessment started successfully",
        data: submission
    });
}));
const saveAnswer = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    console.log("Saving answersssssssssssssssssssssssssssssssss", req.body);
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    const { submissionId, questionId } = req.params;
    console.log("User IDsssssssssssssssss:", userId);
    console.log("Saving answer for submission:", submissionId, "question:", questionId);
    if (!userId) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.UNAUTHORIZED,
            success: false,
            message: "User ID not found",
            data: null
        });
    }
    const answer = yield assessment_service_1.AssessmentService.saveAnswer(submissionId, questionId, userId, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Answer saved successfully",
        data: answer
    });
}));
const submitAssessment = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    const { submissionId } = req.params;
    if (!userId) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.UNAUTHORIZED,
            success: false,
            message: "User ID not found",
            data: null
        });
    }
    const submission = yield assessment_service_1.AssessmentService.submitAssessment(submissionId, userId, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Assessment submitted successfully",
        data: submission
    });
}));
const reviewAssessment = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    console.log("review hit", req.body);
    console.log("req user", req.user);
    console.log("req params", req.params);
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    const { submissionId } = req.params;
    if (!userId) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.UNAUTHORIZED,
            success: false,
            message: "User ID not found",
            data: null
        });
    }
    const submission = yield assessment_service_1.AssessmentService.reviewAssessment(submissionId, userId, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Assessment reviewed successfully",
        data: submission
    });
}));
const reviewEvidence = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    const { answerId } = req.params;
    if (!userId) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.UNAUTHORIZED,
            success: false,
            message: "User ID not found",
            data: null
        });
    }
    const answer = yield assessment_service_1.AssessmentService.reviewEvidence(answerId, userId, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Evidence reviewed successfully",
        data: answer
    });
}));
const getAssessmentStatistics = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    console.log("Getting assessment statistics", req.body);
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    if (!userId) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.UNAUTHORIZED,
            success: false,
            message: "User ID not found",
            data: null
        });
    }
    const stats = yield assessment_service_1.AssessmentService.getAssessmentStatistics(userId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Assessment statistics retrieved successfully",
        data: stats
    });
}));
const requestEvidence = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    const { answerId } = req.params;
    if (!userId) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.UNAUTHORIZED,
            success: false,
            message: "User ID not found",
            data: null
        });
    }
    const answer = yield assessment_service_1.AssessmentService.requestEvidence(answerId, userId, req.body.reason);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Evidence requested successfully",
        data: answer
    });
}));
const getDraftSubmissionById = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    console.log("Getting draft submission", req.params, req.user);
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    const { submissionId } = req.params;
    console.log("User IDsssssssssssssssss:", userId);
    if (!userId) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.UNAUTHORIZED,
            success: false,
            message: "User ID not found",
            data: null
        });
    }
    const submission = yield assessment_service_1.AssessmentService.getDraftSubmissionById(submissionId, userId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Draft submission retrieved successfully",
        data: submission
    });
}));
// src/modules/assessment/assessment.controller.ts (add this method)
const removeEvidence = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    const { answerId } = req.params;
    if (!userId) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.UNAUTHORIZED,
            success: false,
            message: "User ID not found",
            data: null
        });
    }
    const answer = yield assessment_service_1.AssessmentService.removeEvidence(answerId, userId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Evidence removed successfully",
        data: answer
    });
}));
const getSubmissionsByUserId = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId } = req.params; // Fixed extra dot
    const options = req.query; // For pagination, filters
    const result = yield assessment_service_1.AssessmentService.getSubmissionsByUserId(userId, options);
    res.status(http_status_1.default.OK).json({
        success: true,
        message: "Submissions retrieved successfully",
        meta: result.meta,
        data: result.submissions,
    });
}));
exports.AssessmentController = {
    getAssessments,
    getAssessmentById,
    getSubmissions,
    getSubmissionById,
    startAssessment,
    saveAnswer,
    submitAssessment,
    reviewAssessment,
    reviewEvidence,
    getAssessmentStatistics,
    requestEvidence,
    getDraftSubmissionById,
    removeEvidence,
    getSubmissionsByUserId
};
