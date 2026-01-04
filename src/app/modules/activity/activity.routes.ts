import auth from "../../middlewares/auth";
import { ActivityLogController } from "./activity.controller";
import express from "express";

const router = express.Router();

router.get("/me", auth("VENDOR", "SUPPLIER", "ADMIN"), ActivityLogController.getMyActivity);
router.get("/recent", auth("ADMIN"), ActivityLogController.getRecentActivity);
router.get(
  "/user/:userId",
  auth("VENDOR", "SUPPLIER", "ADMIN"), // any logged-in user
  ActivityLogController.getActivityByUserId
);


export const activityRoutes = router;