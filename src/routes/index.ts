import express from "express";
import authRoutes from "./auth";
import adminAuthRoutes from "./adminAuth";
import adminRoutes from "./admin";
import cardPaymentRoutes from "./cardPayment";
import clientRoutes from "./client";
import tankSizeRoutes from "./tankSize";
import driverRoutes from "./driver";
import dashboardRoutes from "./dashboard";
import notificationRoutes from "./notifications";
import paystackRoutes from "./paystack";
import interswitchRoutes from "./interswitch";
import payonlineRoutes from "./payonline";
const router = express.Router();

// Public routes
router.use("/auth", authRoutes);
router.use("/admin/auth", adminAuthRoutes);

// Protected routes
router.use("/client", clientRoutes);
router.use("/admin/dashboard", dashboardRoutes);
router.use("/card-payment", cardPaymentRoutes);
router.use("/paystack", paystackRoutes);
router.use("/interswitch", interswitchRoutes);
router.use("/tank-sizes", tankSizeRoutes);
router.use("/admin", adminRoutes);
router.use("/driver", driverRoutes);
router.use("/notifications", notificationRoutes);
router.use("/payonline", payonlineRoutes);

export default router;
