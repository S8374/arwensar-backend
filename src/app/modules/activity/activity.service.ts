// src/modules/activity/activity.service.ts
import ApiError from "../../../error/ApiError";
import { prisma } from "../../shared/prisma";
import httpStatus from "http-status";

export const ActivityLogService = {

    async getUserActivity(
        userId: string, page = 1, limit = 20, p0?: string,
    ) {
        const skip = (page - 1) * limit;

        const where: any = { userId };


        const [logs, total] = await Promise.all([
            prisma.activityLog.findMany({
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
            prisma.activityLog.count({ where }),
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
    },

    async getRecentActivity(limit = 50) {
        return await prisma.activityLog.findMany({
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
    },
    async getActivityByUserId(
        targetUserId: string,
        requestingUser: { id: string; role: string },
        page = 1,
        limit = 20,
        action?: string
    ) {
        // Permission check: User can view their own logs, or ADMIN can view anyone's
        if (requestingUser.id !== targetUserId && requestingUser.role !== "ADMIN") {
            throw new ApiError(httpStatus.FORBIDDEN, "You can only view your own activity logs");
        }

        const skip = (page - 1) * limit;

        const where: any = { userId: targetUserId };
        if (action) {
            where.action = action.toUpperCase();
        }

        const [logs, total] = await Promise.all([
            prisma.activityLog.findMany({
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
            prisma.activityLog.count({ where }),
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
    },
};


