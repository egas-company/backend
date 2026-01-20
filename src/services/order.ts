import { DriverAssignmentAlarmStatus, OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/ApiError";
import { CreateOrderInput, UpdateOrderStatusInput } from "../types/order";
import { logger } from "../utils/logger";
import { emitNewOrder, emitOrderUpdate, emitDriverReassignment } from "./socketService";
import { generateOrderId } from "../utils/orderUtils";
import { calculateDistance, findBestAvailableDriver } from "../utils/distance";
import {
  enqueueDriverAssignmentNotification,
  scheduleAlarmReminder,
  cancelAlarmReminder,
  enqueueNotification,
} from "./notificationQueue";
import type { NotificationJob } from "../types/notifications";

export const getPendingReassignment = async (orderId: string) => {
  return prisma.driverAssignmentAlarm.findUnique({ where: { orderId } });
};

export const acknowledgeDriverReassignment = async (
  orderId: string,
  driverId: string
) => {
  const alarm = await prisma.driverAssignmentAlarm.findUnique({ where: { orderId } });

  if (!alarm) {
    throw new ApiError(404, "No reassignment awaiting confirmation for this order.");
  }

  if (alarm.driverId !== driverId) {
    throw new ApiError(403, "This order reassignment is not assigned to your driver profile.");
  }

  if (alarm.repeatJobKey) {
    await cancelAlarmReminder(alarm.repeatJobKey);
  }

  await prisma.driverAssignmentAlarm.update({
    where: { id: alarm.id },
    data: {
      status: DriverAssignmentAlarmStatus.ACKNOWLEDGED,
      acknowledgedAt: new Date(),
      resolvedAt: new Date(),
      repeatJobKey: null,
    },
  });

  return {
    success: true,
    orderId,
  };
};

const driverUserSelect = {
  id: true,
  firstName: true,
  lastName: true,
  phoneNumber: true,
} as const;

const orderUserSelect = {
  firstName: true,
  lastName: true,
  phoneNumber: true,
  email: true,
} as const;

const orderDetailsInclude = {
  driver: {
    include: {
      user: {
        select: driverUserSelect,
      },
    },
  },
  user: {
    select: orderUserSelect,
  },
} as const;

type OrderWithDetails = Prisma.OrderGetPayload<{ include: typeof orderDetailsInclude }>;
type DriverWithUser = Prisma.DriverGetPayload<{ include: { user: { select: typeof driverUserSelect } } }>;

const createOrResetAssignmentAlarm = async (orderId: string, driverId: string) => {
  const existing = await prisma.driverAssignmentAlarm.findUnique({ where: { orderId } });

  if (existing?.repeatJobKey) {
    await cancelAlarmReminder(existing.repeatJobKey);
  }

  return prisma.driverAssignmentAlarm.upsert({
    where: { orderId },
    update: {
      driverId,
      status: DriverAssignmentAlarmStatus.PENDING,
      requestedAt: new Date(),
      acknowledgedAt: null,
      resolvedAt: null,
      repeatJobKey: null,
    },
    create: {
      orderId,
      driverId,
    },
  });
};

const scheduleDriverAlarm = async (alarmId: string, driverId: string, order: { id: string; orderId: string }) => {
  logger.info("Scheduling driver alarm reminder", {
    alarmId,
    driverId,
    orderId: order.id,
    orderCode: order.orderId,
  });
  await scheduleAlarmReminder(alarmId, {
    type: "ALARM_REMINDER",
    audience: { driverId },
    payload: {
      title: "Order awaiting acceptance",
      body: `Order #${order.orderId} is waiting for your confirmation`,
      data: {
        orderId: order.id,
        reason: "ALARM_REMINDER",
        type: "ALARM_REMINDER",
      },
      priority: "high",
    },
    metadata: {
      orderId: order.id,
      driverId,
      alarmId,
    },
  }).catch(error => {
    logger.warn("Failed to trigger alarm reminder", { alarmId, error });
  });

  await prisma.driverAssignmentAlarm.update({
    where: { id: alarmId },
    data: { repeatJobKey: new Date().toISOString() },
  }).catch(error => {
    logger.warn("Failed to store alarm reminder timestamp", { alarmId, error });
  });
};

const sendDriverAssignmentNotification = async (
  order: { id: string; orderId: string; user: { firstName: string | null; lastName: string | null }; deliveryAddress: string },
  driverId: string,
  alarmId: string
) => {
  logger.info("Sending driver assignment notification", {
    orderId: order.id,
    orderCode: order.orderId,
    driverId,
    alarmId,
  });
  const job: NotificationJob = {
    type: "ORDER_ASSIGNMENT",
    audience: { driverId },
    payload: {
      title: "New order assigned",
      body: `Order #${order.orderId} is ready for pickup`,
      data: {
        orderId: order.id,
        customer: `${order.user.firstName ?? ""} ${order.user.lastName ?? ""}`.trim(),
        deliveryAddress: order.deliveryAddress,
        type: "ORDER_ASSIGNMENT",
      },
      priority: "high",
    },
    metadata: {
      orderId: order.id,
      driverId,
      alarmId,
    },
  };

  await enqueueDriverAssignmentNotification(job);
};

const notifyPreviousDriver = async (
  order: { id: string; orderId: string },
  previousDriverId?: string | null
) => {
  if (!previousDriverId) return;

  const job: NotificationJob = {
    type: "CUSTOM",
    audience: { driverId: previousDriverId },
    payload: {
      title: "Order reassigned",
      body: `Order #${order.orderId} has been reassigned to another driver.`,
      data: {
        orderId: order.id,
        type: "ORDER_REASSIGNED",
      },
    },
    metadata: {
      orderId: order.id,
      driverId: previousDriverId,
    },
  };

  await enqueueNotification(job);
};

// Active order statuses that prevent new orders
const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  "PENDING",
  "ASSIGNED",
  "ACCEPTED",
  "PICKED_UP",
  "IN_TRANSIT"
];

