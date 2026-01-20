import { describe, it, beforeEach, expect, vi } from "vitest";
import type { NotificationJob } from "../src/types/notifications";
import { DriverAssignmentAlarmStatus, OrderStatus } from "@prisma/client";

const prismaStub = {
  order: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  driver: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  driverAssignmentAlarm: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn(),
  },
  notificationDevice: {
    findMany: vi.fn(),
  },
  notificationLog: {
    create: vi.fn(),
  },
};

const mockEnqueueDriverAssignmentNotification = vi.fn<[], Promise<void>>(async () => undefined);
const mockScheduleAlarmReminder = vi.fn<
  [string, NotificationJob],
  Promise<string | null>
>(async () => "repeat-key");
const mockEnqueueNotification = vi.fn<[], Promise<void>>(async () => undefined);
const mockCancelAlarmReminder = vi.fn<[string | null | undefined], Promise<void>>(async () => undefined);

const mockEmitNewOrder = vi.fn();
const mockEmitOrderUpdate = vi.fn();
const mockEmitDriverReassignment = vi.fn();

vi.mock("../src/lib/prisma", () => ({
  prisma: prismaStub,
}));

vi.mock("../src/services/notificationQueue", () => ({
  enqueueDriverAssignmentNotification: mockEnqueueDriverAssignmentNotification,
  scheduleAlarmReminder: mockScheduleAlarmReminder,
  enqueueNotification: mockEnqueueNotification,
  cancelAlarmReminder: mockCancelAlarmReminder,
}));

vi.mock("../src/services/socketService", () => ({
  emitNewOrder: mockEmitNewOrder,
  emitOrderUpdate: mockEmitOrderUpdate,
  emitDriverReassignment: mockEmitDriverReassignment,
}));

vi.mock("../src/utils/distance", () => ({
  calculateDistance: vi.fn().mockReturnValue(2.4),
  findBestAvailableDriver: vi.fn(),
}));

