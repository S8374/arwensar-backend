// src/modules/user/user.controller.ts
import { Request, Response } from "express";
import sendResponse from "../../shared/sendResponse";
import httpStatus from "http-status";
import { UserService } from "./user.service";
import catchAsync from "../../shared/catchAsync";

const getUserProfile = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  
  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "User ID not found",
      data: null
    });
  }

  const profile = await UserService.getUserProfile(userId);
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Profile retrieved successfully",
    data: profile
  });
});

const updateUserProfile = catchAsync(async (req: Request, res: Response) => {

  console.log("come from to update profile", req.body , req.user)
  const userId = req.user?.userId;
  
  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "User ID not found",
      data: null
    });
  }

  const profile = await UserService.updateUserProfile(userId, req.body);
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Profile updated successfully",
    data: profile
  });
});

const updatePassword = catchAsync(async (req: Request, res: Response) => {

  console.log("Request Body:", req.body);
  console.log("User Info:", req.user);
  const userId = req.user?.userId;
  
  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "User ID not found",
      data: null
    });
  }

  const result = await UserService.updatePassword(userId, req.body);
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.message,
    data: null
  });
});

const getNotificationPreferences = catchAsync(async (req: Request, res: Response) => {

  const userId = req.user?.userId;
  
  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "User ID not found",
      data: null
    });
  }

  const preferences = await UserService.getNotificationPreferences(userId);
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Notification preferences retrieved successfully",
    data: preferences
  });
});

const updateNotificationPreferences = catchAsync(async (req: Request, res: Response) => {
  console.log("Request Body:", req.body);
  console.log("User Info:", req.user);
  const userId = req.user?.userId;
  
  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "User ID not found",
      data: null
    });
  }

  const preferences = await UserService.updateNotificationPreferences(userId, req.body);
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Notification preferences updated successfully",
    data: preferences
  });
});

const getActivityLogs = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  
  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "User ID not found",
      data: null
    });
  }

  const result = await UserService.getActivityLogs(userId, req.query);
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Activity logs retrieved successfully",
    data: result.logs,
    meta: result.meta
  });
});

const search = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const { q } = req.query;
  
  if (!userId || !q) {
    return sendResponse(res, {
      statusCode: httpStatus.BAD_REQUEST,
      success: false,
      message: "Search query is required",
      data: null
    });
  }

  const result = await UserService.search(
    q as string,
    userId,
    req.user?.role || ""
  );
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Search results retrieved successfully",
    data: result
  });
});

export const UserController = {
  getUserProfile,
  updateUserProfile,
  updatePassword,
  getNotificationPreferences,
  updateNotificationPreferences,
  getActivityLogs,
  search
};