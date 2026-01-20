import { Request, Response } from "express";
import { ApiError } from "../utils/ApiError";
import { prisma } from "../lib/prisma";
import { UserRole } from "@prisma/client";

export const driverProfileController = {
  async getProfile(req: Request & { user?: { id: string } }, res: Response) {
    try {
      if (!req.user?.id) {
        throw new ApiError(401, "Unauthorized");
      }

      const profile = await prisma.user.findFirst({
        where: {
          id: req.user.id,
          role: UserRole.DRIVER,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phoneNumber: true,
          role: true,
          driver: {
            select: {
              isAvailable: true,
              currentLat: true,
              currentLong: true,
              vehicleType: true,
              vehiclePlate: true,
              licenseNumber: true,
              licenseExpiry: true,
              rating: true,
              totalTrips: true,
            },
          },
        },
      });

      if (!profile) {
        throw new ApiError(404, "Driver profile not found");
      }

      res.json({
        success: true,
        data: profile,
      });
    } catch (error) {
      console.error("Get driver profile error:", error);
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

  async updateAvailability(
    req: Request & { user?: { id: string } },
    res: Response
  ) {
    try {
      if (!req.user?.id) {
        throw new ApiError(401, "Unauthorized");
      }

      const { isAvailable } = req.body;

      if (typeof isAvailable !== "boolean") {
        throw new ApiError(400, "Invalid availability status");
      }

      const driver = await prisma.driver.findUnique({
        where: { userId: req.user.id },
      });

      if (!driver) {
        throw new ApiError(404, "Driver record not found");
      }

      const updatedDriver = await prisma.driver.update({
        where: { userId: req.user.id },
        data: { isAvailable },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              phoneNumber: true,
              role: true,
            },
          },
        },
      });

      res.json({
        success: true,
        message: `Availability status updated to ${
          isAvailable ? "available" : "unavailable"
        }`,
        data: {
          ...updatedDriver.user,
          driver: {
            ...updatedDriver,
            user: undefined, // Remove circular reference
          },
        },
      });
    } catch (error) {
      console.error("Update driver availability error:", error);
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
