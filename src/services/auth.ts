import { prisma } from "../lib/prisma";
import { config } from "../config";
import jwt from "jsonwebtoken";
import { ApiError } from "../utils/ApiError";
import { redis } from "../lib/redis";
import crypto from "crypto";
import { User, UserRole } from "@prisma/client";
import { hashPassword } from "../utils/password";
import bcrypt from "bcryptjs";
// import { sendPasswordResetEmail } from "../lib/email";

const DRIVER_SESSION_TTL_SECONDS = 60 * 24 * 60 * 60; // 60 days
const driverSessionKey = (userId: string) => `driverSession:${userId}`;
const createSessionId = () =>
  typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : crypto.randomBytes(16).toString("hex");

export const authService = {
  async findOrCreateUser(phoneNumber: string) {
    const user = await prisma.user.findUnique({
      where: { phoneNumber },
    });

    if (user) {
      // Update device token if provided
      // if (deviceToken) {
      //   return prisma.user.update({
      //     where: { id: user.id },
      //     data: { deviceToken },
      //   });
      // }
      return user;
    }

    // New users are created as clients by default
    return prisma.user.create({
      data: {
        phoneNumber,
        role: UserRole.CLIENT,
      },
    });
  },

  async invalidateRefreshToken(refreshToken: string): Promise<void> {
    try {
      const decoded = jwt.verify(refreshToken, config.jwt.secret) as {
        userId: string;
        jti: string;
        role?: UserRole;
      };

      const tokenExp = jwt.decode(refreshToken) as { exp: number };
      const ttl = tokenExp.exp - Math.floor(Date.now() / 1000);

      if (ttl > 0) {
        await redis.setEx(`blacklist:${decoded.jti}`, ttl, "true");
      }

      if (decoded.role === UserRole.DRIVER && decoded.userId) {
        await redis.del(driverSessionKey(decoded.userId));
      }

      // await prisma.user.update({
      //   where: { id: decoded.userId },
      //   data: {
      //     deviceToken: null,
      //   },
      // });
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new ApiError(401, "Invalid refresh token");
      }
      throw error;
    }
  },

  async setDriverSession(
    userId: string,
    sessionId: string,
    meta?: { deviceId?: string; userAgent?: string; ipAddress?: string }
  ) {
    const payload = {
      sessionId,
      deviceId: meta?.deviceId,
      userAgent: meta?.userAgent,
      ipAddress: meta?.ipAddress,
      createdAt: new Date().toISOString(),
    };
    await redis.setEx(driverSessionKey(userId), DRIVER_SESSION_TTL_SECONDS, JSON.stringify(payload));
  },

  async getDriverSession(userId: string) {
    const stored = await redis.get(driverSessionKey(userId));
    return stored ? JSON.parse(stored) : null;
  },

  async clearDriverSession(userId: string) {
    await redis.del(driverSessionKey(userId));
  },

  generateTokens(userId: string, role: UserRole) {
    const sessionId = createSessionId();
    const accessToken = jwt.sign(
      { userId, role, sessionId },
      config.jwt.secret,
      { expiresIn: '5d' } // Short-lived access token
    );

    const refreshToken = jwt.sign(
      { userId, role, sessionId },
      config.jwt.secret,
      { expiresIn: '60d' } // 60-day refresh token
    );

    return { accessToken, refreshToken, sessionId };
  },

  async verifyAccessToken(token: string) {
    try {
      const decoded = jwt.verify(token, config.jwt.secret) as {
        userId: string;
        role: UserRole;
        sessionId?: string;
      };

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          role: true,
          phoneNumber: true,
          // deviceToken: true,
          isBlocked: true,
        },
      });

      if (!user) {
        throw new ApiError(401, "User not found or inactive");
      }

      if (user.role === UserRole.DRIVER) {
        const session = await this.getDriverSession(user.id);
        if (!session || session.sessionId !== decoded.sessionId) {
          throw new ApiError(401, "Session invalidated. Please log in again on this device.");
        }
      }

      return user;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new ApiError(401, "Token expired");
      }
      throw new ApiError(401, "Invalid token");
    }
  },

  async verifyRefreshToken(token: string): Promise<{ userId: string; role?: UserRole; sessionId?: string }> {
    try {
      const decoded = jwt.verify(token, config.jwt.secret) as {
        userId: string;
        jti: string;
        role?: UserRole;
        sessionId?: string;
      };

      const isBlacklisted = await redis.get(`blacklist:${decoded.jti}`);
      if (isBlacklisted) {
        throw new ApiError(401, "Token has been revoked");
      }

      // Verify user still exists
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true },
      });

      if (!user) {
        throw new ApiError(401, "User not found");
      }

      if (decoded.role === UserRole.DRIVER) {
        const session = await this.getDriverSession(decoded.userId);
        if (!session || session.sessionId !== decoded.sessionId) {
          throw new ApiError(401, "Session invalidated. Please log in again on this device.");
        }
      }

      return { userId: decoded.userId, role: decoded.role, sessionId: decoded.sessionId };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new ApiError(401, "Refresh token expired");
      }
      throw new ApiError(401, "Invalid refresh token");
    }
  },

  async findDriverByEmail(email: string, extraWhere: any = {}) {
    return prisma.user.findFirst({
      where: {
        email,
        role: UserRole.DRIVER,
        isDeleted: false,
        ...extraWhere,
      },
      select: {
        id: true,
        email: true,
        password: true,
        phoneNumber: true,
        role: true,
        driver: true,
      },
    });
  },

  // async updateDeviceToken(userId: string, deviceToken: string) {
  //   return prisma.user.update({
  //     where: { id: userId },
  //     data: { deviceToken },
  //     select: {
  //       id: true,
  //       deviceToken: true,
  //     },
  //   });
  // },

  async initiatePasswordReset(email: string) {
    const user = await this.findDriverByEmail(email);
    if (!user) {
      // Return success even if user doesn't exist for security
      return;
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    // const hashedToken = await hashPassword(resetToken);

    // Store the reset token in Redis with expiration
    await redis.setEx(`pwd_reset:${resetToken}`, 24 * 60 * 60, user.id); // 24 hours

    // Send reset email
    // await sendPasswordResetEmail(email, resetToken);
  },

  async resetPassword(token: string, newPassword: string) {
    const userId = await redis.get(`pwd_reset:${token}`);
    if (!userId) {
      throw new ApiError(400, "Invalid or expired reset token");
    }

    const hashedPassword = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    // Delete the used token
    await redis.del(`pwd_reset:${token}`);
  },

  // Admin auth methods
  async findUserByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        password: true,
        role: true,
      },
    });
  },

  async createAdmin(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }) {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new ApiError(400, "Email already exists");
    }

    return prisma.user.create({
      data: {
        ...data,
        role: UserRole.ADMIN,
        phoneNumber: "",
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });
  },

  async createDriverAccount(user: User) {
    await prisma.driver.create({
      data: {
        userId: user.id,
        isAvailable: false,
        currentLat: null,
        currentLong: null,
        vehicleType: null,
        vehiclePlate: null,
        licenseNumber: null,
        licenseExpiry: null,
        rating: null,
        totalTrips: 0,
      },
    });
  },

  async register(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phoneNumber: string;
    role: UserRole;
  }) {
    const existingUser = await prisma.user.findFirst({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new ApiError(400, "Email already exists");
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = await prisma.user.create({
      data: {
        ...data,
        password: hashedPassword,
      },
    });

    // If the user is a driver, create their driver record
    if (user.role === UserRole.DRIVER) {
      await this.createDriverAccount(user);
    }

    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  },
};
