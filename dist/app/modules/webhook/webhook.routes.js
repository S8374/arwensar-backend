"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookRoutes = void 0;
// src/app/modules/webhook/webhook.route.ts
const express_1 = __importDefault(require("express"));
const webhook_controller_1 = require("./webhook.controller");
const router = express_1.default.Router();
// Stripe webhook endpoint - Note: No body parser should be used for this route
router.post("/stripe", express_1.default.raw({ type: "application/json" }), webhook_controller_1.WebhookController.handleWebhook);
exports.WebhookRoutes = router;
//  https://periodontal-garrett-dintless.ngrok-free.dev/webhook/stripe
