// src/modules/report/report.controller.ts
import { Request, Response } from "express";
import sendResponse from "../../shared/sendResponse";
import httpStatus from "http-status";
import { ReportService } from "./report.service";
import catchAsync from "../../shared/catchAsync";

const generateReport = catchAsync(async (req: Request, res: Response) => {
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

const getReports = catchAsync(async (req: Request, res: Response) => {
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

const getReportById = catchAsync(async (req: Request, res: Response) => {
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

const updateReport = catchAsync(async (req: Request, res: Response) => {
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

const deleteReport = catchAsync(async (req: Request, res: Response) => {
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

const sendReport = catchAsync(async (req: Request, res: Response) => {
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

const getReportStatistics = catchAsync(async (req: Request, res: Response) => {
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

export const ReportController = {
  generateReport,
  getReports,
  getReportById,
  updateReport,
  deleteReport,
  sendReport,
  getReportStatistics
};