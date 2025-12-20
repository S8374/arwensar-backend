// src/modules/payment/payment.constant.ts
import { z } from 'zod';

export const createPaymentSessionSchema = z.object({
  body: z.object({
    planId: z.string().min(1, "Plan ID is required"),
    billingCycle: z.enum(['MONTHLY', 'ANNUAL']),
    successUrl: z.string().url().optional(),
    cancelUrl: z.string().url().optional()
  })
});

export const createDirectPaymentSchema = z.object({
  body: z.object({
    planId: z.string().min(1, "Plan ID is required"),
    billingCycle: z.enum(['MONTHLY', 'ANNUAL']),
    paymentMethodId: z.string().min(1, "Payment method ID is required"),
    savePaymentMethod: z.boolean().default(false)
  })
});

export const webhookSchema = z.object({
  body: z.object({
    type: z.string(),
    data: z.object({
      object: z.any()
    })
  })
});

export const createPaymentMethodSchema = z.object({
  body: z.object({
    paymentMethodId: z.string().min(1, "Payment method ID is required")
  })
});

export const refundPaymentSchema = z.object({
  body: z.object({
    reason: z.string().optional(),
    amount: z.number().optional()
  })
});