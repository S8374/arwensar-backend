// src/app/modules/payment/payment.constant.ts
import { z } from 'zod';

export const createCheckoutSchema = z.object({
  body: z.object({
    planId: z.string().min(1, "Plan ID is required"),
    billingCycle: z.enum(['MONTHLY', 'ANNUAL', 'QUARTERLY']).optional().default('MONTHLY')
  })
});

export const createPortalSessionSchema = z.object({
  body: z.object({
    returnUrl: z.string().url("Valid return URL is required").optional().default('/dashboard')
  })
});

export const confirmPaymentSchema = z.object({
  body: z.object({
    sessionId: z.string().min(1, "Session ID is required")
  })
});