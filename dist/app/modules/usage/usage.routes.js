"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsageRoutes = void 0;
// src/app/modules/usage/usage.routes.ts
const express_1 = __importDefault(require("express"));
const usage_controller_1 = require("./usage.controller");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const router = express_1.default.Router();
// ========== PROTECTED ROUTES ==========
// Get current usage (for current user)
router.get('/my-access', (0, auth_1.default)('ADMIN', 'VENDOR', 'SUPPLIER'), usage_controller_1.UsageController.getCurrentUsage);
// Check if user has enough usage (without decrementing)
router.post('/check-usage', (0, auth_1.default)('ADMIN', 'VENDOR', 'SUPPLIER'), usage_controller_1.UsageController.checkUsage);
// Decrement usage (use this when performing an action)
router.post('/decrement-usage', (0, auth_1.default)('ADMIN', 'VENDOR', 'SUPPLIER'), usage_controller_1.UsageController.decrementUsage);
// ========== ADMIN ONLY ROUTES ==========
// Reset usage (admin only)
router.post('/reset-usage', (0, auth_1.default)('ADMIN'), usage_controller_1.UsageController.resetUsage);
exports.UsageRoutes = router;
