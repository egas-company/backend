import type { NotificationJob } from "../types/notifications";
import { logger } from "../lib/logger";
import { dispatchNotification } from "./notificationDispatcher";

export const enqueueNotification = async (
  job: NotificationJob
): Promise<void> => {
  logger.info(`Dispatching notification immediately`, {
    type: job.type,
    audience: job.audience,
    metadata: job.metadata,
    payloadPreview: {
      title: job.payload?.title,
      body: job.payload?.body,
      dataKeys: job.payload?.data ? Object.keys(job.payload.data) : [],
      priority: job.payload?.priority,
    },
  });
  await dispatchNotification(job);
};

export const enqueueDriverAssignmentNotification = async (job: NotificationJob) => {
  await enqueueNotification(job);
};

export const scheduleAlarmReminder = async (
  alarmId: string,
  job: NotificationJob
): Promise<string | null> => {
  logger.info(`Dispatching single alarm reminder (no queue)`, {
    alarmId,
    type: job.type,
  });
  await dispatchNotification(job);
  return null;
};

export const cancelAlarmReminder = async (repeatKey?: string | null) => {
  logger.debug(`cancelAlarmReminder invoked (no-op in inline mode)`, { repeatKey });
};
