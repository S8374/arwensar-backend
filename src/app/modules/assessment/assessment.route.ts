// src/modules/assessment/assessment.route.ts
import express from "express";
import { AssessmentController } from "./assessment.controller";
import {
  startAssessmentSchema,
  saveAnswerSchema,
  submitAssessmentSchema,
  reviewAssessmentSchema,
  reviewEvidenceSchema
} from "./assessment.constant";
import auth from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { checkUsage } from "../../middlewares/planLimitMiddleware";

const router = express.Router();

// Get assessments
router.get(
  "/",
  auth("ADMIN", "VENDOR", "SUPPLIER"),
  AssessmentController.getAssessments
);

// Get assessment by ID
router.get(
  "/:assessmentId",
  auth("ADMIN", "VENDOR", "SUPPLIER"),
  AssessmentController.getAssessmentById
);

// Get submissions
router.get(
  "/submissions/all",
  auth("ADMIN", "VENDOR", "SUPPLIER"),
  AssessmentController.getSubmissions
);

// Get submission by ID
router.get(
  "/submissions/:submissionId",
  auth("ADMIN", "VENDOR", "SUPPLIER"),
  AssessmentController.getSubmissionById
);

// Start assessment
router.post(
  "/start",
  auth("SUPPLIER"),
  validateRequest(startAssessmentSchema),
  AssessmentController.startAssessment
);

// Save answer
router.post(
  "/submissions/:submissionId/answers/:questionId",
  auth("SUPPLIER"),
  AssessmentController.saveAnswer
);

// Submit assessment
router.post(
  "/submissions/:submissionId/submit",
  auth("SUPPLIER"),
  AssessmentController.submitAssessment
);

// Review assessment
router.post(
  "/submissions/:submissionId/review",
  auth("VENDOR", "ADMIN"),
  // checkUsage('assessmentsUsed', 1), // Decrement by 1 per review
  validateRequest(reviewAssessmentSchema),
  AssessmentController.reviewAssessment
);

// Review evidence
router.post(
  "/evidence/:answerId/review",
  auth("VENDOR", "ADMIN"),
  validateRequest(reviewEvidenceSchema),
  AssessmentController.reviewEvidence
);

// Request evidence
router.post(
  "/evidence/:answerId/request",
  auth("VENDOR", "ADMIN"),
  AssessmentController.requestEvidence
);

// Get assessment statistics
router.get(
  "/statistics/all",
  auth("ADMIN", "VENDOR", "SUPPLIER"),
  AssessmentController.getAssessmentStatistics
);

router.get(
  "/submissions/drafts/:submissionId",
  auth("ADMIN", "VENDOR", "SUPPLIER"),
  AssessmentController.getDraftSubmissionById
);
router.get(
  "/user/:userId/submissions",
  auth("ADMIN", "VENDOR", "SUPPLIER"),
  AssessmentController.getSubmissionsByUserId
);

router.delete(
  "/evidence/:answerId",
  auth("ADMIN", "VENDOR", "SUPPLIER"),
  AssessmentController.removeEvidence
);


export const AssessmentRoutes = router;