import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";
import { getMessaging } from "../config/firebase";
import type { NotificationJob } from "../types/notifications";
import { NotificationStatus } from "@prisma/client";

const messaging = getMessaging();
const MAX_TOKENS_PER_REQUEST = 500;

type TargetDevice = {
  id?: string | null;
  token: string;
  userId?: string | null;
  driverId?: string | null;
  fallback?: boolean;
};

const buildFallbackTargets = async (
  audience: NotificationJob["audience"]
): Promise<TargetDevice[]> => {
  const targets: TargetDevice[] = [];

  if (audience?.userId) {
    const user = await prisma.user.findUnique({
      where: { id: audience.userId },
      select: { id: true, pushToken: true, fcmToken: true },
    });
    const token = user?.pushToken ?? user?.fcmToken;
    if (token) {
      targets.push({
        token,
        userId: user?.id,
        fallback: true,
      });
    }
  }

  if (audience?.driverId) {
    const driver = await prisma.driver.findUnique({
      where: { id: audience.driverId },
      select: {
        id: true,
        user: {
          select: {
            id: true,
            pushToken: true,
            fcmToken: true,
          },
        },
      },
    });
    const token = driver?.user?.pushToken ?? driver?.user?.fcmToken;
    if (token) {
      targets.push({
        token,
        driverId: driver?.id,
        userId: driver?.user?.id,
        fallback: true,
      });
    }
  }

  return targets;
};

export const dispatchNotification = async (job: NotificationJob) => {
  const { audience, payload, type, metadata } = job;

  if (metadata?.alarmId) {
    const alarm = await prisma.driverAssignmentAlarm.findUnique({
      where: { id: metadata.alarmId },
      select: { status: true },
    });

    if (!alarm || alarm.status !== "PENDING") {
      if (type === "ALARM_REMINDER") {
        logger.info(`Skipping alarm reminder for alarm ${metadata.alarmId} (status: ${alarm?.status})`);
        return;
      }

      logger.debug(`Alarm ${metadata.alarmId} no longer pending (status: ${alarm?.status}); continuing delivery for type ${type}`);
    }
  }

  const devices = await prisma.notificationDevice.findMany({
    where: {
      enabled: true,
      ...(audience?.deviceIds ? { id: { in: audience.deviceIds } } : {}),
      ...(audience?.driverId ? { driverId: audience.driverId } : {}),
      ...(audience?.userId ? { userId: audience.userId } : {}),
    },
  });

  let targets: TargetDevice[] = devices;

  if (!targets.length) {
    logger.warn(`No devices found for notification type ${type}. Attempting fallback tokens.`, audience);
    targets = await buildFallbackTargets(audience);
  }

  if (!targets.length) {
    logger.error(`No tokens available to deliver notification type ${type}`, audience);
    return;
  }

  logger.info("Resolved notification targets", {
    type,
    totalTargets: targets.length,
    directDevices: devices.length,
    fallbackTargets: targets.filter(target => target.fallback).length,
  });

  const batches: TargetDevice[][] = [];
  for (let i = 0; i < targets.length; i += MAX_TOKENS_PER_REQUEST) {
    batches.push(targets.slice(i, i + MAX_TOKENS_PER_REQUEST));
  }

  const isLikelyFCM = (t: string) =>
    !!t &&
    !t.startsWith("ExponentPushToken") &&
    !t.startsWith("Exponent") &&
    !t.includes("[") &&
    !t.includes("]") &&
    t.length >= 20;

  for (const batch of batches) {
    const rawTokens = batch.map(device => device.token).filter(Boolean);
    const tokens = rawTokens.filter(isLikelyFCM);

    const filteredOut = rawTokens.filter(t => !isLikelyFCM(t));
    if (filteredOut.length) {
      logger.warn("Filtered out non-FCM tokens", {
        count: filteredOut.length,
        previews: filteredOut.map(t => `${t.slice(0, 8)}…${t.slice(-4)}`),
      });
    }

    if (!tokens.length) continue;

    try {
      logger.info("Sending notification batch", {
        type,
        tokenCount: tokens.length,
        fallbackCount: batch.filter(target => target.fallback).length,
        metadata,
        maskedTokens: tokens.map(token => `${token.slice(0, 8)}…${token.slice(-4)}`),
      });
      const response = await messaging.sendEachForMulticast({
        tokens,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        android: {
          priority: payload.priority === "high" ? "high" : "normal",
        },
        apns: {
          headers: payload.priority === "high" ? { "apns-priority": "10" } : undefined,
          payload: {
            aps: {
              contentAvailable: true,
            },
          },
        },
        data: payload.data,
      });

      for (let i = 0; i < batch.length; i++) {
        const device = batch[i];
        const result = response.responses[i];

        try {
          await prisma.notificationLog.create({
            data: {
              deviceId: device.id ?? null,
              userId: device.userId ?? null,
              driverId: device.driverId ?? null,
              type,
              status: result.success ? NotificationStatus.SENT : NotificationStatus.FAILED,
              response: result.success ? result.messageId ?? undefined : result.error?.message,
              errorCode: result.error?.code,
              payload: payload.data ? JSON.parse(JSON.stringify(payload.data)) : undefined,
            },
          });
        } catch (logError) {
          logger.error("Failed to record notification log", {
            error: logError instanceof Error ? logError.message : logError,
            type,
            tokenPreview: `${device.token.slice(0, 8)}…${device.token.slice(-4)}`,
          });
        }

        if (!result.success) {
          logger.warn(`Failed to send notification`, {
            tokenPreview: `${device.token.slice(0, 8)}…${device.token.slice(-4)}`,
            message: result.error?.message,
            code: result.error?.code,
            type,
          });

          if (device.id && !device.fallback && result.error?.code === "messaging/registration-token-not-registered") {
            await prisma.notificationDevice.update({
              where: { id: device.id },
              data: { enabled: false },
            });
          }
        } else {
          logger.info("Notification delivered", {
            tokenPreview: `${device.token.slice(0, 8)}…${device.token.slice(-4)}`,
            type,
            messageId: result.messageId,
            fallback: device.fallback ?? false,
          });
        }

        if (result.success && device.id && !device.fallback) {
          await prisma.notificationDevice.update({
            where: { id: device.id },
            data: { lastSeenAt: new Date() },
          }).catch(() => undefined);
        }
      }
    } catch (error) {
      logger.error("Failed to send notification batch", error);
    }
  }
};
