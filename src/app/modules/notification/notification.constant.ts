// src/modules/notification/notification.constant.ts
import { z } from 'zod';

export const createNotificationSchema = z.object({
  body: z.object({
    title: z.string().min(1, "Title is required"),
    message: z.string().min(1, "Message is required"),
    type: z.enum([
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
    metadata: z.record(z.string(), z.any()).optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional()
  })
});

export const markAsReadSchema = z.object({
  body: z.object({
    notificationIds: z.array(z.string()).optional(),
    markAll: z.boolean().optional()
  })
});