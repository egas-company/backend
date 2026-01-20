import express, { RequestHandler } from "express";
import { authenticate, authorize } from "../middleware/auth";
import { UserRole } from "../types/user";
import {
  acceptOrder,
  declineOrder,
  startDelivery,
  completeDelivery,
  getOrderHistory,
  getCurrentOrders,
  updateAvailability,
  updateLocation,
  getProfile,
  updateProfile,
  uploadDocument,
  getOngoingOrders,
  confirmReassignment,
} from "../controllers/driverController";
import { registerDevice } from "../controllers/notificationDeviceController";

const router = express.Router();

router.use(authenticate, authorize([UserRole.DRIVER]));

router.post(
  "/orders/:orderId/accept",
  acceptOrder as unknown as RequestHandler
);
router.post(
  "/orders/:orderId/decline",
  declineOrder as unknown as RequestHandler
);
router.post(
  "/orders/:orderId/reassignment/confirm",
  confirmReassignment as unknown as RequestHandler
);
router.put(
  "/push-token",
  registerDevice as unknown as RequestHandler
);
router.post("/location", updateLocation as unknown as RequestHandler);
router.patch("/availability", updateAvailability as unknown as RequestHandler);

// Orders
router.get("/orders/current", getCurrentOrders as unknown as RequestHandler);
router.get("/orders/history", getOrderHistory as unknown as RequestHandler);
router.get("/orders/ongoing", getOngoingOrders as unknown as RequestHandler);

// Profile and documents
router.patch("/profile", updateProfile as unknown as RequestHandler);
router.post("/documents", uploadDocument as unknown as RequestHandler);
router.get("/profile", getProfile as unknown as RequestHandler);
router.post(
  "/orders/:orderId/start-delivery",
  startDelivery as unknown as RequestHandler
);

router.post(
  "/orders/:orderId/complete-delivery",
  completeDelivery as unknown as RequestHandler
);

export default router;
