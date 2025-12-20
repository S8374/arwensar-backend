// src/middleware/refreshAuth.ts
import { Request, Response, NextFunction } from "express";
import httpStatus from "http-status";
import { jwtHelper } from "../helper/jwtHelper";
import { prisma } from "../shared/prisma";
import ApiError from "../../error/ApiError";
import { config } from "../../config";

const refreshAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get refresh token from cookies
    const refreshToken = req.cookies?.refreshToken;
    
    if (!refreshToken) {
      throw new ApiError(
        httpStatus.UNAUTHORIZED, 
        "Refresh token is required"
      );
    }

    // Verify refresh token
    let decoded;
    try {
      decoded = jwtHelper.verifyToken(
        refreshToken, 
        config.jwt.refresh_token_secret as string
      ) as any;
    } catch (error: any) {
      throw new ApiError(
        httpStatus.UNAUTHORIZED, 
        "Invalid or expired refresh token"
      );
    }

    // Check if user exists and is active
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        vendorId: true,
        supplierId: true
      }
    });

    if (!user) {
      throw new ApiError(httpStatus.UNAUTHORIZED, "User not found");
    }

    if (user.status !== 'ACTIVE') {
      throw new ApiError(httpStatus.FORBIDDEN, "Account is not active");
    }

    // Generate new access token
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role as "ADMIN" | "VENDOR" | "SUPPLIER",
      vendorId: user.vendorId,
      supplierId: user.supplierId
    };

    const newAccessToken = (jwtHelper.generateToken as any)(
      tokenPayload,
      config.jwt.jwt_secret as string,
      config.jwt.expires_in as string
    );

    // Set new access token in cookie
    res.cookie("accessToken", newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 1000 // 1 hour
    });

    // Return new token in response
    res.locals.newAccessToken = newAccessToken;
    res.locals.user = tokenPayload;

    next();
  } catch (error) {
    // Clear cookies on error
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");
    next(error);
  }
};

export default refreshAuth;