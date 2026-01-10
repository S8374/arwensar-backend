"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/index.ts
const express_1 = __importDefault(require("express"));
const auth_route_1 = require("../modules/auth/auth.route");
const user_route_1 = require("../modules/user/user.route");
const admin_route_1 = require("../modules/admin/admin.route");
const vendor_route_1 = require("../modules/vendor/vendor.route");
const supplier_route_1 = require("../modules/supplier/supplier.route");
const assessment_route_1 = require("../modules/assessment/assessment.route");
const notification_route_1 = require("../modules/notification/notification.route");
const problem_route_1 = require("../modules/problem/problem.route");
const payment_routes_1 = require("../modules/payment/payment.routes");
const webhook_routes_1 = require("../modules/webhook/webhook.routes");
const document_route_1 = require("../modules/documents/document.route");
const report_route_1 = require("../modules/report/report.route");
const upload_route_1 = __importDefault(require("../modules/upload/upload.route"));
const activity_routes_1 = require("../modules/activity/activity.routes");
const usage_routes_1 = require("../modules/usage/usage.routes");
const router = express_1.default.Router();
const moduleRoutes = [
    { path: '/auth', route: auth_route_1.AuthRoutes },
    { path: '/user', route: user_route_1.UserRoutes },
    { path: '/admin', route: admin_route_1.AdminRoutes },
    { path: '/vendor', route: vendor_route_1.VendorRoutes },
    { path: '/supplier', route: supplier_route_1.SupplierRoutes },
    { path: '/assessments', route: assessment_route_1.AssessmentRoutes },
    { path: '/notifications', route: notification_route_1.NotificationRoutes },
    { path: '/reports', route: report_route_1.reportRoutes },
    { path: '/payment', route: payment_routes_1.paymentRoutes },
    { path: '/problems', route: problem_route_1.ProblemRoutes },
    { path: '/webhook', route: webhook_routes_1.WebhookRoutes }, // Webhook routes should be last
    { path: '/documents', route: document_route_1.DocumentRoutes }, // Document routes should be last
    { path: '/uploade', route: upload_route_1.default }, // Document routes should be last
    { path: '/activity', route: activity_routes_1.activityRoutes }, // Document routes should be last
    {
        path: '/usage',
        route: usage_routes_1.UsageRoutes
    }
];
moduleRoutes.forEach(route => router.use(route.path, route.route));
exports.default = router;
