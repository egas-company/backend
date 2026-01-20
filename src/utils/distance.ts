import { prisma } from "../lib/prisma";

export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const toRad = (degrees: number): number => {
  return degrees * (Math.PI / 180);
};

export const findBestAvailableDriver = async (
  deliveryLat: number,
  deliveryLong: number,
  excludeDriverId?: string
) => {
  // Get all available drivers
  const availableDrivers = await prisma.driver.findMany({
    where: {
      isAvailable: true,
      id: excludeDriverId ? { not: excludeDriverId } : undefined,
      user: {
        isActive: true,
        isBlocked: false,
      },
    },
    include: {
      user: true,
      orders: {
        where: {
          status: { in: ["ACCEPTED", "IN_TRANSIT", "DELIVERED"] },
        },
      },
    },
  });

  if (availableDrivers.length === 0) return null;

  let bestDriver: typeof availableDrivers[number] | null = null;
  let shortestDistance = Number.POSITIVE_INFINITY;

  for (const driver of availableDrivers) {
    if (driver.currentLat == null || driver.currentLong == null) {
      continue;
    }

    const distance = calculateDistance(
      deliveryLat,
      deliveryLong,
      driver.currentLat,
      driver.currentLong
    );

    if (distance < shortestDistance) {
      shortestDistance = distance;
      bestDriver = driver;
    }
  }

  return bestDriver;
};