vi.mock("../src/utils/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("../src/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

const resetPrismaStubs = () => {
  prismaStub.order.findUnique.mockReset();
  prismaStub.order.update.mockReset();
  prismaStub.driver.findFirst.mockReset();
  prismaStub.driver.update.mockReset();
  prismaStub.driverAssignmentAlarm.findUnique.mockReset();
  prismaStub.driverAssignmentAlarm.upsert.mockReset();
  prismaStub.driverAssignmentAlarm.updateMany.mockReset();
  prismaStub.driverAssignmentAlarm.update.mockReset();
};

beforeEach(() => {
  resetPrismaStubs();
  vi.clearAllMocks();
  mockScheduleAlarmReminder.mockResolvedValue("repeat-key");
});

describe("notification workflow", () => {
  it("enqueues assignment and alarm notifications when an order is manually assigned", async () => {
    const user = {
      id: "user-1",
      firstName: "Ada",
      lastName: "Obi",
      phoneNumber: "+2348000000000",
      email: "ada@example.com",
    };

    const driverUser = {
      id: "driver-user-1",
      firstName: "Kunle",
      lastName: "Ade",
      phoneNumber: "+2348111111111",
    };

    const driver = {
      id: "driver-123",
      isAvailable: true,
      currentLat: 6.4,
      currentLong: 3.2,
      user: driverUser,
    };

    const baseOrder = {
      id: "order-123",
      orderId: "EG-1001",
      status: "PENDING",
      deliveryLatitude: 6.5,
      deliveryLongitude: 3.3,
      driverId: null as string | null,
      userId: user.id,
      driver: null,
      user,
    };

    let orderState = clone(baseOrder);

    prismaStub.order.findUnique
      .mockResolvedValueOnce(clone(baseOrder))
      .mockResolvedValueOnce({
        ...clone(orderState),
        driver: {
          ...driver,
          user: driverUser,
        },
      });

    prismaStub.order.update.mockImplementation(async ({ data, include }) => {
      orderState = {
        ...orderState,
        ...data,
        status: data.status ?? orderState.status,
        driverId: data.driverId ?? orderState.driverId,
        assignedAt: data.assignedAt ?? orderState.assignedAt,
        acceptedAt: data.acceptedAt ?? orderState.acceptedAt,
      };

      const result: any = {
        ...orderState,
      };

      if (include?.driver) {
        result.driver = {
          ...driver,
          user: driverUser,
        };
      }

      if (include?.user) {
        result.user = user;
      }

      return result;
    });

    prismaStub.driver.findFirst.mockResolvedValue(driver);
    prismaStub.driver.update.mockImplementation(async args => ({
      ...driver,
      ...args.data,
    }));

    prismaStub.driverAssignmentAlarm.findUnique.mockResolvedValue(null);

    const alarm = {
      id: "alarm-1",
      orderId: baseOrder.id,
      driverId: driver.id,
      status: DriverAssignmentAlarmStatus.PENDING,
      repeatJobKey: null as string | null,
      requestedAt: new Date(),
      acknowledgedAt: null,
      resolvedAt: null,
    };

    prismaStub.driverAssignmentAlarm.upsert.mockResolvedValue(alarm);
    prismaStub.driverAssignmentAlarm.updateMany.mockResolvedValue({ count: 0 });
    prismaStub.driverAssignmentAlarm.update.mockResolvedValue({
      ...alarm,
      repeatJobKey: "repeat-key",
    });

    const { manualAssignDriver } = await import("../src/services/order");

    const result = await manualAssignDriver(baseOrder.id, driver.id, "admin-9");

    expect(result.success).toBe(true);
    expect(mockEnqueueDriverAssignmentNotification).toHaveBeenCalledTimes(1);
    const assignmentJob = mockEnqueueDriverAssignmentNotification.mock.calls[0][0];
    expect(assignmentJob).toMatchObject({
      type: "ORDER_ASSIGNMENT",
      audience: { driverId: driver.id },
      payload: {
        title: expect.stringContaining("New order"),
        data: {
          orderId: baseOrder.id,
          type: "ORDER_ASSIGNMENT",
        },
        priority: "high",
      },
      metadata: {
        orderId: baseOrder.id,
        driverId: driver.id,
        alarmId: alarm.id,
      },
    });

    expect(mockScheduleAlarmReminder).toHaveBeenCalledTimes(1);
    expect(mockScheduleAlarmReminder).toHaveBeenCalledWith(
      alarm.id,
      expect.objectContaining({
        type: "ALARM_REMINDER",
        audience: { driverId: driver.id },
        metadata: expect.objectContaining({
          alarmId: alarm.id,
          orderId: baseOrder.id,
        }),
      })
    );

    expect(prismaStub.driverAssignmentAlarm.update).toHaveBeenCalledWith({
      where: { id: alarm.id },
      data: { repeatJobKey: expect.any(String) },
    });

    expect(mockEnqueueNotification).not.toHaveBeenCalled();
  });

  it("enqueues delivery notification for users when an order is delivered", async () => {
    const orderId = "order-456";
    const userId = "user-1";
    const trackingId = "TRK-001";

    const existingOrder = {
      id: orderId,
      orderId: "EG-2000",
      status: OrderStatus.ASSIGNED,
      trackingId,
      driverId: "driver-123",
      user: {
        id: userId,
        pushToken: "push-token",
      },
      driver: {
        user: {
          firstName: "Kunle",
          lastName: "Ade",
          pushToken: "driver-token",
        },
      },
    };

    prismaStub.order.findUnique.mockResolvedValue(existingOrder);

    prismaStub.order.update.mockImplementation(async ({ data }) => ({
      ...existingOrder,
      ...data,
      status: data.status ?? OrderStatus.DELIVERED,
    }));

    const alarmRecord = {
      id: "alarm-9",
      orderId,
      driverId: "driver-123",
      repeatJobKey: "repeat-key",
      status: DriverAssignmentAlarmStatus.PENDING,
    };

    prismaStub.driverAssignmentAlarm.findUnique.mockResolvedValue(alarmRecord);
    prismaStub.driverAssignmentAlarm.update.mockResolvedValue({
      ...alarmRecord,
      status: DriverAssignmentAlarmStatus.ACKNOWLEDGED,
      repeatJobKey: null,
      resolvedAt: expect.any(Date),
    });

    const { updateOrderStatus } = await import("../src/services/order");

    await updateOrderStatus(orderId, { status: OrderStatus.DELIVERED, driverId: existingOrder.driverId });

    expect(mockEnqueueNotification).toHaveBeenCalledTimes(2);
    const [statusJob, deliveryJob] = mockEnqueueNotification.mock.calls.map(call => call[0]);

    expect(statusJob).toMatchObject({
      type: "ORDER_STATUS",
      audience: { userId },
      payload: expect.objectContaining({
        data: expect.objectContaining({
          orderId,
          status: OrderStatus.DELIVERED,
          type: "ORDER_STATUS",
        }),
      }),
    });

    expect(deliveryJob).toMatchObject({
      type: "ORDER_STATUS",
      audience: { userId },
      payload: {
        title: expect.stringMatching(/Order delivered/i),
        body: expect.stringMatching(/has been delivered/i),
        data: expect.objectContaining({
          orderId,
          type: "ORDER_DELIVERED",
          status: OrderStatus.DELIVERED,
        }),
        priority: "high",
      },
      metadata: {
        orderId,
        userId,
      },
    });

    expect(mockCancelAlarmReminder).toHaveBeenCalledWith("repeat-key");
    expect(prismaStub.driverAssignmentAlarm.update).toHaveBeenCalledWith({
      where: { id: alarmRecord.id },
      data: {
        status: DriverAssignmentAlarmStatus.ACKNOWLEDGED,
        resolvedAt: expect.any(Date),
        repeatJobKey: null,
      },
    });
  });
});
