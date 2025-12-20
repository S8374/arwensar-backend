// src/modules/report/report.constant.ts
import { z } from 'zod';

export const generateReportSchema = z.object({
  body: z.object({
    title: z.string().min(1, "Title is required"),
    reportType: z.enum([
      'RISK_ASSESSMENT',
      'COMPLIANCE_REPORT',
      'SECURITY_AUDIT',
      'PERFORMANCE_REVIEW',
      'FINANCIAL_ANALYSIS',
      'SUPPLIER_EVALUATION',
      'INCIDENT_REPORT',
      'CUSTOM'
    ]),
    description: z.string().optional(),
    vendorId: z.string().optional(),
    supplierId: z.string().optional(),
    parameters: z.record(z.any()).optional(),
    filters: z.record(z.any()).optional()
  })
});

export const updateReportSchema = z.object({
  body: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    status: z.enum(['GENERATED', 'SENT', 'VIEWED', 'ARCHIVED']).optional()
  })
});