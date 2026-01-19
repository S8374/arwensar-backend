// src/modules/activity/activity.controller.ts
import { Request, Response } from "express";

import { ActivityLogService } from "./activity.service";
import ApiError from "../../../error/ApiError";
import httpStatus from "http-status";
import catchAsync from "../../shared/catchAsync";
import sendResponse from "../../shared/sendResponse";

export const ActivityLogController = {
    // Get current user's activity
    getMyActivity: catchAsync(async (req: Request, res: Response) => {
        const userId = req.user!.userId;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const action = req.query.action as string | undefined;

        const result = await ActivityLogService.getUserActivity(userId as string, page, limit, action);

        sendResponse(res, {
            success: true,
            statusCode: 200,
            message: "Your activity logs retrieved successfully",
            data: result.data,
            meta: result.meta,
        });
    }),

    // Admin: Get recent activity across all users
    getRecentActivity: catchAsync(async (req: Request, res: Response) => {
        if (req.user?.role !== "ADMIN") {
            throw new ApiError(httpStatus.FORBIDDEN, "Only admins can view global activity");
        }

        const limit = parseInt(req.query.limit as string) || 50;
        const logs = await ActivityLogService.getRecentActivity(limit);

        sendResponse(res, {
            success: true,
            statusCode: 200,
            message: "Recent activity retrieved",
            data: logs,
        });
    }),
    getActivityByUserId: catchAsync(async (req, res) => {
        const { userId } = req.params; // ← userId from URL param
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const action = req.query.action as string | undefined;

        const result = await ActivityLogService.getActivityByUserId(
            userId as string,
            { id: req.user!.userId, role: req.user!.role },
            page,
            limit,
            action
        );

        sendResponse(res, {
            success: true,
            statusCode: 200,
            message: "Activity logs retrieved successfully",
            data: result.data,
            meta: result.meta,
        });
    }),
};