// src/modules/report/report.validation.ts
import { z } from 'zod';

export const reportValidation = {
  generateReport: z.object({
    body: z.object({
      title: z.string().min(1, 'Title is required'),
      reportType: z.union([
        z.enum([
          'RISK_ASSESSMENT',
          'COMPLIANCE_REPORT',
          'SUPPLIER_EVALUATION',
          'FINANCIAL_ANALYSIS',
          'SECURITY_AUDIT',
          'PERFORMANCE_REVIEW',
          'INCIDENT_REPORT',
          'CUSTOM'
        ]),
        z.string().transform(val => val.toUpperCase())
      ]),
      description: z.string().optional(),
      vendorId: z.string().optional(),
      supplierId: z.string().optional(),
      filters: z.object({}).optional(),
      parameters: z.object({}).optional()
    })
  }),

  generateVendorSummary: z.object({
    body: z.object({
      title: z.string().min(1, 'Title is required'),
      description: z.string().optional(),
      filters: z.object({}).optional(),
      parameters: z.object({}).optional()
    })
  }),

  updateReport: z.object({
    body: z.object({
      title: z.string().min(1, 'Title is required').optional(),
      description: z.string().optional(),
      status: z.enum(['GENERATED', 'SENT', 'VIEWED', 'ARCHIVED']).optional()
    })
  }),

  sendReport: z.object({
    body: z.object({
      recipientEmail: z.string().email('Invalid email format').optional()
    })
  }),

  bulkGenerate: z.object({
    body: z.object({
      reportType: z.enum([
        'RISK_ASSESSMENT',
        'COMPLIANCE_REPORT',
        'SUPPLIER_EVALUATION',
        'SECURITY_AUDIT',
        'PERFORMANCE_REVIEW',
        'INCIDENT_REPORT'
      ]),
      title: z.string().min(1, 'Title is required'),
      description: z.string().optional(),
      vendorId: z.string().optional(),
      supplierIds: z.array(z.string()).optional(),
      filters: z.object({}).optional(),
      options: z.object({
        includeCoverPage: z.boolean().optional(),
        includeRecommendations: z.boolean().optional(),
        sendEmail: z.boolean().optional(),
        emailTemplate: z.string().optional()
      }).optional()
    })
  }),

  uploadExternal: z.object({
    body: z.object({
      title: z.string().min(1, 'Title is required'),
      reportType: z.enum([
        'RISK_ASSESSMENT',
        'COMPLIANCE_REPORT',
        'SUPPLIER_EVALUATION',
        'FINANCIAL_ANALYSIS',
        'SECURITY_AUDIT',
        'PERFORMANCE_REVIEW',
        'INCIDENT_REPORT',
        'CUSTOM'
      ]),
      description: z.string().optional(),
      vendorId: z.string().optional(),
      supplierId: z.string().optional(),
      documentUrl: z.string().url('Invalid URL format'),
      fileSize: z.number().positive('File size must be positive'),
      documentType: z.string().min(1, 'Document type is required'),
      parameters: z.object({}).optional()
    })
  })
};