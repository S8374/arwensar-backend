"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssessmentRoutes = void 0;
// src/modules/assessment/assessment.route.ts
const express_1 = __importDefault(require("express"));
const assessment_controller_1 = require("./assessment.controller");
const assessment_constant_1 = require("./assessment.constant");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const planLimitMiddleware_1 = require("../../middlewares/planLimitMiddleware");
const router = express_1.default.Router();
// Get assessments
router.get("/", (0, auth_1.default)("ADMIN", "VENDOR", "SUPPLIER"), assessment_controller_1.AssessmentController.getAssessments);
// Get assessment by ID
router.get("/:assessmentId", (0, auth_1.default)("ADMIN", "VENDOR", "SUPPLIER"), assessment_controller_1.AssessmentController.getAssessmentById);
// Get submissions
router.get("/submissions/all", (0, auth_1.default)("ADMIN", "VENDOR", "SUPPLIER"), assessment_controller_1.AssessmentController.getSubmissions);
// Get submission by ID
router.get("/submissions/:submissionId", (0, auth_1.default)("ADMIN", "VENDOR", "SUPPLIER"), assessment_controller_1.AssessmentController.getSubmissionById);
// Start assessment
router.post("/start", (0, auth_1.default)("SUPPLIER"), (0, validateRequest_1.default)(assessment_constant_1.startAssessmentSchema), assessment_controller_1.AssessmentController.startAssessment);
// Save answer
router.post("/submissions/:submissionId/answers/:questionId", (0, auth_1.default)("SUPPLIER"), assessment_controller_1.AssessmentController.saveAnswer);
// Submit assessment
router.post("/submissions/:submissionId/submit", (0, auth_1.default)("SUPPLIER"), assessment_controller_1.AssessmentController.submitAssessment);
// Review assessment
router.post("/submissions/:submissionId/review", (0, auth_1.default)("VENDOR", "ADMIN"), (0, planLimitMiddleware_1.checkUsage)('assessmentsUsed', 1), (0, validateRequest_1.default)(assessment_constant_1.reviewAssessmentSchema), assessment_controller_1.AssessmentController.reviewAssessment);
// Review evidence
router.post("/evidence/:answerId/review", (0, auth_1.default)("VENDOR", "ADMIN"), (0, validateRequest_1.default)(assessment_constant_1.reviewEvidenceSchema), assessment_controller_1.AssessmentController.reviewEvidence);
// Request evidence
router.post("/evidence/:answerId/request", (0, auth_1.default)("VENDOR", "ADMIN"), assessment_controller_1.AssessmentController.requestEvidence);
// Get assessment statistics
router.get("/statistics/all", (0, auth_1.default)("ADMIN", "VENDOR", "SUPPLIER"), assessment_controller_1.AssessmentController.getAssessmentStatistics);
router.get("/submissions/drafts/:submissionId", (0, auth_1.default)("ADMIN", "VENDOR", "SUPPLIER"), assessment_controller_1.AssessmentController.getDraftSubmissionById);
router.get("/user/:userId/submissions", (0, auth_1.default)("ADMIN", "VENDOR", "SUPPLIER"), assessment_controller_1.AssessmentController.getSubmissionsByUserId);
router.delete("/evidence/:answerId", (0, auth_1.default)("ADMIN", "VENDOR", "SUPPLIER"), assessment_controller_1.AssessmentController.removeEvidence);
exports.AssessmentRoutes = router;
