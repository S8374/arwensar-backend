"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeEvidenceSchema = exports.reviewEvidenceSchema = exports.reviewAssessmentSchema = exports.submitAssessmentSchema = exports.saveAnswerSchema = exports.startAssessmentSchema = void 0;
// src/modules/assessment/assessment.constant.ts
const zod_1 = require("zod");
exports.startAssessmentSchema = zod_1.z.object({
    body: zod_1.z.object({
        assessmentId: zod_1.z.string().min(1, "Assessment ID is required")
    })
});
exports.saveAnswerSchema = zod_1.z.object({
    body: zod_1.z.object({
        answer: zod_1.z.enum(['YES', 'NO', 'PARTIAL', 'NOT_APPLICABLE', 'NA']),
        evidence: zod_1.z.string().optional(),
        comments: zod_1.z.string().optional(),
        evidenceFile: zod_1.z.string().optional()
    })
});
exports.submitAssessmentSchema = zod_1.z.object({
    body: zod_1.z.object({
        reviewComments: zod_1.z.string().optional()
    })
});
exports.reviewAssessmentSchema = zod_1.z.object({
    body: zod_1.z.object({
        status: zod_1.z.enum(['APPROVED', 'REJECTED', 'REQUIRES_ACTION']),
        reviewComments: zod_1.z.string().optional(),
        reviewerReport: zod_1.z.string().optional(),
        complianceRate: zod_1.z.number().min(0).max(100).optional()
    })
});
exports.reviewEvidenceSchema = zod_1.z.object({
    body: zod_1.z.object({
        status: zod_1.z.enum(['APPROVED', 'REJECTED', 'REQUESTED']),
        score: zod_1.z.number().min(0).max(10).optional(),
        rejectionReason: zod_1.z.string().optional()
    })
});
// src/modules/assessment/assessment.constant.ts (add this)
exports.removeEvidenceSchema = zod_1.z.object({
    params: zod_1.z.object({
        answerId: zod_1.z.string()
    }),
    body: zod_1.z.object({
        deleteFromCloudinary: zod_1.z.boolean().optional().default(true)
    })
});
