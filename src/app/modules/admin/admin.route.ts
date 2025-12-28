// src/modules/admin/admin.route.ts
import express from "express";
import { AdminController } from "./admin.controller";
import { createPlanSchema, updatePlanSchema, createAssessmentSchema } from "./admin.constant";
import { UserRole } from "@prisma/client";
import auth from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";

const router = express.Router();

// Dashboard
router.get(
  "/dashboard",
  auth(UserRole.ADMIN),
  AdminController.getDashboardStats
);

// Plans Management
router.post(
  "/plans",
  auth("ADMIN"),
  validateRequest(createPlanSchema),
  AdminController.createPlan
);

router.patch(
  "/plans/:planId",
  auth("ADMIN"),
  validateRequest(updatePlanSchema),
  AdminController.updatePlan
);

router.delete(
  "/plans/:planId",
  auth("ADMIN"),
  AdminController.deletePlan
);

router.get(
  "/plans",
  auth("ADMIN" , "SUPPLIER" , "VENDOR"),
  AdminController.getAllPlans
);

router.get(
  "/plans/:planId",
  auth("ADMIN" , "SUPPLIER" ,"VENDOR"),
  AdminController.getPlanById
);

// Assessments Management
router.post(
  "/assessments",
  auth("ADMIN"),
  validateRequest(createAssessmentSchema),
  AdminController.createAssessment
);

router.get(
  "/assessments",
  auth("ADMIN"),
  AdminController.getAllAssessments
);

// User Management
router.get(
  "/vendors",
  auth("ADMIN"),
  AdminController.getAllVendors
);

router.get(
  "/suppliers",
  auth("ADMIN"),
  AdminController.getAllSuppliers
);

// Reports
router.post(
  "/reports/:type",
  auth("ADMIN"),
  AdminController.generateReport
);

export const AdminRoutes = router;