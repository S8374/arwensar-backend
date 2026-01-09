// src/modules/problem/problem.route.ts
import express from "express";
import { ProblemController } from "./problem.controller";
import {
  createProblemSchema,
  updateProblemSchema,
  createMessageSchema
} from "./problem.constant";
import auth from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { checkUsage } from "../../middlewares/planLimitMiddleware";

const router = express.Router();

// Create problem
router.post(
  "/",
  auth("ADMIN", "VENDOR", "SUPPLIER"),
  checkUsage('reportCreate', 1),
  ProblemController.createProblem
);

// Get problems
router.get(
  "/",
  auth("ADMIN", "VENDOR", "SUPPLIER"),
  ProblemController.getProblems
);

// Get problem by ID
router.get(
  "/:problemId",
  auth("ADMIN", "VENDOR", "SUPPLIER"),
  ProblemController.getProblemById
);

// Update problem
router.patch(
  "/:problemId",
  auth("ADMIN", "VENDOR", "SUPPLIER"),
  validateRequest(updateProblemSchema),
  ProblemController.updateProblem
);

// Create message
router.post(
  "/:problemId/messages",
  auth("ADMIN", "VENDOR", "SUPPLIER"),
  checkUsage('messagesUsed', 1),
  validateRequest(createMessageSchema),
  ProblemController.createMessage
);

// Get problem statistics
router.get(
  "/statistics",
  auth("ADMIN", "VENDOR", "SUPPLIER"),
  ProblemController.getProblemStatistics
);

// Delete problem
router.delete(
  "/:problemId",
  auth("ADMIN", "VENDOR", "SUPPLIER"),
  ProblemController.deleteProblem
);

export const ProblemRoutes = router;