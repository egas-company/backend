import express from "express";
import { registerDevice, unregisterDevice, sendTestNotification } from "../controllers/notificationDeviceController";
import { authenticate } from "../middleware/auth";

const router = express.Router();

router.use(authenticate);

router.post("/register", registerDevice);
router.delete("/unregister", unregisterDevice);
router.post("/send-test", sendTestNotification);

export default router;
