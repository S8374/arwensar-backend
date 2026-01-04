"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.completeSupplierRegistrationSchema = exports.updateSupplierInputSchema = exports.createSupplierInputSchema = void 0;
// src/modules/supplier/supplier.constant.ts
const zod_1 = require("zod");
exports.createSupplierInputSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().min(1, "Name is required"),
        contactPerson: zod_1.z.string().min(1, "Contact person is required"),
        email: zod_1.z.string().email("Valid email is required"),
        phone: zod_1.z.string().min(1, "Phone number is required"),
        category: zod_1.z.string().min(1, "Category is required"),
        criticality: zod_1.z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
        contractStartDate: zod_1.z.string().refine(val => !isNaN(Date.parse(val)), {
            message: "Valid contract start date is required"
        }),
        contractEndDate: zod_1.z.string().refine(val => !isNaN(Date.parse(val)), {
            message: "Valid contract end date is required"
        }).optional(),
        documentUrl: zod_1.z.string().optional(),
        documentType: zod_1.z.string().optional()
    })
});
exports.updateSupplierInputSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().min(1).optional(),
        contactPerson: zod_1.z.string().min(1).optional(),
        email: zod_1.z.string().email().optional(),
        phone: zod_1.z.string().optional(),
        category: zod_1.z.string().optional(),
        criticality: zod_1.z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
        contractStartDate: zod_1.z.string().refine(val => !isNaN(Date.parse(val))).optional(),
        contractEndDate: zod_1.z.string().refine(val => !isNaN(Date.parse(val))).optional(),
        documentUrl: zod_1.z.string().optional(),
        documentType: zod_1.z.string().optional(),
        totalContractValue: zod_1.z.number().optional(),
        outstandingPayments: zod_1.z.number().optional(),
        onTimeDeliveryRate: zod_1.z.number().min(0).max(100).optional(),
        averageResponseTime: zod_1.z.number().int().optional()
    })
});
exports.completeSupplierRegistrationSchema = zod_1.z.object({
    body: zod_1.z.object({
        invitationToken: zod_1.z.string().min(1, "Invitation token is required"),
        password: zod_1.z.string().min(6, "Password must be at least 6 characters"),
        confirmPassword: zod_1.z.string().min(6, "Confirm password is required")
    }).refine(data => data.password === data.confirmPassword, {
        message: "Passwords don't match",
        path: ["confirmPassword"]
    })
});
