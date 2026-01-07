// src/modules/vendor/vendor.controller.ts
import { NextFunction, Request, Response } from "express";
import sendResponse from "../../shared/sendResponse";
import httpStatus from "http-status";
import { VendorService } from "./vendor.service";
import { paginationHelper } from "../../helper/paginationHelper";
import catchAsync from "../../shared/catchAsync";
import { SupplierService } from "../supplier/supplier.service";
import { usageService } from "../usage/usage.service";
import ApiError from "../../../error/ApiError";

const getDashboardStats = catchAsync(async (req: Request, res: Response) => {
  const vendorId = req.user?.vendorId;

  if (!vendorId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "Vendor ID not found",
      data: null
    });
  }

  const stats = await VendorService.getVendorDashboardStats(vendorId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Dashboard stats retrieved successfully",
    data: stats
  });
});

const getVendorProfile = catchAsync(async (req: Request, res: Response) => {
  const vendorId = req.user?.vendorId;

  if (!vendorId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "Vendor ID not found",
      data: null
    });
  }

  const profile = await VendorService.getVendorProfile(vendorId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Profile retrieved successfully",
    data: profile
  });
});

const updateVendorProfile = catchAsync(async (req: Request, res: Response) => {
  const vendorId = req.user?.vendorId;

  if (!vendorId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "Vendor ID not found",
      data: null
    });
  }

  const profile = await VendorService.updateVendorProfile(vendorId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Profile updated successfully",
    data: profile
  });
});

const getSuppliers = catchAsync(async (req: Request, res: Response) => {
  const vendorId = req.user?.vendorId;

  if (!vendorId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "Vendor ID not found",
      data: null
    });
  }

  const suppliers = await VendorService.getSuppliers(vendorId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Suppliers retrieved successfully",
    data: suppliers
  });
});

const getSupplierById = catchAsync(async (req: Request, res: Response) => {
  const vendorId = req.user?.vendorId;
  const { supplierId } = req.params;

  if (!vendorId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "Vendor ID not found",
      data: null
    });
  }

  const supplier = await VendorService.getSupplierById(vendorId, supplierId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Supplier details retrieved successfully",
    data: supplier
  });
});

const reviewAssessment = catchAsync(async (req: Request, res: Response) => {
  const vendorId = req.user?.vendorId;
  const { submissionId } = req.params;

  if (!vendorId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "Vendor ID not found",
      data: null
    });
  }

  const result = await VendorService.reviewAssessment(
    vendorId,
    submissionId,
    {
      ...req.body,
      reviewedBy: req.user?.userId
    }
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Assessment reviewed successfully",
    data: result
  });
});

const reviewEvidence = catchAsync(async (req: Request, res: Response) => {
  const vendorId = req.user?.vendorId;
  const { answerId } = req.params;

  if (!vendorId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "Vendor ID not found",
      data: null
    });
  }

  const result = await VendorService.reviewEvidence(vendorId, answerId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Evidence reviewed successfully",
    data: result
  });
});
export const createSupplier = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {

    // Vendor ID usually comes from auth middleware (JWT)
    const vendorId = req.user?.vendorId;

    if (!vendorId) {
      return next(
        new Error("Vendor ID not found in request user")
      );
    }

    const result = await SupplierService.createSupplier(
      vendorId,
      req.body
    );

    sendResponse(res, {
      statusCode: httpStatus.CREATED,
      success: true,
      message: result.message,
      data: {
        supplier: result.supplier,
        invitationSent: result.invitationSent,
      },
    });
  }
);

const getSingleSupplierProgress = catchAsync(async (req: Request, res: Response) => {
  const vendorId = req.user?.vendorId;
  const { supplierId } = req.params;

  if (!vendorId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "Vendor ID not found",
      data: null
    });
  }

  const progress = await VendorService.getSingleSupplierProgress(supplierId, vendorId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Supplier progress retrieved successfully",
    data: progress
  });
});
// src/app/modules/vendor/vendor.controller.ts
const bulkImportSuppliers = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  console.log("Processing bulk import request");

  const vendorId = req.user.vendorId;

  if (!vendorId) {
    return sendResponse(res, {
      statusCode: httpStatus.BAD_REQUEST,
      success: false,
      message: "Vendor ID not found in token",
      data: null,
    });
  }

  // Validate request body
  if (!req.body.suppliers || !Array.isArray(req.body.suppliers)) {
    return sendResponse(res, {
      statusCode: httpStatus.BAD_REQUEST,
      success: false,
      message: "Invalid request body. Expected 'suppliers' array.",
      data: null,
    });
  }

  // Set bulk count for usage tracking middleware
  // (req as any).bulkCount = req.body.suppliers.length;
  // Check capacity before processing
  const capacityCheck = await usageService.checkBulkSupplierLimit(
    vendorId,
    req.body.suppliers.length
  );
  if (!capacityCheck.canProceed) {
    throw new ApiError(httpStatus.PAYMENT_REQUIRED, capacityCheck.message!);
  }

  // Decrement usage for all suppliers
  await usageService.decrementUsage(
    vendorId,
    'suppliersUsed',
    req.body.suppliers.length
  );
  const result = await VendorService.bulkImportSuppliers(vendorId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: `Bulk import completed. ${result.successful} added, ${result.failed} : ''}`,
    data: result,
  });
});
const resendInvitation = catchAsync(async (req: Request, res: Response) => {
  const vendorId = req.user?.vendorId;
  const { supplierId } = req.params;

  if (!vendorId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "Vendor ID not found",
      data: null
    });
  }

  const result = await VendorService.resendInvitation(supplierId, vendorId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.message,
    data: {
      supplier: result.supplier,
      invitationSent: result.invitationSent
    }
  });
});
const getVendorSupplierContracts = catchAsync(async (req: Request, res: Response) => {
  // Use vendorId from token
  const vendorId = req.user?.vendorId;
  if (!vendorId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "Vendor ID missing in token",
      data: undefined
    });
  }

  const data = await VendorService.getVendorSupplierContracts(vendorId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Supplier contracts fetched successfully",
    data,
  });
});

export const VendorController = {
  getDashboardStats,
  getVendorProfile,
  updateVendorProfile,
  getSuppliers,
  getSupplierById,
  reviewAssessment,
  reviewEvidence,
  createSupplier,
  getSingleSupplierProgress,
  bulkImportSuppliers,
  resendInvitation,
  getVendorSupplierContracts
};