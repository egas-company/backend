import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/ApiError";
import { UserRole } from "@prisma/client";
import { hashPassword } from "../utils/password";
import { emitOrderUpdate } from "./socketService";
import { autoAssignDriver, manualAssignDriver } from "./order";

export const adminService = {
  async createDriver(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phoneNumber: string;
    address: string;
  }) {
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email: data.email }, { phoneNumber: data.phoneNumber }],
      },
    });

    if (existingUser) {
      throw new ApiError(
        400,
        "User with this email or phone number already exists"
      );
    }

    return prisma.$transaction(async prisma => {
      const user = await prisma.user.create({
        data: {
          ...data,
          role: UserRole.DRIVER,
        },
      });

      const driver = await prisma.driver.create({
        data: {
          userId: user.id,
          isAvailable: true,
        },
      });

      return {
        ...user,
        driver,
      };
    });
  },

  async getAvailableDrivers() {
    const drivers = await prisma.user.findMany({
      where: {
        role: UserRole.DRIVER,
        isActive: true,
        isBlocked: false,
        // driver: {
        //   isAvailable: true,
        // },
      },
      include: {
        driver: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return drivers.map(user => ({
      id: user.driver!.id,
      name: `${user.firstName} ${user.lastName}`,
      phoneNumber: user.phoneNumber,
      isAvailable: user.driver!.isAvailable,
    }));
  },

  async getDriverById(id: string) {
    const driver = await prisma.user.findFirst({
      where: { id, role: UserRole.DRIVER },
      include: {
        driver: true,
      },
    });

    if (!driver) {
      throw new ApiError(404, "Driver not found");
    }

    return driver;
  },

  async updateDriver(
    driverId: string,
    data: {
      firstName?: string;
      lastName?: string;
      phoneNumber?: string;
      email?: string;
      isActive?: boolean;
      vehicleType?: string;
      vehiclePlate?: string;
      licenseNumber?: string;
      licenseExpiry?: Date;
    }
  ) {
    const driver = await prisma.user.findFirst({
      where: {
        id: driverId,
        role: UserRole.DRIVER,
      },
      include: { driver: true },
    });

    if (!driver) {
      throw new ApiError(404, "Driver not found");
    }

    const {
      vehicleType,
      vehiclePlate,
      licenseNumber,
      licenseExpiry,
      ...userData
    } = data;

    return prisma.$transaction(async tx => {
      const updatedUser = await tx.user.update({
        where: { id: driverId },
        data: userData,
      });

      // Update driver specific data
      const updatedDriver = await tx.driver.update({
        where: { userId: driverId },
        data: {
          vehicleType,
          vehiclePlate,
          licenseNumber,
          licenseExpiry,
        },
      });

      return {
        ...updatedUser,
        driver: updatedDriver,
      };
    });
  },

  async toggleDriverStatus(driverId: string, isActive: boolean) {
    const driver = await prisma.user.findFirst({
      where: {
        id: driverId,
        role: UserRole.DRIVER,
      },
    });

    if (!driver) {
      throw new ApiError(404, "Driver not found");
    }

    return prisma.user.update({
      where: { id: driverId },
      data: { isActive },
      include: { driver: true },
    });
  },

  async deleteDriver(id: string) {
    await this.getDriverById(id);

    return prisma.user.delete({
      where: { id },
    });
  },

  async createAdmin(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phoneNumber: string;
  }) {
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email: data.email }, { phoneNumber: data.phoneNumber }],
      },
    });

    if (existingUser) {
      throw new ApiError(
        400,
        "User with this email or phone number already exists"
      );
    }

    const hashedPassword = await hashPassword(data.password);

    return prisma.user.create({
      data: {
        ...data,
        password: hashedPassword,
        role: UserRole.ADMIN,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
        role: true,
        createdAt: true,
      },
    });
  },

  async getAdminProfile(adminId: string) {
    const admin = await prisma.user.findFirst({
      where: { id: adminId, role: UserRole.ADMIN },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
        role: true,
        createdAt: true,
      },
    });

    if (!admin) {
      throw new ApiError(404, "Admin not found");
    }

    return admin;
  },

  async getOrders() {
    return prisma.order.findMany({
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        driver: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        TankSize: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // return orders.map(order => ({
    //   id: order.id,
    //   customerName: `${order.user.firstName} ${order.user.lastName}`,
    //   product: order.TankSize?.size || order.tankSize,
    //   deliveryAddress: order.deliveryAddress,
    //   deliveryDriver: order.driver ? `${order.driver.user.firstName} ${order.driver.user.lastName}` : '-',
    //   dateCreated: order.createdAt,
    //   amountPaid: order.totalAmount,
    //   status: order.status
    // }));
  },

  async getPendingOrders() {
    const pendingOrders = await prisma.order.findMany({
      where: {
        status: "PENDING",
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            phoneNumber: true,
          },
        },
        driver: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                phoneNumber: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return pendingOrders.map(order => ({
      id: order.id,
      orderId: order.orderId,
      customerName: `${order.user.firstName} ${order.user.lastName}`,
      customerPhone: order.user.phoneNumber,
      deliveryAddress: order.deliveryAddress,
      amount: order.totalAmount,
      status: order.status,
      createdAt: order.createdAt,
      assignedDriver: order.driver ? `${order.driver.user.firstName} ${order.driver.user.lastName}` : null,
    }));
  },

  async getUnassignedOrders() {
    const unassignedOrders = await prisma.order.findMany({
      where: {
        status: "PENDING",
        driverId: null,
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

    return unassignedOrders.map(order => ({
      id: order.id,
      orderId: order.orderId,
      customerName: `${order.user.firstName} ${order.user.lastName}`,
      customerPhone: order.user.phoneNumber,
      deliveryAddress: order.deliveryAddress,
      amount: order.totalAmount,
      status: order.status,
      createdAt: order.createdAt,
      timeSinceCreation: Date.now() - new Date(order.createdAt).getTime(),
    }));
  },

  async autoAssignOrder(orderId: string, adminId: string) {
    try {
      // Get the order details
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          user: true,
        },
      });

      if (!order) {
        throw new ApiError(404, "Order not found");
      }

      if (order.status !== "PENDING") {
        throw new ApiError(400, `Cannot auto-assign order in ${order.status.toLowerCase()} state`);
      }

      if (order.driverId) {
        throw new ApiError(400, "Order already has a driver assigned");
      }

      // Attempt auto-assignment
      const assignmentResult = await autoAssignDriver(
        orderId,
        order.deliveryLatitude || 0,
        order.deliveryLongitude || 0
      );

      // Log the auto-assignment attempt
      console.log(`Order ${orderId} auto-assignment attempted by admin ${adminId}:`, assignmentResult);

      return assignmentResult;
    } catch (error) {
      console.error("Admin auto-assignment error:", error);
      throw error;
    }
  },

  async manualAssignDriver(orderId: string, driverId: string, adminId: string) {
    try {
      const result = await manualAssignDriver(orderId, driverId, adminId);
      const orderDetails = await adminService.getOrderDetails(orderId);

      return {
        ...result,
        order: orderDetails,
      };
    } catch (error) {
      console.error("Admin manual assignment error:", error);
      throw error instanceof ApiError ? error : new ApiError(500, "Failed to manually assign driver");
    }
  },

  async getTankSizes() {
    return prisma.tankSize.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });
  },

  async createTankSize(data: { size: string; name: string; price: number }) {
    return prisma.tankSize.create({
      data,
    });
  },

  async updateTankSize(
    id: string,
    data: {
      size?: string;
      name?: string;
      price?: number;
      status?: string;
    }
  ) {
    return prisma.tankSize.update({
      where: { id },
      data,
    });
  },

  async getCustomers() {
    const customers = await prisma.user.findMany({
      where: {
        role: UserRole.CLIENT,
        isActive: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return customers;
  },

  async updateCustomer(userId: string, data: {
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
    address?: string;
    tankSize?: string;
  }) {
    return prisma.user.update({
      where: { id: userId },
      data,
    });
  },

  async deleteCustomer(userId: string) {
    return prisma.user.delete({
      where: { id: userId },
    });
  },

  async getCustomerDetails(userId: string) {
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
        role: UserRole.CLIENT,
      },
      include: {
        orders: {
          orderBy: {
            createdAt: "desc",
          },
          take: 5,
          select: {
            id: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });

    if (!user) {
      throw new ApiError(404, "Customer not found");
    }

    // Get order counts
    const [totalOrders, completedOrders, cancelledOrders] = await Promise.all([
      prisma.order.count({
        where: { userId: user.id },
      }),
      prisma.order.count({
        where: {
          userId: user.id,
          status: "DELIVERED",
        },
      }),
      prisma.order.count({
        where: {
          userId: user.id,
          status: "CANCELLED",
        },
      }),
    ]);

    // Format recent activity
    const recentActivity = user.orders.map(order => ({
      date: order.createdAt,
      action: order.status,
      time: order.createdAt,
    }));

    return {
      id: user.id,
      name: `${user.firstName} ${user.lastName}`,
      phoneNumber: user.phoneNumber,
      currentAddress: user.address,
      gasSize: user.tankSize,
      isActive: user.isActive,
      stats: {
        totalOrders,
        completedOrders,
        cancelledOrders,
      },
      recentActivity,
    };
  },

  async getCustomerOrders(userId: string) {

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
        role: UserRole.CLIENT,
      },
    });

    if (!user) {
      throw new ApiError(404, "Customer not found");
    }

    const orders = await prisma.order.findMany({
      where: {
        userId: userId,
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
          }
        },
        TankSize: {
          select: {
            size: true,
            name: true,
            price: true,
          }
        },
        driver: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return orders.map(order => ({
      id: order.id,
      orderId: order.orderId,
      customer: `${order.user.firstName} ${order.user.lastName}`,
      product: order.tankSize,
      deliveryAddress: order.deliveryAddress,
      deliveryDriver: order.driver 
        ? `${order.driver.user.firstName} ${order.driver.user.lastName}`
        : '-',
      dateCreated: order.createdAt,
      amountPaid: order.amount,
      paymentMethod: order.paymentMethod,
      status: order.status
    }));
  },

  async getDeliveryPersonnel() {
    const drivers = await prisma.user.findMany({
      where: {
        role: UserRole.DRIVER,
        isActive: true,
        driver: {
          isNot: null,
        },
      },
      include: {
        driver: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return drivers.map((driver, index) => ({
      id: index + 1,
      name: `${driver.firstName || ""} ${driver.lastName || ""}`.trim(),
      phoneNo: driver.phoneNumber || "-",
      address: driver.address || "-",
      dateCreated: driver.createdAt,
    }));
  },

  async getOrderDetails(orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            phoneNumber: true,
            email: true,
          },
        },
        driver: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                phoneNumber: true,
              },
            },
          },
        },
        TankSize: true,
      },
    });

    if (!order) {
      throw new ApiError(404, "Order not found");
    }

    // Format status updates
    const statusUpdates = [
      {
        status: "Order placed",
        timestamp: order.createdAt,
        description: "Order placed",
      },
      ...(order.assignedAt
        ? [
            {
              status: "Order assigned to driver",
              timestamp: order.assignedAt,
              description: "Order assigned to driver",
            },
          ]
        : []),
      ...(order.acceptedAt
        ? [
            {
              status: "Delivery in progress",
              timestamp: order.acceptedAt,
              description: "Driver accepted order",
            },
          ]
        : []),
      ...(order.deliveredAt
        ? [
            {
              status: "Order completed",
              timestamp: order.deliveredAt,
              description: "Order delivered successfully",
            },
          ]
        : []),
    ].filter(update => update.timestamp);

    return {
      id: order.orderId,
      status: order.status,
      items: [
        {
          name: `Gas ${order.tankSize}`,
          price: order.amount,
        },
      ],
      shippingFee: order.shippingFee,
      total: order.totalAmount,
      payment: {
        type: order.paymentMethod,
        status: order.paymentStatus,
      },
      customer: {
        name: `${order.user.firstName} ${order.user.lastName}`,
        phone: order.user.phoneNumber,
        email: order.user.email,
      },
      driver: order.driver
        ? {
            name: `${order.driver.user.firstName} ${order.driver.user.lastName}`,
            phone: order.driver.user.phoneNumber,
          }
        : null,
      deliveryAddress: order.deliveryAddress,
      statusUpdates: statusUpdates,
    };
  },

  async cancelOrder(orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: true,
        driver: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!order) {
      throw new ApiError(404, "Order not found");
    }

    if (order.status === "DELIVERED" || order.status === "CANCELLED") {
      throw new ApiError(
        400,
        `Cannot cancel order that is ${order.status.toLowerCase()}`
      );
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
      },
      include: {
        user: true,
        driver: {
          include: {
            user: true,
          },
        },
      },
    });

    // Emit socket event for real-time updates
    emitOrderUpdate({
      orderId,
      status: "CANCELLED",
    });

    return updatedOrder;
  },

  async deleteOrder(orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new ApiError(404, "Order not found");
    }

    if (order.status !== "CANCELLED") {
      throw new ApiError(400, "Only cancelled orders can be deleted");
    }

    // Delete the order
    await prisma.order.delete({
      where: { id: orderId },
    });

    return true;
  },

  async getDrivers() {
    const drivers = await prisma.user.findMany({
      where: {
        role: UserRole.DRIVER,
      },
      include: {
        driver: {
          select: {
            isAvailable: true,
          }
        }
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return drivers.map((driver, index) => ({
      id: driver.id,
      no: index + 1,
      name: `${driver.firstName} ${driver.lastName}`,
      phoneNo: driver.phoneNumber,
      address: driver.address || "",
      dateCreated: driver.createdAt,
      isActive: driver.isActive,
      isBlocked: driver.isBlocked,
      isAvailable: driver.driver?.isAvailable,
      email: driver.email,
    }));
  },

  async addDriver(data: { name: string; phoneNo: string; address: string }) {
    const [firstName, lastName] = data.name.split(" ");

    const user = await prisma.user.create({
      data: {
        firstName,
        lastName,
        phoneNumber: data.phoneNo,
        address: data.address,
        role: "DRIVER",
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@driver.egas.com`,
        password: "defaultPassword123", // You should generate a random password and send it to the driver
      },
    });

    const driver = await prisma.driver.create({
      data: {
        userId: user.id,
        isAvailable: true,
      },
      include: {
        user: true,
      },
    });

    return {
      id: driver.id,
      name: `${user.firstName} ${user.lastName}`,
      phoneNo: user.phoneNumber,
      address: user.address,
      dateCreated: driver.createdAt,
    };
  },
};
