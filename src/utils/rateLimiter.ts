import type { PrismaClient } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { ApiError } from "./ApiError";

const HOUR_MS = 60 * 60 * 1000;
const TWO_HOURS_MS = 2 * HOUR_MS;
const DAY_MS = 24 * HOUR_MS;

const OTP_HOURLY_LIMIT = 4;
const OTP_TWO_HOUR_LIMIT = 8;
const OTP_DAILY_VERIFICATION_LIMIT = 4;

interface OtpRequestStats {
  requestsLastHour: number;
  requestsLastTwoHours: number;
  requestsLast24Hours: number;
  nextAllowedRequestAt: Date | null;
  blockedUntil: Date | null;
  lastRequestAt: Date | null;
}

// Safety check function
function ensurePrismaClient(): PrismaClient {
  if (!prisma) {
    throw new Error('Prisma client is not initialized');
  }
  return prisma;
}

function formatRelativeTime(target: Date): string {
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  if (diffMs <= 0) {
    return "now";
  }

  const diffMinutes = Math.ceil(diffMs / (60 * 1000));
  if (diffMinutes < 60) {
    return `in ${diffMinutes} minute${diffMinutes === 1 ? "" : "s"}`;
  }

  const diffHours = Math.ceil(diffMinutes / 60);
  if (diffHours < 24) {
    return `in ${diffHours} hour${diffHours === 1 ? "" : "s"}`;
  }

  const diffDays = Math.ceil(diffHours / 24);
  return `in ${diffDays} day${diffDays === 1 ? "" : "s"}`;
}

