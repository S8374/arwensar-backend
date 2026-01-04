// src/types/express.d.ts
import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        role: "ADMIN" | "VENDOR" | "SUPPLIER";
        vendorId?: string;
        supplierId?: string;
        iat?: number;
        exp?: number;
      };
    }
  }
}