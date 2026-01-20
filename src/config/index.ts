import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.string().default("3000"),
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string(),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  INTERSWITCH_BASE_URL: z.string(),
  INTERSWITCH_MERCHANT_CODE: z.string(),
  INTERSWITCH_MERCHANT_ID: z.string().default(""),
  INTERSWITCH_CLIENT_ID: z.string(),
  INTERSWITCH_SECRET_KEY: z.string(),
  INTERSWITCH_PUBLIC_MODULUS: z.string().optional(),
  INTERSWITCH_PUBLIC_EXPONENT: z.string().optional(),
  INTERSWITCH_PAYITEMID: z.string(),
  INTERSWITCH_CALLBACKURL: z.string().default("https://example.com/"),
  INTERSWITCH_INLINE_SCRIPT: z.string().optional(),
  PAYSTACK_SECRET_KEY: z.string().optional(),
  PAYSTACK_PUBLIC_KEY: z.string().optional(),
});

const envVars = envSchema.safeParse(process.env);

if (!envVars.success) {
  throw new Error(`Config validation error: ${envVars.error.message}`);
}

export const config = {
  env: envVars.data.NODE_ENV,
  port: parseInt(envVars.data.PORT, 10),
  database: {
    url: envVars.data.DATABASE_URL,
  },
  jwt: {
    secret: envVars.data.JWT_SECRET,
    accessExpiresIn: envVars.data.JWT_ACCESS_EXPIRES_IN,
    refreshExpiresIn: envVars.data.JWT_REFRESH_EXPIRES_IN,
  },
  redis: {
    url: envVars.data.REDIS_URL,
  },
  otp: {
    expiresIn: 5 * 60, // 5 minutes in seconds
    maxAttempts: 3,
    blockDuration: 30 * 60, // 30 minutes in seconds
  },
  interswitch: {
    baseUrl: envVars.data.INTERSWITCH_BASE_URL,
    merchantCode: envVars.data.INTERSWITCH_MERCHANT_CODE,
    merchantId: envVars.data.INTERSWITCH_MERCHANT_ID,
    clientId: envVars.data.INTERSWITCH_CLIENT_ID,
    secretKey: envVars.data.INTERSWITCH_SECRET_KEY,
    publicModulus: envVars.data.INTERSWITCH_PUBLIC_MODULUS,
    publicExponent: envVars.data.INTERSWITCH_PUBLIC_EXPONENT,
    paymentItemId: envVars.data.INTERSWITCH_PAYITEMID,
    callbackUrl: envVars.data.INTERSWITCH_CALLBACKURL,
    inlineScript: envVars.data.INTERSWITCH_INLINE_SCRIPT,
  },
  paystack: {
    secretKey: envVars.data.PAYSTACK_SECRET_KEY,
    publicKey: envVars.data.PAYSTACK_PUBLIC_KEY,
  },
} as const;
