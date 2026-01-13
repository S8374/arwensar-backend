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
  AdminController.getAllPlans
);

router.get(
  "/plans/:planId",
  auth("ADMIN", "SUPPLIER", "VENDOR"),
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
router.patch('/assessments/:assessmentId', AdminController.updateAssessment);
router.delete('/assessments/:assessmentId', AdminController.deleteAssessment);
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
router.delete(
  "/suppliers/:id",
  auth("ADMIN", "VENDOR"),

  AdminController.deleteSupplier);

// Reports
router.post(
  "/reports/:type",
  auth("ADMIN"),
  AdminController.generateReport
);
// ==================  Users =============
router.get(
  "/all-users",
  auth("ADMIN"),
  AdminController.getAllUsers
);


router.patch(
  "/user/:userId",
  auth("ADMIN"),
  AdminController.updateUsers
);

router.delete(
  "/user/:userId",
  auth("ADMIN"),
  AdminController.deleteUser
);

router.patch(
  "/user/:userId/block",
  auth("ADMIN"),
  AdminController.toggleUserBlock
);
router.delete("/users/permanent/:userId", auth("ADMIN"), AdminController.permanentDeleteUser);

router.post(
  "/users/bulk-delete",
  auth("ADMIN"),
  AdminController.bulkDeleteUsers
);
router.post("/users/bulk-update", auth("ADMIN"), AdminController.bulkUpdateUsers);
router.post("/users/bulk-block", auth("ADMIN"), AdminController.bulkBlockUsers);
router.post("/users/bulk-verify", auth("ADMIN"), AdminController.bulkVerifyUsers);
router.post("/users/deactivate-inactive", auth("ADMIN"), AdminController.deactivateInactiveUsers);
router.post("/users/export-csv", auth("ADMIN"), AdminController.exportUsersToCSV);
export const AdminRoutes = router;