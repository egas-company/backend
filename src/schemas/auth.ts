import { z } from "zod";
import { UserRole } from "@prisma/client";

const phoneNumberRegex = /^\+234[0-9]{10}$/;

// Base schemas
const phoneNumberSchema = z
  .string()
  .regex(
    phoneNumberRegex,
    "Phone number must be a valid Nigerian number starting with +234"
  )
  .min(14, "Phone number must be 14 characters long")
  .max(14, "Phone number must be 14 characters long");

const otpSchema = z
  .string()
  .length(6, "OTP must be exactly 6 digits")
  .regex(/^\d+$/, "OTP must contain only numbers");

export const authSchema = {
  // Request OTP
  requestOTP: z.object({
    phoneNumber: phoneNumberSchema,
  }),

  // Verify OTP
  verifyOTP: z.object({
    phoneNumber: phoneNumberSchema,
    otp: otpSchema,
  }),

  // Logout
  logout: z.object({
    refreshToken: z.string().min(1, "Refresh token is required"),
  }),

  updateProfile: z.object({
    firstName: z
      .string()
      .min(2, "First name must be at least 2 characters")
      .optional(),
    lastName: z
      .string()
      .min(2, "Last name must be at least 2 characters")
      .optional(),
    email: z.string().email("Invalid email address").optional(),
    tankSize: z.string().min(1, "Tank size is required").optional(),
    address: z
      .string()
      .min(5, "Address must be at least 5 characters")
      .optional(),
    city: z.string().min(1, "City is required").optional(),
    area: z.string().min(1, "Area is required").optional(),
    termsAccepted: z.boolean().optional(),
  }),

  // Refresh token
  refreshToken: z.object({
    refreshToken: z.string().min(1, "Refresh token is required"),
  }),

  // Driver login schema
  driverLogin: z.object({
    email: z.string().email("Invalid email format"),
    password: z.string().min(8, "Password is required"),
  }),

  // Password reset request
  requestPasswordReset: z.object({
    email: z.string().email("Invalid email format"),
  }),

  // Reset password
  resetPassword: z.object({
    token: z.string(),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
        "Password must contain at least one uppercase letter, one lowercase letter, one number and one special character"
      ),
  }),

} as const;

// Response schemas
export const authResponseSchema = {
  // User data
  user: z.object({
    id: z.string(),
    phoneNumber: phoneNumberSchema,
    role: z.nativeEnum(UserRole),
    verified: z.boolean(),
    active: z.boolean(),
    createdAt: z.date(),
    updatedAt: z.date(),
  }),

  // OTP request response
  otpRequest: z.object({
    success: z.boolean(),
    message: z.string(),
    data: z
      .object({
        timeout: z.number(),
        attemptCount: z.number().optional(),
        nextRetry: z.date().optional(),
      })
      .optional(),
  }),

  // Auth response with tokens
  auth: z.object({
    success: z.boolean(),
    message: z.string(),
    data: z.object({
      user: z.object({
        id: z.string(),
        phoneNumber: phoneNumberSchema,
        role: z.nativeEnum(UserRole),
      }),
      accessToken: z.string(),
      refreshToken: z.string(),
    }),
  }),
} as const;

// Types for TypeScript
export type RequestOTPSchema = z.infer<typeof authSchema.requestOTP>;
export type VerifyOTPSchema = z.infer<typeof authSchema.verifyOTP>;
export type UserSchema = z.infer<typeof authResponseSchema.user>;
export type OTPRequestResponse = z.infer<typeof authResponseSchema.otpRequest>;
export type AuthResponse = z.infer<typeof authResponseSchema.auth>;

// Error messages
export const AUTH_ERROR_MESSAGES = {
  INVALID_PHONE:
    "Invalid phone number format. Must start with +234 followed by 10 digits",
  INVALID_OTP: "Invalid OTP format. Must be 6 digits",
  EXPIRED_OTP: "OTP has expired. Please request a new one",
  MAX_ATTEMPTS: "Maximum attempts reached. Please try again later",
  INVALID_TOKEN: "Invalid or expired token",
  USER_NOT_FOUND: "User not found",
  USER_INACTIVE: "User account is inactive",
} as const;

// Validation functions
export const authValidation = {
  isValidPhoneNumber: (phoneNumber: string): boolean => {
    return phoneNumberRegex.test(phoneNumber);
  },

  isValidOTP: (otp: string): boolean => {
    return /^\d{6}$/.test(otp);
  },

  sanitizePhoneNumber: (phoneNumber: string): string => {
    // Remove all non-numeric characters except +
    return phoneNumber.replace(/[^\d+]/g, "");
  },
};

// Additional helper types
export type PhoneNumber = z.infer<typeof phoneNumberSchema>;
export type OTPCode = z.infer<typeof otpSchema>;
// Schema for environment variables validation
export const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.string().default("3000"),
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string(),
  JWT_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  OTP_EXPIRY_MINUTES: z.string().default("5"),
  OTP_MAX_ATTEMPTS: z.string().default("3"),
  RATE_LIMIT_WINDOW_MS: z.string().default("900000"), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z.string().default("5"),
});

// Type for validated environment variables
export type Env = z.infer<typeof envSchema>;

// Add to types
export type UpdateProfileSchema = z.infer<typeof authSchema.updateProfile>;
