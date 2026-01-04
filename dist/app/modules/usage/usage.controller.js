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
exports.UsageController = void 0;
const http_status_1 = __importDefault(require("http-status"));
const usage_service_1 = require("./usage.service");
const ApiError_1 = __importDefault(require("../../../error/ApiError"));
const sendResponse_1 = __importDefault(require("../../shared/sendResponse"));
const catchAsync_1 = __importDefault(require("../../shared/catchAsync"));
const getCurrentUsage = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // Get userId from request (from auth middleware)
    const user = req.user;
    if (!user) {
        throw new ApiError_1.default(http_status_1.default.UNAUTHORIZED, 'User not authenticated');
    }
    const userId = user.userId;
    const usage = yield usage_service_1.usageService.getRemainingLimits(userId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Current usage retrieved successfully',
        data: usage
    });
}));
const decrementUsage = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    if (!user) {
        throw new ApiError_1.default(http_status_1.default.UNAUTHORIZED, 'User not authenticated');
    }
    const userId = user.userId;
    const { field, count = 1 } = req.body;
    if (!field) {
        throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, 'Field is required');
    }
    const result = yield usage_service_1.usageService.decrementUsage(userId, field, count);
    (0, sendResponse_1.default)(res, {
        statusCode: result.success ? http_status_1.default.OK : http_status_1.default.PAYMENT_REQUIRED,
        success: result.success,
        message: result.success
            ? 'Usage decremented successfully'
            : 'Limit exceeded',
        data: {
            remaining: result.remaining,
            field,
            count
        }
    });
}));
const checkUsage = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    if (!user) {
        throw new ApiError_1.default(http_status_1.default.UNAUTHORIZED, 'User not authenticated');
    }
    const userId = user.userId;
    const { field, count = 1 } = req.body;
    if (!field) {
        throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, 'Field is required');
    }
    const result = yield usage_service_1.usageService.checkUsage(userId, field, count);
    (0, sendResponse_1.default)(res, {
        statusCode: result.canProceed ? http_status_1.default.OK : http_status_1.default.PAYMENT_REQUIRED,
        success: result.canProceed,
        message: result.message || (result.canProceed ? 'Usage check passed' : 'Usage check failed'),
        data: {
            canProceed: result.canProceed,
            remaining: result.remaining,
            limit: result.limit,
            required: count
        }
    });
}));
const resetUsage = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // Only for ADMIN
    const user = req.user;
    if (!user || user.role !== 'ADMIN') {
        throw new ApiError_1.default(http_status_1.default.FORBIDDEN, 'Admin access required');
    }
    const { userId, subscriptionId } = req.body;
    if (!userId && !subscriptionId) {
        throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, 'userId or subscriptionId is required');
    }
    let result;
    if (subscriptionId) {
        // Reset by subscriptionId
        yield usage_service_1.usageService.refreshMonthlyUsage(subscriptionId);
        result = { message: 'Usage reset for subscription' };
    }
    else {
        // Reset by userId
        yield usage_service_1.usageService.resetExpiredSubscription(userId);
        result = { message: 'Usage reset for user' };
    }
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Usage reset successfully',
        data: result
    });
}));
exports.UsageController = {
    getCurrentUsage,
    decrementUsage,
    checkUsage,
    resetUsage
};
