"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.markAsReadSchema = exports.createNotificationSchema = void 0;
// src/modules/notification/notification.constant.ts
const zod_1 = require("zod");
exports.createNotificationSchema = zod_1.z.object({
    body: zod_1.z.object({
        title: zod_1.z.string().min(1, "Title is required"),
        message: zod_1.z.string().min(1, "Message is required"),
        type: zod_1.z.enum([
            'RISK_ALERT',
            'CONTRACT_EXPIRY',
            'ASSESSMENT_DUE',
            'ASSESSMENT_SUBMITTED',
            'PROBLEM_REPORTED',
            'PROBLEM_UPDATED',
            'PROBLEM_RESOLVED',
            'SYSTEM_ALERT',
            'PAYMENT_SUCCESS',
            'PAYMENT_FAILED',
            'REPORT_GENERATED',
            'INVITATION_SENT',
            'INVITATION_ACCEPTED',
            'ASSESSMENT_APPROVED',
            'ASSESSMENT_REJECTED',
            'EVIDENCE_REQUESTED',
            'EVIDENCE_APPROVED',
            'EVIDENCE_REJECTED',
            'CONTRACT_EXPIRING_SOON',
            'SLA_BREACHED'
        ]),
        metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional(),
        priority: zod_1.z.enum(['LOW', 'MEDIUM', 'HIGH']).optional()
    })
});
exports.markAsReadSchema = zod_1.z.object({
    body: zod_1.z.object({
        notificationIds: zod_1.z.array(zod_1.z.string()).optional(),
        markAll: zod_1.z.boolean().optional()
    })
});
