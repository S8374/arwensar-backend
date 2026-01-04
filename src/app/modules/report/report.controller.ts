// src/modules/report/report.controller.ts
import { Request, Response } from "express";
import sendResponse from "../../shared/sendResponse";
import httpStatus from "http-status";
import { ReportService } from "./report.service";
import catchAsync from "../../shared/catchAsync";
import * as path from "path";
import fs from "fs";

// Define the user type for your auth middleware
interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
    vendorId?: string;
    supplierId?: string;
  };
}

// ========== GENERATE REPORT ==========
const generateReport = catchAsync(async (req: AuthRequest, res: Response) => {
  console.log("req body for generate report" ,  req.body);
  const userId = req.user?.userId;

  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "User ID not found",
      data: null
    });
  }

  const report = await ReportService.generateReport(userId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Report generated successfully",
    data: report
  });
});




// ========== GET VENDOR REPORT OPTIONS ==========
const getVendorReportOptions = catchAsync(async (req: AuthRequest, res: Response) => {
  const vendorId = req.user?.vendorId;

  if (!vendorId) {
    return sendResponse(res, {
      statusCode: httpStatus.FORBIDDEN,
      success: false,
      message: "Vendor access required",
      data: null
    });
  }

  const options = await ReportService.getVendorReportOptions(vendorId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Vendor report options retrieved successfully",
    data: options
  });
});




// ========== GET REPORTS ==========
const getReports = catchAsync(async (req: AuthRequest, res: Response) => { 
  console.log("Hits here...", req.user);

  const userId = req.user?.userId;

  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "User ID not found",
      data: null
    });
  }

  const result = await ReportService.getReports(userId, req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Reports retrieved successfully",
    data: result.reports,
    meta: result.meta
  });
});

// ========== GET REPORT BY ID ==========
const getReportById = catchAsync(async (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId;
  const { reportId } = req.params;

  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "User ID not found",
      data: null
    });
  }

  const report = await ReportService.getReportById(reportId, userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Report retrieved successfully",
    data: report
  });
});

// ========== VIEW/DOWNLOAD REPORT DOCUMENT ==========
const getReportDocument = catchAsync(async (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId;
  const { reportId } = req.params;

  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "User ID not found",
      data: null
    });
  }

  // Get the report with permission check
  const report = await ReportService.getReportById(reportId, userId);

  if (!report || !report.documentUrl) {
    return sendResponse(res, {
      statusCode: httpStatus.NOT_FOUND,
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
  
  if (!fs.existsSync(filePath)) {
    console.warn(`Local file not found: ${filePath}`);
    return sendResponse(res, {
      statusCode: httpStatus.NOT_FOUND,
      success: false,
      message: 'Document file not found on server',
      data: null
    });
  }

  // Set headers for PDF display
  res.setHeader('Content-Type', report.documentType || 'application/pdf');
  res.setHeader(
    'Content-Disposition', 
    req.query.download === 'true' 
      ? `attachment; filename="${report.title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf"`
      : `inline; filename="${report.title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf"`
  );

  // Stream the file
  const fileStream = fs.createReadStream(filePath);
  fileStream.pipe(res);
});

// ========== GET REPORT DOCUMENT URL ==========
const getReportDocumentUrl = catchAsync(async (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId;
  const { reportId } = req.params;

  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "User ID not found",
      data: null
    });
  }

  // Get the report with permission check
  const report = await ReportService.getReportById(reportId, userId);

  if (!report || !report.documentUrl) {
    return sendResponse(res, {
      statusCode: httpStatus.NOT_FOUND,
      success: false,
      message: 'Report or document not found',
      data: null
    });
  }

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Report document URL retrieved successfully',
    data: {
      url: report.documentUrl,
      fileName: `${report.title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
      type: report.documentType,
      fileSize: report.fileSize
    }
  });
});

// ========== UPDATE REPORT ==========
const updateReport = catchAsync(async (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId;
  const { reportId } = req.params;

  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "User ID not found",
      data: null
    });
  }

  const report = await ReportService.updateReport(reportId, userId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Report updated successfully",
    data: report
  });
});

// ========== DELETE REPORT ==========
const deleteReport = catchAsync(async (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId;
  const { reportId } = req.params;

  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "User ID not found",
      data: null
    });
  }

  const result = await ReportService.deleteReport(reportId, userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.message,
    data: null
  });
});

// ========== SEND REPORT ==========
const sendReport = catchAsync(async (req: AuthRequest, res: Response) => {
  console.log("Hits................ send report")
  const userId = req.user?.userId;
  const { reportId } = req.params;
 
  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "User ID not found",
      data: null
    });
  }

  const result = await ReportService.sendReport(
    reportId,
    userId,
    req.body.recipientEmail
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.message,
    data: null
  });
});

// ========== GET REPORT STATISTICS ==========
const getReportStatistics = catchAsync(async (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "User ID not found",
      data: null
    });
  }

  const stats = await ReportService.getReportStatistics(userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Report statistics retrieved successfully",
    data: stats
  });
});

// ========== UPLOAD EXTERNAL REPORT ==========
const uploadExternalReport = catchAsync(async (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "User ID not found",
      data: null
    });
  }

  const report = await ReportService.uploadExternalReport(userId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "External report uploaded successfully",
    data: report
  });
});

// ========== BULK GENERATE REPORTS ==========
const bulkGenerateReports = catchAsync(async (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId;

    console.log("req body for bulkGenerateReports " ,  req.body);

  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "User ID not found",
      data: null
    });
  }

  const result = await ReportService.bulkGenerateReports(userId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: result.message,
    data: {
      reports: result.reports,
      totalProcessed: result.reports.length
    }
  });
});

export const ReportController = {
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