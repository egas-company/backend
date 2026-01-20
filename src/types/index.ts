import { z } from "zod";
import { Request } from "express";
import { PaymentType, UserRole } from "@prisma/client";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: UserRole;
    phoneNumber: string;
  };
}

export const phoneNumberSchema = z
  .string()
  .regex(/^\+234[0-9]{10}$/, "Invalid Nigerian phone number format");

export const otpSchema = z
  .string()
  .length(6, "OTP must be 6 digits")
  .regex(/^[0-9]{6}$/, "OTP must only contain numbers");

export interface CreateOrderDTO {
  userId: string;
  tankSize: string;
  quantity: number;
  deliveryAddress: string;
  deliveryLatitude: number;
  deliveryLongitude: number;
  paymentMethod: PaymentType;
  scheduledDate?: Date;
  notes?: string;
}

export interface UpdateDriverLocationDTO {
  currentLat: number;
  currentLong: number;
  isAvailable: boolean;
}

export interface AssignDriverDTO {
  orderId: string;
  driverId: string;
}
