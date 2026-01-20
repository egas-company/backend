import { Response } from "express";
import { NotificationApp, NotificationPlatform, UserRole } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { registerDeviceSchema, unregisterDeviceSchema } from "../schemas/notification";
import { ApiError } from "../utils/ApiError";
import { AuthRequest } from "../middleware/auth";
import { logger } from "../lib/logger";
import { getMessaging } from "../config/firebase";

const normalizePlatform = (input?: string): NotificationPlatform => {
  if (!input) return NotificationPlatform.UNKNOWN;
  const upper = input.toUpperCase();
  if (upper === "ANDROID" || upper === "IOS" || upper === "WEB") {
    return upper as NotificationPlatform;
  }
  return NotificationPlatform.UNKNOWN;
};

const normalizeApp = (input?: string, fallback: NotificationApp = NotificationApp.USER): NotificationApp => {
  if (!input) return fallback;
  const upper = input.toUpperCase();
  if (upper === "USER" || upper === "DRIVER" || upper === "ADMIN") {
    return upper as NotificationApp;
  }
  return fallback;
};

export const registerDevice = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, "Authentication required");
  }

  logger.info("registerDevice payload received", {
    userId: req.user.userId,
    role: req.user.role,
    bodyKeys: Object.keys(req.body ?? {}),
  });

  const token = req.body?.token ?? req.body?.pushToken;
  if (!token || typeof token !== "string") {
    throw new ApiError(400, "Device token is required");
  }

  const inferredApp: NotificationApp =
    req.user.role === UserRole.DRIVER
      ? NotificationApp.DRIVER
      : req.user.role === UserRole.ADMIN
        ? NotificationApp.ADMIN
        : NotificationApp.USER;

  const ownerUserId = req.user.id;

  if (!ownerUserId) {
    throw new ApiError(400, "Missing authenticated user id");
  }

  let userId: string | undefined = undefined;
  let driverId: string | undefined = undefined;

  if (req.user.role === UserRole.CLIENT || req.user.role === UserRole.ADMIN) {
    userId = ownerUserId;
  }

  if (req.user.role === UserRole.DRIVER) {
    const driver = await prisma.driver.findUnique({
      where: { userId: ownerUserId },
      select: { id: true },
    });

    if (!driver) {
      throw new ApiError(404, "Driver profile not found");
    }

    driverId = driver.id;
  }

  const platformInput =
    typeof req.body?.platform === "string"
      ? req.body.platform
      : typeof req.body?.deviceType === "string"
        ? req.body.deviceType
        : undefined;

  const appInput = typeof req.body?.app === "string" ? req.body.app : undefined;

  const normalizedPayload = {
    token,
    platform: normalizePlatform(platformInput),
    app: normalizeApp(appInput, inferredApp),
  } as const;

  logger.info("registerDevice normalized payload", {
    userId,
    driverId,
    platform: normalizedPayload.platform,
    app: normalizedPayload.app,
  });

  const payload = registerDeviceSchema.parse(normalizedPayload);

  const notificationRepo = (prisma as unknown as { notificationDevice?: typeof prisma.notificationDevice }).notificationDevice;

  if (!notificationRepo?.upsert) {
    await prisma.user.update({
      where: { id: ownerUserId },
      data: {
        pushToken: payload.token,
        fcmToken: payload.token,
        deviceType: payload.platform,
        appType: payload.app,
        lastTokenUpdate: new Date(),
      },
    }).catch(error => {
      throw new ApiError(500, `Failed to persist device token: ${error instanceof Error ? error.message : "unknown error"}`);
    });

    res.json({
      success: true,
      data: {
        id: ownerUserId,
        token: payload.token,
        platform: payload.platform,
        app: payload.app,
        userId: ownerUserId,
        driverId,
        fallback: true,
      },
    });
    return;
  }

  const device = await notificationRepo.upsert({
    where: { token: payload.token },
    update: {
      userId,
      driverId,
      platform: payload.platform as NotificationPlatform,
      app: payload.app as NotificationApp,
      enabled: true,
      lastSeenAt: new Date(),
    },
    create: {
      token: payload.token,
      userId,
      driverId,
      platform: payload.platform as NotificationPlatform,
      app: payload.app as NotificationApp,
    },
  });

  res.json({
    success: true,
    data: {
      id: device.id,
      token: device.token,
      platform: device.platform,
      app: device.app,
      userId: device.userId,
      driverId: device.driverId,
      fallback: false,
    },
  });
};

export const unregisterDevice = async (req: AuthRequest, res: Response) => {
  const payload = unregisterDeviceSchema.parse(req.body ?? {});

  const notificationRepo = (prisma as unknown as { notificationDevice?: typeof prisma.notificationDevice }).notificationDevice;

  if (!notificationRepo?.deleteMany) {
    await prisma.user.updateMany({
      where: { pushToken: payload.token },
      data: {
        pushToken: null,
        fcmToken: null,
        deviceType: null,
        appType: null,
        lastTokenUpdate: new Date(),
      },
    });

    res.json({
      success: true,
      data: { fallback: true },
    });
    return;
  }

  await notificationRepo.deleteMany({
    where: {
      token: payload.token,
    },
  });

  res.json({
    success: true,
    data: { fallback: false },
  });
};

export const sendTestNotification = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, "Authentication required");
  }

  const { token, title, body } = req.body ?? {};

  if (typeof token !== "string" || token.trim().length < 10) {
    throw new ApiError(400, "Valid token is required");
  }

  const messaging = getMessaging();

  await messaging.send({
    token: token.trim(),
    notification: {
    title: title ?? "Notification Debug",
    body: body ?? "Test push from notification debugger",
    },
    android: {
      priority: "high",
    },
    apns: {
      payload: {
        aps: {
          sound: "default",
        },
      },
    },
    data: {
      type: "LOCAL_DEBUG",
    },
  });

  res.json({
    success: true,
  });
};
