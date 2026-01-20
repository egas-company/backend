import { Request, Response } from "express";
import * as driverService from "../services/driverService";
import { prisma } from "../lib/prisma";
import { User } from "@prisma/client";
import { ApiError } from "../utils/ApiError";
import { acknowledgeDriverReassignment, getPendingReassignment } from "../services/order";

export const acceptOrder = async (
  req: Request & { user: User },
  res: Response
) => {
  try {
    const { orderId } = req.params;

    const driver = await prisma.driver.findUnique({
      where: { userId: req.user!.id },
    });

    if (!driver) {
      res.status(404).json({ error: "Driver not found" });
      return;
    }

    const result = await driverService.acceptOrder(orderId, driver.id);
    res.json(result);
  } catch (error: any) {
    console.error("Error accepting order:", error);
    res.status(400).json({ error: error.message });
  }
};

export const declineOrder = async (
  req: Request & { user: User },
  res: Response
) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      res.status(400).json({ error: "Decline reason is required" });
      return;
    }

    const driver = await prisma.driver.findUnique({
      where: { userId: req.user!.id },
    });

    if (!driver) {
      res.status(404).json({ error: "Driver not found" });
      return;
    }

    const result = await driverService.declineOrder(orderId, driver.id, reason);
    res.json(result);
  } catch (error: any) {
    console.error("Error declining order:", error);
    res.status(400).json({ error: error.message });
  }
};

export const updateLocation = async (
  req: Request & { user: User },
  res: Response
) => {
  try {
    const driver = await prisma.driver.findUnique({
      where: { userId: req.user!.id },
    });

    if (!driver) {
      res.status(404).json({ error: "Driver not found" });
      return;
    }

    const { currentLat, currentLong } = req.body;

    const updatedDriver = await driverService.updateDriverLocation(
      driver.id,
      currentLat,
      currentLong,
    );

    res.json(updatedDriver);
  } catch (error: any) {
    console.error("Error updating driver location:", error);
    res.status(500).json({ error: error.message });
  }
};

export const updateAvailability = async (
  req: Request & { user: User },
  res: Response
) => {
  try {
    const { isAvailable } = req.body;

    const driver = await prisma.driver.findUnique({
      where: { userId: req.user!.id },
    });

    if (!driver) {
      res.status(404).json({ error: "Driver not found" });
      return;
    }

    const updatedDriver = await prisma.driver.update({
      where: { id: driver.id },
      data: {
        isAvailable,
        lastLocationUpdate: new Date(),
      },
    });

    res.json(updatedDriver);
  } catch (error: any) {
    console.error("Error updating driver availability:", error);
    res.status(500).json({ error: error.message });
  }
};

// Get driver's current orders
export const getCurrentOrders = async (
  req: Request & { user: User },
  res: Response
) => {
  try {
    console.log(req.user.id);
    const driver = await prisma.driver.findUnique({
      where: { userId: req.user!.id },
    });

    if (!driver) {
      res.status(404).json({ error: "Driver not found" });
      return;
    }

    const orders = await prisma.order.findMany({
      where: {
        driverId: driver.id,
        status: {
          in: ["ASSIGNED"],
        },
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            phoneNumber: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(orders);
  } catch (error: any) {
    console.error("Error fetching current orders:", error);
    res.status(500).json({ error: error.message });
  }
};

// Get driver's order history
export const getOrderHistory = async (
  req: Request & { user: User },
  res: Response
) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const driver = await prisma.driver.findUnique({
      where: { userId: req.user!.id },
    });

    if (!driver) {
      res.status(404).json({ error: "Driver not found" });
      return;
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: {
          driverId: driver.id,
          status: {
            in: ["DELIVERED", "CANCELLED"],
          },
        },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              phoneNumber: true,
            },
          },
          rating: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: Number(limit),
      }),
      prisma.order.count({
        where: {
          driverId: driver.id,
          status: {
            in: ["DELIVERED", "CANCELLED"],
          },
        },
      }),
    ]);

    res.json({
      orders,
      pagination: {
        total,
        pages: Math.ceil(total / Number(limit)),
        page: Number(page),
        limit: Number(limit),
      },
    });
  } catch (error: any) {
    console.error("Error fetching order history:", error);
    res.status(500).json({ error: error.message });
  }
};