/**
 * Check if user has any active orders
 * @param userId - The user ID to check
 * @returns Promise<boolean> - True if user has active orders, false otherwise
 */
export const checkUserActiveOrders = async (userId: string): Promise<boolean> => {
  try {
    const activeOrders = await prisma.order.count({
      where: {
        userId,
        status: {
          in: ACTIVE_ORDER_STATUSES
        }
      }
    });

    return activeOrders > 0;
  } catch (error) {
    console.error('Error checking user active orders:', error);
    throw new ApiError(500, 'Failed to check active orders');
  }
};

/**
 * Get user's active orders with details
 * @param userId - The user ID
 * @returns Promise<Array> - Array of active orders
 */
export const getUserActiveOrders = async (userId: string) => {
  try {
    const activeOrders = await prisma.order.findMany({
      where: {
        userId,
        status: {
          in: ACTIVE_ORDER_STATUSES
        }
      },
      include: {
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
        createdAt: 'desc'
      }
    });

    return activeOrders;
  } catch (error) {
    console.error('Error getting user active orders:', error);
    throw new ApiError(500, 'Failed to get active orders');
  }
};

/**
 * Check if user can use POS payment method
 * @param userId - The user ID to check
 * @returns Promise<boolean> - True if user can use POS, false otherwise
 */
export const canUserUsePOSPayment = async (userId: string): Promise<boolean> => {
  try {
    // Check if user has any failed POS payments in the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const failedPOSPayments = await prisma.order.count({
      where: {
        userId,
        paymentMethod: 'POS',
        paymentStatus: 'FAILED',
        createdAt: {
          gte: sevenDaysAgo
        }
      }
    });

    // If user has failed POS payments in last 7 days, they cannot use POS
    if (failedPOSPayments > 0) {
      return false;
    }

    // Otherwise, POS is allowed
    return true;
  } catch (error) {
    console.error('Error checking POS payment eligibility:', error);
    throw new ApiError(500, 'Failed to check POS payment eligibility');
  }
};

