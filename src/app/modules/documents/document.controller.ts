// src/modules/document/document.controller.ts
import { Request, Response } from "express";
import sendResponse from "../../shared/sendResponse";
import httpStatus from "http-status";
import { DocumentService } from "./document.service";
import { prisma } from "../../shared/prisma";
import catchAsync from "../../shared/catchAsync";
import ApiError from "../../../error/ApiError";

const uploadDocument = catchAsync(async (req: Request, res: Response) => {
    console.log("Request Body:", req.body);
    console.log("User Info:", req.user);
    const userId = req.user?.userId;

    if (!userId) {
        return sendResponse(res, {
            statusCode: httpStatus.UNAUTHORIZED,
            success: false,
            message: "User ID not found",
            data: null
        });
    }

    // Get file URL from request (assuming file upload middleware handled it)
    const fileUrl = req.body.fileUrl;
    const fileSize = req.body.fileSize;
    const mimeType = req.body.mimeType;

    if (!fileUrl) {
        return sendResponse(res, {
            statusCode: httpStatus.BAD_REQUEST,
            success: false,
            message: "File URL is required",
            data: null
        });
    }

    const document = await DocumentService.uploadDocument(
        userId,
        fileUrl,
        fileSize,
        mimeType,
        req.body
    );

    sendResponse(res, {
        statusCode: httpStatus.CREATED,
        success: true,
        message: "Document uploaded successfully",
        data: document
    });
});

const getDocuments = catchAsync(async (req: Request, res: Response) => {
    const userId = req.user?.userId;

    if (!userId) {
        return sendResponse(res, {
            statusCode: httpStatus.UNAUTHORIZED,
            success: false,
            message: "User ID not found",
            data: null
        });
    }

    const filters = {
        supplierId: req.query.supplierId as string,
        vendorId: req.query.vendorId as string,
        category: req.query.category as string,
        type: req.query.type as string,
        status: req.query.status as any,
        search: req.query.search as string,
        expiredOnly: req.query.expiredOnly === 'true',
        expiringSoon: req.query.expiringSoon === 'true',
        uploadedById: req.query.uploadedById as string
    };

    const result = await DocumentService.getDocuments(userId, filters, req.query);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Documents retrieved successfully",
        data: result.documents,
        meta: result.meta
    });
});

const getDocumentById = catchAsync(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    const { documentId } = req.params;
    console.log("userId", userId);
    console.log("documentId", documentId);
    if (!userId) {
        return sendResponse(res, {
            statusCode: httpStatus.UNAUTHORIZED,
            success: false,
            message: "User ID not found",
            data: null
        });
    }

    const document = await DocumentService.getDocumentById(documentId, userId);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Document retrieved successfully",
        data: document
    });
});

const updateDocument = catchAsync(async (req: Request, res: Response) => {
    console.log("Update Document Body:", req.body);
    console.log("User Info:", req.user);
    const userId = req.user?.userId;
    const { documentId } = req.params;

    if (!userId) {
        return sendResponse(res, {
            statusCode: httpStatus.UNAUTHORIZED,
            success: false,
            message: "User ID not found",
            data: null
        });
    }

    const document = await DocumentService.updateDocument(documentId, userId, req.body);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Document updated successfully",
        data: document
    });
});

const reviewDocument = catchAsync(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    const { documentId } = req.params;
    console.log("req", req.body);
    console.log("userId", userId);
    console.log("documentId", documentId)
    if (!userId) {
        return sendResponse(res, {
            statusCode: httpStatus.UNAUTHORIZED,
            success: false,
            message: "User ID not found",
            data: null
        });
    }

    const document = await DocumentService.reviewDocument(documentId, userId, req.body);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: `Document ${req.body.status} successfully`,
        data: document
    });
});

const deleteDocument = catchAsync(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    const { documentId } = req.params;

    if (!userId) {
        return sendResponse(res, {
            statusCode: httpStatus.UNAUTHORIZED,
            success: false,
            message: "User ID not found",
            data: null
        });
    }

    const result = await DocumentService.deleteDocument(documentId, userId);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: result.message,
        data: null
    });
});

const getDocumentStatistics = catchAsync(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    const { supplierId } = req.query;

    if (!userId) {
        return sendResponse(res, {
            statusCode: httpStatus.UNAUTHORIZED,
            success: false,
            message: "User ID not found",
            data: null
        });
    }

    const stats = await DocumentService.getDocumentStatistics(
        userId,
        supplierId as string | undefined
    );

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Document statistics retrieved successfully",
        data: stats
    });
});

const getDocumentCategories = catchAsync(async (req: Request, res: Response) => {
    const categories = await DocumentService.getDocumentCategories();

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Document categories retrieved successfully",
        data: categories
    });
});

const getExpiringDocuments = catchAsync(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    const days = req.query.days ? parseInt(req.query.days as string) : 30;

    if (!userId) {
        return sendResponse(res, {
            statusCode: httpStatus.UNAUTHORIZED,
            success: false,
            message: "User ID not found",
            data: null
        });
    }

    const documents = await DocumentService.getExpiringDocuments(userId, days);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Expiring documents retrieved successfully",
        data: documents
    });
});

const bulkUpdateDocumentStatus = catchAsync(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    const { documentIds, status, reviewNotes } = req.body;

    if (!userId) {
        return sendResponse(res, {
            statusCode: httpStatus.UNAUTHORIZED,
            success: false,
            message: "User ID not found",
            data: null
        });
    }

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
        return sendResponse(res, {
            statusCode: httpStatus.BAD_REQUEST,
            success: false,
            message: "Document IDs are required",
            data: null
        });
    }

    if (!status) {
        return sendResponse(res, {
            statusCode: httpStatus.BAD_REQUEST,
            success: false,
            message: "Status is required",
            data: null
        });
    }

    const result = await DocumentService.bulkUpdateDocumentStatus(
        userId,
        documentIds,
        status,
        reviewNotes
    );

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: result.message,
        data: {
            count: result.count
        }
    });
});

const checkExpiredDocuments = catchAsync(async (req: Request, res: Response) => {
    // This endpoint can be called by admins or via cron job
    const userId = req.user?.userId;

    // Optional authentication for cron job calls
    if (userId) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { role: true }
        });

        if (!userId) {
            return sendResponse(res, {
                statusCode: httpStatus.FORBIDDEN,
                success: false,
                message: "User not found",
                data: null
            });
        }
    }

    const result = await DocumentService.checkExpiredDocuments();

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: result.message,
        data: {
            count: result.count
        }
    });
});
// document.controller.ts
const getMyDocuments = catchAsync(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
        throw new ApiError(httpStatus.UNAUTHORIZED, "Unauthorized");
    }

    const documents = await DocumentService.getMyDocuments(userId);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Your documents retrieved successfully",
        data: documents,
    });
});
export const DocumentController = {
    uploadDocument,
    getDocuments,
    getDocumentById,
    updateDocument,
    reviewDocument,
    deleteDocument,
    getDocumentStatistics,
    getDocumentCategories,
    getExpiringDocuments,
    bulkUpdateDocumentStatus,
    checkExpiredDocuments,
    getMyDocuments
};