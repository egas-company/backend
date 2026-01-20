import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/ApiError";

interface TankSizeCreateInput {
  size: string;
  price: number;
  name: string;
  status: string;
}

interface TankSizeUpdateInput {
  price?: number;
  status?: string;
  name?: string;
}

export const tankSizeService = {
  getAllTankSizes: async (includeInactive = false) => {
    return prisma.tankSize.findMany({
      where: includeInactive ? {} : { status: 'ACTIVE' },
      orderBy: { size: 'asc' },
      select: {
        id: true,
        size: true,
        price: true,
        status: true,
        _count: {
          select: {
            orders: true
          }
        }
      }
    });
  },

  getTankSizeBySize: async (size: string) => {
    const tankSize = await prisma.tankSize.findUnique({
      where: { size, status: 'ACTIVE' },
    });
    
    if (!tankSize) {
      throw new ApiError(404, "Tank size not found or inactive");
    }
    
    return tankSize;
  },

  createTankSize: async (data: TankSizeCreateInput) => {
    const existing = await prisma.tankSize.findUnique({
      where: { size: data.size },
    });

    if (existing) {
      throw new ApiError(400, "Tank size already exists");
    }

    return prisma.tankSize.create({
      data: {
        size: data.size,
        price: data.price,
        name: data.name,
      },
    });
  },

  updateTankSize: async (id: string, data: TankSizeUpdateInput) => {
    const tankSize = await prisma.tankSize.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            orders: true
          }
        }
      }
    });

    if (!tankSize) {
      throw new ApiError(404, "Tank size not found");
    }

    // If trying to deactivate, check if there are any pending orders
    if (data.status === 'INACTIVE' && tankSize._count.orders > 0) {
      const pendingOrders = await prisma.order.count({
        where: {
          tankSizeId: id,
          status: 'PENDING'
        }
      });

      if (pendingOrders > 0) {
        throw new ApiError(400, "Cannot deactivate tank size with pending orders");
      }
    }

    return prisma.tankSize.update({
      where: { id },
      data: {
        ...data,
        price: data.price ? data.price : undefined,
      },
    });
  },

  deleteTankSize: async (id: string) => {
    const tankSize = await prisma.tankSize.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            orders: true
          }
        }
      }
    });

    if (!tankSize) {
      throw new ApiError(404, "Tank size not found");
    }

    if (tankSize._count.orders > 0) {
      // Instead of deleting, just deactivate
      return prisma.tankSize.update({
        where: { id },
        data: { status: 'INACTIVE' }
      });
    }

    return prisma.tankSize.delete({
      where: { id }
    });
  }
}; 