"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateVendorProfileSchema = void 0;
// src/modules/vendor/vendor.constant.ts
const zod_1 = require("zod");
exports.updateVendorProfileSchema = zod_1.z.object({
    body: zod_1.z.object({
        companyName: zod_1.z.string().min(1).optional(),
        businessEmail: zod_1.z.string().email().optional(),
        contactNumber: zod_1.z.string().optional(),
        industryType: zod_1.z.string().optional(),
        firstName: zod_1.z.string().optional(),
        lastName: zod_1.z.string().optional(),
        companyLogo: zod_1.z.string().optional()
    })
});
