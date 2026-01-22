import { prisma } from "../lib/prisma";
import { findBestAvailableDriver } from "../utils/distance";
import { emitDriverLocationUpdate, emitOrderUpdate } from "./socketService";
import { DriverAssignmentAlarmStatus, OrderStatus } from "@prisma/client";
import axios from 'axios';
import { cancelAlarmReminder } from "./notificationQueue";
import { updateOrderStatus } from "./order";

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyDYxkdoCPdRSTXYPfjAodX4HpR2njHpKVA';

interface OrderResponse {
  orderId: string;
  success: boolean;
  message: string;
}


export const acceptOrder = async (
  orderId: string,
  driverId: string
): Promise<OrderResponse> => {
  try {
    // Get order and validate status
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
      throw new Error("Order not found");
    }

    if (order.status !== "ASSIGNED") {
      throw new Error("Order cannot be accepted at this time");
    }

    if (order.driverId !== driverId) {
      throw new Error("Order is not assigned to this driver");
    }

    const updatedOrder = await updateOrderStatus(orderId, {
      status: OrderStatus.ACCEPTED,
      driverId,
    });

    await prisma.driver.update({
      where: { id: driverId },
      data: { isAvailable: true },
    });

    await resolveAssignmentAlarm(orderId, DriverAssignmentAlarmStatus.ACKNOWLEDGED);

    // Calculate initial ETA when order is accepted
    let initialETA: {
      estimatedArrival: string;
      timeRemaining: number;
      distanceText: string;
      durationText: string;
    } | null = null;

    if (
      order.driver &&
      order.driver.currentLat &&
      order.driver.currentLong &&
      order.deliveryLatitude &&
      order.deliveryLongitude
    ) {
      const driverLat = order.driver.currentLat;
      const driverLng = order.driver.currentLong;
      const deliveryLat = order.deliveryLatitude;
      const deliveryLng = order.deliveryLongitude;

      // Check if location is invalid, but still try to calculate ETA (compulsory)
      const isInvalidLocation = 
        (driverLat === 0 && driverLng === 0) ||
        (Math.abs(driverLat - 37.422) < 0.001 && Math.abs(driverLng - (-122.084)) < 0.001);

      if (isInvalidLocation) {
        console.warn('⚠️ Driver location is invalid (Google HQ or 0,0), but attempting ETA calculation anyway:', {
          driverLat,
          driverLng,
          orderId: order.id,
        });
      }

      // ALWAYS try to calculate ETA (compulsory requirement)
      try {
        const url = `https://maps.googleapis.com/maps/api/distancematrix/json?` +
          `origins=${driverLat},${driverLng}&` +
          `destinations=${deliveryLat},${deliveryLng}&` +
          `departure_time=now&` +
          `traffic_model=best_guess&` +
          `key=${GOOGLE_MAPS_API_KEY}`;

        console.log('🔄 Calculating initial ETA when order accepted (COMPULSORY):', {
          orderId: order.id,
          driverLocation: `(${driverLat}, ${driverLng})`,
          deliveryLocation: `(${deliveryLat}, ${deliveryLng})`,
          isInvalidLocation,
        });

        const response = await axios.get(url);
        
        if (response.data.status === 'OK') {
          const element = response.data.rows[0].elements[0];
          
          if (element.status === 'OK') {
            const { text: durationText } = element.duration;
            const { text: distanceText } = element.distance;
            
            // Calculate arrival time
            const now = new Date();
            const arrivalTime = new Date(now.getTime() + element.duration.value * 1000);
            const estimatedArrival = `${arrivalTime.getHours().toString().padStart(2, '0')}:${arrivalTime.getMinutes().toString().padStart(2, '0')}`;

            initialETA = {
              estimatedArrival,
              timeRemaining: element.duration.value,
              distanceText,
              durationText
            };

            console.log('✅ Initial ETA calculated successfully:', initialETA);
          } else {
            console.warn('⚠️ Initial ETA calculation failed (element status):', {
              status: element.status,
              orderId: order.id,
              driverLocation: `(${driverLat}, ${driverLng})`,
            });
          }
        } else {
          console.warn('⚠️ Distance Matrix API error for initial ETA:', {
            status: response.data.status,
            error_message: response.data.error_message,
            orderId: order.id,
          });
        }
      } catch (error) {
        console.error('❌ Error calculating initial ETA:', {
          error: error instanceof Error ? error.message : error,
          orderId: order.id,
          driverLocation: `(${driverLat}, ${driverLng})`,
        });
      }
    } else {
      console.warn('⚠️ Cannot calculate initial ETA - missing data:', {
        orderId: order.id,
        hasDriver: !!order.driver,
        hasDriverLocation: !!(order.driver?.currentLat && order.driver?.currentLong),
        hasDeliveryLocation: !!(order.deliveryLatitude && order.deliveryLongitude),
      });
    }

    // Emit socket update with status and initial ETA immediately
    console.log('📤 Emitting order accepted update:', {
      orderId: order.id,
      status: "ACCEPTED",
      driverLocation: order.driver ? {
        latitude: order.driver.currentLat,
        longitude: order.driver.currentLong,
      } : undefined,
      hasInitialETA: !!initialETA,
      willSendETA: !!initialETA,
    });

    emitOrderUpdate({
      orderId: order.id,
      status: "ACCEPTED",
      driverLocation: order.driver ? {
        latitude: order.driver.currentLat!,
        longitude: order.driver.currentLong!,
      } : undefined,
    });

    // Emit initial ETA immediately if calculated (send right after orderUpdate)
    if (initialETA && order.driver) {
      // Send ETA immediately - no delay needed
      emitDriverLocationUpdate({
        orderId: order.id,
        driverLocation: {
          latitude: order.driver.currentLat!,
          longitude: order.driver.currentLong!,
        },
        estimatedArrival: initialETA.estimatedArrival,
        timeRemaining: initialETA.timeRemaining,
        distanceText: initialETA.distanceText,
        durationText: initialETA.durationText,
      });
      console.log('Initial ETA sent immediately after order acceptance');
    }

    return {
      orderId,
      success: true,
      message: "Order accepted successfully",
    };
  } catch (error: any) {
    throw new Error(`Failed to accept order: ${error.message}`);
  }
};

