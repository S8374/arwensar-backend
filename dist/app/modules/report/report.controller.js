"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportController = void 0;
const sendResponse_1 = __importDefault(require("../../shared/sendResponse"));
const http_status_1 = __importDefault(require("http-status"));
const report_service_1 = require("./report.service");
const catchAsync_1 = __importDefault(require("../../shared/catchAsync"));
const path = __importStar(require("path"));
const fs_1 = __importDefault(require("fs"));
// ========== GENERATE REPORT ==========
const generateReport = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    console.log("req body for generate report", req.body);
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    if (!userId) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.UNAUTHORIZED,
            success: false,
            message: "User ID not found",
            data: null
        });
    }
    const report = yield report_service_1.ReportService.generateReport(userId, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.CREATED,
        success: true,
        message: "Report generated successfully",
        data: report
    });
}));
// ========== GET VENDOR REPORT OPTIONS ==========
const getVendorReportOptions = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const vendorId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.vendorId;
    if (!vendorId) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.FORBIDDEN,
            success: false,
            message: "Vendor access required",
            data: null
        });
    }
    const options = yield report_service_1.ReportService.getVendorReportOptions(vendorId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Vendor report options retrieved successfully",
        data: options
    });
}));
// ========== GET REPORTS ==========
const getReports = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    console.log("Hits here...", req.user);
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    if (!userId) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.UNAUTHORIZED,
            success: false,
            message: "User ID not found",
            data: null
        });
    }
    const result = yield report_service_1.ReportService.getReports(userId, req.query);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Reports retrieved successfully",
        data: result.reports,
        meta: result.meta
    });
}));
// ========== GET REPORT BY ID ==========
const getReportById = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    const { reportId } = req.params;
    if (!userId) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.UNAUTHORIZED,
            success: false,
            message: "User ID not found",
            data: null
        });
    }
    const report = yield report_service_1.ReportService.getReportById(reportId, userId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Report retrieved successfully",
        data: report
    });
}));
// ========== VIEW/DOWNLOAD REPORT DOCUMENT ==========
const getReportDocument = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    const { reportId } = req.params;
    if (!userId) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.UNAUTHORIZED,
            success: false,
            message: "User ID not found",
            data: null
        });
    }
    // Get the report with permission check
    const report = yield report_service_1.ReportService.getReportById(reportId, userId);
    if (!report || !report.documentUrl) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.NOT_FOUND,
            success: false,
            message: 'Report or document not found',
            data: null
        });
    }
    // If using Cloudinary URL, redirect to it
    if (report.documentUrl.includes('cloudinary')) {
        return res.redirect(report.documentUrl);
    }
    // If using local file (for backward compatibility)
    const cleanPath = report.documentUrl.startsWith('/')
        ? report.documentUrl.substring(1)
        : report.documentUrl;
    const filePath = path.join(__dirname, '../../..', cleanPath);
    if (!fs_1.default.existsSync(filePath)) {
        console.warn(`Local file not found: ${filePath}`);
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.NOT_FOUND,
            success: false,
            message: 'Document file not found on server',
            data: null
        });
    }
    // Set headers for PDF display
    res.setHeader('Content-Type', report.documentType || 'application/pdf');
    res.setHeader('Content-Disposition', req.query.download === 'true'
        ? `attachment; filename="${report.title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf"`
        : `inline; filename="${report.title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf"`);
    // Stream the file
    const fileStream = fs_1.default.createReadStream(filePath);
    fileStream.pipe(res);
}));
// ========== GET REPORT DOCUMENT URL ==========
const getReportDocumentUrl = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    const { reportId } = req.params;
    if (!userId) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.UNAUTHORIZED,
            success: false,
            message: "User ID not found",
            data: null
        });
    }
    // Get the report with permission check
    const report = yield report_service_1.ReportService.getReportById(reportId, userId);
    if (!report || !report.documentUrl) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.NOT_FOUND,
            success: false,
            message: 'Report or document not found',
            data: null
        });
    }
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Report document URL retrieved successfully',
        data: {
            url: report.documentUrl,
            fileName: `${report.title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
            type: report.documentType,
            fileSize: report.fileSize
        }
    });
}));
// ========== UPDATE REPORT ==========
const updateReport = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    const { reportId } = req.params;
    if (!userId) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.UNAUTHORIZED,
            success: false,
            message: "User ID not found",
            data: null
        });
    }
    const report = yield report_service_1.ReportService.updateReport(reportId, userId, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Report updated successfully",
        data: report
    });
}));
// ========== DELETE REPORT ==========
const deleteReport = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    const { reportId } = req.params;
    if (!userId) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.UNAUTHORIZED,
            success: false,
            message: "User ID not found",
            data: null
        });
    }
    const result = yield report_service_1.ReportService.deleteReport(reportId, userId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: result.message,
        data: null
    });
}));
// ========== SEND REPORT ==========
const sendReport = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    console.log("Hits................ send report");
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    const { reportId } = req.params;
    if (!userId) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.UNAUTHORIZED,
            success: false,
            message: "User ID not found",
            data: null
        });
    }
    const result = yield report_service_1.ReportService.sendReport(reportId, userId, req.body.recipientEmail);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: result.message,
        data: null
    });
}));
// ========== GET REPORT STATISTICS ==========
const getReportStatistics = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    if (!userId) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.UNAUTHORIZED,
            success: false,
            message: "User ID not found",
            data: null
        });
    }
    const stats = yield report_service_1.ReportService.getReportStatistics(userId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Report statistics retrieved successfully",
        data: stats
    });
}));
// ========== UPLOAD EXTERNAL REPORT ==========
const uploadExternalReport = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    if (!userId) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.UNAUTHORIZED,
            success: false,
            message: "User ID not found",
            data: null
        });
    }
    const report = yield report_service_1.ReportService.uploadExternalReport(userId, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.CREATED,
        success: true,
        message: "External report uploaded successfully",
        data: report
    });
}));
// ========== BULK GENERATE REPORTS ==========
const bulkGenerateReports = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    console.log("req body for bulkGenerateReports ", req.body);
    if (!userId) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.UNAUTHORIZED,
            success: false,
            message: "User ID not found",
            data: null
        });
    }
    const result = yield report_service_1.ReportService.bulkGenerateReports(userId, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.CREATED,
        success: true,
        message: result.message,
        data: {
            reports: result.reports,
            totalProcessed: result.reports.length
        }
    });
}));
exports.ReportController = {
    // Main report endpoints
    generateReport,
    getReports,
    getReportById,
    updateReport,
    deleteReport,
    sendReport,
    getReportStatistics,
    uploadExternalReport,
    bulkGenerateReports,
    // Document endpoints
    getReportDocument,
    getReportDocumentUrl,
    getVendorReportOptions,
};
