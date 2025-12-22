// src/modules/document/document.constant.ts
import { z } from 'zod';

export const uploadDocumentSchema = z.object({
  body: z.object({
    name: z.string().min(1, "Document name is required"),
    type: z.string().min(1, "Document type is required"),
    category: z.enum([
      'CERTIFICATE',
      'CONTRACT',
      'INSURANCE', 
      'LICENSE',
      'COMPLIANCE',
      'FINANCIAL',
      'OTHER'
    ]).optional(),
    description: z.string().optional(),
    expiryDate: z.string().refine(val => !val || !isNaN(Date.parse(val)), {
      message: "Invalid expiry date format"
    }).optional(),
    supplierId: z.string().optional(), // For vendor uploading to specific supplier
    isPrivate: z.boolean().optional().default(false),
    accessRoles: z.array(z.enum(['ADMIN', 'VENDOR', 'SUPPLIER'])).optional()
  })
});

export const updateDocumentSchema = z.object({
  body: z.object({
    name: z.string().optional(),
    type: z.string().optional(),
    category: z.string().optional(),
    description: z.string().optional(),
    expiryDate: z.string().refine(val => !val || !isNaN(Date.parse(val))).optional(),
    status: z.enum(['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED']).optional(),
    reviewNotes: z.string().optional(),
    isPrivate: z.boolean().optional(),
    accessRoles: z.array(z.enum(['ADMIN', 'VENDOR', 'SUPPLIER'])).optional()
  })
});

export const reviewDocumentSchema = z.object({
  body: z.object({
    status: z.enum(['APPROVED', 'REJECTED']),
    reviewNotes: z.string().optional()
  })
});

export const documentFilterSchema = z.object({
  query: z.object({
    supplierId: z.string().optional(),
    vendorId: z.string().optional(),
    category: z.string().optional(),
    type: z.string().optional(),
    status: z.string().optional(),
    search: z.string().optional(),
    expiredOnly: z.string().optional(),
    expiringSoon: z.string().optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.string().optional()
  })
});