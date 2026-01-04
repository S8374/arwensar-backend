"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportRoutes = void 0;
// src/modules/report/report.routes.ts
const express_1 = __importDefault(require("express"));
const auth_1 = __importDefault(require("../../middlewares/auth"));
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const report_controller_1 = require("./report.controller");
const report_constant_1 = require("./report.constant");
const router = express_1.default.Router();
// All routes require authentication
router.use((0, auth_1.default)());
// ========== VENDOR-SPECIFIC ROUTES ==========
router.get('/vendor/options', report_controller_1.ReportController.getVendorReportOptions);
// ========== MAIN REPORT ROUTES ==========
router.post('/', 
//  checkUsage('reportsGeneratedUsed', 1),
(0, validateRequest_1.default)(report_constant_1.reportValidation.generateReport), report_controller_1.ReportController.generateReport);
router.post('/bulk', (0, validateRequest_1.default)(report_constant_1.reportValidation.bulkGenerate), report_controller_1.ReportController.bulkGenerateReports);
router.post('/upload', (0, validateRequest_1.default)(report_constant_1.reportValidation.uploadExternal), report_controller_1.ReportController.uploadExternalReport);
router.get('/', report_controller_1.ReportController.getReports);
router.get('/statistics', report_controller_1.ReportController.getReportStatistics);
router.get('/:reportId', report_controller_1.ReportController.getReportById);
// Document endpoints
router.get('/:reportId/document', report_controller_1.ReportController.getReportDocument);
router.get('/:reportId/document/url', report_controller_1.ReportController.getReportDocumentUrl);
router.put('/:reportId', (0, validateRequest_1.default)(report_constant_1.reportValidation.updateReport), report_controller_1.ReportController.updateReport);
router.delete('/:reportId', report_controller_1.ReportController.deleteReport);
router.post('/:reportId/send', (0, validateRequest_1.default)(report_constant_1.reportValidation.sendReport), report_controller_1.ReportController.sendReport);
exports.reportRoutes = router;
