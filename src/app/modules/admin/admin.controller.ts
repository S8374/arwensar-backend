// src/modules/admin/admin.controller.ts
import { Request, Response } from "express";
import sendResponse from "../../shared/sendResponse";
import httpStatus from "http-status";
import { AdminService } from "./admin.service";
import { paginationHelper } from "../../helper/paginationHelper";
import catchAsync from "../../shared/catchAsync";
import ApiError from "../../../error/ApiError";


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
   console.log("Plan craete" ,req.body);

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
  
  // Extract data - check for data property first, then body, then direct
  const data = req.body.data || req.body.body || req.body;
  
  console.log("Plan update details", req.body);  // Log the full body
  console.log("Extracted data:", data);         // Log what we extracted
  console.log("Plan planId", planId);
  
  if (!data) {
    throw new ApiError(httpStatus.BAD_REQUEST, "No data provided for update");
  }
  
  const plan = await AdminService.updatePlan(planId, data);
  
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

  console.log("Assainment Create",req.body);
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
const deleteSupplier = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const deletedSupplier = await AdminService.deleteSupplierPermanently(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Supplier deleted permanently",
    data: deletedSupplier,
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
//============== USER =====================
const updateUsers = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const data = req.body;
  const updatedUser = await AdminService.updateUser(userId, data);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Plan updated successfully",
    data: updatedUser
  });
});
const deleteUser = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.params;

  const result = await AdminService.deleteUser(userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Plan deleted successfully",
    data: result
  });
});
const toggleUserBlock = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { block, reason } = req.body as { block: boolean; reason?: string };
  const updatedUser = await AdminService.toggleUserBlock(userId, block, reason);
  console.log("userId",userId)
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Plan deleted successfully",
    data: updatedUser
  });
});
const bulkDeleteUsers = catchAsync(async (req: Request, res: Response) => {
  const { userIds } = req.body as { userIds: string[] };

  if (!userIds || userIds.length === 0) {
    return res.status(httpStatus.BAD_REQUEST).json({
      success: false,
      message: "No user IDs provided"
    });
  }

  const result = await AdminService.bulkDeleteUsers(userIds);


  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Plan deleted successfully",
    data: result
  });
});
const bulkUpdateUsers = catchAsync(async (req: Request, res: Response) => {
  const { userIds, data } = req.body as { userIds: string[]; data: Partial<any> };
  const result = await AdminService.bulkUpdateUsers(userIds, data);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Users updated successfully",
    data: result
  });
});
const bulkBlockUsers = catchAsync(async (req: Request, res: Response) => {
  const { userIds, block, reason } = req.body as { userIds: string[]; block: boolean; reason?: string };
  const result = await AdminService.bulkBlockUsers(userIds, block, reason);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: `Users ${block ? 'blocked' : 'unblocked'} successfully`,
    data: result
  });
});
const bulkVerifyUsers = catchAsync(async (req: Request, res: Response) => {
  const { userIds } = req.body as { userIds: string[] };
  const result = await AdminService.bulkVerifyUsers(userIds);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Users verified successfully",
    data: result
  });
});
const deactivateInactiveUsers = catchAsync(async (req: Request, res: Response) => {
  const { inactiveDays } = req.body as { inactiveDays?: number };
  const result = await AdminService.deactivateInactiveUsers(inactiveDays || 90);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Inactive users deactivated successfully",
    data: result
  });
});
const exportUsersToCSV = catchAsync(async (req: Request, res: Response) => {
  const filters = req.body.filters || {};
  const result = await AdminService.exportUsersToCSV(filters);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="users.csv"');
  res.send(result.csvData);
})

// Permanently delete a user
const permanentDeleteUser = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const result = await AdminService.permanentDeleteUser(userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User permanently deleted",
    data: result
  });
});
const updateAssessment = catchAsync(async (req: Request, res: Response) => {
  const { assessmentId } = req.params;
  console.log("Assainment Update fiend",req.body)
  const assessment = await AdminService.updateAssessment(assessmentId, {
    ...req.body,
    updatedBy: req.user?.userId
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Assessment updated successfully",
    data: assessment
  });
});

const deleteAssessment = catchAsync(async (req: Request, res: Response) => {
  const { assessmentId } = req.params;
  const result = await AdminService.deleteAssessment(assessmentId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Assessment deactivated successfully",
    data: result
  });
});
const getAssessmentById = catchAsync(async (req: Request, res: Response) => {
  const { assessmentId } = req.params;
  const assessment = await AdminService.getAssessmentById(assessmentId);

  if (!assessment) {
    throw new ApiError(httpStatus.NOT_FOUND, "Assessment not found");
  }

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Assessment retrieved successfully",
    data: assessment
  });
});




// Fix: Add pagination support to getAllUsers (currently broken – using users.meta incorrectly)
const getAllUsers = catchAsync(async (req: Request, res: Response) => {
  const pagination = paginationHelper.calculatePagination(req.query);
  const filters = {
    // you can extract more filters from query if needed
    role: req.query.role as string,
    status: req.query.status as string,
    search: req.query.search as string,
    isVerified: req.query.isVerified ? req.query.isVerified === 'true' : undefined,
  };

  const { users, meta } = await AdminService.getAllUsers(filters, pagination);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Users retrieved successfully",
    data: users,
    meta
  });
});

// Also recommended: paginated vendors & suppliers
const getUserById = catchAsync(async (req, res) => {
  const { userId } = req.params;

  const result = await AdminService.getUserById(userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User retrieved successfully",
    data: result,
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
  deleteAssessment,
  updateAssessment,
  getAllVendors,
  getAllSuppliers,
  generateReport,
  getAllUsers,
  updateUsers,
  deleteUser,
  toggleUserBlock,
  bulkDeleteUsers, //need
  bulkBlockUsers, //need
  bulkVerifyUsers,
  deactivateInactiveUsers,
  exportUsersToCSV,
  bulkUpdateUsers,
  permanentDeleteUser,
  deleteSupplier,
  getUserById,
  getAssessmentById
};