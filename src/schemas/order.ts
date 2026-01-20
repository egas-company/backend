import { z } from "zod";
import { prisma } from "../lib/prisma";

export const orderSchema = {
  create: z.object({
    tankSize: z.string().refine(async (size) => {
      const tankSize = await prisma.tankSize.findFirst({
        where: { size, status: 'ACTIVE' }
      });
      return !!tankSize;
    }, "Invalid tank size selected"),
    deliveryAddress: z.string().min(5, "Delivery address is required"),
    paymentMethod: z.enum(["CARD", "CASH", "BANK_TRANSFER", "POS", "ONLINE"]),
    notes: z.string().optional(),
    deliveryLatitude: z.number(),
    deliveryLongitude: z.number(),
  }),
  update: z.object({
    status: z.enum([
      "PENDING",
      "ACCEPTED",
      "IN_TRANSIT",
      "DELIVERED",
      "CANCELLED",
    ]),
    driverId: z.string().optional(),
    actualDeliveryDate: z.string().optional(),
  }),
};
