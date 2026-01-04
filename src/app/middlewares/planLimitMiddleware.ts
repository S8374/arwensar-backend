// src/app/middleware/usage.middleware.ts
import { NextFunction, Request, Response } from 'express';
import { usageService } from '../modules/usage/usage.service';
import asyncHandler from 'express-async-handler';

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
    
    if (!userId) {
      return next(new Error('User ID not found in request'));
    }
    
    await usageService.decrementMiddleware(userId, field, count);
    
    next();
  });
};