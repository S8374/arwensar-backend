"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationRoutes = void 0;
// src/modules/notification/notification.route.ts
const express_1 = __importDefault(require("express"));
const notification_controller_1 = require("./notification.controller");
const notification_constant_1 = require("./notification.constant");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const client_1 = require("@prisma/client");
const planLimitMiddleware_1 = require("../../middlewares/planLimitMiddleware");
const router = express_1.default.Router();
// Get notifications
router.get("/", (0, auth_1.default)("ADMIN", "VENDOR", "SUPPLIER"), notification_controller_1.NotificationController.getNotifications);
// Get notification stats
router.get("/stats", (0, auth_1.default)("ADMIN", "VENDOR", "SUPPLIER"), notification_controller_1.NotificationController.getNotificationStats);
// Mark as read
router.patch("/mark-read", (0, auth_1.default)("ADMIN", "VENDOR", "SUPPLIER"), (0, validateRequest_1.default)(notification_constant_1.markAsReadSchema), notification_controller_1.NotificationController.markAsRead);
// Delete notifications
router.delete("/", (0, auth_1.default)("ADMIN", "VENDOR", "SUPPLIER"), notification_controller_1.NotificationController.deleteNotifications);
// Get unread count
router.get("/unread-count", (0, auth_1.default)("ADMIN", "VENDOR", "SUPPLIER"), notification_controller_1.NotificationController.getUnreadCount);
// Clear all notifications
router.delete("/clear-all", (0, auth_1.default)("ADMIN", "VENDOR", "SUPPLIER"), notification_controller_1.NotificationController.clearAllNotifications);
router.post("/create", (0, auth_1.default)("ADMIN", "VENDOR", "SUPPLIER"), (0, planLimitMiddleware_1.checkUsage)('notificationsSend', 1), notification_controller_1.NotificationController.createNotification);
router.get('/targets', (0, auth_1.default)(client_1.UserRole.ADMIN, client_1.UserRole.VENDOR, client_1.UserRole.SUPPLIER), notification_controller_1.NotificationController.getTargetUsers);
exports.NotificationRoutes = router;
