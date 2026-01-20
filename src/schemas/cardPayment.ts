import { z } from "zod";

const cardPaymentSchema = z.object({
  customerId: z.string().min(1, "Customer ID is required"),
  amount: z.number().positive("Amount must be positive"),
  currency: z.literal("NGN", { description: "Only NGN currency is supported" }),
  authData: z.string().min(1, "Encrypted card data is required"),
  transactionRef: z.string().min(1, "Transaction reference is required"),
});

export { cardPaymentSchema };