export const declineOrder = async (
  orderId: string,
  driverId: string,
  reason: string
): Promise<OrderResponse> => {
  try {
    // Get order and validate status
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: true,
      },
    });

    if (!order) {
      throw new Error("Order not found");
    }

    if (order.status !== "ASSIGNED") {
      throw new Error("Order cannot be declined at this time");
    }

    if (order.driverId !== driverId) {
      throw new Error("Order is not assigned to this driver");
    }

    // Update order status and find new driver
    const updatedOrder = await prisma.$transaction(async tx => {
      // Find next nearest available driver
      const nextDriver = await findBestAvailableDriver(
        order.deliveryLatitude!,
        order.deliveryLongitude!,
        driverId // Exclude current driver
      );

      // Update order based on whether another driver is available
      const orderUpdate = nextDriver
        ? {
            driverId: nextDriver.id,
            status: OrderStatus.ASSIGNED,
            assignedAt: new Date(),
          }
        : {
            driverId: null,
            status: OrderStatus.PENDING,
            assignedAt: null,
          };

      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          ...orderUpdate,
          notes: `Previous driver declined: ${reason}`,
        },
        include: {
          user: true,
        },
      });

      // Update current driver availability
      await tx.driver.update({
        where: { id: driverId },
        data: {
          isAvailable: true,
        },
      });

      return updated;
    });

    // Emit socket update
    emitOrderUpdate({
      orderId: order.id,
      status: updatedOrder.status,
    });

    return {
      orderId,
      success: true,
      message: "Order declined successfully",
    };
  } catch (error: any) {
    throw new Error(`Failed to decline order: ${error.message}`);
  }
};

