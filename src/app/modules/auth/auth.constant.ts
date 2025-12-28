// src/modules/auth/auth.constant.ts
import { z } from 'zod';

export const registerSchema = z.object({
  body: z.object({
    email: z.string().email("Valid email is required"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string().min(6, "Confirm password is required"),
    companyName: z.string().min(1, "Company name is required"),
    businessEmail: z.string().email("Valid business email is required"),
    contactNumber: z.string().min(1, "Contact number is required"),
    industryType: z.string().min(1, "Industry type is required"),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    termsAccepted: z.boolean().refine(val => val === true, {
      message: "You must accept the terms and conditions"
    })
  }).refine(data => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"]
  })
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email("Valid email is required"),
    password: z.string().min(1, "Password is required")
  })
});

export const verifyEmailSchema = z.object({
  body: z.object({
    email: z.string().email("Valid email is required"),
    otp: z.string().length(6, "OTP must be 6 digits"),
  }),
});


export const resendOTPSchema = z.object({
  body: z.object({
    email: z.string().email("Valid email is required")
  })
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email("Valid email is required")
  })
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1, "Token is required"),
    password: z.string().min(6, "Password must be at least 6 characters"),
  })
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(6, "New password must be at least 6 characters"),
    confirmPassword: z.string().min(6, "Confirm password is required")
  }).refine(data => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"]
  })
});