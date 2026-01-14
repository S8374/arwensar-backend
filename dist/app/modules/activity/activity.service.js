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
exports.ActivityLogService = void 0;
// src/modules/activity/activity.service.ts
const ApiError_1 = __importDefault(require("../../../error/ApiError"));
const prisma_1 = require("../../shared/prisma");
const http_status_1 = __importDefault(require("http-status"));
exports.ActivityLogService = {
    getUserActivity(userId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, page = 1, limit = 20, p0) {
            const skip = (page - 1) * limit;
            const where = { userId };
            const [logs, total] = yield Promise.all([
                prisma_1.prisma.activityLog.findMany({
                    where,
                    orderBy: { createdAt: "desc" },
                    skip,
                    take: limit,
                    select: {
                        id: true,
                        action: true,
                        entityType: true,
                        entityId: true,
                        ipAddress: true,
                        userAgent: true,
                        details: true,
                        createdAt: true,
                    },
                }),
                prisma_1.prisma.activityLog.count({ where }),
            ]);
            return {
                data: logs,
                meta: {
                    total,
                    page,
                    limit,
                    totalPages: Math.ceil(total / limit),
                    hasNext: page * limit < total,
                    hasPrev: page > 1,
                },
            };
        });
    },
    getRecentActivity() {
        return __awaiter(this, arguments, void 0, function* (limit = 50) {
            return yield prisma_1.prisma.activityLog.findMany({
                take: limit,
                orderBy: { createdAt: "desc" },
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                            role: true,
                        },
                    },
                },
            });
        });
    },
    getActivityByUserId(targetUserId_1, requestingUser_1) {
        return __awaiter(this, arguments, void 0, function* (targetUserId, requestingUser, page = 1, limit = 20, action) {
            // Permission check: User can view their own logs, or ADMIN can view anyone's
            if (requestingUser.id !== targetUserId && requestingUser.role !== "ADMIN") {
                throw new ApiError_1.default(http_status_1.default.FORBIDDEN, "You can only view your own activity logs");
            }
            const skip = (page - 1) * limit;
            const where = { userId: targetUserId };
            if (action) {
                where.action = action.toUpperCase();
            }
            const [logs, total] = yield Promise.all([
                prisma_1.prisma.activityLog.findMany({
                    where,
                    orderBy: { createdAt: "desc" },
                    skip,
                    take: limit,
                    select: {
                        id: true,
                        action: true,
                        entityType: true,
                        entityId: true,
                        ipAddress: true,
                        userAgent: true,
                        details: true,
                        createdAt: true,
                    },
                }),
                prisma_1.prisma.activityLog.count({ where }),
            ]);
            return {
                data: logs,
                meta: {
                    total,
                    page,
                    limit,
                    totalPages: Math.ceil(total / limit),
                    hasNext: page * limit < total,
                    hasPrev: page > 1,
                },
            };
        });
    },
};
