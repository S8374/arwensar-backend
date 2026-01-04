"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAssessmentSchema = exports.updatePlanSchema = exports.createPlanSchema = void 0;
const zod_1 = require("zod");
exports.createPlanSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().min(1, "Plan name is required"),
        description: zod_1.z.string().optional().nullable(),
        type: zod_1.z.enum([
            "FREE",
            "STARTER",
            "PROFESSIONAL",
            "ENTERPRISE",
            "CUSTOM"
        ]),
        billingCycle: zod_1.z.enum([
            "MONTHLY",
            "ANNUAL",
            "QUARTERLY"
        ]),
        price: zod_1.z.number().min(0),
        currency: zod_1.z.string().default("EUR"),
        // ✅ unlimited allowed
        supplierLimit: zod_1.z.number().int().min(1).nullable(),
        // ✅ unlimited allowed
        assessmentLimit: zod_1.z.number().int().nullable(),
        storageLimit: zod_1.z.number().int().nullable().optional(),
        // ✅ unlimited allowed
        userLimit: zod_1.z.number().int().nullable(),
        features: zod_1.z.record(zod_1.z.string(), zod_1.z.any()),
        trialDays: zod_1.z.number().int().min(0).default(14),
        isActive: zod_1.z.boolean().default(true),
        isDefault: zod_1.z.boolean().default(false),
    }),
});
exports.updatePlanSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().min(1).optional(),
        description: zod_1.z.string().optional(),
        type: zod_1.z.enum(['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE', 'CUSTOM']).optional(),
        billingCycle: zod_1.z.enum(['MONTHLY', 'ANNUAL', 'QUARTERLY']).optional(),
        price: zod_1.z.number().min(0).optional(),
        currency: zod_1.z.string().optional(),
        supplierLimit: zod_1.z.number().int().min(1).optional(),
        assessmentLimit: zod_1.z.number().int().optional(),
        storageLimit: zod_1.z.number().int().optional(),
        userLimit: zod_1.z.number().int().optional(),
        features: zod_1.z.record(zod_1.z.any(), zod_1.z.string()).optional(),
        trialDays: zod_1.z.number().int().min(0).optional(),
        isActive: zod_1.z.boolean().optional(),
        isDefault: zod_1.z.boolean().optional(),
        stripePriceId: zod_1.z.string().optional(),
        stripeProductId: zod_1.z.string().optional(),
    })
});
exports.createAssessmentSchema = zod_1.z.object({
    body: zod_1.z.object({
        examId: zod_1.z.string().min(1, "Exam ID is required"),
        title: zod_1.z.string().min(1, "Title is required"),
        description: zod_1.z.string().optional(),
        isActive: zod_1.z.boolean().default(true),
        isTemplate: zod_1.z.boolean().default(false),
        stage: zod_1.z.enum(['INITIAL', 'FULL', 'COMPLETE']).default('FULL'),
        totalPoints: zod_1.z.number().int().default(100),
        passingScore: zod_1.z.number().optional(),
        timeLimit: zod_1.z.number().int().optional(),
        categories: zod_1.z.array(zod_1.z.object({
            categoryId: zod_1.z.string(),
            title: zod_1.z.string(),
            description: zod_1.z.string().optional(),
            order: zod_1.z.number().int().default(1),
            weight: zod_1.z.number().optional(),
            maxScore: zod_1.z.number().int().default(100),
            questions: zod_1.z.array(zod_1.z.object({
                questionId: zod_1.z.number().int(),
                question: zod_1.z.string(),
                description: zod_1.z.string().optional(),
                order: zod_1.z.number().int().default(1),
                isDocument: zod_1.z.boolean().default(false),
                isInputField: zod_1.z.boolean().default(false),
                answerType: zod_1.z.enum(['YES', 'NO', 'PARTIAL', 'NOT_APPLICABLE', 'NA']).default('YES'),
                weight: zod_1.z.number().optional(),
                maxScore: zod_1.z.number().int().default(10),
                helpText: zod_1.z.string().optional(),
                bivCategory: zod_1.z.enum(['BUSINESS', 'INTEGRITY', 'AVAILABILITY']).optional(),
                evidenceRequired: zod_1.z.boolean().default(false),
            }))
        }))
    })
});
