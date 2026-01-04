// src/modules/supplier/supplier.constant.ts
import { z } from 'zod';

export const createSupplierInputSchema = z.object({
  body: z.object({
    name: z.string().min(1, "Name is required"),
    contactPerson: z.string().min(1, "Contact person is required"),
    email: z.string().email("Valid email is required"),
    phone: z.string().min(1, "Phone number is required"),
    category: z.string().min(1, "Category is required"),
    criticality: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
    contractStartDate: z.string().refine(val => !isNaN(Date.parse(val)), {
      message: "Valid contract start date is required"
    }),
    contractEndDate: z.string().refine(val => !isNaN(Date.parse(val)), {
      message: "Valid contract end date is required"
    }).optional(),
    documentUrl: z.string().optional(),
    documentType: z.string().optional()
  })
});

export const updateSupplierInputSchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    contactPerson: z.string().min(1).optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    category: z.string().optional(),
    criticality: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
    contractStartDate: z.string().refine(val => !isNaN(Date.parse(val))).optional(),
    contractEndDate: z.string().refine(val => !isNaN(Date.parse(val))).optional(),
    documentUrl: z.string().optional(),
    documentType: z.string().optional(),
    totalContractValue: z.number().optional(),
    outstandingPayments: z.number().optional(),
    onTimeDeliveryRate: z.number().min(0).max(100).optional(),
    averageResponseTime: z.number().int().optional()
  })
});

export const completeSupplierRegistrationSchema = z.object({
  body: z.object({
    invitationToken: z.string().min(1, "Invitation token is required"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string().min(6, "Confirm password is required")
  }).refine(data => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"]
  })
});