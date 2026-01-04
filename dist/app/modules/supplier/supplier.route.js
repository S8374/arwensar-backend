"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupplierRoutes = void 0;
// src/modules/supplier/supplier.route.ts
const express_1 = __importDefault(require("express"));
const supplier_controller_1 = require("./supplier.controller");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const router = express_1.default.Router();
// Dashboard
router.get("/dashboard", (0, auth_1.default)("SUPPLIER"), supplier_controller_1.SupplierController.getDashboardStats);
// Profile
router.get("/profile", (0, auth_1.default)("SUPPLIER"), supplier_controller_1.SupplierController.getSupplierProfile);
router.patch("/profile", (0, auth_1.default)("SUPPLIER"), supplier_controller_1.SupplierController.updateSupplierProfile);
// Assessments
router.get("/assessments", (0, auth_1.default)("SUPPLIER"), supplier_controller_1.SupplierController.getAssessments);
router.post("/assessments/:assessmentId/start", (0, auth_1.default)("SUPPLIER"), supplier_controller_1.SupplierController.startAssessment);
router.post("/submissions/:submissionId/answers/:questionId", (0, auth_1.default)("SUPPLIER"), supplier_controller_1.SupplierController.saveAnswer);
router.post("/submissions/:submissionId/submit", (0, auth_1.default)("SUPPLIER"), supplier_controller_1.SupplierController.submitAssessment);
router.get("/verify-invitation/:token", supplier_controller_1.SupplierController.verifyInvitation);
router.post("/complete-registration", supplier_controller_1.SupplierController.completeSupplierRegistration);
exports.SupplierRoutes = router;