export const getOngoingOrders = async (
  req: Request & { user: User },
  res: Response
) => {
  try {
    const driver = await prisma.driver.findUnique({
      where: { userId: req.user!.id },
    });

    if (!driver) {
      res.status(404).json({ error: "Driver not found" });
      return;
    }

    const orders = await prisma.order.findMany({
      where: {
        driverId: driver.id,
        status: {
          in: ["ACCEPTED", "IN_TRANSIT"],
        },
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            phoneNumber: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(orders);
  } catch (error: any) {
    console.error("Error fetching current orders:", error);
    res.status(500).json({ error: error.message });
  }
};

// Get driver's profile
export const getProfile = async (
  req: Request & { user: User },
  res: Response
) => {
  try {
    const driver = await prisma.driver.findUnique({
      where: { userId: req.user!.id },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            phoneNumber: true,
            email: true,
          },
        },
      },
    });

    if (!driver) {
      res.status(404).json({ error: "Driver not found" });
      return;
    }

    res.json({ profile: driver });
  } catch (error: any) {
    console.error("Error fetching driver profile:", error);
    res.status(500).json({ error: error.message });
  }
};

// Update driver's profile
export const updateProfile = async (
  req: Request & { user: User },
  res: Response
) => {
  try {
    const { vehicleType, vehiclePlate } = req.body;

    const driver = await prisma.driver.findUnique({
      where: { userId: req.user!.id },
    });

    if (!driver) {
      res.status(404).json({ error: "Driver not found" });
      return;
    }

    const updatedDriver = await prisma.driver.update({
      where: { id: driver.id },
      data: {
        vehicleType,
        vehiclePlate,
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            phoneNumber: true,
            email: true,
          },
        },
      },
    });

    res.json(updatedDriver);
  } catch (error: any) {
    console.error("Error updating driver profile:", error);
    res.status(500).json({ error: error.message });
  }
};

// Upload driver document
export const uploadDocument = async (
  req: Request & { user: User },
  res: Response
) => {
  try {
    const { type, url, expiryDate } = req.body;

    const driver = await prisma.driver.findUnique({
      where: { userId: req.user!.id },
    });

    if (!driver) {
      res.status(404).json({ error: "Driver not found" });
      return;
    }

    const document = await prisma.driverDocument.create({
      data: {
        driverId: driver.id,
        type,
        url,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
      },
    });

    res.status(201).json(document);
  } catch (error: any) {
    console.error("Error uploading document:", error);
    res.status(500).json({ error: error.message });
  }
};

export const startDelivery = async (
  req: Request & { user: User },
  res: Response
) => {
  try {
    const { orderId } = req.params;
    const driver = await prisma.driver.findUnique({
      where: { userId: req.user!.id },
    });

    if (!driver) {
      res.status(404).json({ error: "Driver not found" });
      return;
    }

    const result = await driverService.startDelivery(orderId, driver.id);
    res.json(result);
  } catch (error: any) {
    console.error("Error starting delivery:", error);
    res.status(400).json({ error: error.message });
  }
};

export const completeDelivery = async (
  req: Request & { user: User },
  res: Response
) => {
  try {
    const { orderId } = req.params;
    const driver = await prisma.driver.findUnique({
      where: { userId: req.user!.id },
    });

    if (!driver) {
      res.status(404).json({ error: "Driver not found" });
      return;
    }

    const result = await driverService.completeDelivery(orderId, driver.id);
    res.json(result);
  } catch (error: any) {
    console.error("Error completing delivery:", error);
    res.status(400).json({ error: error.message });
  }
};

export const confirmReassignment = async (
  req: Request & { user: User },
  res: Response
) => {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      throw new ApiError(400, "Order ID is required");
    }

    const driver = await prisma.driver.findUnique({
      where: { userId: req.user.id },
    });

    if (!driver) {
      throw new ApiError(404, "Driver profile not found");
    }

    const pending = await getPendingReassignment(orderId);
    if (!pending) {
      res.json({
        success: true,
        message: "No reassignment pending for this order.",
      });
      return;
    }

    const acknowledgement = await acknowledgeDriverReassignment(orderId, driver.id);

    await prisma.driver.update({
      where: { id: driver.id },
      data: { isAvailable: true },
    }).catch(error => {
      console.warn("Failed to update driver availability after acknowledgement:", error);
    });

    res.json({
      success: true,
      message: "Reassignment acknowledged successfully.",
      data: acknowledgement,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
      return;
    }

    console.error("Error acknowledging reassignment:", error);
    res.status(500).json({
      success: false,
      message: "Failed to acknowledge reassignment",
    });
  }
};