export const createOrder = async (orderData: CreateOrderInput) => {
  try {
    // Check if user has active orders
    const hasActiveOrders = await checkUserActiveOrders(orderData.userId);
    if (hasActiveOrders) {
      throw new ApiError(400, "You already have an active order. Please complete or cancel your current order before placing a new one.");
    }

    // Check POS payment eligibility if user is trying to use POS
    if (orderData.paymentMethod === 'POS') {
      const canUsePOS = await canUserUsePOSPayment(orderData.userId);
      if (!canUsePOS) {
        throw new ApiError(400, "POS payment is not available due to failed POS attempts within the last 7 days.");
      }
    }

    // Validate tank size
    const tankSize = await prisma.tankSize.findUnique({
      where: { size: orderData.tankSize },
    });

    if (!tankSize) {
      throw new Error("Invalid tank size");
    }

    const orderId = generateOrderId();

    // Create the order first
    const order = await prisma.order.create({
      data: {
        orderId,
        userId: orderData.userId,
        tankSize: orderData.tankSize,
        deliveryAddress: orderData.deliveryAddress,
        deliveryLatitude: orderData.deliveryLatitude,
        deliveryLongitude: orderData.deliveryLongitude,
        paymentMethod: orderData.paymentMethod,
        notes: orderData.notes,
        amount: orderData.amount,
        totalAmount: orderData.amount,
        status: "PENDING",
        paymentStatus: orderData.paymentStatus ?? "PENDING",
        paymentReference: orderData.paymentReference ?? null,
      },
      include: {
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
    });

    // Auto-assign driver if available
    const assignmentResult = await autoAssignDriver(order.id, orderData.deliveryLatitude, orderData.deliveryLongitude);

    // Return the order with assignment result
    return await prisma.order.findUnique({
      where: { id: order.id },
      include: {
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
    });
  } catch (error) {
    console.error("Error creating order:", error);
    throw error;
  }
};

/**
 * Mark a payment as successful, ensure idempotency, and auto-assign driver if needed.
 */
export const confirmPaymentAndAssign = async (
  reference: string,
  amount?: number,
  gatewayReference?: string
) => {
  const ref = reference?.toString().trim();
  const gwRef = gatewayReference?.toString().trim();

  let order =
    (await prisma.order.findFirst({
      where: { paymentReference: ref },
    })) ||
    (gwRef
      ? await prisma.order.findFirst({
          where: { paymentReference: gwRef },
        })
      : null);

  if (!order) {
    throw new ApiError(404, "Order not found for payment reference");
  }

  if (order.paymentStatus === "PAID") {
    return order;
  }

  const updatedOrder = await prisma.order.update({
    where: { id: order.id },
    data: {
      paymentStatus: "PAID",
      totalAmount: amount
        ? Number(amount > 1000 ? amount / 100 : amount)
        : order.totalAmount,
      ...(gwRef && gwRef !== order.paymentReference
        ? { paymentReference: gwRef }
        : {}),
      ...(ref && !order.paymentReference
        ? { paymentReference: ref }
        : {}),
    },
  });

  if (!updatedOrder.driverId && updatedOrder.deliveryLatitude && updatedOrder.deliveryLongitude) {
    await autoAssignDriver(
      updatedOrder.id,
      updatedOrder.deliveryLatitude,
      updatedOrder.deliveryLongitude
    );
  }

  return updatedOrder;
};

/**
 * Auto-assign the best available driver to an order
 * @param orderId - The order ID to assign
 * @param deliveryLat - Delivery latitude
 * @param deliveryLong - Delivery longitude
 * @returns Promise<{success: boolean, driver?: any, message: string}>
 */
export const autoAssignDriver = async (
  orderId: string, 
  deliveryLat: number, 
  deliveryLong: number
) => {
  try {
    // Find best available driver
    const bestDriver = await findBestAvailableDriver(deliveryLat, deliveryLong);

    if (bestDriver) {
      // Assign the driver
      const assignedOrder = await assignDriver(orderId, bestDriver.id);

      let driverDistance: number | null = null;
      if (bestDriver.currentLat != null && bestDriver.currentLong != null) {
        driverDistance = calculateDistance(
          deliveryLat,
          deliveryLong,
          bestDriver.currentLat,
          bestDriver.currentLong
        );
      }

      // Emit new order event with distance information
        emitNewOrder(bestDriver.id, {
          orderId,
          estimatedDistance:
            driverDistance != null ? Number(driverDistance.toFixed(1)) : undefined,
        });

      const alarm = await createOrResetAssignmentAlarm(orderId, bestDriver.id);
      await sendDriverAssignmentNotification(
        assignedOrder,
        bestDriver.id,
        alarm.id
      );
      await scheduleDriverAlarm(alarm.id, bestDriver.id, {
        id: assignedOrder.id,
        orderId: assignedOrder.orderId,
      });

      return {
        success: true,
        driver: bestDriver,
        message: `Order auto-assigned to ${bestDriver.user.firstName} ${bestDriver.user.lastName}`
      };
    } else {
      return {
        success: false,
        message: "No available drivers found. Order will be assigned manually by admin."
      };
    }
  } catch (error) {
    console.error("Error in auto-assignment:", error);
    return {
      success: false,
      message: "Auto-assignment failed. Order will be assigned manually by admin."
    };
  }
};

/**
 * Manually assign a specific driver to an order (admin function)
 * @param orderId - The order ID
 * @param driverId - The driver ID to assign
 * @param assignedBy - Admin ID who made the assignment
 * @returns Promise<any>
 */
export const manualAssignDriver = async (
  orderId: string,
  driverId: string,
  assignedBy: string
) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        driver: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                phoneNumber: true,
              },
            },
          },
        },
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

    if (!order) {
      throw new ApiError(404, "Order not found");
    }

    const allowedStatuses: OrderStatus[] = ["PENDING", "ASSIGNED", "ACCEPTED"];
    if (!allowedStatuses.includes(order.status)) {
      throw new ApiError(400, `Cannot manually assign driver when order is ${order.status.toLowerCase()}.`);
    }

    const driver = await prisma.driver.findFirst({
      where: {
        id: driverId,
        isAvailable: true,
        user: {
          isActive: true,
          isBlocked: false,
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
    });

    if (!driver) {
      throw new ApiError(404, "Driver not found or unavailable");
    }

    if (order.driverId === driver.id) {
      return {
        success: true,
        message: "Driver is already assigned to this order.",
        order,
        previousDriverNotified: false,
        requiresAcknowledgement: false,
      };
    }

    const previousDriverId = order.driverId;

    const updatedOrder = await assignDriver(orderId, driver.id);

    if (order.status === "ACCEPTED") {
      await prisma.order.update({
        where: { id: orderId },
        data: { acceptedAt: null, status: "ASSIGNED" },
      });
      updatedOrder.status = "ASSIGNED";
      updatedOrder.acceptedAt = null;
    }

    await prisma.driver.update({
      where: { id: driver.id },
      data: { isAvailable: false },
    });

    if (previousDriverId) {
      await prisma.driver.update({
        where: { id: previousDriverId },
        data: { isAvailable: true },
      }).catch(error => {
        console.warn("Failed to mark previous driver available:", error);
      });
    }

    const deliveryLat = order.deliveryLatitude ?? 0;
    const deliveryLong = order.deliveryLongitude ?? 0;

    const alarm = await createOrResetAssignmentAlarm(orderId, driver.id);

    await prisma.driverAssignmentAlarm.updateMany({
      where: {
        orderId,
        driverId: { not: driver.id },
      },
      data: {
        status: DriverAssignmentAlarmStatus.CANCELLED,
        resolvedAt: new Date(),
      },
    });

    await sendDriverAssignmentNotification(updatedOrder, driver.id, alarm.id);
    await scheduleDriverAlarm(alarm.id, driver.id, {
      id: updatedOrder.id,
      orderId: updatedOrder.orderId,
    });

    await notifyPreviousDriver({ id: updatedOrder.id, orderId: updatedOrder.orderId }, previousDriverId);

    const driverDistance = driver.currentLat != null && driver.currentLong != null
      ? calculateDistance(deliveryLat, deliveryLong, driver.currentLat, driver.currentLong)
      : null;

    emitNewOrder(driver.id, {
      orderId,
      reassigned: Boolean(previousDriverId),
      estimatedDistance: driverDistance != null ? Number(driverDistance.toFixed(1)) : undefined,
    });

    emitOrderUpdate({
      orderId,
      status: updatedOrder.status,
      driverId: updatedOrder.driverId,
      driverName: `${driver.user.firstName ?? ""} ${driver.user.lastName ?? ""}`.trim() || null,
    });

    if (previousDriverId && previousDriverId !== driver.id) {
      emitDriverReassignment(previousDriverId, {
        orderId,
        newDriverId: driver.id,
        newDriverName: `${driver.user.firstName ?? ""} ${driver.user.lastName ?? ""}`.trim() || "Assigned driver",
        requestedAt: new Date().toISOString(),
        requiresAcknowledgement: true,
      });
    }

    console.log(`Order ${orderId} manually assigned to driver ${driver.id} by admin ${assignedBy}`);

    const refreshedOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
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

    return {
      success: true,
      order: refreshedOrder ?? updatedOrder,
      previousDriverNotified: Boolean(previousDriverId && previousDriverId !== driver.id),
      requiresAcknowledgement: Boolean(previousDriverId && previousDriverId !== driver.id),
      message: previousDriverId && previousDriverId !== driver.id
        ? "Driver reassigned successfully. Previous driver has been notified."
        : "Driver assigned successfully.",
    };
  } catch (error) {
    console.error("Error in manual assignment:", error);
    throw error;
  }
};

