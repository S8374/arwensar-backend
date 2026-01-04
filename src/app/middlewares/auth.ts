// src/middleware/auth.ts
import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { config } from "../../config";
import { prisma } from "../shared/prisma";
import ApiError from "../../error/ApiError";
import { jwtHelper } from "../helper/jwtHelper";

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        role: string;
        vendorId?: string;
        supplierId?: string;
        vendorCompany?: string;
      };
    }
  }
}

const auth = (...requiredRoles: ("ADMIN" | "VENDOR" | "SUPPLIER")[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // 1. Get token from cookie or Authorization header
      const token = req.cookies?.accessToken || req.headers.authorization?.split(" ")?.[1];

      if (!token) {
        throw new ApiError(httpStatus.UNAUTHORIZED, "Authentication token is missing");
      }

      // 2. Verify JWT
      let decoded;
      try {
        decoded = jwtHelper.verifyToken(token, config.jwt.jwt_secret as string) as any;
      } catch (error) {
        throw new ApiError(httpStatus.UNAUTHORIZED, "Invalid or expired token");
      }

      if (!decoded?.userId || !decoded?.role) {
        throw new ApiError(httpStatus.UNAUTHORIZED, "Invalid token payload");
      }

      // 3. Check if user exists and is active
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          vendorId: true,
          supplierId: true,
          isVerified: true,
        }
      });

      if (!user) {
        throw new ApiError(httpStatus.UNAUTHORIZED, "User not found");
      }

      if (user.status !== 'ACTIVE') {
        throw new ApiError(httpStatus.FORBIDDEN, "Your account is not active");
      }

      // 4. Check if user is verified (for non-admin users)
      if (user.role !== 'ADMIN' && !user.isVerified) {
        throw new ApiError(
          httpStatus.FORBIDDEN, 
          "Please verify your email before accessing this resource"
        );
      }

      // 5. Prepare user data for request
      const userData: any = {
        userId: user.id,
        email: user.email,
        role: user.role,
      };

      // Use vendorId from JWT or database
      if (decoded.vendorId) {
        userData.vendorId = decoded.vendorId;
      } else if (user.role === "VENDOR" && user.vendorId) {
        userData.vendorId = user.vendorId;
      }

      // Use supplierId from JWT or database
      if (decoded.supplierId) {
        userData.supplierId = decoded.supplierId;
      } else if (user.role === "SUPPLIER" && user.supplierId) {
        userData.supplierId = user.supplierId;
      }

      // 6. For suppliers, get vendor info
      if (user.role === "SUPPLIER" && userData.supplierId) {
        const supplier = await prisma.supplier.findUnique({
          where: { id: userData.supplierId },
          select: { 
            vendorId: true,
            vendor: {
              select: {
                id: true,
                companyName: true
              }
            }
          }
        });
        
        if (supplier) {
          userData.vendorId = supplier.vendorId;
          userData.vendorCompany = supplier.vendor.companyName;
        }
      }

      // 7. Attach user to request
      req.user = userData;

      // 8. Role-based access control
      if (requiredRoles.length > 0 && !requiredRoles.includes(user.role as any)) {
        throw new ApiError(httpStatus.FORBIDDEN, "You do not have permission to access this resource");
      }

      console.log(`✅ Auth passed - User: ${user.email}, Role: ${user.role}, UserId: ${user.id}`);
      next();
    } catch (error) {
      console.error('❌ Auth error:', error);
      next(error);
    }
  };
};

export default auth;