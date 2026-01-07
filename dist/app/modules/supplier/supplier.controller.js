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
exports.SupplierController = void 0;
const sendResponse_1 = __importDefault(require("../../shared/sendResponse"));
const http_status_1 = __importDefault(require("http-status"));
const supplier_service_1 = require("./supplier.service");
const catchAsync_1 = __importDefault(require("../../shared/catchAsync"));
const getDashboardStats = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const supplierId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.supplierId;
    if (!supplierId) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.UNAUTHORIZED,
            success: false,
            message: "Supplier ID not found",
            data: null
        });
    }
    const stats = yield supplier_service_1.SupplierService.getDashboardStats(supplierId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Dashboard stats retrieved successfully",
        data: stats
    });
}));
const getSupplierProfile = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const supplierId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.supplierId;
    if (!supplierId) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.UNAUTHORIZED,
            success: false,
            message: "Supplier ID not found",
            data: null
        });
    }
    const profile = yield supplier_service_1.SupplierService.getSupplierProfile(supplierId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Profile retrieved successfully",
        data: profile
    });
}));
const updateSupplierProfile = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    console.log("Req user for update supplier", req.user);
    // const supplierId = req.user?.supplierId;
    const supplierId = (_a = req.params) === null || _a === void 0 ? void 0 : _a.supplierId;
    if (!supplierId) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.UNAUTHORIZED,
            success: false,
            message: "Supplier ID not found",
            data: null
        });
    }
    const profile = yield supplier_service_1.SupplierService.updateSupplierProfile(supplierId, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Profile updated successfully",
        data: profile
    });
}));
const getAssessments = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const supplierId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.supplierId;
    if (!supplierId) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.UNAUTHORIZED,
            success: false,
            message: "Supplier ID not found",
            data: null
        });
    }
    const assessments = yield supplier_service_1.SupplierService.getAssessments(supplierId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Assessments retrieved successfully",
        data: assessments
    });
}));
const startAssessment = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    console.log("Starting assessment", req.params, req.user);
    const supplierId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    const { assessmentId } = req.params;
    console.log("Assessment ID:", assessmentId, "Supplier ID:", supplierId);
    if (!supplierId) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.UNAUTHORIZED,
            success: false,
            message: "Supplier ID not found",
            data: null
        });
    }
    const result = yield supplier_service_1.SupplierService.startAssessment(assessmentId, supplierId, ((_b = req.user) === null || _b === void 0 ? void 0 : _b.userId) || "");
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Assessment started successfully",
        data: result
    });
}));
const saveAnswer = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { submissionId, questionId } = req.params;
    const result = yield supplier_service_1.SupplierService.saveAnswer(submissionId, questionId, req.body, ((_a = req.user) === null || _a === void 0 ? void 0 : _a.userId) || "");
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Answer saved successfully",
        data: result
    });
}));
const submitAssessment = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { submissionId } = req.params;
    const result = yield supplier_service_1.SupplierService.submitAssessment(submissionId, ((_a = req.user) === null || _a === void 0 ? void 0 : _a.userId) || "");
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Assessment submitted successfully",
        data: result
    });
}));
const verifyInvitation = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { token } = req.params;
    const result = yield supplier_service_1.SupplierService.verifyInvitationToken(token);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Invitation verified successfully",
        data: result
    });
}));
const completeSupplierRegistration = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield supplier_service_1.SupplierService.completeSupplierRegistration(req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Supplier registration completed successfully",
        data: result
    });
}));
const getSupplierContractStatus = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    // Use supplierId from token
    const supplierId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.supplierId;
    if (!supplierId) {
        return (0, sendResponse_1.default)(res, {
            statusCode: http_status_1.default.UNAUTHORIZED,
            success: false,
            message: "Supplier ID missing in token",
            data: undefined
        });
    }
    const data = yield supplier_service_1.SupplierService.getSupplierContractStatus(supplierId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Supplier contract status fetched successfully",
        data,
    });
}));
exports.SupplierController = {
    getDashboardStats,
    getSupplierProfile,
    updateSupplierProfile,
    getAssessments,
    startAssessment,
    saveAnswer,
    submitAssessment,
    verifyInvitation,
    completeSupplierRegistration,
    getSupplierContractStatus
};
