import { Router } from "express";
import { verifyPaystackPayment, getPaystackPublicKey } from "../controllers/paystack";

const router = Router();

router.get("/public-key", getPaystackPublicKey);
router.post("/verify", verifyPaystackPayment);

export default router;
