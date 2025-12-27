// src/app/modules/payment/payment.routes.ts
import express from 'express';
import auth from '../../middlewares/auth';
import { UserRole } from '@prisma/client';
import validateRequest from '../../middlewares/validateRequest';
import { PaymentController } from './payment.controller';
import { createCheckoutSchema } from './payment.validation';

const router = express.Router();

// Create checkout session
router.post(
  '/create-checkout-session',
  auth(UserRole.VENDOR),
  validateRequest(createCheckoutSchema),
  PaymentController.createCheckoutSession
);

// Get session status (public for frontend polling)
router.get(
  '/session-status/:sessionId',
  PaymentController.getSessionStatus
);

// Create portal session for customer portal
router.post(
  '/create-portal-session',
  auth(UserRole.VENDOR),
  PaymentController.createPortalSession
);



export const paymentRoutes = router;