import { Router } from "express";
import { verifyPayOnlinePayment } from "../controllers/payOnline";

const router = Router();

// Public: used by mobile app/webview callback
router.post("/payments/verify", verifyPayOnlinePayment);

export default router;
