import { OrderStatus } from "@prisma/client";

export interface CreateOrderInput {
  userId: string;
  tankSizeId: string;
  tankSize: string;
  deliveryAddress: string;
  paymentMethod: "CARD" | "CASH" | "BANK_TRANSFER" | "POS" | "ONLINE";
  amount: number;
  notes?: string;
  deliveryLatitude: number;
  deliveryLongitude: number;
}

export interface UpdateOrderStatusInput {
  status: OrderStatus;
  driverId?: string;
  cancellationReason?: string;
}
