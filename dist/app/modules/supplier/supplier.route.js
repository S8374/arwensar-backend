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
router.patch("/profile/:supplierId", (0, auth_1.default)("SUPPLIER", "VENDOR"), supplier_controller_1.SupplierController.updateSupplierProfile);
// Assessments
router.get("/verify-invitation/:token", supplier_controller_1.SupplierController.verifyInvitation);
router.post("/complete-registration", supplier_controller_1.SupplierController.completeSupplierRegistration);
// Supplier routes (auth required)
router.get("/contract", (0, auth_1.default)("SUPPLIER"), supplier_controller_1.SupplierController.getSupplierContractStatus);
exports.SupplierRoutes = router;
