import { Router } from "express";
import { createInterswitchPayment, verifyInterswitchPayment } from "../controllers/interswitch";
import { authenticate } from "../middleware/auth";

const router = Router();

// Prepare inline checkout payload (protected: user must be authenticated)
router.post("/init", authenticate as any, createInterswitchPayment);

// Verify payment (client or webhook can call; keep protected to prevent abuse)
router.post("/verify", authenticate as any, verifyInterswitchPayment);

export default router;
