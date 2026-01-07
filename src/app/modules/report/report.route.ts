// src/modules/report/report.routes.ts
import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { ReportController } from './report.controller';
import { reportValidation } from './report.constant';
import { checkUsage } from '../../middlewares/planLimitMiddleware';

const router = express.Router();

// All routes require authentication
router.use(auth());

// ========== VENDOR-SPECIFIC ROUTES ==========
router.get(
  '/vendor/options',
  ReportController.getVendorReportOptions
);



// ========== MAIN REPORT ROUTES ==========
router.post(
  '/',
  checkUsage('reportsGeneratedUsed', 1),
  validateRequest(reportValidation.generateReport),
  ReportController.generateReport
);

router.post(
  '/bulk',
  validateRequest(reportValidation.bulkGenerate),
  checkUsage('reportsGeneratedUsed', 1), 

  ReportController.bulkGenerateReports,
);

router.post(
  '/upload',
  validateRequest(reportValidation.uploadExternal),
  ReportController.uploadExternalReport
);

router.get(
  '/',

  ReportController.getReports
);

router.get(
  '/statistics',
  ReportController.getReportStatistics
);

router.get(
  '/:reportId',
  ReportController.getReportById
);

// Document endpoints
router.get(
  '/:reportId/document',
  ReportController.getReportDocument
);

router.get(
  '/:reportId/document/url',
  ReportController.getReportDocumentUrl
);

router.put(
  '/:reportId',
  validateRequest(reportValidation.updateReport),
  ReportController.updateReport
);

router.delete(
  '/:reportId',
  ReportController.deleteReport
);

router.post(
  '/:reportId/send',
  validateRequest(reportValidation.sendReport),
  ReportController.sendReport
);

export const reportRoutes = router;