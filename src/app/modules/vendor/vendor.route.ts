// src/modules/vendor/vendor.route.ts
import express from "express";
import { VendorController } from "./vendor.controller";
import { updateVendorProfileSchema } from "./vendor.constant";
import auth from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { UserRole } from "@prisma/client";
import { checkUsage } from "../../middlewares/planLimitMiddleware";

const router = express.Router();

// Dashboard
router.get(
  "/dashboard",
  auth("VENDOR"),
  VendorController.getDashboardStats
);

// Profile
router.get(
  "/profile",
  auth("VENDOR"),
  VendorController.getVendorProfile
);

router.patch(
  "/profile",
  auth("VENDOR"),
  validateRequest(updateVendorProfileSchema),
  VendorController.updateVendorProfile
);

// Suppliers
router.get(
  "/suppliers",
  auth("VENDOR", "SUPPLIER"),
  VendorController.getSuppliers
);

router.get(
  "/suppliers/:supplierId",
  auth("VENDOR"),
  VendorController.getSupplierById
);
router.post(
  "/suppliers/create",
  auth("VENDOR"),
  checkUsage('suppliersUsed', 1),
  VendorController.createSupplier
);
// Assessment Review
router.post(
  "/assessments/:submissionId/review",
  auth("VENDOR"),
  VendorController.reviewAssessment
);

router.post(
  "/evidence/:answerId/review",
  auth("VENDOR"),
  VendorController.reviewEvidence
);
router.get(
  "/suppliers/:supplierId/progress",
  auth("VENDOR"),
  VendorController.getSingleSupplierProgress
);


router.post(
  '/bulk-import',
  auth(UserRole.VENDOR),
  VendorController.bulkImportSuppliers
);

router.post(
  "/:supplierId/resend-invitation",
  auth("VENDOR"),
  VendorController.resendInvitation
);

// Vendor routes (auth required)
router.get(
  "/contracts",
  auth("VENDOR"),
  VendorController.getVendorSupplierContracts
);


export const VendorRoutes = router;