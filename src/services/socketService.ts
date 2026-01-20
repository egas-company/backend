import { getIO } from "../config/socket";

interface OrderUpdate {
  orderId: string;
  status: string;
  driverId?: string | null;
  driverName?: string | null;
  driverLocation?: {
    latitude: number;
    longitude: number;
  };
}

interface DriverLocationUpdate {
  orderId: string;
  driverLocation: {
    latitude: number;
    longitude: number;
  };
  estimatedArrival: string;
  timeRemaining: number;
  distanceText: string;
  durationText: string;
}

export const emitOrderUpdate = (update: OrderUpdate) => {
  const io = getIO();
  console.log(`Emitting order update for order ${update.orderId}:`, update);
  io.to(`order_${update.orderId}`).emit("orderUpdate", {
    orderId: update.orderId,
    status: update.status,
    driverId: update.driverId ?? null,
    driverName: update.driverName ?? null,
    driverLocation: update.driverLocation
  });
};

export const emitNewOrder = (driverId: string, order: any) => {
  const io = getIO();
  console.log(`Emitting new order to driver ${driverId}:`, order);
  
  // Emit to specific driver
  io.to(`driver_${driverId}`).emit("newOrder", order);
  
};

export const emitDriverLocationUpdate = (update: DriverLocationUpdate) => {
  const io = getIO();
  console.log(`Emitting driver location update for order ${update.orderId}:`, update);
  io.to(`order_${update.orderId}`).emit("driverLocationUpdate", {
    orderId: update.orderId,
    driverLocation: update.driverLocation,
    estimatedArrival: update.estimatedArrival,
    timeRemaining: update.timeRemaining
  });
};

export const emitDriverReassignment = (
  driverId: string,
  payload: {
    orderId: string;
    newDriverId: string;
    newDriverName?: string;
    requestedAt: string;
    requiresAcknowledgement: boolean;
  }
) => {
  const io = getIO();
  console.log(`Emitting reassignment notice to driver ${driverId}:`, payload);
  io.to(`driver_${driverId}`).emit("orderReassignment", payload);
};
