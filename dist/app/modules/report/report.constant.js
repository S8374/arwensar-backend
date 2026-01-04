"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportValidation = void 0;
// src/modules/report/report.validation.ts
const zod_1 = require("zod");
exports.reportValidation = {
    generateReport: zod_1.z.object({
        body: zod_1.z.object({
            title: zod_1.z.string().min(1, 'Title is required'),
            reportType: zod_1.z.union([
                zod_1.z.enum([
                    'RISK_ASSESSMENT',
                    'COMPLIANCE_REPORT',
                    'SUPPLIER_EVALUATION',
                    'FINANCIAL_ANALYSIS',
                    'SECURITY_AUDIT',
                    'PERFORMANCE_REVIEW',
                    'INCIDENT_REPORT',
                    'CUSTOM'
                ]),
                zod_1.z.string().transform(val => val.toUpperCase())
            ]),
            description: zod_1.z.string().optional(),
            vendorId: zod_1.z.string().optional(),
            supplierId: zod_1.z.string().optional(),
            filters: zod_1.z.object({}).optional(),
            parameters: zod_1.z.object({}).optional()
        })
    }),
    generateVendorSummary: zod_1.z.object({
        body: zod_1.z.object({
            title: zod_1.z.string().min(1, 'Title is required'),
            description: zod_1.z.string().optional(),
            filters: zod_1.z.object({}).optional(),
            parameters: zod_1.z.object({}).optional()
        })
    }),
    updateReport: zod_1.z.object({
        body: zod_1.z.object({
            title: zod_1.z.string().min(1, 'Title is required').optional(),
            description: zod_1.z.string().optional(),
            status: zod_1.z.enum(['GENERATED', 'SENT', 'VIEWED', 'ARCHIVED']).optional()
        })
    }),
    sendReport: zod_1.z.object({
        body: zod_1.z.object({
            recipientEmail: zod_1.z.string().email('Invalid email format').optional()
        })
    }),
    bulkGenerate: zod_1.z.object({
        body: zod_1.z.object({
            reportType: zod_1.z.enum([
                'RISK_ASSESSMENT',
                'COMPLIANCE_REPORT',
                'SUPPLIER_EVALUATION',
                'SECURITY_AUDIT',
                'PERFORMANCE_REVIEW',
                'INCIDENT_REPORT'
            ]),
            title: zod_1.z.string().min(1, 'Title is required'),
            description: zod_1.z.string().optional(),
            vendorId: zod_1.z.string().optional(),
            supplierIds: zod_1.z.array(zod_1.z.string()).optional(),
            filters: zod_1.z.object({}).optional(),
            options: zod_1.z.object({
                includeCoverPage: zod_1.z.boolean().optional(),
                includeRecommendations: zod_1.z.boolean().optional(),
                sendEmail: zod_1.z.boolean().optional(),
                emailTemplate: zod_1.z.string().optional()
            }).optional()
        })
    }),
    uploadExternal: zod_1.z.object({
        body: zod_1.z.object({
            title: zod_1.z.string().min(1, 'Title is required'),
            reportType: zod_1.z.enum([
                'RISK_ASSESSMENT',
                'COMPLIANCE_REPORT',
                'SUPPLIER_EVALUATION',
                'FINANCIAL_ANALYSIS',
                'SECURITY_AUDIT',
                'PERFORMANCE_REVIEW',
                'INCIDENT_REPORT',
                'CUSTOM'
            ]),
            description: zod_1.z.string().optional(),
            vendorId: zod_1.z.string().optional(),
            supplierId: zod_1.z.string().optional(),
            documentUrl: zod_1.z.string().url('Invalid URL format'),
            fileSize: zod_1.z.number().positive('File size must be positive'),
            documentType: zod_1.z.string().min(1, 'Document type is required'),
            parameters: zod_1.z.object({}).optional()
        })
    })
};
