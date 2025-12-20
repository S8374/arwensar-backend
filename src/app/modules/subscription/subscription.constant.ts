// src/modules/subscription/subscription.constant.ts
import { z } from 'zod';

export const createCheckoutSessionSchema = z.object({
  body: z.object({
    planId: z.string().min(1, "Plan ID is required"),
    billingCycle: z.enum(['MONTHLY', 'ANNUAL', 'QUARTERLY']).default('MONTHLY'),
    promotionCode: z.string().optional(),
    successUrl: z.string().optional(),
    cancelUrl: z.string().optional()
  })
});

export const applyPromotionCodeSchema = z.object({
  body: z.object({
    promotionCode: z.string().min(1, "Promotion code is required")
  })
});