export const updateDriverLocation = async (
  driverId: string,
  currentLat: number,
  currentLong: number
) => {
  try {
    // Validate coordinates
    if (!currentLat || !currentLong || isNaN(currentLat) || isNaN(currentLong)) {
      console.error('Invalid driver location coordinates received:', { currentLat, currentLong, driverId });
      throw new Error('Invalid driver location coordinates');
    }

    // Check for invalid coordinates (0,0)
    if (currentLat === 0 && currentLong === 0) {
      console.warn('Driver location is (0,0) - location may not be available:', { driverId });
      // Don't throw, but log warning
    }

    // Check for Google HQ coordinates (common default/test value)
    if (Math.abs(currentLat - 37.422) < 0.001 && Math.abs(currentLong - (-122.084)) < 0.001) {
      console.warn('⚠️ Driver location appears to be Google HQ (default/test coordinates):', {
        driverId,
        lat: currentLat,
        lng: currentLong,
      });
    }

    const driver = await prisma.driver.update({
      where: { id: driverId },
      data: { currentLat, currentLong },
      include: {
        orders: {
          where: {
            status: { in: ['ACCEPTED', 'IN_TRANSIT'] }
          },
          include: {
            user: true
          }
        }
      }
    });

    for (const order of driver.orders) {
      try {
        // Validate order coordinates
        if (!order.deliveryLatitude || !order.deliveryLongitude) {
          console.warn('Order missing delivery coordinates:', { orderId: order.id });
          continue;
        }

        const url = `https://maps.googleapis.com/maps/api/distancematrix/json?` +
          `origins=${currentLat},${currentLong}&` +
          `destinations=${order.deliveryLatitude},${order.deliveryLongitude}&` +
          `departure_time=now&` +
          `traffic_model=best_guess&` +
          `key=${GOOGLE_MAPS_API_KEY}`;

        console.log('Calculating ETA for order:', {
          orderId: order.id,
          driverLocation: `(${currentLat}, ${currentLong})`,
          deliveryLocation: `(${order.deliveryLatitude}, ${order.deliveryLongitude})`,
        });

        const response = await axios.get(url);
        console.log('Distance Matrix API response:', response.data);
        
        if (response.data.status !== 'OK') {
          console.error('❌ Distance Matrix API error:', {
            status: response.data.status,
            error_message: response.data.error_message,
            orderId: order.id,
          });
          // Still emit location update - client can calculate ETA (COMPULSORY)
          emitDriverLocationUpdate({
            orderId: order.id,
            driverLocation: { 
              latitude: currentLat, 
              longitude: currentLong 
            },
            estimatedArrival: '',
            timeRemaining: 0,
            distanceText: '',
            durationText: ''
          });
          continue;
        }

        const element = response.data.rows[0].elements[0];

        if (element.status === 'OK') {
          // Use the formatted text directly from the API response
          const { text: durationText } = element.duration;
          const { text: distanceText } = element.distance;
          
          // Calculate arrival time
          const now = new Date();
          const arrivalTime = new Date(now.getTime() + element.duration.value * 1000);
          const estimatedArrival = `${arrivalTime.getHours().toString().padStart(2, '0')}:${arrivalTime.getMinutes().toString().padStart(2, '0')}`;

          console.log('✅ ETA calculated successfully:', {
            orderId: order.id,
            estimatedArrival,
            timeRemaining: element.duration.value,
            durationText,
          });

          emitDriverLocationUpdate({
            orderId: order.id,
            driverLocation: { 
              latitude: currentLat, 
              longitude: currentLong 
            },
            estimatedArrival,
            timeRemaining: element.duration.value,
            distanceText,
            durationText
          });
        } else {
          console.warn('⚠️ Distance Matrix element status not OK:', {
            status: element.status,
            orderId: order.id,
            driverLocation: `(${currentLat}, ${currentLong})`,
            deliveryLocation: `(${order.deliveryLatitude}, ${order.deliveryLongitude})`,
          });
          // Still emit location update - client can calculate ETA (COMPULSORY)
          emitDriverLocationUpdate({
            orderId: order.id,
            driverLocation: { 
              latitude: currentLat, 
              longitude: currentLong 
            },
            estimatedArrival: '',
            timeRemaining: 0,
            distanceText: '',
            durationText: ''
          });
        }
      } catch (error) {
        console.error('❌ Error calculating ETA for order:', {
          error: error instanceof Error ? error.message : error,
          orderId: order.id,
          driverLocation: `(${currentLat}, ${currentLong})`,
        });
        // Emit location update anyway - client can calculate ETA (COMPULSORY)
        emitDriverLocationUpdate({
          orderId: order.id,
          driverLocation: { 
            latitude: currentLat, 
            longitude: currentLong 
          },
          estimatedArrival: '',
          timeRemaining: 0,
          distanceText: '',
          durationText: ''
        });
      }
    }

    return driver;
  } catch (error) {
    console.error('Error updating driver location:', error);
    throw error;
  }
};

