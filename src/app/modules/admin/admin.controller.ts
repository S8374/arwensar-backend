// src/modules/admin/admin.controller.ts
import { Request, Response } from "express";
import sendResponse from "../../shared/sendResponse";
import httpStatus from "http-status";
import { AdminService } from "./admin.service";
import { paginationHelper } from "../../helper/paginationHelper";
import catchAsync from "../../shared/catchAsync";

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        [key: string]: any;
      };
    }
  }
}

const getDashboardStats = catchAsync(async (req: Request, res: Response) => {
  const stats = await AdminService.getDashboardStats();
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Dashboard stats retrieved successfully",
    data: stats
  });
});

const createPlan = catchAsync(async (req: Request, res: Response) => {
  const plan = await AdminService.createPlan({
    ...req.body,
    createdBy: req.user?.userId
  });
  
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Plan created successfully",
    data: plan
  });
});

const updatePlan = catchAsync(async (req: Request, res: Response) => {
  const { planId } = req.params;
  const plan = await AdminService.updatePlan(planId, req.body);
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Plan updated successfully",
    data: plan
  });
});

const deletePlan = catchAsync(async (req: Request, res: Response) => {
  const { planId } = req.params;
  const plan = await AdminService.deletePlan(planId);
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Plan deleted successfully",
    data: plan
  });
});

const getAllPlans = catchAsync(async (req: Request, res: Response) => {
  const plans = await AdminService.getAllPlans();
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Plans retrieved successfully",
    data: plans
  });
});

const getPlanById = catchAsync(async (req: Request, res: Response) => {
  const { planId } = req.params;
  const plan = await AdminService.getPlanById(planId);
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Plan retrieved successfully",
    data: plan
  });
});

const createAssessment = catchAsync(async (req: Request, res: Response) => {
  const assessment = await AdminService.createAssessment({
    ...req.body,
    createdBy: req.user?.userId
  });
  
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Assessment created successfully",
    data: assessment
  });
});

const getAllAssessments = catchAsync(async (req: Request, res: Response) => {
  const assessments = await AdminService.getAllAssessments();
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Assessments retrieved successfully",
    data: assessments
  });
});

const getAllVendors = catchAsync(async (req: Request, res: Response) => {
  const pagination = paginationHelper.calculatePagination(req.query);
  const vendors = await AdminService.getAllVendors();
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Vendors retrieved successfully",
    data: vendors,
    meta: {
      page: pagination.page,
      limit: pagination.limit,
      total: vendors.length
    }
  });
});

const getAllSuppliers = catchAsync(async (req: Request, res: Response) => {
  const pagination = paginationHelper.calculatePagination(req.query);
  const suppliers = await AdminService.getAllSuppliers();
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Suppliers retrieved successfully",
    data: suppliers,
    meta: {
      page: pagination.page,
      limit: pagination.limit,
      total: suppliers.length
    }
  });
});

const generateReport = catchAsync(async (req: Request, res: Response) => {
  const { type } = req.params;
  const { filters } = req.body;
  
  const report = await AdminService.generateSystemReport(type, filters);
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Report generated successfully",
    data: report
  });
});

export const AdminController = {
  getDashboardStats,
  createPlan,
  updatePlan,
  deletePlan,
  getAllPlans,
  getPlanById,
  createAssessment,
  getAllAssessments,
  getAllVendors,
  getAllSuppliers,
  generateReport
};