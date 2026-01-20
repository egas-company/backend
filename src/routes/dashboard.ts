import express from "express";
import { authenticate, authorize } from "../middleware/auth";
import { dashboardController } from "../controllers/dashboard";
import { UserRole } from "../types/user";

const router = express.Router();

// Apply authentication and admin authorization
router.use(authenticate, authorize([UserRole.ADMIN]));


router.get("/orders-stats", dashboardController.getStats);
router.get("/recent-orders", dashboardController.getRecentOrders);

export default router; 