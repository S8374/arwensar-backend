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
exports.checkUsage = void 0;
const usage_service_1 = require("../modules/usage/usage.service");
const express_async_handler_1 = __importDefault(require("express-async-handler"));
const ApiError_1 = __importDefault(require("../../error/ApiError"));
const http_status_1 = __importDefault(require("http-status"));
const client_1 = require("@prisma/client");
const checkUsage = (field, count = 1) => {
    return (0, express_async_handler_1.default)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
        const userRole = (_b = req.user) === null || _b === void 0 ? void 0 : _b.role;
        if (!userId) {
            return next(new Error('User ID not found in request'));
        }
        // Only apply usage decrement for VENDOR role
        // ADMIN and SUPPLIER roles skip usage tracking
        if (userRole === client_1.UserRole.VENDOR) {
            yield usage_service_1.usageService.decrementMiddleware(userId, field, count);
        }
        else if (userRole === client_1.UserRole.ADMIN) {
            // Admins have unlimited access, skip usage tracking
            console.log(`Admin user ${userId} skipping usage check for ${field}`);
        }
        else if (userRole === client_1.UserRole.SUPPLIER) {
            // Suppliers have different limits, we'll handle them differently
            // For now, they skip VENDOR plan limits
            console.log(`Supplier user ${userId} skipping vendor usage check for ${field}`);
        }
        else {
            throw new ApiError_1.default(http_status_1.default.FORBIDDEN, 'Invalid user role for usage tracking');
        }
        next();
    }));
};
exports.checkUsage = checkUsage;
