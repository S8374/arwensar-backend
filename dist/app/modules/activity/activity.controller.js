"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActivityLogController = void 0;
const activity_service_1 = require("./activity.service");
const ApiError_1 = __importDefault(require("../../../error/ApiError"));
const http_status_1 = __importDefault(require("http-status"));
const catchAsync_1 = __importDefault(require("../../shared/catchAsync"));
const sendResponse_1 = __importDefault(require("../../shared/sendResponse"));
exports.ActivityLogController = {
    // Get current user's activity
    getMyActivity: (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const userId = req.user.userId;
        const pageValue = req.query.page;
        const pageStr = Array.isArray(pageValue) ? pageValue[0] : pageValue;
        const page = parseInt(pageStr || '1', 10) || 1;
        const limitValue = req.query.limit;
        const limitStr = Array.isArray(limitValue) ? limitValue[0] : limitValue;
        const limit = parseInt(limitStr || '20', 10) || 20;
        const actionValue = req.query.action;
        const action = Array.isArray(actionValue) ? actionValue[0] : actionValue;
        const result = yield activity_service_1.ActivityLogService.getUserActivity(userId, page, limit, action);
        (0, sendResponse_1.default)(res, {
            success: true,
            statusCode: 200,
            message: "Your activity logs retrieved successfully",
            data: result.data,
            meta: result.meta,
        });
    })),
    // Admin: Get recent activity across all users
    getRecentActivity: (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        if (((_a = req.user) === null || _a === void 0 ? void 0 : _a.role) !== "ADMIN") {
            throw new ApiError_1.default(http_status_1.default.FORBIDDEN, "Only admins can view global activity");
        }
        const limitValue = req.query.limit;
        const limitStr = Array.isArray(limitValue) ? limitValue[0] : limitValue;
        const limit = parseInt(limitStr || '50', 10) || 50;
        const logs = yield activity_service_1.ActivityLogService.getRecentActivity(limit);
        (0, sendResponse_1.default)(res, {
            success: true,
            statusCode: 200,
            message: "Recent activity retrieved",
            data: logs,
        });
    })),
    getActivityByUserId: (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { userId } = req.params; // ← userId from URL param
        const pageValue = req.query.page;
        const pageStr = Array.isArray(pageValue) ? pageValue[0] : pageValue;
        const page = parseInt(pageStr || '1', 10) || 1;
        const limitValue = req.query.limit;
        const limitStr = Array.isArray(limitValue) ? limitValue[0] : limitValue;
        const limit = parseInt(limitStr || '20', 10) || 20;
        const actionValue = req.query.action;
        const action = Array.isArray(actionValue) ? actionValue[0] : actionValue;
        const result = yield activity_service_1.ActivityLogService.getActivityByUserId(userId, { id: req.user.userId, role: req.user.role }, page, limit, action);
        (0, sendResponse_1.default)(res, {
            success: true,
            statusCode: 200,
            message: "Activity logs retrieved successfully",
            data: result.data,
            meta: result.meta,
        });
    })),
};
