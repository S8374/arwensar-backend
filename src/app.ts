import express, { Application, Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import globalErrorHandler from "./app/middlewares/globalErrorHandler";
import notFound from "./app/middlewares/notFound";
import router from "./app/routes";
import { WebhookRoutes } from "./app/modules/webhook/webhook.routes";
import { config } from "./config";

const app: Application = express();

// Apply CORS for all routes
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://periodontal-garrett-dintless.ngrok-free.dev/",
      "https://arwensar-frontend.vercel.app",
      "https://dev.cybernark.com",
      "https://cybernark.com"
    ],
    credentials: true,
  })
);

// Parse cookies
app.use(cookieParser());

// IMPORTANT: Create a separate router for webhooks that needs raw body
const webhookRouter = express.Router();

// Middleware for webhook routes - needs raw body for Stripe signature verification
webhookRouter.use(express.raw({ type: 'application/json' }));

// Regular router for all other routes
const apiRouter = express.Router();

// Parse JSON for all other routes
apiRouter.use(express.json());
apiRouter.use(express.urlencoded({ extended: true }));

// Import your routes


// Mount webhook routes to webhook router (uses raw body)
webhookRouter.use(WebhookRoutes);

// Mount regular routes to api router (uses JSON parser)
apiRouter.use(router);

// Mount both routers
app.use("/webhook", webhookRouter); // Webhook routes at /webhook
app.use("/api/v1", apiRouter);      // API routes at /api/v1


app.get("/", (req: Request, res: Response) => {
  res.send({
    message: "Server is running..",
    environment: config.node_env,
    uptime: process.uptime().toFixed(2) + " sec",
    timeStamp: new Date().toISOString(),
  });
});

app.use(globalErrorHandler);
app.use(notFound);

export default app;