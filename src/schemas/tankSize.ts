import { z } from "zod";

export const tankSizeSchema = {
  create: z.object({
    size: z.string().min(2, "Size must be at least 2 characters"),
    price: z.number().min(0, "Price must be greater than 0"),
  }),

  update: z.object({
    price: z.number().min(0, "Price must be greater than 0").optional(),
    isActive: z.boolean().optional(),
  }),
}; 