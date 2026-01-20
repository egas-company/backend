import rateLimit from "express-rate-limit";

export const otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 4,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many OTP requests. Please try again later.",
});

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests from this IP",
});

export const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many verification attempts. Please try again later.",
});
