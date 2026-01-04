"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMessageSchema = exports.updateProblemSchema = exports.createProblemSchema = void 0;
// src/modules/problem/problem.constant.ts
const zod_1 = require("zod");
exports.createProblemSchema = zod_1.z.object({
    body: zod_1.z.object({
        title: zod_1.z.string().min(1, "Title is required"),
        description: zod_1.z.string().min(1, "Description is required"),
        type: zod_1.z.enum([
            'QUALITY_ISSUE',
            'DELIVERY_DELAY',
            'COMMUNICATION',
            'CONTRACT_VIOLATION',
            'PAYMENT_ISSUE',
            'COMPLIANCE',
            'TECHNICAL',
            'OTHER'
        ]).default('OTHER'),
        direction: zod_1.z.enum(['VENDOR_TO_SUPPLIER', 'SUPPLIER_TO_VENDOR']),
        priority: zod_1.z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
        supplierId: zod_1.z.string().min(1, "Supplier ID is required"),
        dueDate: zod_1.z.string().refine(val => !isNaN(Date.parse(val)), {
            message: "Valid due date is required"
        }).optional(),
        attachments: zod_1.z.array(zod_1.z.string()).optional()
    })
});
exports.updateProblemSchema = zod_1.z.object({
    body: zod_1.z.object({
        title: zod_1.z.string().optional(),
        description: zod_1.z.string().optional(),
        type: zod_1.z.enum([
            'QUALITY_ISSUE',
            'DELIVERY_DELAY',
            'COMMUNICATION',
            'CONTRACT_VIOLATION',
            'PAYMENT_ISSUE',
            'COMPLIANCE',
            'TECHNICAL',
            'OTHER'
        ]).optional(),
        priority: zod_1.z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
        status: zod_1.z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'ESCALATED', 'CLOSED']).optional(),
        resolutionNotes: zod_1.z.string().optional(),
        assignedToId: zod_1.z.string().optional(),
        internalNotes: zod_1.z.string().optional(),
        supplierNotes: zod_1.z.string().optional(),
        dueDate: zod_1.z.string().refine(val => !isNaN(Date.parse(val))).optional()
    })
});
exports.createMessageSchema = zod_1.z.object({
    body: zod_1.z.object({
        content: zod_1.z.string().min(1, "Message content is required"),
        isInternal: zod_1.z.boolean().default(false),
        attachments: zod_1.z.array(zod_1.z.string()).optional()
    })
});
