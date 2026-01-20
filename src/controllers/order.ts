import { Request, Response } from "express";
import * as orderService from "../services/order";
import { ApiError } from "../utils/ApiError";
import { tankSizeService } from "../services/tankSize";

export const orderController = {
  async createOrder(req: Request & { user: { id: string } }, res: Response) {
    try {
      console.log(req.body);
      const userId = req.user?.id;
      if (!userId) throw new ApiError(401, "Unauthorized");

      const tankSize = await tankSizeService.getTankSizeBySize(
        req.body.tankSize
      );

      const order = await orderService.createOrder({
        ...req.body,
        userId,
        tankSizeId: tankSize.id,
        amount: Number(tankSize.price),
      });

      res.status(201).json(order);
    } catch (error) {
      if (error instanceof ApiError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message,
        });
        return;
      }
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  async checkActiveOrders(req: Request & { user: { id: string } }, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new ApiError(401, "Unauthorized");

      const hasActiveOrders = await orderService.checkUserActiveOrders(userId);
      const activeOrders = hasActiveOrders ? await orderService.getUserActiveOrders(userId) : [];

      res.json({
        success: true,
        hasActiveOrders,
        activeOrders,
        message: hasActiveOrders ? "User has active orders" : "No active orders found"
      });
    } catch (error) {
      if (error instanceof ApiError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message,
        });
        return;
      }
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  async checkPOSPaymentEligibility(req: Request & { user: { id: string } }, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new ApiError(401, "Unauthorized");

      const canUsePOS = await orderService.canUserUsePOSPayment(userId);

      res.json({
        success: true,
        canUsePOS,
        message: canUsePOS ? "User can use POS payment" : "User cannot use POS payment"
      });
    } catch (error) {
      if (error instanceof ApiError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message,
        });
        return;
      }
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  async confirmDelivery(req: Request & { user: { id: string } }, res: Response) {
    try {
      const { orderId } = req.params;
      console.log("confirming delivery", orderId);
      const userId = req.user?.id;
      if (!userId) throw new ApiError(401, "Unauthorized");

      const order = await orderService.confirmDelivery(orderId);
      res.json(order);
    } catch (error) {
      if (error instanceof ApiError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message,
        });
        return;
      }
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  async getClientOrders(
    req: Request & { user: { id: string } },
    res: Response
  ) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new ApiError(401, "Unauthorized");

      const orders = await orderService.getUserOrderHistory(userId);
      res.json(orders);
    } catch (error) {
      if (error instanceof ApiError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message,
        });
        return;
      }
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  async getDriverOrders(
    req: Request & { user: { id: string } },
    res: Response
  ) {
    try {
      const driverId = req.user?.id;
      if (!driverId) throw new ApiError(401, "Unauthorized");

      // Get pagination parameters from query
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      const { orders, total } = await orderService.getDriverOrderHistory(
        driverId,
        page,
        limit
      );

      res.json({
        success: true,
        data: {
          orders,
          pagination: {
            total,
            pages: Math.ceil(total / limit),
            page,
            limit,
          },
        },
      });
    } catch (error) {
      if (error instanceof ApiError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message,
        });
        return;
      }
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  async getOrder(req: Request & { user: { id: string } }, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      if (!userId) throw new ApiError(401, "Unauthorized");

      const order = await orderService.getOrderById(id, userId);
      


      res.json(order);
    } catch (error) {
      if (error instanceof ApiError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message,
        });
        return;
      }
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  async updateOrderStatus(req: Request, res: Response) {
    try {
      const { orderId } = req.params;
      const order = await orderService.updateOrderStatus(orderId, req.body);
      res.json(order);
    } catch (error) {
      if (error instanceof ApiError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message,
        });
        return;
      }
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  async trackOrder(req: Request, res: Response) {
    try {
      const { trackingId } = req.params;
      const order = await orderService.trackOrder(trackingId);
      res.json(order);
    } catch (error) {
      if (error instanceof ApiError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message,
        });
        return;
      }
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },
};
