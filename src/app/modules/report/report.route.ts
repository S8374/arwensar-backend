// src/modules/report/report.route.ts
import express from "express";
import { ReportController } from "./report.controller";
import { generateReportSchema, updateReportSchema } from "./report.constant";
import auth from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";

const router = express.Router();

// Generate report
router.post(
  "/",
  auth("ADMIN", "VENDOR"),
  validateRequest(generateReportSchema),
  ReportController.generateReport
);

// Get reports
router.get(
  "/",
  auth("ADMIN", "VENDOR", "SUPPLIER"),
  ReportController.getReports
);

// Get report by ID
router.get(
  "/:reportId",
  auth("ADMIN", "VENDOR", "SUPPLIER"),
  ReportController.getReportById
);

// Update report
router.patch(
  "/:reportId",
  auth("ADMIN", "VENDOR"),
  validateRequest(updateReportSchema),
  ReportController.updateReport
);

// Delete report
router.delete(
  "/:reportId",
  auth("ADMIN", "VENDOR"),
  ReportController.deleteReport
);

// Send report
router.post(
  "/:reportId/send",
  auth("ADMIN", "VENDOR"),
  ReportController.sendReport
);

// Get report statistics
router.get(
  "/statistics",
  auth("ADMIN", "VENDOR"),
  ReportController.getReportStatistics
);

export const ReportRoutes = router;