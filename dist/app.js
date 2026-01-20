"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const globalErrorHandler_1 = __importDefault(require("./app/middlewares/globalErrorHandler"));
const notFound_1 = __importDefault(require("./app/middlewares/notFound"));
const routes_1 = __importDefault(require("./app/routes"));
const webhook_routes_1 = require("./app/modules/webhook/webhook.routes");
const config_1 = require("./config");
const app = (0, express_1.default)();
// Apply CORS for all routes
app.use((0, cors_1.default)({
    origin: [
        "http://localhost:5173",
        "https://dev.cybernark.com",
        "https://cybernark.com",
        "https://www.cybernark.com"
    ],
    credentials: true,
}));
// Parse cookies
app.use((0, cookie_parser_1.default)());
// IMPORTANT: Create a separate router for webhooks that needs raw body
const webhookRouter = express_1.default.Router();
// Middleware for webhook routes - needs raw body for Stripe signature verification
webhookRouter.use(express_1.default.raw({ type: 'application/json' }));
// Regular router for all other routes
const apiRouter = express_1.default.Router();
// Parse JSON for all other routes
apiRouter.use(express_1.default.json());
apiRouter.use(express_1.default.urlencoded({ extended: true }));
// Import your routes
// Mount webhook routes to webhook router (uses raw body)
webhookRouter.use(webhook_routes_1.WebhookRoutes);
// Mount regular routes to api router (uses JSON parser)
apiRouter.use(routes_1.default);
// Mount both routers
app.use("/webhook", webhookRouter); // Webhook routes at /webhook
app.use("/api/v1", apiRouter); // API routes at /api/v1
app.get("/", (req, res) => {
    res.send({
        message: "Server is running..",
        environment: config_1.config.node_env,
        uptime: process.uptime().toFixed(2) + " sec",
        timeStamp: new Date().toISOString(),
    });
});
app.use(globalErrorHandler_1.default);
app.use(notFound_1.default);
exports.default = app;
