import { prisma } from "../lib/prisma";
import { OrderStatus } from "@prisma/client";

export const dashboardService = {
  async getOrderStats() {
    const [totalOrders, activeOrders, completedOrders, canceledOrders] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({
        where: {
          status: {
            in: [
              OrderStatus.PENDING,
              OrderStatus.ASSIGNED,
              OrderStatus.ACCEPTED,
              OrderStatus.PICKED_UP,
              OrderStatus.IN_TRANSIT
            ]
          }
        }
      }),
      prisma.order.count({
        where: { status: OrderStatus.DELIVERED }
      }),
      prisma.order.count({
        where: { status: OrderStatus.CANCELLED }
      })
    ]);

    return {
      totalOrders,
      activeOrders,
      completedOrders,
      canceledOrders
    };
  },

  async getRecentOrders() {
    return prisma.order.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true
          }
        },
        TankSize: true
      },
      where: {
        status: {
          in: [
            OrderStatus.PENDING,
            OrderStatus.PICKED_UP,
            OrderStatus.IN_TRANSIT,
            OrderStatus.ASSIGNED,
            OrderStatus.ACCEPTED,
            OrderStatus.DELIVERED,
            OrderStatus.CANCELLED
          ]
        }
      }
    });
  }
}; 