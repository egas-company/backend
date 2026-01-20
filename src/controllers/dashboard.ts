import { Request, Response } from "express";
import { dashboardService } from "../services/dashboard";
import { ApiError } from "../utils/ApiError";
import { UserRole } from "@prisma/client";

export const dashboardController = {
  async getStats(req: Request & { user?: { role: UserRole } }, res: Response) {
    try {
      if (req.user?.role !== UserRole.ADMIN) {
        throw new ApiError(403, "Unauthorized access");
      }

      const stats = await dashboardService.getOrderStats();
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      if (error instanceof ApiError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
        return;
      }
      res.status(500).json({
        success: false,
        message: "Internal server error"
      });
    }
  },

  async getRecentOrders(req: Request & { user?: { role: UserRole } }, res: Response) {
    try {
      if (req.user?.role !== UserRole.ADMIN) {
        throw new ApiError(403, "Unauthorized access");
      }

      const orders = await dashboardService.getRecentOrders();
      
      const formattedOrders = orders.map(order => ({
        id: order.orderId,
        customerName: `${order.user.firstName} ${order.user.lastName}`,
        product: order.TankSize?.size || order.tankSize,
        deliveryAddress: order.deliveryAddress,
        dateCreated: order.createdAt,
        status: order.status,
        amountPaid: order.totalAmount,
        paymentMethod: order.paymentMethod,
        notes: order.notes,
        paymentStatus: order.paymentStatus,
      }));

      res.json({
        success: true,
        data: formattedOrders
      });
    } catch (error) {
      if (error instanceof ApiError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
        return;
      }
      res.status(500).json({
        success: false,
        message: "Internal server error"
      });
    }
  }
}; 