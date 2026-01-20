import { Request, Response } from "express";
import { ApiError } from "../utils/ApiError";
import { adminService } from "../services/admin";
import { hashPassword } from "../utils/password";
import { UserRole } from "@prisma/client";

export const adminController = {
  async createDriver(
    req: Request & { user?: { role: UserRole } },
    res: Response
  ) {
    try {
      if (req.user?.role !== UserRole.ADMIN) {
        throw new ApiError(403, "Unauthorized access");
      }

      const { firstName, lastName, email, password, phoneNumber, address } = req.body;
      // const [firstName, lastName] = name.split(" ");

      const hashedPassword = await hashPassword(password);

      const driver = await adminService.createDriver({
        email,
        password: hashedPassword,
        firstName,
        lastName,
        phoneNumber,
        address,
      });

      res.json({
        success: true,
        message: "Driver created successfully",
        data: driver,
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

  async getDriverById(req: Request, res: Response) {
    try {
      const driver = await adminService.getDriverById(req.params.id);
      res.json({
        success: true,
        data: { driver },
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

  async updateDriver(
    req: Request & { user?: { id: string; role: UserRole } },
    res: Response
  ) {
    try {
      if (!req.user || req.user.role !== UserRole.ADMIN) {
        throw new ApiError(403, "Unauthorized - Admin access required");
      }

      const { id } = req.params;
      const updatedDriver = await adminService.updateDriver(id, req.body);

      res.json({
        success: true,
        message: "Driver updated successfully",
        data: {
          driver: updatedDriver,
        },
      });
    } catch (error) {
      console.error("Update driver error:", error);
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

  async deleteDriver(req: Request, res: Response) {
    try {
      await adminService.deleteDriver(req.params.id);
      res.json({
        success: true,
        message: "Driver deleted successfully",
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

  async toggleDriverStatus(
    req: Request & { user?: { id: string; role: UserRole } },
    res: Response
  ) {
    try {
      if (!req.user || req.user.role !== UserRole.ADMIN) {
        throw new ApiError(403, "Unauthorized - Admin access required");
      }

      const { id } = req.params;
      const { isActive } = req.body;

      const driver = await adminService.toggleDriverStatus(id, isActive);

      res.json({
        success: true,
        message: `Driver ${
          isActive ? "activated" : "deactivated"
        } successfully`,
        data: {
          driver,
        },
      });
    } catch (error) {
      console.error("Toggle driver status error:", error);
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

  async getOrders(req: Request & { user?: { role: UserRole } }, res: Response) {
    try {
      if (req.user?.role !== UserRole.ADMIN) {
        throw new ApiError(403, "Unauthorized access");
      }

      const orders = await adminService.getOrders();

      const formattedOrders = orders.map(order => ({
        id: order.id,
        orderId: order.orderId,
        customerName: `${order.user.firstName} ${order.user.lastName}`,
        product: order.TankSize?.size || order.tankSize,
        deliveryAddress: order.deliveryAddress,
        deliveryDriver: order.driver
          ? `${order.driver.user.firstName} ${order.driver.user.lastName}`
          : "-",
        dateCreated: order.createdAt,
        status: order.status,
        amountPaid: order.totalAmount,
      }));

      res.json({
        success: true,
        data: formattedOrders,
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

  async getPendingOrders(
    req: Request & { user?: { role: UserRole } },
    res: Response
  ) {
    try {
      if (req.user?.role !== UserRole.ADMIN) {
        throw new ApiError(403, "Unauthorized access");
      }

      const pendingOrders = await adminService.getPendingOrders();

      res.json({
        success: true,
        data: pendingOrders,
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

  async getUnassignedOrders(
    req: Request & { user?: { role: UserRole } },
    res: Response
  ) {
    try {
      if (req.user?.role !== UserRole.ADMIN) {
        throw new ApiError(403, "Unauthorized access");
      }

      const unassignedOrders = await adminService.getUnassignedOrders();

      res.json({
        success: true,
        data: unassignedOrders,
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

  async autoAssignOrder(
    req: Request & { user?: { role: UserRole; id: string } },
    res: Response
  ) {
    try {
      if (req.user?.role !== UserRole.ADMIN) {
        throw new ApiError(403, "Unauthorized access");
      }

      const { id: orderId } = req.params;

      const assignmentResult = await adminService.autoAssignOrder(orderId, req.user.id);

      res.json({
        success: true,
        message: "Auto-assignment completed",
        data: assignmentResult,
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

  async assignDriver(
    req: Request & { user?: { role: UserRole; id: string } },
    res: Response
  ) {
    try {
      if (req.user?.role !== UserRole.ADMIN) {
        throw new ApiError(403, "Unauthorized access");
      }

      const { orderId, driverId } = req.body ?? {};

      if (!orderId || !driverId) {
        throw new ApiError(400, "Order ID and Driver ID are required");
      }

      const result = await adminService.manualAssignDriver(orderId, driverId, req.user.id);

      res.json({
        success: true,
        message: result.message,
        data: result.order,
        meta: {
          previousDriverNotified: result.previousDriverNotified,
          requiresAcknowledgement: result.requiresAcknowledgement,
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

  async getTankSizes(
    req: Request & { user?: { role: UserRole } },
    res: Response
  ) {
    try {
      if (req.user?.role !== UserRole.ADMIN) {
        throw new ApiError(403, "Unauthorized access");
      }

      const tankSizes = await adminService.getTankSizes();

      const formattedTankSizes = tankSizes.map(tank => ({
        id: tank.id,
        name: tank.name,
        weight: tank.size,
        price: tank.price,
        dateCreated: tank.createdAt,
        status: tank.status,
      }));

      res.json({
        success: true,
        data: formattedTankSizes,
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

  async createTankSize(
    req: Request & { user?: { role: UserRole } },
    res: Response
  ) {
    try {
      if (req.user?.role !== UserRole.ADMIN) {
        throw new ApiError(403, "Unauthorized access");
      }

      const { name, size, price } = req.body;

      if (!name || !size || !price) {
        throw new ApiError(400, "Missing required fields");
      }

      const tankSize = await adminService.createTankSize({
        name,
        size,
        price: Number(price),
      });

      res.json({
        success: true,
        message: "Tank size created successfully",
        data: tankSize,
      });
    } catch (error) {
      if (error.code === 'P2002' && error.meta?.target?.includes('size') || error.meta?.target?.includes('name')) {
        res.status(400).json({
          success: false,
          message: "Tank size or name already exists"
        });
        return;
      }

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

  async updateTankSize(
    req: Request & { user?: { role: UserRole } },
    res: Response
  ) {
    try {
      if (req.user?.role !== UserRole.ADMIN) {
        throw new ApiError(403, "Unauthorized access");
      }

      const { id } = req.params;
      const { name, size, price, status } = req.body;

      if (!id) {
        throw new ApiError(400, "Tank size ID is required");
      }

      const tankSize = await adminService.updateTankSize(id, {
        name,
        size,
        price: price ? Number(price) : undefined,
        status,
      });

      res.json({
        success: true,
        message: "Tank size updated successfully",
        data: tankSize,
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

  async getCustomers(
    req: Request & { user?: { role: UserRole } },
    res: Response
  ) {
    try {
      if (req.user?.role !== UserRole.ADMIN) {
        throw new ApiError(403, "Unauthorized access");
      }

      const customers = await adminService.getCustomers();

      const formattedCustomers = customers.map(customer => ({
        id: customer.id,
        name: `${customer.firstName} ${customer.lastName}`,
        tankSize: customer.tankSize || "-",
        phoneNo: customer.phoneNumber || "-",
        address: customer.address || "-",
        dateCreated: customer.createdAt,
      }));

      res.json({
        success: true,
        data: formattedCustomers,
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

  async updateCustomer(
    req: Request & { user?: { role: UserRole } },
    res: Response
  ) {
    try {
      if (req.user?.role !== UserRole.ADMIN) {
        throw new ApiError(403, "Unauthorized access");
      }

      const { id } = req.params;
      const { firstName, lastName, phoneNumber, address, tankSize } = req.body;

      if (!id) {
        throw new ApiError(400, "Customer ID is required");
      }

      const updatedCustomer = await adminService.updateCustomer(id, {
        firstName,
        lastName,
        phoneNumber,
        address,
        tankSize,
      });

      res.json({
        success: true,
        message: "Customer updated successfully",
        data: updatedCustomer,
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

  async deleteCustomer(
    req: Request & { user?: { role: UserRole } },
    res: Response
  ) {
    try {
      if (req.user?.role !== UserRole.ADMIN) {
        throw new ApiError(403, "Unauthorized access");
      }

      const { id } = req.params;
      await adminService.deleteCustomer(id);

      res.json({
        success: true,
        message: "Customer deleted successfully",
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

  
  

  async getCustomerDetails(
    req: Request & { user?: { role: UserRole } },
    res: Response
  ) {
    try {
      if (req.user?.role !== UserRole.ADMIN) {
        throw new ApiError(403, "Unauthorized access");
      }

      const { id } = req.params;
      const customerDetails = await adminService.getCustomerDetails(id);

      res.json({
        success: true,
        data: customerDetails,
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

  async getCustomerOrders(
    req: Request & { user?: { role: UserRole } },
    res: Response
  ) {
    try {
      if (req.user?.role !== UserRole.ADMIN) {
        throw new ApiError(403, "Unauthorized access");
      }

      const { id } = req.params;
      const orders = await adminService.getCustomerOrders(id);

      res.json({
        success: true,
        data: orders,
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

  async getDeliveryPersonnel(
    req: Request & { user?: { role: UserRole } },
    res: Response
  ) {
    try {
      if (req.user?.role !== UserRole.ADMIN) {
        throw new ApiError(403, "Unauthorized access");
      }

      const personnel = await adminService.getDeliveryPersonnel();

      res.json({
        success: true,
        data: personnel,
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

  async getOrderDetails(
    req: Request & { user?: { role: UserRole } },
    res: Response
  ) {
    try {
      if (req.user?.role !== UserRole.ADMIN) {
        throw new ApiError(403, "Unauthorized access");
      }

      const { id } = req.params;
      const orderDetails = await adminService.getOrderDetails(id);

      res.json({
        success: true,
        data: orderDetails,
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

  async cancelOrder(
    req: Request & { user?: { role: UserRole } },
    res: Response
  ) {
    try {
      if (req.user?.role !== UserRole.ADMIN) {
        throw new ApiError(403, "Unauthorized access");
      }

      const { id } = req.params;
      const updatedOrder = await adminService.cancelOrder(id);

      res.json({
        success: true,
        message: "Order cancelled successfully",
        data: updatedOrder,
      });
    } catch (error) {
      console.error("Cancel order error:", error);
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

  async deleteOrder(
    req: Request & { user?: { role: UserRole } },
    res: Response
  ) {
    try {
      if (req.user?.role !== UserRole.ADMIN) {
        throw new ApiError(403, "Unauthorized access");
      }

      const { id } = req.params;
      await adminService.deleteOrder(id);

      res.json({
        success: true,
        message: "Order deleted successfully",
      });
    } catch (error) {
      console.error("Delete order error:", error);
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

  async getAvailableDrivers(
    req: Request & { user?: { role: UserRole } },
    res: Response
  ) {
    try {
      if (req.user?.role !== UserRole.ADMIN) {
        throw new ApiError(403, "Unauthorized access");
      }

      const drivers = await adminService.getAvailableDrivers();

      res.json({
        success: true,
        data: drivers,
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

  async getDrivers(
    req: Request & { user?: { role: UserRole } },
    res: Response
  ) {
    try {
      if (req.user?.role !== UserRole.ADMIN) {
        throw new ApiError(403, "Unauthorized access");
      }

      const drivers = await adminService.getDrivers();

      res.json({
        success: true,
        data: drivers,
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

  async addDriver(req: Request & { user?: { role: UserRole } }, res: Response) {
    try {
      if (req.user?.role !== UserRole.ADMIN) {
        throw new ApiError(403, "Unauthorized access");
      }

      const driver = await adminService.addDriver(req.body);

      res.json({
        success: true,
        data: driver,
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
};
