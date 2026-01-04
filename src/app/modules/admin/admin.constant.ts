import { z } from "zod";

export const createPlanSchema = z.object({
  body: z.object({
    name: z.string().min(1, "Plan name is required"),

    description: z.string().optional().nullable(),

    type: z.enum([
      "FREE",
      "STARTER",
      "PROFESSIONAL",
      "ENTERPRISE",
      "CUSTOM"
    ]),

    billingCycle: z.enum([
      "MONTHLY",
      "ANNUAL",
      "QUARTERLY"
    ]),

    price: z.number().min(0),

    currency: z.string().default("EUR"),

    // ✅ unlimited allowed
    supplierLimit: z.number().int().min(1).nullable(),

    // ✅ unlimited allowed
    assessmentLimit: z.number().int().nullable(),

    storageLimit: z.number().int().nullable().optional(),


    // ✅ unlimited allowed
    userLimit: z.number().int().nullable(),

    features: z.record(z.string(), z.any()),

    trialDays: z.number().int().min(0).default(14),

    isActive: z.boolean().default(true),

    isDefault: z.boolean().default(false),
  }),
});


export const updatePlanSchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    type: z.enum(['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE', 'CUSTOM']).optional(),
    billingCycle: z.enum(['MONTHLY', 'ANNUAL', 'QUARTERLY']).optional(),
    price: z.number().min(0).optional(),
    currency: z.string().optional(),
    supplierLimit: z.number().int().min(1).optional(),
    assessmentLimit: z.number().int().optional(),
    storageLimit: z.number().int().optional(),
    userLimit: z.number().int().optional(),
    features: z.record(z.any() , z.string()).optional(),
    trialDays: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
    isDefault: z.boolean().optional(),
    stripePriceId: z.string().optional(),
    stripeProductId: z.string().optional(),
  })
});

export const createAssessmentSchema = z.object({
  body: z.object({
    examId: z.string().min(1, "Exam ID is required"),
    title: z.string().min(1, "Title is required"),
    description: z.string().optional(),
    isActive: z.boolean().default(true),
    isTemplate: z.boolean().default(false),
    stage: z.enum(['INITIAL', 'FULL', 'COMPLETE']).default('FULL'),
    totalPoints: z.number().int().default(100),
    passingScore: z.number().optional(),
    timeLimit: z.number().int().optional(),
    categories: z.array(z.object({
      categoryId: z.string(),
      title: z.string(),
      description: z.string().optional(),
      order: z.number().int().default(1),
      weight: z.number().optional(),
      maxScore: z.number().int().default(100),
      questions: z.array(z.object({
        questionId: z.number().int(),
        question: z.string(),
        description: z.string().optional(),
        order: z.number().int().default(1),
        isDocument: z.boolean().default(false),
        isInputField: z.boolean().default(false),
        answerType: z.enum(['YES', 'NO', 'PARTIAL', 'NOT_APPLICABLE', 'NA']).default('YES'),
        weight: z.number().optional(),
        maxScore: z.number().int().default(10),
        helpText: z.string().optional(),
        bivCategory: z.enum(['BUSINESS', 'INTEGRITY', 'AVAILABILITY']).optional(),
        evidenceRequired: z.boolean().default(false),
      }))
    }))
  })
});