// src/routes/index.ts
import express from 'express';
import { AuthRoutes } from '../modules/auth/auth.route';
import { UserRoutes } from '../modules/user/user.route';
import { AdminRoutes } from '../modules/admin/admin.route';
import { VendorRoutes } from '../modules/vendor/vendor.route';
import { SupplierRoutes } from '../modules/supplier/supplier.route';
import { AssessmentRoutes } from '../modules/assessment/assessment.route';
import { NotificationRoutes } from '../modules/notification/notification.route';
import { ProblemRoutes } from '../modules/problem/problem.route';
import { paymentRoutes } from '../modules/payment/payment.routes';
import { WebhookRoutes } from '../modules/webhook/webhook.routes';
import { DocumentRoutes } from '../modules/documents/document.route';
import { reportRoutes } from '../modules/report/report.route';
import Minorouter from '../modules/upload/upload.route';
import { activityRoutes } from '../modules/activity/activity.routes';
import { UsageRoutes } from '../modules/usage/usage.routes';

const router = express.Router();

const moduleRoutes = [
  { path: '/auth', route: AuthRoutes },
  { path: '/user', route: UserRoutes },
  { path: '/admin', route: AdminRoutes },
  { path: '/vendor', route: VendorRoutes },
  { path: '/supplier', route: SupplierRoutes },
  { path: '/assessments', route: AssessmentRoutes },
  { path: '/notifications', route: NotificationRoutes },
  { path: '/reports', route: reportRoutes },
  { path: '/payment', route: paymentRoutes },
  { path: '/problems', route: ProblemRoutes },
  { path: '/webhook', route: WebhookRoutes },// Webhook routes should be last
  { path: '/documents', route: DocumentRoutes }, // Document routes should be last
  { path: '/uploade', route: Minorouter },// Document routes should be last
  { path: '/activity', route: activityRoutes },// Document routes should be last
{
    path: '/usage',
    route: UsageRoutes
  }
];

moduleRoutes.forEach(route => router.use(route.path, route.route));

export default router;