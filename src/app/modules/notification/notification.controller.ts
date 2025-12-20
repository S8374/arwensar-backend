// src/modules/notification/notification.controller.ts
import { Request, Response } from "express";
import sendResponse from "../../shared/sendResponse";
import httpStatus from "http-status";
import { NotificationService } from "./notification.service";
import catchAsync from "../../shared/catchAsync";

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

export const NotificationController = {
  getNotifications,
  getNotificationStats,
  markAsRead,
  deleteNotifications,
  getUnreadCount,
  clearAllNotifications
};