const assignDriver = async (orderId: string, driverId: string) => {
  try {
  const order = await prisma.order.update({
    where: { id: orderId },
    data: {
      driverId,
      status: "ASSIGNED",
      assignedAt: new Date(),
      acceptedAt: null,
    },
    include: {
      driver: {
        include: {
          user: true,
        },
      },
      user: true,
    },
  });

  return order;
  } catch (error) {
    console.error("Error assigning driver:", error);
    throw error;
  }
};

export const getUserOrderHistory = async (userId: string) => {
  return prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      driver: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phoneNumber: true,
            },
          },
        },
      },
    },
  });
};

export const confirmDelivery = async (orderId: string) => {
  const order = await prisma.order.update({
    where: { orderId: orderId },
    data: { deliveryConfirmation: true },
  });
  return order;
};

export const getDriverOrderHistory = async (
  driverId: string,
  page: number,
  limit: number
) => {
  // Calculate skip for pagination
  const skip = (page - 1) * limit;

  // Get total count
  const total = await prisma.order.count({
    where: { driverId },
  });

  // Get paginated orders
  const orders = await prisma.order.findMany({
    where: { driverId },
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phoneNumber: true,
        },
      },
    },
    skip,
    take: limit,
  });

  return { orders, total };
};

export const getOrderById = async (orderId: string, userId: string) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId, userId },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phoneNumber: true,
        },
      },
      driver: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phoneNumber: true,
            },
          },
        },
      },
    },
  });

  //fetch the driver location
  const driverLocation = await prisma.driver.findUnique({
    where: { id: order?.driverId || "" },
    select: {
      currentLat: true,
      currentLong: true,
    },
  });

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  return { order, driverLocation };
};

