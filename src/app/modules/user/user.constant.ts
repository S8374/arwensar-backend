// src/modules/user/user.constant.ts
import { z } from 'zod';

export const updateProfileSchema = z.object({
  body: z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    phoneNumber: z.string().optional(),
    profileImage: z.string().optional()
  })
});

export const updatePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(6, "New password must be at least 6 characters"),
    confirmPassword: z.string().min(6, "Confirm password is required")
  }).refine(data => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"]
  })
});
// Update your notification preferences schema
export const updateNotificationPreferencesSchema = z.object({
  body: z.object({
    emailNotifications: z.boolean().optional(),
    pushNotifications: z.boolean().optional(),
    riskAlerts: z.boolean().optional(),
    contractReminders: z.boolean().optional(),
    complianceUpdates: z.boolean().optional(),
    assessmentReminders: z.boolean().optional(),
    problemAlerts: z.boolean().optional(),
    reportAlerts: z.boolean().optional(),
    paymentAlerts: z.boolean().optional(),
    messageAlerts: z.boolean().optional(),
    digestFrequency: z.string().optional(),
    quietHoursStart: z.number().min(0).max(23).optional(),
    quietHoursEnd: z.number().min(0).max(23).optional()
  })
});