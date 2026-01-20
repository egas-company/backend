import express, { RequestHandler } from "express";
import { authenticate, authorize } from "../middleware/auth";
import { UserRole } from "../types/user";
import { orderController } from "../controllers/order";
import { validate } from "../middleware/validate";
import { orderSchema } from "../schemas/order";
import { getMe, updateProfile, deleteProfile } from "../controllers/auth";
import { registerDevice } from "../controllers/notificationDeviceController";
import { authSchema } from "../schemas/auth";

const router = express.Router();

router.use(authenticate, authorize([UserRole.CLIENT]));

router.post(
  "/orders",
  validate(orderSchema.create),
  orderController.createOrder as unknown as RequestHandler
);

// Check active orders before placing new order
router.get(
  "/orders/active",
  orderController.checkActiveOrders as unknown as RequestHandler
);

// Check POS payment eligibility
router.get(
  "/payment/pos-eligibility",
  orderController.checkPOSPaymentEligibility as unknown as RequestHandler
);

router.put(
  "/profile",
  validate(authSchema.updateProfile),
  updateProfile as unknown as RequestHandler
);

router.delete("/profile", deleteProfile as unknown as RequestHandler);

router.get(
  "/orders",
  orderController.getClientOrders as unknown as RequestHandler
);

router.put(
  "/push-token",
  registerDevice as unknown as RequestHandler
);

router.get(
  "/orders/:id",
  orderController.getOrder as unknown as RequestHandler
);

router.get("/me", getMe as unknown as RequestHandler);

router.post(
  "/orders/:orderId/confirm-delivery",
  orderController.confirmDelivery as unknown as RequestHandler
);

export default router;
