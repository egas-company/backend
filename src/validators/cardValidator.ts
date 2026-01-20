import { z } from "zod";

export const cardSchema = z.object({
  cardNumber: z
    .string()
    .regex(/^[0-9]{13,19}$/, "Invalid card number")
    .transform(val => val.replace(/\s/g, "")),

  cvv: z.string().regex(/^[0-9]{3,4}$/, "Invalid CVV"),

  expiryMonth: z
    .string()
    .regex(/^(0[1-9]|1[0-2])$/, "Invalid expiry month")
    .or(
      z
        .number()
        .min(1)
        .max(12)
        .transform(val => val.toString().padStart(2, "0"))
    ),

  expiryYear: z
    .string()
    .regex(/^[0-9]{2}|[0-9]{4}$/, "Invalid expiry year")
    .or(z.number().transform(val => val.toString())),

  pin: z
    .string()
    .regex(/^[0-9]{4}$/, "Invalid PIN")
    .optional(),
});

export const paymentRequestSchema = z.object({
  cardDetails: cardSchema,
  amount: z.number().positive("Amount must be greater than 0"),
  currency: z.literal("NGN"),
  customerId: z.string().min(1, "Customer ID is required"),
  transactionRef: z.string().optional(),
});
