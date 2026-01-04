// src/app/modules/usage/usage.controller.ts
import { Request, Response } from 'express';

import httpStatus from 'http-status';
import { usageService } from './usage.service';
import ApiError from '../../../error/ApiError';
import sendResponse from '../../shared/sendResponse';
import catchAsync from '../../shared/catchAsync';

const getCurrentUsage = catchAsync(async (req: Request, res: Response) => {
  // Get userId from request (from auth middleware)
  const user = (req as any).user;
  if (!user) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'User not authenticated');
  }
  
  const userId = user.userId;
  
  const usage = await usageService.getRemainingLimits(userId);
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Current usage retrieved successfully',
    data: usage
  });
});

const decrementUsage = catchAsync(async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'User not authenticated');
  }
  
  const userId = user.userId;
  const { field, count = 1 } = req.body;
  
  if (!field) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Field is required');
  }
  
  const result = await usageService.decrementUsage(userId, field, count);
  
  sendResponse(res, {
    statusCode: result.success ? httpStatus.OK : httpStatus.PAYMENT_REQUIRED,
    success: result.success,
    message: result.success 
      ? 'Usage decremented successfully' 
      : 'Limit exceeded',
    data: {
      remaining: result.remaining,
      field,
      count
    }
  });
});

const checkUsage = catchAsync(async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'User not authenticated');
  }
  
  const userId = user.userId;
  const { field, count = 1 } = req.body;
  
  if (!field) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Field is required');
  }
  
  const result = await usageService.checkUsage(userId, field, count);
  
  sendResponse(res, {
    statusCode: result.canProceed ? httpStatus.OK : httpStatus.PAYMENT_REQUIRED,
    success: result.canProceed,
    message: result.message || (result.canProceed ? 'Usage check passed' : 'Usage check failed'),
    data: {
      canProceed: result.canProceed,
      remaining: result.remaining,
      limit: result.limit,
      required: count
    }
  });
});

const resetUsage = catchAsync(async (req: Request, res: Response) => {
  // Only for ADMIN
  const user = (req as any).user;
  if (!user || user.role !== 'ADMIN') {
    throw new ApiError(httpStatus.FORBIDDEN, 'Admin access required');
  }
  
  const { userId, subscriptionId } = req.body;
  
  if (!userId && !subscriptionId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'userId or subscriptionId is required');
  }
  
  let result;
  if (subscriptionId) {
    // Reset by subscriptionId
    await usageService.refreshMonthlyUsage(subscriptionId);
    result = { message: 'Usage reset for subscription' };
  } else {
    // Reset by userId
    await usageService.resetExpiredSubscription(userId);
    result = { message: 'Usage reset for user' };
  }
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Usage reset successfully',
    data: result
  });
});

export const UsageController = {
  getCurrentUsage,
  decrementUsage,
  checkUsage,
  resetUsage
};




