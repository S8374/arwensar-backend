"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.changePasswordSchema = exports.resetPasswordSchema = exports.forgotPasswordSchema = exports.resendOTPSchema = exports.verifyEmailSchema = exports.loginSchema = exports.registerSchema = void 0;
// src/modules/auth/auth.constant.ts
const zod_1 = require("zod");
exports.registerSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.string().email("Valid email is required"),
        password: zod_1.z.string().min(6, "Password must be at least 6 characters"),
        confirmPassword: zod_1.z.string().min(6, "Confirm password is required"),
        companyName: zod_1.z.string().min(1, "Company name is required"),
        businessEmail: zod_1.z.string().email("Valid business email is required"),
        contactNumber: zod_1.z.string().min(1, "Contact number is required"),
        industryType: zod_1.z.string().min(1, "Industry type is required"),
        firstName: zod_1.z.string().optional(),
        lastName: zod_1.z.string().optional(),
        termsAccepted: zod_1.z.boolean().refine(val => val === true, {
            message: "You must accept the terms and conditions"
        })
    }).refine(data => data.password === data.confirmPassword, {
        message: "Passwords don't match",
        path: ["confirmPassword"]
    })
});
exports.loginSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.string().email("Valid email is required"),
        password: zod_1.z.string().min(1, "Password is required")
    })
});
exports.verifyEmailSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.string().email("Valid email is required"),
        otp: zod_1.z.string().length(6, "OTP must be 6 digits"),
    }),
});
exports.resendOTPSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.string().email("Valid email is required")
    })
});
exports.forgotPasswordSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.string().email("Valid email is required")
    })
});
exports.resetPasswordSchema = zod_1.z.object({
    body: zod_1.z.object({
        token: zod_1.z.string().min(1, "Token is required"),
        password: zod_1.z.string().min(6, "Password must be at least 6 characters"),
    })
});
exports.changePasswordSchema = zod_1.z.object({
    body: zod_1.z.object({
        currentPassword: zod_1.z.string().min(1, "Current password is required"),
        newPassword: zod_1.z.string().min(6, "New password must be at least 6 characters"),
        confirmPassword: zod_1.z.string().min(6, "Confirm password is required")
    }).refine(data => data.newPassword === data.confirmPassword, {
        message: "Passwords don't match",
        path: ["confirmPassword"]
    })
});
