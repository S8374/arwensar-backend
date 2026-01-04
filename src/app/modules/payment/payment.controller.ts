// src/app/modules/payment/payment.controller.ts
import { Request, Response } from "express";
import catchAsync from "../../shared/catchAsync";
import sendResponse from "../../shared/sendResponse";
import httpStatus from "http-status";
import { PaymentService } from "./payment.service";

const getAvailablePlans = catchAsync(async (req: Request, res: Response) => {
  const plans = await PaymentService.getAvailablePlans();
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Plans retrieved successfully",
    data: plans
  });
});

const getPlanById = catchAsync(async (req: Request, res: Response) => {
  const { planId } = req.params;
  const plan = await PaymentService.getPlanById(planId);
  
  if (!plan) {
    return sendResponse(res, {
      statusCode: httpStatus.NOT_FOUND,
      success: false,
      message: "Plan not found",
      data: null
    });
  }
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Plan retrieved successfully",
    data: plan
  });
});

const createCheckoutSession = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  
  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "User not authenticated",
      data: null
    });
  }

  const { planId, billingCycle } = req.body;
  
  const result = await PaymentService.createCheckoutSession(userId, planId, billingCycle);
  
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Checkout session created successfully",
    data: result
  });
});

const getSessionStatus = catchAsync(async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  
  const session = await PaymentService.getSessionStatus(sessionId);
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Session status retrieved successfully",
    data: session
  });
});

const confirmPayment = catchAsync(async (req: Request, res: Response) => {
  const { sessionId } = req.body;
  
  const result = await PaymentService.confirmPayment(sessionId);
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.message,
    data: result.data
  });
});

const createPortalSession = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  console.log("Req body",req.body);
  console.log("Req user",req.user);
  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "User not authenticated",
      data: null
    });
  }

  const { returnUrl } = req.body;
  
  const result = await PaymentService.createPortalSession(userId, returnUrl);
  
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Portal session created successfully",
    data: result
  });
});

const getCurrentSubscription = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  
  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "User not authenticated",
      data: null
    });
  }

  const subscription = await PaymentService.getCurrentSubscription(userId);
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Current subscription retrieved successfully",
    data: subscription
  });
});

const getPaymentHistory = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  
  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "User not authenticated",
      data: null
    });
  }

  const { page = 1, limit = 10 } = req.query;
  
  const result = await PaymentService.getPaymentHistory(userId, {
    page: Number(page),
    limit: Number(limit)
  });
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Payment history retrieved successfully",
    data: result.payments,
    meta: result.meta
  });
});

const cancelSubscription = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  
  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "User not authenticated",
      data: null
    });
  }

  const { cancelAtPeriodEnd = true } = req.body;
  
  const result = await PaymentService.cancelSubscription(userId, cancelAtPeriodEnd);
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.message,
    data: result.data
  });
});

export const PaymentController = {
  getAvailablePlans,
  getPlanById,
  createCheckoutSession,
  getSessionStatus,
  confirmPayment,
  createPortalSession,
  getCurrentSubscription,
  getPaymentHistory,
  cancelSubscription
};