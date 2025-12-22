// src/modules/user/user.route.ts
import express from "express";
import { UserController } from "./user.controller";
import {
  updateProfileSchema,
  updatePasswordSchema,
  updateNotificationPreferencesSchema
} from "./user.constant";
import auth from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";

const router = express.Router();

// Profile
router.get(
  "/profile",
  auth("ADMIN", "VENDOR", "SUPPLIER"),
  UserController.getUserProfile
);

router.patch(
  "/profile",
  auth("ADMIN", "VENDOR", "SUPPLIER"),
  validateRequest(updateProfileSchema),
  UserController.updateUserProfile
);

// Password
router.patch(
  "/password",
  auth("ADMIN", "VENDOR", "SUPPLIER"),
  UserController.updatePassword
);

// Notification Preferences
router.get(
  "/notifications/preferences",
  auth("ADMIN", "VENDOR", "SUPPLIER"),
  UserController.getNotificationPreferences
);

router.patch(
  "/notifications/preferences",
  auth("ADMIN", "VENDOR", "SUPPLIER"),
  UserController.updateNotificationPreferences
);

// Activity Logs
router.get(
  "/activity-logs",
  auth("ADMIN", "VENDOR", "SUPPLIER"),
  UserController.getActivityLogs
);

// Search
router.get(
  "/search",
  auth("ADMIN", "VENDOR", "SUPPLIER"),
  UserController.search
);

export const UserRoutes = router;