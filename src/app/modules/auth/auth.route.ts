// src/modules/auth/auth.route.ts
import express from "express";
import { AuthController } from "./auth.controller";
import {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  resendOTPSchema,
  forgotPasswordSchema,
  resetPasswordSchema
} from "./auth.constant";
import validateRequest from "../../middlewares/validateRequest";
import auth from "../../middlewares/auth";

const router = express.Router();

router.post(
  "/register",
  validateRequest(registerSchema),
  AuthController.registerVendor
);

router.post(
  "/verify-email",
  validateRequest(verifyEmailSchema),
  AuthController.verifyEmail
);

router.post(
  "/resend-otp",
  validateRequest(resendOTPSchema),
  AuthController.resendOTP
);

router.post(
  "/login",
  validateRequest(loginSchema),
  AuthController.login
);

router.post(
  "/refresh-token",
  AuthController.refreshToken
);

router.post(
  "/forgot-password",
  validateRequest(forgotPasswordSchema),
  AuthController.forgotPassword
);

router.post(
  "/reset-password",
  validateRequest(resetPasswordSchema),
  AuthController.resetPassword
);

router.post(
  "/logout",
  AuthController.logout
);
router.get(
  "/me",
    auth("ADMIN", "VENDOR", "SUPPLIER"),
  AuthController.getMe
);

export const AuthRoutes = router;