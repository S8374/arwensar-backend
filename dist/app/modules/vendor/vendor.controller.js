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
exports.VendorController = exports.createSupplier = void 0;
const sendResponse_1 = __importDefault(require("../../shared/sendResponse"));
const http_status_1 = __importDefault(require("http-status"));
const vendor_service_1 = require("./vendor.service");
const catchAsync_1 = __importDefault(require("../../shared/catchAsync"));
const supplier_service_1 = require("../supplier/supplier.service");
const usage_service_1 = require("../usage/usage.service");
const ApiError_1 = __importDefault(require("../../../error/ApiError"));
const getDashboardStats = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const vendorId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.vendorId;
    if (!vendorId) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.UNAUTHORIZED,
            success: false,
            message: "Vendor ID not found",
            data: null
        });
    }
    const stats = yield vendor_service_1.VendorService.getVendorDashboardStats(vendorId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Dashboard stats retrieved successfully",
        data: stats
    });
}));
const getVendorProfile = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const vendorId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.vendorId;
    if (!vendorId) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.UNAUTHORIZED,
            success: false,
            message: "Vendor ID not found",
            data: null
        });
    }
    const profile = yield vendor_service_1.VendorService.getVendorProfile(vendorId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Profile retrieved successfully",
        data: profile
    });
}));
const updateVendorProfile = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const vendorId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.vendorId;
    if (!vendorId) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.UNAUTHORIZED,
            success: false,
            message: "Vendor ID not found",
            data: null
        });
    }
    const profile = yield vendor_service_1.VendorService.updateVendorProfile(vendorId, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Profile updated successfully",
        data: profile
    });
}));
const getSuppliers = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const vendorId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.vendorId;
    if (!vendorId) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.UNAUTHORIZED,
            success: false,
            message: "Vendor ID not found",
            data: null
        });
    }
    const suppliers = yield vendor_service_1.VendorService.getSuppliers(vendorId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Suppliers retrieved successfully",
        data: suppliers
    });
}));
const getSupplierById = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const vendorId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.vendorId;
    const { supplierId } = req.params;
    if (!vendorId) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.UNAUTHORIZED,
            success: false,
            message: "Vendor ID not found",
            data: null
        });
    }
    const supplier = yield vendor_service_1.VendorService.getSupplierById(vendorId, supplierId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Supplier details retrieved successfully",
        data: supplier
    });
}));
const reviewAssessment = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const vendorId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.vendorId;
    const { submissionId } = req.params;
    if (!vendorId) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.UNAUTHORIZED,
            success: false,
            message: "Vendor ID not found",
            data: null
        });
    }
    const result = yield vendor_service_1.VendorService.reviewAssessment(vendorId, submissionId, Object.assign(Object.assign({}, req.body), { reviewedBy: (_b = req.user) === null || _b === void 0 ? void 0 : _b.userId }));
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Assessment reviewed successfully",
        data: result
    });
}));
const reviewEvidence = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const vendorId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.vendorId;
    const { answerId } = req.params;
    if (!vendorId) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.UNAUTHORIZED,
            success: false,
            message: "Vendor ID not found",
            data: null
        });
    }
    const result = yield vendor_service_1.VendorService.reviewEvidence(vendorId, answerId, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Evidence reviewed successfully",
        data: result
    });
}));
exports.createSupplier = (0, catchAsync_1.default)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    // Vendor ID usually comes from auth middleware (JWT)
    const vendorId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.vendorId;
    if (!vendorId) {
        return next(new Error("Vendor ID not found in request user"));
    }
    const result = yield supplier_service_1.SupplierService.createSupplier(vendorId, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.CREATED,
        success: true,
        message: result.message,
        data: {
            supplier: result.supplier,
            invitationSent: result.invitationSent,
        },
    });
}));
const getSingleSupplierProgress = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const vendorId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.vendorId;
    const { supplierId } = req.params;
    if (!vendorId) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.UNAUTHORIZED,
            success: false,
            message: "Vendor ID not found",
            data: null
        });
    }
    const progress = yield vendor_service_1.VendorService.getSingleSupplierProgress(supplierId, vendorId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Supplier progress retrieved successfully",
        data: progress
    });
}));
// src/app/modules/vendor/vendor.controller.ts
const bulkImportSuppliers = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    console.log("Processing bulk import request");
    const vendorId = req.user.vendorId;
    const userId = req.user.userId;
    if (!vendorId && !userId) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.BAD_REQUEST,
            success: false,
            message: "Vendor ID not found in token",
            data: null,
        });
    }
    // Validate request body
    if (!req.body.suppliers || !Array.isArray(req.body.suppliers)) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.BAD_REQUEST,
            success: false,
            message: "Invalid request body. Expected 'suppliers' array.",
            data: null,
        });
    }
    // Set bulk count for usage tracking middleware
    // (req as any).bulkCount = req.body.suppliers.length;
    // Check capacity before processing
    const capacityCheck = yield usage_service_1.usageService.checkBulkSupplierLimit(userId, req.body.suppliers.length);
    if (!capacityCheck.canProceed) {
        throw new ApiError_1.default(http_status_1.default.PAYMENT_REQUIRED, capacityCheck.message);
    }
    // Decrement usage for all suppliers
    yield usage_service_1.usageService.decrementUsage(userId, 'suppliersUsed', req.body.suppliers.length);
    const result = yield vendor_service_1.VendorService.bulkImportSuppliers(vendorId, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: `Bulk import completed. ${result.successful} added, ${result.failed} : ''}`,
        data: result,
    });
}));
const resendInvitation = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const vendorId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.vendorId;
    const { supplierId } = req.params;
    if (!vendorId) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.UNAUTHORIZED,
            success: false,
            message: "Vendor ID not found",
            data: null
        });
    }
    const result = yield vendor_service_1.VendorService.resendInvitation(supplierId, vendorId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: result.message,
        data: {
            supplier: result.supplier,
            invitationSent: result.invitationSent
        }
    });
}));
const getVendorSupplierContracts = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    // Use vendorId from token
    const vendorId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.vendorId;
    if (!vendorId) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.UNAUTHORIZED,
            success: false,
            message: "Vendor ID missing in token",
            data: undefined
        });
    }
    const data = yield vendor_service_1.VendorService.getVendorSupplierContracts(vendorId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Supplier contracts fetched successfully",
        data,
    });
}));
exports.VendorController = {
    getDashboardStats,
    getVendorProfile,
    updateVendorProfile,
    getSuppliers,
    getSupplierById,
    reviewAssessment,
    reviewEvidence,
    createSupplier: exports.createSupplier,
    getSingleSupplierProgress,
    bulkImportSuppliers,
    resendInvitation,
    getVendorSupplierContracts
};
