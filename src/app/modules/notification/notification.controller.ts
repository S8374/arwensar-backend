// src/modules/notification/notification.controller.ts
import { Request, Response } from "express";
import sendResponse from "../../shared/sendResponse";
import httpStatus from "http-status";
import { NotificationService } from "./notification.service";
import catchAsync from "../../shared/catchAsync";
import ApiError from "../../../error/ApiError";

const getNotifications = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  
  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "User ID not found",
      data: null
    });
  }

  const result = await NotificationService.getNotifications(userId, req.query);
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Notifications retrieved successfully",
    data: result.notifications,
    meta: result.meta
  });
});

const getNotificationStats = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  
  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "User ID not found",
      data: null
    });
  }

  const stats = await NotificationService.getNotificationStats(userId);
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Notification stats retrieved successfully",
    data: stats
  });
});

const markAsRead = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  
  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "User ID not found",
      data: null
    });
  }

  const result = await NotificationService.markAsRead(userId, req.body);
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.message,
    data: { count: result.count }
  });
});

const deleteNotifications = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  
  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "User ID not found",
      data: null
    });
  }

  const result = await NotificationService.deleteNotifications(
    userId,
    req.body.notificationIds
  );
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.message,
    data: { count: result.count }
  });
});

const getUnreadCount = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  
  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "User ID not found",
      data: null
    });
  }

  const result = await NotificationService.getUnreadCount(userId);
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Unread count retrieved successfully",
    data: result
  });
});

const clearAllNotifications = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  
  if (!userId) {
    return sendResponse(res, {
      statusCode: httpStatus.UNAUTHORIZED,
      success: false,
      message: "User ID not found",
      data: null
    });
  }

  const result = await NotificationService.clearAllNotifications(userId);
  
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.message,
    data: { count: result.count }
  });
});
const createNotification = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId; // Assuming auth middleware sets req.user

  if (!userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Unauthorized');
  }

  const payload = {
    ...req.body,
    // receiverId is the user who will receive the notification
    userId: req.body.receiverId || req.body.userId,
  };

  const notification = await NotificationService.createNotification(payload);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Notification sent successfully',
    data: notification,
  });
});
const getTargetUsers = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Unauthorized access');
  }

  const targetUsers = await NotificationService.getTargetUsers(userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Target users retrieved successfully',
    data: targetUsers,
  });
});
export const NotificationController = {
  getNotifications,
  getNotificationStats,
  markAsRead,
  deleteNotifications,
  getUnreadCount,
  clearAllNotifications ,
  createNotification,
  getTargetUsers
};