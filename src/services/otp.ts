import crypto from "crypto";
import { prisma } from "../lib/prisma";
import { config } from "../config";
import { ApiError } from "../utils/ApiError";
import { sendSMS } from "./sms";

function generateOTP(): string {
  return crypto.randomInt(100000, 999999).toString();
}

export async function createAndSendOTP(
  userId: string,
  phoneNumber: string,
  requestIp: string,
  requestAgent: string
): Promise<boolean> {
  await prisma.otp.updateMany({
    where: { userId },
    data: { verified: true },
  });

  const code = generateOTP();
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + config.otp.expiresIn);

  await prisma.otp.create({
    data: {
      code,
      userId,
      expiresAt,
      requestIp,
      requestAgent,
      phoneNumber,
    },
  });

  const message = `EGAS OTP:${code}`;
  return await sendSMS(phoneNumber, message);
}

export async function verifyOTPCode(
  userId: string,
  code: string,
  requestIp: string,
  requestAgent: string
): Promise<boolean> {
  const otp = await prisma.otp.findFirst({
    where: {
      userId,
      code,
      verified: false,
      attempts: {
        lt: config.otp.maxAttempts,
      },
      expiresAt: {
        gt: new Date(),
      },
    },
  });

  if (!otp) {
    throw new ApiError(400, "Invalid or expired OTP");
  }

  if (otp.requestIp !== requestIp || otp.requestAgent !== requestAgent) {
    await prisma.otp.update({
      where: { id: otp.id },
      data: {
        attempts: { increment: 1 },
        verified: true,
      },
    });
    throw new ApiError(
      400,
      "OTP must be verified from the same device/location"
    );
  }

  await prisma.otp.update({
    where: { id: otp.id },
    data: {
      verified: true,
    },
  });

  await prisma.otp.updateMany({
    where: {
      userId,
      id: { not: otp.id },
    },
    data: { verified: true },
  });

  return true;
}