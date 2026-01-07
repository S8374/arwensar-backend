"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentRoutes = void 0;
// src/modules/document/document.routes.ts
const express_1 = __importDefault(require("express"));
const document_controller_1 = require("./document.controller");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const planLimitMiddleware_1 = require("../../middlewares/planLimitMiddleware");
const router = express_1.default.Router();
// Upload document
router.post("/upload", (0, auth_1.default)("ADMIN", "VENDOR", "SUPPLIER"), document_controller_1.DocumentController.uploadDocument);
// Get all documents
router.get("/", (0, auth_1.default)("ADMIN", "VENDOR", "SUPPLIER"), document_controller_1.DocumentController.getDocuments);
// Get document by ID
router.get("/:documentId", (0, auth_1.default)("ADMIN", "VENDOR", "SUPPLIER"), document_controller_1.DocumentController.getDocumentById);
// Update document
router.patch("/:documentId", (0, auth_1.default)("ADMIN", "VENDOR", "SUPPLIER"), document_controller_1.DocumentController.updateDocument);
// Review document (Vendor/Admin)
router.post("/:documentId/review", (0, auth_1.default)("VENDOR", "ADMIN"), (0, planLimitMiddleware_1.checkUsage)('documentReviewsUsed', 1), document_controller_1.DocumentController.reviewDocument);
// Delete document
router.delete("/:documentId", (0, auth_1.default)("ADMIN", "VENDOR", "SUPPLIER"), document_controller_1.DocumentController.deleteDocument);
// Get document statistics
router.get("/statistics/overview", (0, auth_1.default)("ADMIN", "VENDOR", "SUPPLIER"), document_controller_1.DocumentController.getDocumentStatistics);
// Get document categories
router.get("/categories/all", (0, auth_1.default)("ADMIN", "VENDOR", "SUPPLIER"), document_controller_1.DocumentController.getDocumentCategories);
// Get expiring documents
router.get("/expiring/soon", (0, auth_1.default)("ADMIN", "VENDOR", "SUPPLIER"), document_controller_1.DocumentController.getExpiringDocuments);
// Bulk update document status
router.post("/bulk/update-status", (0, auth_1.default)("VENDOR", "ADMIN"), document_controller_1.DocumentController.bulkUpdateDocumentStatus);
// Check expired documents (Admin only - usually scheduled)
router.post("/admin/check-expired", (0, auth_1.default)("ADMIN", "VENDOR", "SUPPLIER"), document_controller_1.DocumentController.checkExpiredDocuments);
// document.routes.ts
router.get('/user/:userID', (0, auth_1.default)('ADMIN', 'VENDOR', 'SUPPLIER'), document_controller_1.DocumentController.getMyDocuments);
exports.DocumentRoutes = router;