// export const findNearestDriver = async (
//   deliveryLat: number,
//   deliveryLong: number
// ) => {
//   const availableDrivers = await prisma.driver.findMany({
//     where: {
//       isAvailable: true,
//       user: {
//         isActive: true,
//         isBlocked: false,
//       },
//     },
//   });

//   if (availableDrivers.length === 0) return null;

//   let nearestDriver = availableDrivers[0];
//   let shortestDistance = calculateDistance(
//     deliveryLat,
//     deliveryLong,
//     nearestDriver.currentLat!,
//     nearestDriver.currentLong!
//   );

//   for (const driver of availableDrivers) {
//     if (!driver.currentLat || !driver.currentLong) continue;

//     const distance = calculateDistance(
//       deliveryLat,
//       deliveryLong,
//       driver.currentLat,
//       driver.currentLong
//     );

//     if (distance < shortestDistance) {
//       shortestDistance = distance;
//       nearestDriver = driver;
//     }
//   }

//   return nearestDriver;
// };

export const startDelivery = async (
  orderId: string,
  driverId: string
): Promise<OrderResponse> => {
  try {
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        driverId,
        status: "ACCEPTED",
      },
      include: {
        user: {
          select: {
            pushToken: true,
          },
        },
      },
    });

    if (!order) {
      throw new Error("Order not found or not in correct state");
    }

    await updateOrderStatus(orderId, {
      status: OrderStatus.IN_TRANSIT,
      driverId,
    });

    await prisma.driver.update({
      where: { id: driverId },
      data: { isAvailable: false },
    });

    // Emit socket update
    emitOrderUpdate({
      orderId: order.id,
      status: "IN_TRANSIT",
    });

    return {
      orderId,
      success: true,
      message: "Delivery started successfully",
    };
  } catch (error: any) {
    throw new Error(`Failed to start delivery: ${error.message}`);
  }
};

export const completeDelivery = async (
  orderId: string,
  driverId: string
): Promise<OrderResponse> => {
  try {
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        driverId,
        status: "IN_TRANSIT",
      },
      include: {
        user: {
          select: {
            id: true,
            pushToken: true,
          },
        },
      },
    });

    if (!order) {
      throw new Error("Order not found or not in correct state");
    }

    await updateOrderStatus(orderId, {
      status: OrderStatus.DELIVERED,
      driverId,
    });

    await prisma.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: "PAID",
        paymentReference: "POS",
        deliveredAt: new Date(),
      },
    });

    await prisma.driver.update({
      where: { id: driverId },
      data: {
        isAvailable: true,
      },
    });

    // Emit socket update
    emitOrderUpdate({
      orderId: order.id,
      status: "DELIVERED",
    });

    await resolveAssignmentAlarm(orderId, DriverAssignmentAlarmStatus.CANCELLED);

    return {
      orderId,
      success: true,
      message: "Delivery completed successfully",
    };
  } catch (error: any) {
    throw new Error(`Failed to complete delivery: ${error.message}`);
  }
};
const resolveAssignmentAlarm = async (orderId: string, status: DriverAssignmentAlarmStatus) => {
  try {
    const alarm = await prisma.driverAssignmentAlarm.findUnique({ where: { orderId } });
    if (!alarm) return;

    if (alarm.repeatJobKey) {
      await cancelAlarmReminder(alarm.repeatJobKey);
    }

    await prisma.driverAssignmentAlarm.update({
      where: { id: alarm.id },
      data: {
        status,
        acknowledgedAt: status === DriverAssignmentAlarmStatus.ACKNOWLEDGED ? new Date() : alarm.acknowledgedAt,
        resolvedAt: new Date(),
        repeatJobKey: null,
      },
    });
  } catch (error) {
    console.warn("Failed to resolve assignment alarm", error);
  }
};
