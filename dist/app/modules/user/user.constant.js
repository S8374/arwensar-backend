"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateNotificationPreferencesSchema = exports.updatePasswordSchema = exports.updateProfileSchema = void 0;
// src/modules/user/user.constant.ts
const zod_1 = require("zod");
exports.updateProfileSchema = zod_1.z.object({
    body: zod_1.z.object({
        firstName: zod_1.z.string().optional(),
        lastName: zod_1.z.string().optional(),
        phoneNumber: zod_1.z.string().optional(),
        profileImage: zod_1.z.string().optional()
    })
});
exports.updatePasswordSchema = zod_1.z.object({
    body: zod_1.z.object({
        currentPassword: zod_1.z.string().min(1, "Current password is required"),
        newPassword: zod_1.z.string().min(6, "New password must be at least 6 characters"),
        confirmPassword: zod_1.z.string().min(6, "Confirm password is required")
    }).refine(data => data.newPassword === data.confirmPassword, {
        message: "Passwords don't match",
        path: ["confirmPassword"]
    })
});
// Update your notification preferences schema
exports.updateNotificationPreferencesSchema = zod_1.z.object({
    body: zod_1.z.object({
        emailNotifications: zod_1.z.boolean().optional(),
        pushNotifications: zod_1.z.boolean().optional(),
        riskAlerts: zod_1.z.boolean().optional(),
        contractReminders: zod_1.z.boolean().optional(),
        complianceUpdates: zod_1.z.boolean().optional(),
        assessmentReminders: zod_1.z.boolean().optional(),
        problemAlerts: zod_1.z.boolean().optional(),
        reportAlerts: zod_1.z.boolean().optional(),
        paymentAlerts: zod_1.z.boolean().optional(),
        messageAlerts: zod_1.z.boolean().optional(),
        digestFrequency: zod_1.z.string().optional(),
        quietHoursStart: zod_1.z.number().min(0).max(23).optional(),
        quietHoursEnd: zod_1.z.number().min(0).max(23).optional()
    })
});
