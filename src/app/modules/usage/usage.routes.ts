// src/app/modules/usage/usage.routes.ts
import express from 'express';
import { UsageController } from './usage.controller';
import auth from '../../middlewares/auth';


const router = express.Router();

// ========== PROTECTED ROUTES ==========

// Get current usage (for current user)
router.get(
  '/my-access',
  auth('ADMIN', 'VENDOR', 'SUPPLIER'),
  UsageController.getCurrentUsage
);

// Check if user has enough usage (without decrementing)
router.post(
  '/check-usage',
  auth('ADMIN', 'VENDOR', 'SUPPLIER'),
  UsageController.checkUsage
);

// Decrement usage (use this when performing an action)
router.post(
  '/decrement-usage',
  auth('ADMIN', 'VENDOR', 'SUPPLIER'),
  UsageController.decrementUsage
);

// ========== ADMIN ONLY ROUTES ==========

// Reset usage (admin only)
router.post(
  '/reset-usage',
  auth('ADMIN'),
  UsageController.resetUsage
);

export const UsageRoutes = router;