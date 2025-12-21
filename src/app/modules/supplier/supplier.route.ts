// src/modules/supplier/supplier.route.ts
import express from "express";
import { SupplierController } from "./supplier.controller";
import auth from "../../middlewares/auth";

const router = express.Router();

// Dashboard
router.get(
  "/dashboard",
  auth("SUPPLIER"),
  SupplierController.getDashboardStats
);

// Profile
router.get(
  "/profile",
  auth("SUPPLIER"),
  SupplierController.getSupplierProfile
);

router.patch(
  "/profile",
  auth("SUPPLIER"),
  SupplierController.updateSupplierProfile
);

// Assessments
router.get(
  "/assessments",
  auth("SUPPLIER"),
  SupplierController.getAssessments
);

router.post(
  "/assessments/:assessmentId/start",
  auth("SUPPLIER"),
  SupplierController.startAssessment
);

router.post(
  "/submissions/:submissionId/answers/:questionId",
  auth("SUPPLIER"),
  SupplierController.saveAnswer
);

router.post(
  "/submissions/:submissionId/submit",
  auth("SUPPLIER"),
  SupplierController.submitAssessment
);
router.get(
  "/verify-invitation/:token",
  SupplierController.verifyInvitation
);
router.post(
  "/complete-registration",
  SupplierController.completeSupplierRegistration
);
export const SupplierRoutes = router;