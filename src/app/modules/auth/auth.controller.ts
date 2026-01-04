// src/modules/auth/auth.controller.ts
import { Request, Response } from "express";
import sendResponse from "../../shared/sendResponse";
import httpStatus from "http-status";
import { AuthService } from "./auth.service";
import catchAsync from "../../shared/catchAsync";

const registerVendor = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthService.registerVendor(req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: result.message,
    data: {
      user: result.user,
      vendor: result.vendor
    }
  });
});

const verifyEmail = catchAsync(async (req: Request, res: Response) => {
  const user = await AuthService.verifyEmail(req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Email verified successfully",
    data: user
  });
});

const resendOTP = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthService.resendOTP(req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.message,
    data: null
  });
});

const login = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthService.login({
    ...req.body,
    ip: req.ip,
    req ,
    userAgent: req.get("User-Agent")
  });

  // Set cookies
  res.cookie("accessToken", result.accessToken, {
    httpOnly: true,
    secure:true,
    sameSite: "none",
    maxAge: 60 * 60 * 1000 // 1 hour
  });

  res.cookie("refreshToken", result.refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Login successful",
    data: {
      user: result.user,
      vendor: result.vendor,
      supplier: result.supplier,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken
    }
  });
});

const refreshToken = catchAsync(async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;

  if (!refreshToken) {
    return sendResponse(res, {
      statusCode: httpStatus.BAD_REQUEST,
      success: false,
      message: "Refresh token is required",
      data: null
    });
  }

  const result = await AuthService.refreshToken(refreshToken);

  // Set new access token cookie
  res.cookie("accessToken", result.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 1000 // 1 hour
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Token refreshed successfully",
    data: {
      accessToken: result.accessToken
    }
  });
});

const forgotPassword = catchAsync(async (req: Request, res: Response) => {
  console.log("res ponse", req.body);
  const result = await AuthService.forgotPassword(req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.message,
    data: null
  });
});

const resetPassword = catchAsync(async (req: Request, res: Response) => {
  console.log("res pass", req.body);
  const result = await AuthService.resetPassword(req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.message,
    data: null
  });
});

const logout = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  let result;
  if (userId) {
    result = await AuthService.logout(userId);
  } else {
    result = { message: "Logged out successfully" };
  }

  // Clear cookies regardless of user existence
  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.message,
    data: null
  });
});
// Get current user (me)
const getMe = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "User not authenticated",
      data: null
    });
  }

  const result = await AuthService.getMe(userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User profile retrieved successfully",
    data: result
  });
});
export const AuthController = {
  registerVendor,
  verifyEmail,
  resendOTP,
  login,
  refreshToken,
  forgotPassword,
  resetPassword,
  logout,
  getMe
};