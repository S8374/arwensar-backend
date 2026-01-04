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
exports.AdminController = void 0;
const sendResponse_1 = __importDefault(require("../../shared/sendResponse"));
const http_status_1 = __importDefault(require("http-status"));
const admin_service_1 = require("./admin.service");
const paginationHelper_1 = require("../../helper/paginationHelper");
const catchAsync_1 = __importDefault(require("../../shared/catchAsync"));
const getDashboardStats = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const stats = yield admin_service_1.AdminService.getDashboardStats();
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Dashboard stats retrieved successfully",
        data: stats
    });
}));
const createPlan = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const plan = yield admin_service_1.AdminService.createPlan(Object.assign(Object.assign({}, req.body), { createdBy: (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId }));
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.CREATED,
        success: true,
        message: "Plan created successfully",
        data: plan
    });
}));
const updatePlan = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { planId } = req.params;
    const plan = yield admin_service_1.AdminService.updatePlan(planId, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Plan updated successfully",
        data: plan
    });
}));
const deletePlan = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { planId } = req.params;
    const plan = yield admin_service_1.AdminService.deletePlan(planId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Plan deleted successfully",
        data: plan
    });
}));
const getAllPlans = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const plans = yield admin_service_1.AdminService.getAllPlans();
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Plans retrieved successfully",
        data: plans
    });
}));
const getPlanById = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { planId } = req.params;
    const plan = yield admin_service_1.AdminService.getPlanById(planId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Plan retrieved successfully",
        data: plan
    });
}));
const createAssessment = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const assessment = yield admin_service_1.AdminService.createAssessment(Object.assign(Object.assign({}, req.body), { createdBy: (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId }));
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.CREATED,
        success: true,
        message: "Assessment created successfully",
        data: assessment
    });
}));
const getAllAssessments = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const assessments = yield admin_service_1.AdminService.getAllAssessments();
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Assessments retrieved successfully",
        data: assessments
    });
}));
const getAllVendors = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const pagination = paginationHelper_1.paginationHelper.calculatePagination(req.query);
    const vendors = yield admin_service_1.AdminService.getAllVendors();
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Vendors retrieved successfully",
        data: vendors,
        meta: {
            page: pagination.page,
            limit: pagination.limit,
            total: vendors.length
        }
    });
}));
const getAllSuppliers = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const pagination = paginationHelper_1.paginationHelper.calculatePagination(req.query);
    const suppliers = yield admin_service_1.AdminService.getAllSuppliers();
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Suppliers retrieved successfully",
        data: suppliers,
        meta: {
            page: pagination.page,
            limit: pagination.limit,
            total: suppliers.length
        }
    });
}));
const deleteSupplier = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const deletedSupplier = yield admin_service_1.AdminService.deleteSupplierPermanently(id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Supplier deleted permanently",
        data: deletedSupplier,
    });
}));
const generateReport = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { type } = req.params;
    const { filters } = req.body;
    const report = yield admin_service_1.AdminService.generateSystemReport(type, filters);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Report generated successfully",
        data: report
    });
}));
//============== USER =====================
const getAllUsers = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const pagination = paginationHelper_1.paginationHelper.calculatePagination(req.query);
    const users = yield admin_service_1.AdminService.getAllUsers();
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Vendors retrieved successfully",
        data: users,
        meta: users.meta
    });
}));
const updateUsers = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId } = req.params;
    const data = req.body;
    const updatedUser = yield admin_service_1.AdminService.updateUser(userId, data);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Plan updated successfully",
        data: updatedUser
    });
}));
const deleteUser = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId } = req.params;
    const result = yield admin_service_1.AdminService.deleteUser(userId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Plan deleted successfully",
        data: result
    });
}));
const toggleUserBlock = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId } = req.params;
    const { block, reason } = req.body;
    const updatedUser = yield admin_service_1.AdminService.toggleUserBlock(userId, block, reason);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Plan deleted successfully",
        data: updatedUser
    });
}));
const bulkDeleteUsers = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userIds } = req.body;
    if (!userIds || userIds.length === 0) {
        return res.status(http_status_1.default.BAD_REQUEST).json({
            success: false,
            message: "No user IDs provided"
        });
    }
    const result = yield admin_service_1.AdminService.bulkDeleteUsers(userIds);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Plan deleted successfully",
        data: result
    });
}));
const bulkUpdateUsers = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userIds, data } = req.body;
    const result = yield admin_service_1.AdminService.bulkUpdateUsers(userIds, data);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Users updated successfully",
        data: result
    });
}));
const bulkBlockUsers = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userIds, block, reason } = req.body;
    const result = yield admin_service_1.AdminService.bulkBlockUsers(userIds, block, reason);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: `Users ${block ? 'blocked' : 'unblocked'} successfully`,
        data: result
    });
}));
const bulkVerifyUsers = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userIds } = req.body;
    const result = yield admin_service_1.AdminService.bulkVerifyUsers(userIds);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Users verified successfully",
        data: result
    });
}));
const deactivateInactiveUsers = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { inactiveDays } = req.body;
    const result = yield admin_service_1.AdminService.deactivateInactiveUsers(inactiveDays || 90);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "Inactive users deactivated successfully",
        data: result
    });
}));
const exportUsersToCSV = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const filters = req.body.filters || {};
    const result = yield admin_service_1.AdminService.exportUsersToCSV(filters);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="users.csv"');
    res.send(result.csvData);
}));
// Permanently delete a user
const permanentDeleteUser = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId } = req.params;
    const result = yield admin_service_1.AdminService.permanentDeleteUser(userId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: "User permanently deleted",
        data: result
    });
}));
exports.AdminController = {
    getDashboardStats,
    createPlan,
    updatePlan,
    deletePlan,
    getAllPlans,
    getPlanById,
    createAssessment,
    getAllAssessments,
    getAllVendors,
    getAllSuppliers,
    generateReport,
    getAllUsers,
    updateUsers,
    deleteUser,
    toggleUserBlock,
    bulkDeleteUsers,
    bulkBlockUsers,
    bulkVerifyUsers,
    deactivateInactiveUsers,
    exportUsersToCSV,
    bulkUpdateUsers,
    permanentDeleteUser,
    deleteSupplier
};
