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
exports.DocumentController = void 0;
const sendResponse_1 = __importDefault(require("../../shared/sendResponse"));
const http_status_1 = __importDefault(require("http-status"));
const document_service_1 = require("./document.service");
const prisma_1 = require("../../shared/prisma");
const catchAsync_1 = __importDefault(require("../../shared/catchAsync"));
const ApiError_1 = __importDefault(require("../../../error/ApiError"));
const uploadDocument = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    console.log("Request Body:", req.body);
    console.log("User Info:", req.user);
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    if (!userId) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.UNAUTHORIZED,
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
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.BAD_REQUEST,
            success: false,
            message: "File URL is required",
            data: null
        });
    }
    const document = yield document_service_1.DocumentService.uploadDocument(userId, fileUrl, fileSize, mimeType, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.CREATED,
        success: true,
        message: "Document uploaded successfully",
        data: document
    });
}));
const getDocuments = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    if (!userId) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.UNAUTHORIZED,
            success: false,
            message: "User ID not found",
            data: null
        });
    }
    const filters = {
        supplierId: req.query.supplierId,
        vendorId: req.query.vendorId,
        category: req.query.category,
        type: req.query.type,
        status: req.query.status,
        search: req.query.search,
        expiredOnly: req.query.expiredOnly === 'true',
        expiringSoon: req.query.expiringSoon === 'true',
        uploadedById: req.query.uploadedById
    };
    const result = yield document_service_1.DocumentService.getDocuments(userId, filters, req.query);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Documents retrieved successfully",
        data: result.documents,
        meta: result.meta
    });
}));
const getDocumentById = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    const { documentId } = req.params;
    console.log("userId", userId);
    console.log("documentId", documentId);
    if (!userId) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.UNAUTHORIZED,
            success: false,
            message: "User ID not found",
            data: null
        });
    }
    const document = yield document_service_1.DocumentService.getDocumentById(documentId, userId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Document retrieved successfully",
        data: document
    });
}));
const updateDocument = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    console.log("Update Document Body:", req.body);
    console.log("User Info:", req.user);
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    const { documentId } = req.params;
    if (!userId) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.UNAUTHORIZED,
            success: false,
            message: "User ID not found",
            data: null
        });
    }
    const document = yield document_service_1.DocumentService.updateDocument(documentId, userId, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Document updated successfully",
        data: document
    });
}));
const reviewDocument = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    const { documentId } = req.params;
    console.log("req", req.body);
    console.log("userId", userId);
    console.log("documentId", documentId);
    if (!userId) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.UNAUTHORIZED,
            success: false,
            message: "User ID not found",
            data: null
        });
    }
    const document = yield document_service_1.DocumentService.reviewDocument(documentId, userId, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: `Document ${req.body.status} successfully`,
        data: document
    });
}));
const deleteDocument = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    const { documentId } = req.params;
    if (!userId) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.UNAUTHORIZED,
            success: false,
            message: "User ID not found",
            data: null
        });
    }
    const result = yield document_service_1.DocumentService.deleteDocument(documentId, userId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: result.message,
        data: null
    });
}));
const getDocumentStatistics = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    const { supplierId } = req.query;
    if (!userId) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.UNAUTHORIZED,
            success: false,
            message: "User ID not found",
            data: null
        });
    }
    const stats = yield document_service_1.DocumentService.getDocumentStatistics(userId, supplierId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Document statistics retrieved successfully",
        data: stats
    });
}));
const getDocumentCategories = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const categories = yield document_service_1.DocumentService.getDocumentCategories();
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Document categories retrieved successfully",
        data: categories
    });
}));
const getExpiringDocuments = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    const days = req.query.days ? parseInt(req.query.days) : 30;
    if (!userId) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.UNAUTHORIZED,
            success: false,
            message: "User ID not found",
            data: null
        });
    }
    const documents = yield document_service_1.DocumentService.getExpiringDocuments(userId, days);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Expiring documents retrieved successfully",
        data: documents
    });
}));
const bulkUpdateDocumentStatus = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    const { documentIds, status, reviewNotes } = req.body;
    if (!userId) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.UNAUTHORIZED,
            success: false,
            message: "User ID not found",
            data: null
        });
    }
    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.BAD_REQUEST,
            success: false,
            message: "Document IDs are required",
            data: null
        });
    }
    if (!status) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.BAD_REQUEST,
            success: false,
            message: "Status is required",
            data: null
        });
    }
    const result = yield document_service_1.DocumentService.bulkUpdateDocumentStatus(userId, documentIds, status, reviewNotes);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: result.message,
        data: {
            count: result.count
        }
    });
}));
const checkExpiredDocuments = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    // This endpoint can be called by admins or via cron job
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    // Optional authentication for cron job calls
    if (userId) {
        const user = yield prisma_1.prisma.user.findUnique({
            where: { id: userId },
            select: { role: true }
        });
        if (!userId) {
            return (0, sendResponse_1.default)(res, {
                statusCode: http_status_1.default.FORBIDDEN,
                success: false,
                message: "User not found",
                data: null
            });
        }
    }
    const result = yield document_service_1.DocumentService.checkExpiredDocuments();
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: result.message,
        data: {
            count: result.count
        }
    });
}));
// document.controller.ts
const getMyDocuments = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    if (!userId) {
        throw new ApiError_1.default(http_status_1.default.UNAUTHORIZED, "Unauthorized");
    }
    const documents = yield document_service_1.DocumentService.getMyDocuments(userId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Your documents retrieved successfully",
        data: documents,
    });
}));
exports.DocumentController = {
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
