// src/modules/document/document.routes.ts
import express from "express";
import { DocumentController } from "./document.controller";
import auth from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { checkUsage } from "../../middlewares/planLimitMiddleware";

const router = express.Router();

// Upload document
router.post(
  "/upload",
  auth("ADMIN", "VENDOR", "SUPPLIER"),
  DocumentController.uploadDocument
);

// Get all documents
router.get(
  "/",
  auth("ADMIN", "VENDOR", "SUPPLIER"),
  DocumentController.getDocuments
);

// Get document by ID
router.get(
  "/:documentId",
  auth("ADMIN", "VENDOR", "SUPPLIER"),
  DocumentController.getDocumentById
);

// Update document
router.patch(
  "/:documentId",
  auth("ADMIN", "VENDOR", "SUPPLIER"),
  DocumentController.updateDocument
);

// Review document (Vendor/Admin)
router.post(
  "/:documentId/review",
  auth("VENDOR", "ADMIN"),
    checkUsage('documentReviewsUsed', 1),
  DocumentController.reviewDocument
);

// Delete document
router.delete(
  "/:documentId",
  auth("ADMIN", "VENDOR", "SUPPLIER"),
  DocumentController.deleteDocument
);

// Get document statistics
router.get(
  "/statistics/overview",
  auth("ADMIN", "VENDOR", "SUPPLIER"),
  DocumentController.getDocumentStatistics
);

// Get document categories
router.get(
  "/categories/all",
  auth("ADMIN", "VENDOR", "SUPPLIER"),
  DocumentController.getDocumentCategories
);

// Get expiring documents
router.get(
  "/expiring/soon",
  auth("ADMIN", "VENDOR", "SUPPLIER"),
  DocumentController.getExpiringDocuments
);

// Bulk update document status
router.post(
  "/bulk/update-status",
  auth("VENDOR", "ADMIN"),

  DocumentController.bulkUpdateDocumentStatus
);

// Check expired documents (Admin only - usually scheduled)
router.post(
  "/admin/check-expired",
  auth("ADMIN" , "VENDOR" , "SUPPLIER"),
  DocumentController.checkExpiredDocuments
);
// document.routes.ts
router.get('/user/:userID', auth('ADMIN', 'VENDOR', 'SUPPLIER'), DocumentController.getMyDocuments);
export const DocumentRoutes = router;