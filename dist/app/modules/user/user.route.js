"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserRoutes = void 0;
// src/modules/user/user.route.ts
const express_1 = __importDefault(require("express"));
const user_controller_1 = require("./user.controller");
const user_constant_1 = require("./user.constant");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const router = express_1.default.Router();
// Profile
router.get("/profile", (0, auth_1.default)("ADMIN", "VENDOR", "SUPPLIER"), user_controller_1.UserController.getUserProfile);
router.patch("/profile", (0, auth_1.default)("ADMIN", "VENDOR", "SUPPLIER"), (0, validateRequest_1.default)(user_constant_1.updateProfileSchema), user_controller_1.UserController.updateUserProfile);
// Password
router.patch("/password", (0, auth_1.default)("ADMIN", "VENDOR", "SUPPLIER"), user_controller_1.UserController.updatePassword);
// Notification Preferences
router.get("/notifications/preferences", (0, auth_1.default)("ADMIN", "VENDOR", "SUPPLIER"), user_controller_1.UserController.getNotificationPreferences);
router.patch("/notifications/preferences", (0, auth_1.default)("ADMIN", "VENDOR", "SUPPLIER"), user_controller_1.UserController.updateNotificationPreferences);
// Activity Logs
router.get("/activity-logs", (0, auth_1.default)("ADMIN", "VENDOR", "SUPPLIER"), user_controller_1.UserController.getActivityLogs);
// Search
router.get("/search", (0, auth_1.default)("ADMIN", "VENDOR", "SUPPLIER"), user_controller_1.UserController.search);
exports.UserRoutes = router;
