// src/modules/assessment/assessment.constant.ts
import { z } from 'zod';

export const startAssessmentSchema = z.object({
  body: z.object({
    assessmentId: z.string().min(1, "Assessment ID is required")
  })
});

export const saveAnswerSchema = z.object({
  body: z.object({
    answer: z.enum(['YES', 'NO', 'PARTIAL', 'NOT_APPLICABLE', 'NA']),
    evidence: z.string().optional(),
    comments: z.string().optional(),
    evidenceFile: z.string().optional()
  })
});

export const submitAssessmentSchema = z.object({
  body: z.object({
    reviewComments: z.string().optional()
  })
});

export const reviewAssessmentSchema = z.object({
  body: z.object({
    status: z.enum(['APPROVED', 'REJECTED', 'REQUIRES_ACTION']),
    reviewComments: z.string().optional(),
    reviewerReport: z.string().optional(),
    complianceRate: z.number().min(0).max(100).optional()
  })
});

export const reviewEvidenceSchema = z.object({
  body: z.object({
    status: z.enum(['APPROVED', 'REJECTED', 'REQUESTED']),
    score: z.number().min(0).max(10).optional(),
    rejectionReason: z.string().optional()
  })
});