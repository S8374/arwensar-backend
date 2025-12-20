// src/modules/vendor/vendor.constant.ts
import { z } from 'zod';

export const updateVendorProfileSchema = z.object({
  body: z.object({
    companyName: z.string().min(1).optional(),
    businessEmail: z.string().email().optional(),
    contactNumber: z.string().optional(),
    industryType: z.string().optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    companyLogo: z.string().optional()
  })
});