export const updateOrderStatus = async (
  orderId: string,
  { status, driverId, cancellationReason }: UpdateOrderStatusInput
) => {
  logger.info("updateOrderStatus invoked", { orderId, status, driverId });
  const statusTimestamp = {
    ...(status === "ASSIGNED" && { assignedAt: new Date() }),
    ...(status === "ACCEPTED" && { acceptedAt: new Date() }),
    ...(status === "PICKED_UP" && { pickedUpAt: new Date() }),
    ...(status === "DELIVERED" && { deliveredAt: new Date() }),
    ...(status === "CANCELLED" && { cancelledAt: new Date() }),
  };

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: {
        select: {
          id: true,
          pushToken: true,
        },
      },
      driver: {
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              pushToken: true,
            },
          },
        },
      },
    },
  });

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: {
      status,
      driverId,
      cancellationReason,
      ...(status === OrderStatus.DELIVERED && {
        actualDeliveryDate: new Date(),
        ...statusTimestamp,
      }),
    },
    include: {
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
  });

  const userId = order.user?.id;
  if (userId) {
    const statusTitles: Record<OrderStatus, string> = {
      PENDING: "Order pending",
      ASSIGNED: "Driver assigned",
      ACCEPTED: "Order accepted",
      PICKED_UP: "Order picked up",
      IN_TRANSIT: "Driver on the way",
      DELIVERED: "Order delivered",
      CANCELLED: "Order cancelled",
    };

    const statusBodies: Record<OrderStatus, string> = {
      PENDING: "Your order has been received and is awaiting assignment.",
      ASSIGNED: "A driver has been assigned and will accept shortly.",
      ACCEPTED: "Your driver has accepted and is preparing for delivery.",
      PICKED_UP: "Your gas cylinder has been picked up and delivery is underway.",
      IN_TRANSIT: "Your driver is en route. Track progress in the app.",
      DELIVERED: "Your order has been delivered. Thank you for choosing eGas!",
      CANCELLED: "The order has been cancelled. You can place a new one anytime.",
    };

    const userNotification: NotificationJob = {
      type: "ORDER_STATUS",
      audience: { userId },
      payload: {
        title: statusTitles[status] ?? "Order update",
        body: statusBodies[status] ?? `Order status changed to ${status}`,
        data: {
          orderId: order.id,
          status,
          type: "ORDER_STATUS",
        },
        priority: status === OrderStatus.DELIVERED ? "high" : "normal",
      },
      metadata: {
        orderId,
        userId,
      },
    };

    try {
      await enqueueNotification(userNotification);
      logger.info("User status notification enqueued", {
        orderId,
        status,
        userId,
      });
    } catch (err) {
      logger.error("Failed to enqueue user status notification", err);
    }
  }

  if (status === OrderStatus.DELIVERED) {
    try {
      if (userId) {
        const deliveryConfirmationJob: NotificationJob = {
          type: "ORDER_STATUS",
          audience: { userId },
          payload: {
            title: "Order delivered",
            body: `Your order #${order.orderId ?? updatedOrder.orderId} has been delivered`,
            data: {
              orderId: order.id,
              trackingId: order.trackingId ?? updatedOrder.trackingId ?? "",
              status,
              type: "ORDER_DELIVERED",
            },
            priority: "high",
          },
          metadata: {
            orderId,
            userId,
          },
        };

        await enqueueNotification(deliveryConfirmationJob);
        logger.info("User delivery confirmation notification enqueued", {
          orderId,
          userId,
        });
      }
    } catch (error) {
      logger.error("Failed to enqueue delivery notification", error);
    }
  }

  if (status === OrderStatus.DELIVERED || status === OrderStatus.CANCELLED) {
    const alarm = await prisma.driverAssignmentAlarm.findUnique({ where: { orderId } });
    if (alarm) {
      if (alarm.repeatJobKey) {
        await cancelAlarmReminder(alarm.repeatJobKey);
      }
      await prisma.driverAssignmentAlarm.update({
        where: { id: alarm.id },
        data: {
          status: status === OrderStatus.DELIVERED ? DriverAssignmentAlarmStatus.ACKNOWLEDGED : DriverAssignmentAlarmStatus.CANCELLED,
          resolvedAt: new Date(),
          repeatJobKey: null,
        },
      });
    }
  }

  logger.info("Order status update notification segment", {
    orderId,
    status,
    driverId,
    userId: order.user?.id,
  });

  return updatedOrder;
};

export const trackOrder = async (trackingId: string) => {
  const order = await prisma.order.findUnique({
    where: { trackingId },
    include: {
      driver: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phoneNumber: true,
            },
          },
        },
      },
    },
  });

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  return order;
};
