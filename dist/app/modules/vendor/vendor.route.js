"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VendorRoutes = void 0;
// src/modules/vendor/vendor.route.ts
const express_1 = __importDefault(require("express"));
const vendor_controller_1 = require("./vendor.controller");
const vendor_constant_1 = require("./vendor.constant");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const client_1 = require("@prisma/client");
const router = express_1.default.Router();
// Dashboard
router.get("/dashboard", (0, auth_1.default)("VENDOR"), vendor_controller_1.VendorController.getDashboardStats);
// Profile
router.get("/profile", (0, auth_1.default)("VENDOR"), vendor_controller_1.VendorController.getVendorProfile);
router.patch("/profile", (0, auth_1.default)("VENDOR"), (0, validateRequest_1.default)(vendor_constant_1.updateVendorProfileSchema), vendor_controller_1.VendorController.updateVendorProfile);
// Suppliers
router.get("/suppliers", (0, auth_1.default)("VENDOR", "SUPPLIER"), vendor_controller_1.VendorController.getSuppliers);
router.get("/suppliers/:supplierId", (0, auth_1.default)("VENDOR"), vendor_controller_1.VendorController.getSupplierById);
router.post("/suppliers/create", (0, auth_1.default)("VENDOR"), 
// checkUsage('suppliersUsed', 1), // Decrement by 1 per supplier
vendor_controller_1.VendorController.createSupplier);
// Assessment Review
router.post("/assessments/:submissionId/review", (0, auth_1.default)("VENDOR"), vendor_controller_1.VendorController.reviewAssessment);
router.post("/evidence/:answerId/review", (0, auth_1.default)("VENDOR"), vendor_controller_1.VendorController.reviewEvidence);
router.get("/suppliers/:supplierId/progress", (0, auth_1.default)("VENDOR"), vendor_controller_1.VendorController.getSingleSupplierProgress);
router.post('/bulk-import', (0, auth_1.default)(client_1.UserRole.VENDOR), vendor_controller_1.VendorController.bulkImportSuppliers);
router.post("/:supplierId/resend-invitation", (0, auth_1.default)("VENDOR"), vendor_controller_1.VendorController.resendInvitation);
exports.VendorRoutes = router;
