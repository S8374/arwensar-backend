"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activityRoutes = void 0;
const auth_1 = __importDefault(require("../../middlewares/auth"));
const activity_controller_1 = require("./activity.controller");
const express_1 = __importDefault(require("express"));
const router = express_1.default.Router();
router.get("/me", (0, auth_1.default)("VENDOR", "SUPPLIER", "ADMIN"), activity_controller_1.ActivityLogController.getMyActivity);
router.get("/recent", (0, auth_1.default)("ADMIN"), activity_controller_1.ActivityLogController.getRecentActivity);
router.get("/user/:userId", (0, auth_1.default)("VENDOR", "SUPPLIER", "ADMIN"), // any logged-in user
activity_controller_1.ActivityLogController.getActivityByUserId);
exports.activityRoutes = router;
