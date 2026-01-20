// src/app/middleware/usage.middleware.ts
import { NextFunction, Request, Response } from 'express';
import { usageService } from '../modules/usage/usage.service';
import asyncHandler from 'express-async-handler';
import ApiError from '../../error/ApiError';
import httpStatus from 'http-status';
import { UserRole } from '@prisma/client';

// Define the allowed fields type
type UsageField = 
  | 'suppliersUsed' 
  | 'assessmentsUsed' 
  | 'messagesUsed' 
  | 'documentReviewsUsed' 
  | 'reportCreate' 
  | 'reportsGeneratedUsed' 
  | 'notificationsSend';

export const checkUsage = (
  field: UsageField,
  count: number = 1
) => {
  return asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.userId as string;
    const userRole = req.user?.role as UserRole;
    
    if (!userId) {
      return next(new Error('User ID not found in request'));
    }
    
    // Only apply usage decrement for VENDOR role
    // ADMIN and SUPPLIER roles skip usage tracking
    if (userRole === UserRole.VENDOR) {
      await usageService.decrementMiddleware(userId, field, count);
    } else if (userRole === UserRole.ADMIN) {
      // Admins have unlimited access, skip usage tracking
      console.log(`Admin user ${userId} skipping usage check for ${field}`);
    } else if (userRole === UserRole.SUPPLIER) {
      // Suppliers have different limits, we'll handle them differently
      // For now, they skip VENDOR plan limits
      console.log(`Supplier user ${userId} skipping vendor usage check for ${field}`);
    } else {
      throw new ApiError(httpStatus.FORBIDDEN, 'Invalid user role for usage tracking');
    }
    
    next();
  });
};