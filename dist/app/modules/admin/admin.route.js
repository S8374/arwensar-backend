"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminRoutes = void 0;
// src/modules/admin/admin.route.ts
const express_1 = __importDefault(require("express"));
const admin_controller_1 = require("./admin.controller");
const admin_constant_1 = require("./admin.constant");
const client_1 = require("@prisma/client");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const router = express_1.default.Router();
// Dashboard
router.get("/dashboard", (0, auth_1.default)(client_1.UserRole.ADMIN), admin_controller_1.AdminController.getDashboardStats);
// Plans Management
router.post("/plans", (0, auth_1.default)("ADMIN"), admin_controller_1.AdminController.createPlan);
router.patch("/plans/:planId", (0, auth_1.default)("ADMIN"), admin_controller_1.AdminController.updatePlan);
router.delete("/plans/:planId", (0, auth_1.default)("ADMIN"), admin_controller_1.AdminController.deletePlan);
router.get("/plans", admin_controller_1.AdminController.getAllPlans);
router.get("/plans/admin", (0, auth_1.default)("ADMIN"), admin_controller_1.AdminController.getAllPlansAdmin);
router.get("/plans/:planId", (0, auth_1.default)("ADMIN", "SUPPLIER", "VENDOR"), admin_controller_1.AdminController.getPlanById);
// Assessments Management
router.post("/assessments", (0, auth_1.default)("ADMIN"), (0, validateRequest_1.default)(admin_constant_1.createAssessmentSchema), admin_controller_1.AdminController.createAssessment);
router.get("/assessments", (0, auth_1.default)("ADMIN"), admin_controller_1.AdminController.getAllAssessments);
router.patch('/assessments/:assessmentId', admin_controller_1.AdminController.updateAssessment);
router.delete('/assessments/:assessmentId', admin_controller_1.AdminController.deleteAssessment);
// User Management
router.get("/vendors", (0, auth_1.default)("ADMIN"), admin_controller_1.AdminController.getAllVendors);
router.get("/suppliers", (0, auth_1.default)("ADMIN"), admin_controller_1.AdminController.getAllSuppliers);
router.delete("/suppliers/:id", (0, auth_1.default)("ADMIN", "VENDOR"), admin_controller_1.AdminController.deleteSupplier);
// Reports
router.post("/reports/:type", (0, auth_1.default)("ADMIN", "VENDOR"), admin_controller_1.AdminController.generateReport);
// ==================  Users =============
router.get("/all-users", (0, auth_1.default)("ADMIN"), admin_controller_1.AdminController.getAllUsers);
router.patch("/user/:userId", (0, auth_1.default)("ADMIN"), admin_controller_1.AdminController.updateUsers);
router.delete("/user/:userId", (0, auth_1.default)("ADMIN"), admin_controller_1.AdminController.deleteUser);
router.patch("/user/:userId/block", (0, auth_1.default)("ADMIN"), admin_controller_1.AdminController.toggleUserBlock);
router.delete("/users/permanent/:userId", (0, auth_1.default)("ADMIN"), admin_controller_1.AdminController.permanentDeleteUser);
router.post("/users/bulk-delete", (0, auth_1.default)("ADMIN"), admin_controller_1.AdminController.bulkDeleteUsers);
router.get("/:userId", (0, auth_1.default)("ADMIN"), admin_controller_1.AdminController.getUserById);
router.post("/users/bulk-update", (0, auth_1.default)("ADMIN"), admin_controller_1.AdminController.bulkUpdateUsers);
router.post("/users/bulk-block", (0, auth_1.default)("ADMIN"), admin_controller_1.AdminController.bulkBlockUsers);
router.post("/users/bulk-verify", (0, auth_1.default)("ADMIN"), admin_controller_1.AdminController.bulkVerifyUsers);
router.post("/users/deactivate-inactive", (0, auth_1.default)("ADMIN"), admin_controller_1.AdminController.deactivateInactiveUsers);
router.post("/users/export-csv", (0, auth_1.default)("ADMIN"), admin_controller_1.AdminController.exportUsersToCSV);
exports.AdminRoutes = router;
