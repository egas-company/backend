import { z } from "zod";

export const registerDeviceSchema = z.object({
  token: z.string().min(10, "Device token is required"),
  platform: z.enum(["ANDROID", "IOS", "WEB", "UNKNOWN"]).default("UNKNOWN"),
  app: z.enum(["USER", "DRIVER", "ADMIN"]).default("USER"),
});

export const unregisterDeviceSchema = z.object({
  token: z.string().min(10, "Device token is required"),
});
