import { DriverAssignmentAlarmStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { enqueueNotification } from "./notificationQueue";
import type { NotificationJob } from "../types/notifications";
import { logger } from "../lib/logger";

const REMINDER_INTERVAL_MS = Math.max(30_000, Number(process.env.DRIVER_ALARM_REPEAT_MS ?? 120_000));

let reminderTimer: NodeJS.Timeout | null = null;
let sweepInProgress = false;

type AlarmWithOrder = {
  id: string;
  repeatJobKey: string | null;
  order: {
    id: string;
    orderId: string;
    driverId: string | null;
  } | null;
};

const buildAlarmReminderJob = (alarm: AlarmWithOrder): NotificationJob | null => {
  if (!alarm.order || !alarm.order.driverId) {
    return null;
  }

  return {
    type: "ALARM_REMINDER",
    audience: { driverId: alarm.order.driverId },
    payload: {
      title: "Order awaiting acceptance",
      body: `Order #${alarm.order.orderId} is waiting for your confirmation`,
      data: {
        orderId: alarm.order.id,
        reason: "ALARM_REMINDER",
        type: "ALARM_REMINDER",
      },
      priority: "high",
    },
    metadata: {
      orderId: alarm.order.id,
      driverId: alarm.order.driverId,
      alarmId: alarm.id,
    },
  };
};

const runReminderSweep = async () => {
  if (sweepInProgress) {
    return;
  }

  sweepInProgress = true;
  const now = Date.now();

  try {
    const alarms = await prisma.driverAssignmentAlarm.findMany({
      where: { status: DriverAssignmentAlarmStatus.PENDING },
      include: {
        order: {
          select: {
            id: true,
            orderId: true,
            driverId: true,
          },
        },
      },
    }) as AlarmWithOrder[];

    for (const alarm of alarms) {
      const lastSentAt = alarm.repeatJobKey ? Date.parse(alarm.repeatJobKey) : 0;
      if (Number.isNaN(lastSentAt) || now - lastSentAt >= REMINDER_INTERVAL_MS) {
        const job = buildAlarmReminderJob(alarm);
        if (!job) continue;

        logger.info("Reminder sweep sending alarm", {
          alarmId: alarm.id,
          orderId: alarm.order?.id,
          driverId: alarm.order?.driverId,
        });

        try {
          await enqueueNotification(job);
          await prisma.driverAssignmentAlarm.update({
            where: { id: alarm.id },
            data: { repeatJobKey: new Date(now).toISOString() },
          });
        } catch (error) {
          logger.error("Failed to send reminder alarm", { alarmId: alarm.id, error });
        }
      }
    }
  } catch (error) {
    logger.error("Alarm reminder sweep failed", error);
  } finally {
    sweepInProgress = false;
  }
};

export const startAlarmReminderScheduler = () => {
  if (reminderTimer) {
    return;
  }

  logger.info("Starting alarm reminder scheduler", { intervalMs: REMINDER_INTERVAL_MS });
  reminderTimer = setInterval(runReminderSweep, REMINDER_INTERVAL_MS);
};

export const stopAlarmReminderScheduler = () => {
  if (reminderTimer) {
    clearInterval(reminderTimer);
    reminderTimer = null;
  }
};
