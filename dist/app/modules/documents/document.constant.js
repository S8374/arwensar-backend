"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.documentFilterSchema = exports.reviewDocumentSchema = exports.updateDocumentSchema = exports.uploadDocumentSchema = void 0;
// src/modules/document/document.constant.ts
const zod_1 = require("zod");
exports.uploadDocumentSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().min(1, "Document name is required"),
        type: zod_1.z.string().min(1, "Document type is required"),
        category: zod_1.z.enum([
            'CERTIFICATE',
            'CONTRACT',
            'INSURANCE',
            'LICENSE',
            'COMPLIANCE',
            'FINANCIAL',
            'OTHER'
        ]).optional(),
        description: zod_1.z.string().optional(),
        expiryDate: zod_1.z.string().refine(val => !val || !isNaN(Date.parse(val)), {
            message: "Invalid expiry date format"
        }).optional(),
        supplierId: zod_1.z.string().optional(), // For vendor uploading to specific supplier
        isPrivate: zod_1.z.boolean().optional().default(false),
        accessRoles: zod_1.z.array(zod_1.z.enum(['ADMIN', 'VENDOR', 'SUPPLIER'])).optional()
    })
});
exports.updateDocumentSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().optional(),
        type: zod_1.z.string().optional(),
        category: zod_1.z.string().optional(),
        description: zod_1.z.string().optional(),
        expiryDate: zod_1.z.string().refine(val => !val || !isNaN(Date.parse(val))).optional(),
        status: zod_1.z.enum(['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED']).optional(),
        reviewNotes: zod_1.z.string().optional(),
        isPrivate: zod_1.z.boolean().optional(),
        accessRoles: zod_1.z.array(zod_1.z.enum(['ADMIN', 'VENDOR', 'SUPPLIER'])).optional()
    })
});
exports.reviewDocumentSchema = zod_1.z.object({
    body: zod_1.z.object({
        status: zod_1.z.enum(['APPROVED', 'REJECTED']),
        reviewNotes: zod_1.z.string().optional()
    })
});
exports.documentFilterSchema = zod_1.z.object({
    query: zod_1.z.object({
        supplierId: zod_1.z.string().optional(),
        vendorId: zod_1.z.string().optional(),
        category: zod_1.z.string().optional(),
        type: zod_1.z.string().optional(),
        status: zod_1.z.string().optional(),
        search: zod_1.z.string().optional(),
        expiredOnly: zod_1.z.string().optional(),
        expiringSoon: zod_1.z.string().optional(),
        page: zod_1.z.string().optional(),
        limit: zod_1.z.string().optional(),
        sortBy: zod_1.z.string().optional(),
        sortOrder: zod_1.z.string().optional()
    })
});
