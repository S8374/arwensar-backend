// src/modules/problem/problem.constant.ts
import { z } from 'zod';

export const createProblemSchema = z.object({
  body: z.object({
    title: z.string().min(1, "Title is required"),
    description: z.string().min(1, "Description is required"),
    type: z.enum([
      'QUALITY_ISSUE',
      'DELIVERY_DELAY',
      'COMMUNICATION',
      'CONTRACT_VIOLATION',
      'PAYMENT_ISSUE',
      'COMPLIANCE',
      'TECHNICAL',
      'OTHER'
    ]).default('OTHER'),
    direction: z.enum(['VENDOR_TO_SUPPLIER', 'SUPPLIER_TO_VENDOR']),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
    supplierId: z.string().min(1, "Supplier ID is required"),
    dueDate: z.string().refine(val => !isNaN(Date.parse(val)), {
      message: "Valid due date is required"
    }).optional(),
    attachments: z.array(z.string()).optional()
  })
});

export const updateProblemSchema = z.object({
  body: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    type: z.enum([
      'QUALITY_ISSUE',
      'DELIVERY_DELAY',
      'COMMUNICATION',
      'CONTRACT_VIOLATION',
      'PAYMENT_ISSUE',
      'COMPLIANCE',
      'TECHNICAL',
      'OTHER'
    ]).optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
    status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'ESCALATED', 'CLOSED']).optional(),
    resolutionNotes: z.string().optional(),
    assignedToId: z.string().optional(),
    internalNotes: z.string().optional(),
    supplierNotes: z.string().optional(),
    dueDate: z.string().refine(val => !isNaN(Date.parse(val))).optional()
  })
});

export const createMessageSchema = z.object({
  body: z.object({
    content: z.string().min(1, "Message content is required"),
    isInternal: z.boolean().default(false),
    attachments: z.array(z.string()).optional()
  })
});