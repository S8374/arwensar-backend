// src/routes/index.ts
import express from 'express';
import { AuthRoutes } from '../modules/auth/auth.route';
import { UserRoutes } from '../modules/user/user.route';
import { AdminRoutes } from '../modules/admin/admin.route';
import { VendorRoutes } from '../modules/vendor/vendor.route';
import { SupplierRoutes } from '../modules/supplier/supplier.route';
import { AssessmentRoutes } from '../modules/assessment/assessment.route';
import { NotificationRoutes } from '../modules/notification/notification.route';
import { ReportRoutes } from '../modules/report/report.route';
import { ProblemRoutes } from '../modules/problem/problem.route';
import { PaymentRoutes } from '../modules/payment/payment.route';
import { SubscriptionRoutes } from '../modules/subscription/subscription.route';

const router = express.Router();

const moduleRoutes = [
  { path: '/auth', route: AuthRoutes },
  { path: '/users', route: UserRoutes },
  { path: '/admin', route: AdminRoutes },
  { path: '/vendor', route: VendorRoutes },
  { path: '/supplier', route: SupplierRoutes },
  { path: '/assessments', route: AssessmentRoutes },
  { path: '/notifications', route: NotificationRoutes },
  { path: '/reports', route: ReportRoutes },
  { path: '/payment', route: PaymentRoutes },
  { path: '/subscription', route: SubscriptionRoutes },
  { path: '/problems', route: ProblemRoutes }
];

moduleRoutes.forEach(route => router.use(route.path, route.route));

export default router;