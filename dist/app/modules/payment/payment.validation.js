"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.confirmPaymentSchema = exports.createPortalSessionSchema = exports.createCheckoutSchema = void 0;
// src/app/modules/payment/payment.constant.ts
const zod_1 = require("zod");
exports.createCheckoutSchema = zod_1.z.object({
    body: zod_1.z.object({
        planId: zod_1.z.string().min(1, "Plan ID is required"),
        billingCycle: zod_1.z.enum(['MONTHLY', 'ANNUAL', 'QUARTERLY']).optional().default('MONTHLY')
    })
});
exports.createPortalSessionSchema = zod_1.z.object({
    body: zod_1.z.object({
        returnUrl: zod_1.z.string().url("Valid return URL is required").optional().default('/dashboard')
    })
});
exports.confirmPaymentSchema = zod_1.z.object({
    body: zod_1.z.object({
        sessionId: zod_1.z.string().min(1, "Session ID is required")
    })
});
