// src/middleware/planLimit.ts
import { Request, Response, NextFunction } from "express";
import { SubscriptionService } from "../modules/subscription/subscription.service";
import httpStatus from "http-status";
import ApiError from "../../error/ApiError";

export const checkPlanLimit = (action: 'ADD_SUPPLIER' | 'CREATE_ASSESSMENT' | 'UPLOAD_DOCUMENT') => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const vendorId = req.user?.vendorId;
      
      if (!vendorId) {
        return next(new ApiError(httpStatus.UNAUTHORIZED, "Vendor ID not found"));
      }

      await SubscriptionService.enforcePlanLimits(vendorId, action, req.body);
      next();
    } catch (error) {
      next(error);
    }
  };
};

export const getPlanLimits = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const vendorId = req.user?.vendorId;
    
    if (!vendorId) {
      return next(new ApiError(httpStatus.UNAUTHORIZED, "Vendor ID not found"));
    }

    const result = await SubscriptionService.checkPlanLimits(vendorId);
    
    // Attach plan limits to request for use in controllers
    req.planLimits = result;
    next();
  } catch (error) {
    next(error);
  }
};