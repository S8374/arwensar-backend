// src/modules/supplier/supplier.controller.ts
import { Request, Response } from "express";
import sendResponse from "../../shared/sendResponse";
import httpStatus from "http-status";
import { SupplierService } from "./supplier.service";
import catchAsync from "../../shared/catchAsync";

const getDashboardStats = catchAsync(async (req: Request, res: Response) => {
  const supplierId = req.user?.supplierId;

  if (!supplierId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "Supplier ID not found",
      data: null
    });
  }

  const stats = await SupplierService.getDashboardStats(supplierId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Dashboard stats retrieved successfully",
    data: stats
  });
});

const getSupplierProfile = catchAsync(async (req: Request, res: Response) => {
  const supplierId = req.user?.supplierId;

  if (!supplierId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "Supplier ID not found",
      data: null
    });
  }

  const profile = await SupplierService.getSupplierProfile(supplierId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Profile retrieved successfully",
    data: profile
  });
});

const updateSupplierProfile = catchAsync(async (req: Request, res: Response) => {
  console.log("Req user for update supplier",req.user);
  // const supplierId = req.user?.supplierId;
   const supplierId = req.params?.supplierId;

  if (!supplierId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "Supplier ID not found",
      data: null
    });
  }

  const profile = await SupplierService.updateSupplierProfile(supplierId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Profile updated successfully",
    data: profile
  });
});

const getAssessments = catchAsync(async (req: Request, res: Response) => {
  const supplierId = req.user?.supplierId;

  if (!supplierId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "Supplier ID not found",
      data: null
    });
  }

  const assessments = await SupplierService.getAssessments(supplierId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Assessments retrieved successfully",
    data: assessments
  });
});

const startAssessment = catchAsync(async (req: Request, res: Response) => {
  console.log("Starting assessment", req.params, req.user);
  const supplierId = req.user?.userId;
  const { assessmentId } = req.params;
  console.log("Assessment ID:", assessmentId, "Supplier ID:", supplierId);
  if (!supplierId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "Supplier ID not found",
      data: null
    });
  }

  const result = await SupplierService.startAssessment(
    assessmentId,
    supplierId,
    req.user?.userId || ""
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Assessment started successfully",
    data: result
  });
});

const saveAnswer = catchAsync(async (req: Request, res: Response) => {
  const { submissionId, questionId } = req.params;

  const result = await SupplierService.saveAnswer(
    submissionId,
    questionId,
    req.body,
    req.user?.userId || ""
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Answer saved successfully",
    data: result
  });
});

const submitAssessment = catchAsync(async (req: Request, res: Response) => {
  const { submissionId } = req.params;

  const result = await SupplierService.submitAssessment(
    submissionId,
    req.user?.userId || ""
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Assessment submitted successfully",
    data: result
  });
});
const verifyInvitation = catchAsync(async (req: Request, res: Response) => {
  const { token } = req.params;

  const result = await SupplierService.verifyInvitationToken(token);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Invitation verified successfully",
    data: result
  });
});


const completeSupplierRegistration = catchAsync(async (req, res) => {
  const result = await SupplierService.completeSupplierRegistration(req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Supplier registration completed successfully",
    data: result
  });
});

const getSupplierContractStatus = catchAsync(async (req: Request, res: Response) => {
  // Use supplierId from token
  const supplierId = req.user?.supplierId;
  if (!supplierId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "Supplier ID missing in token",
      data: undefined
    });
  }

  const data = await SupplierService.getSupplierContractStatus(supplierId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Supplier contract status fetched successfully",
    data,
  });
}
)



export const SupplierController = {
  getDashboardStats,
  getSupplierProfile,
  updateSupplierProfile,
  getAssessments,
  startAssessment,
  saveAnswer,
  submitAssessment,
  verifyInvitation,
  completeSupplierRegistration,
  getSupplierContractStatus
};