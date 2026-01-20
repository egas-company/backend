import { Router, RequestHandler } from "express";
import { cardPaymentController } from "../controllers/cardPaymentController";
import { authenticate } from "../middleware/auth";

const router = Router();

router.post(
  "/purchase",
  authenticate as RequestHandler,
  cardPaymentController.initiatePayment
);

router.post(
  "/verify-otp",
  authenticate as RequestHandler,
  cardPaymentController.authenticateOtp
);

router.post(
  "/payonline",
  authenticate as RequestHandler,
  cardPaymentController.initiatePayment
);

export default router;
