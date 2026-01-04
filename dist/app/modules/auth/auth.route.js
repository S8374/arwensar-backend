"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthRoutes = void 0;
// src/modules/auth/auth.route.ts
const express_1 = __importDefault(require("express"));
const auth_controller_1 = require("./auth.controller");
const auth_constant_1 = require("./auth.constant");
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const auth_1 = __importDefault(require("../../middlewares/auth"));
const router = express_1.default.Router();
router.post("/register", (0, validateRequest_1.default)(auth_constant_1.registerSchema), auth_controller_1.AuthController.registerVendor);
router.post("/verify-email", (0, validateRequest_1.default)(auth_constant_1.verifyEmailSchema), auth_controller_1.AuthController.verifyEmail);
router.post("/resend-otp", (0, validateRequest_1.default)(auth_constant_1.resendOTPSchema), auth_controller_1.AuthController.resendOTP);
router.post("/login", (0, validateRequest_1.default)(auth_constant_1.loginSchema), auth_controller_1.AuthController.login);
router.post("/refresh-token", auth_controller_1.AuthController.refreshToken);
router.post("/forgot-password", (0, validateRequest_1.default)(auth_constant_1.forgotPasswordSchema), auth_controller_1.AuthController.forgotPassword);
router.post("/reset-password", (0, validateRequest_1.default)(auth_constant_1.resetPasswordSchema), auth_controller_1.AuthController.resetPassword);
router.post("/logout", auth_controller_1.AuthController.logout);
router.get("/me", (0, auth_1.default)("ADMIN", "VENDOR", "SUPPLIER"), auth_controller_1.AuthController.getMe);
exports.AuthRoutes = router;