function formatExactTime(target: Date): string {
  return target.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function describeWait(target: Date): string {
  return `${formatRelativeTime(target)} (${formatExactTime(target)})`;
}

async function fetchOtpRequestStats(client: PrismaClient, phoneNumber: string): Promise<OtpRequestStats> {
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - DAY_MS);
  const oneHourAgo = new Date(now.getTime() - HOUR_MS);
  const twoHoursAgo = new Date(now.getTime() - TWO_HOURS_MS);

  const requestAttempts = await client.loginAttempt.findMany({
    where: {
      phoneNumber,
      success: true,
      createdAt: {
        gte: twentyFourHoursAgo,
      },
    },
    select: {
      createdAt: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  const requestsLastHour = requestAttempts.filter(attempt => attempt.createdAt >= oneHourAgo).length;
  const requestsLastTwoHours = requestAttempts.filter(attempt => attempt.createdAt >= twoHoursAgo).length;

  let nextAllowedRequestAt: Date | null = null;
  if (requestsLastHour >= OTP_HOURLY_LIMIT) {
    const requestsWithinHour = requestAttempts.filter(attempt => attempt.createdAt >= oneHourAgo);
    const oldestWithinHour = requestsWithinHour[requestsWithinHour.length - 1];
    if (oldestWithinHour) {
      nextAllowedRequestAt = new Date(oldestWithinHour.createdAt.getTime() + HOUR_MS);
    }
  }

  let blockedUntil: Date | null = null;
  if (requestsLastTwoHours >= OTP_TWO_HOUR_LIMIT) {
    const latestAttempt = requestAttempts[0];
    if (latestAttempt) {
      const candidate = new Date(latestAttempt.createdAt.getTime() + DAY_MS);
      if (candidate > now) {
        blockedUntil = candidate;
      }
    }
  }

  return {
    requestsLastHour,
    requestsLastTwoHours,
    requestsLast24Hours: requestAttempts.length,
    nextAllowedRequestAt,
    blockedUntil,
    lastRequestAt: requestAttempts[0]?.createdAt ?? null,
  };
}

export async function checkLoginAttempts(phoneNumber: string, ipAddress?: string): Promise<void> {
  try {
    const client = ensurePrismaClient();
    const stats = await fetchOtpRequestStats(client, phoneNumber);
    const now = new Date();

    if (stats.blockedUntil && stats.blockedUntil > now) {
      throw new ApiError(429, `You have reached the maximum OTP requests (8 within 2 hours). Please request a new code ${describeWait(stats.blockedUntil)}.`);
    }

    if (stats.requestsLastHour >= OTP_HOURLY_LIMIT) {
      const waitUntil = stats.nextAllowedRequestAt ?? new Date(now.getTime() + HOUR_MS);
      throw new ApiError(429, `You can request up to ${OTP_HOURLY_LIMIT} OTPs per hour. Please try again ${describeWait(waitUntil)}.`);
    }

    // Maintain defensive limit on repeated verification failures per day
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const failedAttempts = await client.loginAttempt.count({
      where: {
        phoneNumber,
        success: false,
        createdAt: {
          gte: today,
          lt: tomorrow
        }
      }
    });

    const failedAttemptsByIP = ipAddress ? await client.loginAttempt.count({
      where: {
        ipAddress,
        success: false,
        createdAt: {
          gte: today,
          lt: tomorrow
        }
      }
    }) : 0;

    if (failedAttempts >= OTP_DAILY_VERIFICATION_LIMIT) {
      throw new ApiError(429, "Maximum login attempts exceeded for today. Please try again tomorrow.");
    }

    if (failedAttemptsByIP >= OTP_DAILY_VERIFICATION_LIMIT) {
      throw new ApiError(429, "Maximum login attempts exceeded for this IP address. Please try again tomorrow.");
    }
  } catch (error) {
    console.error('Rate limiting check failed:', error);

    if (error instanceof ApiError) {
      throw error;
    }

    console.warn('Database error in rate limiting, allowing request to proceed');
  }
}

export async function recordLoginAttempt(
  phoneNumber: string, 
  success: boolean, 
  ipAddress?: string, 
  userAgent?: string
): Promise<void> {
  try {
    const client = ensurePrismaClient();
    
    await client.loginAttempt.create({
      data: {
        phoneNumber,
        ipAddress,
        userAgent,
        success
      }
    });
  } catch (error) {
    // Log the error but don't fail the request
    console.error('Failed to record login attempt:', error);
  }
}

export async function getRemainingAttempts(phoneNumber: string, ipAddress?: string): Promise<{
  phoneAttempts: number;
  ipAttempts: number;
  remainingPhone: number;
  remainingIP: number;
  remainingVerificationsPhone: number;
  remainingVerificationsIP: number;
  requestsLastHour: number;
  remainingRequestsHour: number;
  requestsLastTwoHours: number;
  remainingRequestsTwoHours: number;
  nextAllowedRequestAt: Date | null;
  blockedUntil: Date | null;
}> {
  try {
    const client = ensurePrismaClient();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const phoneAttempts = await client.loginAttempt.count({
      where: {
        phoneNumber,
        success: false,
        createdAt: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    const ipAttempts = ipAddress
      ? await client.loginAttempt.count({
          where: {
            ipAddress,
            success: false,
            createdAt: {
              gte: today,
              lt: tomorrow,
            },
          },
        })
      : 0;

    const stats = await fetchOtpRequestStats(client, phoneNumber);

    return {
      phoneAttempts,
      ipAttempts,
      remainingPhone: Math.max(0, OTP_DAILY_VERIFICATION_LIMIT - phoneAttempts),
      remainingIP: Math.max(0, OTP_DAILY_VERIFICATION_LIMIT - ipAttempts),
      remainingVerificationsPhone: Math.max(0, OTP_DAILY_VERIFICATION_LIMIT - phoneAttempts),
      remainingVerificationsIP: Math.max(0, OTP_DAILY_VERIFICATION_LIMIT - ipAttempts),
      requestsLastHour: stats.requestsLastHour,
      remainingRequestsHour: Math.max(0, OTP_HOURLY_LIMIT - stats.requestsLastHour),
      requestsLastTwoHours: stats.requestsLastTwoHours,
      remainingRequestsTwoHours: Math.max(0, OTP_TWO_HOUR_LIMIT - stats.requestsLastTwoHours),
      nextAllowedRequestAt: stats.nextAllowedRequestAt,
      blockedUntil: stats.blockedUntil,
    };
  } catch (error) {
    console.error('Failed to get remaining attempts:', error);
    // Return default values if database fails
    return {
      phoneAttempts: 0,
      ipAttempts: 0,
      remainingPhone: OTP_DAILY_VERIFICATION_LIMIT,
      remainingIP: OTP_DAILY_VERIFICATION_LIMIT,
      remainingVerificationsPhone: OTP_DAILY_VERIFICATION_LIMIT,
      remainingVerificationsIP: OTP_DAILY_VERIFICATION_LIMIT,
      requestsLastHour: 0,
      remainingRequestsHour: OTP_HOURLY_LIMIT,
      requestsLastTwoHours: 0,
      remainingRequestsTwoHours: OTP_TWO_HOUR_LIMIT,
      nextAllowedRequestAt: null,
      blockedUntil: null,
    };
  }
}
