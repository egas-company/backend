import express from "express";
import { validate } from "../middleware/validate";
import { authSchema } from "../schemas/auth";
import {
  verifyOTP,
  requestOTP,
  logout,
  refreshToken,
  driverLogin,
  requestPasswordReset,
  resetPassword,
} from "../controllers/auth";
import { getRemainingAttempts } from "../utils/rateLimiter";
import { otpLimiter, otpVerifyLimiter } from "../middleware/rateLimiter";

const router = express.Router();

router.post(
  "/request-otp",
  validate(authSchema.requestOTP),
  requestOTP
);

router.post(
  "/verify-otp",
  validate(authSchema.verifyOTP),
  verifyOTP
);

router.post("/logout", validate(authSchema.logout), logout);

router.post("/refresh-token", validate(authSchema.refreshToken), refreshToken);

router.post("/driver/login", validate(authSchema.driverLogin), driverLogin);

router.post(
  "/driver/password-reset",
  validate(authSchema.requestPasswordReset),
  requestPasswordReset
);

router.post(
  "/driver/reset-password",
  validate(authSchema.resetPassword),
  resetPassword
);

// Debug route to check remaining login attempts
router.get("/login-attempts/:phoneNumber", async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    const ipAddress = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
    const attempts = await getRemainingAttempts(phoneNumber, ipAddress);
    res.json({
      success: true,
      data: attempts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to get login attempts"
    });
  }
});

export default router;
