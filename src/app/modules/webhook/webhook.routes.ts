// src/app/modules/webhook/webhook.route.ts
import express from "express";
import { WebhookController } from "./webhook.controller";

const router = express.Router();

// Stripe webhook endpoint - Note: No body parser should be used for this route
router.post(
  "/stripe",
  express.raw({ type: "application/json" }),
  WebhookController.handleWebhook
);

export const WebhookRoutes = router;

//  https://periodontal-garrett-dintless.ngrok-free.dev/webhook/stripe