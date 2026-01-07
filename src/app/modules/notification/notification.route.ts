// src/modules/notification/notification.route.ts
import express from "express";
import { NotificationController } from "./notification.controller";
import { createNotificationSchema, markAsReadSchema } from "./notification.constant";
import auth from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { UserRole } from "@prisma/client";
import { checkUsage } from "../../middlewares/planLimitMiddleware";

const router = express.Router();

// Get notifications
router.get(
  "/",
  auth("ADMIN", "VENDOR", "SUPPLIER"),
  NotificationController.getNotifications
);

// Get notification stats
router.get(
  "/stats",
  auth("ADMIN", "VENDOR", "SUPPLIER"),
  NotificationController.getNotificationStats
);

// Mark as read
router.patch(
  "/mark-read",
  auth("ADMIN", "VENDOR", "SUPPLIER"),
  validateRequest(markAsReadSchema),
  NotificationController.markAsRead
);

// Delete notifications
router.delete(
  "/",
  auth("ADMIN", "VENDOR", "SUPPLIER"),
  NotificationController.deleteNotifications
);

// Get unread count
router.get(
  "/unread-count",
  auth("ADMIN", "VENDOR", "SUPPLIER"),
  NotificationController.getUnreadCount
);

// Clear all notifications
router.delete(
  "/clear-all",
  auth("ADMIN", "VENDOR", "SUPPLIER"),
  NotificationController.clearAllNotifications
);
router.post(
  "/create",
  auth("ADMIN", "VENDOR", "SUPPLIER"),
  checkUsage('notificationsSend', 1),

  NotificationController.createNotification
);
router.get(
  '/targets',
  auth(UserRole.ADMIN, UserRole.VENDOR, UserRole.SUPPLIER),
  NotificationController.getTargetUsers
);
export const NotificationRoutes = router;