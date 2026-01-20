import { NextFunction, Request, Response } from "express";
import { authService } from "../services/auth";
import { ApiError } from "../utils/ApiError";
import { prisma } from "../lib/prisma";
import { UserRole } from "@prisma/client";
import { comparePassword } from "../utils/password";
import { validatePhoneNumber } from "../utils/validators";
import { generateOTP, sendOTPMessage, verifyOTP as termiiVerifyOTP } from "../utils/termii";
import { checkLoginAttempts, recordLoginAttempt, getRemainingAttempts, describeWait } from "../utils/rateLimiter";
import { tokenService } from "../services/token";

// Store OTP pin IDs temporarily (in production, use Redis or a database)
interface StoredOtpMeta {
  pinId: string | null;
  isDemo: boolean;
}

const otpStorage = new Map<string, StoredOtpMeta>();
const DEMO_PHONE_SUFFIX = "8000000000";
const DEMO_OTP_CODE = "123456";

// Define User type based on Prisma schema
type User = {
  id: string;
  email?: string | null;
  password?: string | null;
  phoneNumber: string;
  address?: string | null;
  tankSize?: string | null;
  role: UserRole;
  pushToken?: string | null;
  verified: boolean;
  firstName?: string | null;
  lastName?: string | null;
  area?: string | null;
  city?: string | null;
  street?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isBlocked: boolean;
  isActive: boolean;
  isDeleted: boolean;
  termsAccepted: boolean;
  onboarded: boolean;
  lastLoginAt?: Date | null;
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  lastActive: Date;
  createdAt: Date;
  updatedAt: Date;
};

// Define PrismaError type for error handling
interface PrismaError extends Error {
  code?: string;
}

export async function requestOTP(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { phoneNumber } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
    const userAgent = req.get('User-Agent');

    if (!phoneNumber || !validatePhoneNumber(phoneNumber)) {
      throw new ApiError(400, "Valid phone number is required");
    }

    // Check login attempts before proceeding (with fallback)
    try {
      await checkLoginAttempts(phoneNumber, ipAddress);
    } catch (rateLimitError) {
      // If it's a rate limiting error, throw it
      if (rateLimitError instanceof ApiError && rateLimitError.statusCode === 429) {
        throw rateLimitError;
      }
      // If it's a database error, log it but continue
      console.warn('Rate limiting check failed, proceeding without rate limiting:', rateLimitError);
    }

    let user = await prisma.user.findUnique({ where: { phoneNumber, isDeleted: false } });
    if (!user) {
      user = await prisma.user.create({ data: { phoneNumber } });
    }

    if (user.isBlocked) {
      throw new ApiError(403, "Account is blocked");
    }

    try {
      // Handle demo number by bypassing Termii
      if (phoneNumber.endsWith(DEMO_PHONE_SUFFIX)) {
        otpStorage.set(phoneNumber, { pinId: null, isDemo: true });
      } else {
        // Generate OTP using Termii
        const otpResponse = await generateOTP(phoneNumber);
        
        otpStorage.set(phoneNumber, { pinId: otpResponse.pinId, isDemo: false });
        await sendOTPMessage(phoneNumber, otpResponse.otp);
      }

      // Record successful attempt (with fallback)
      try {
        await recordLoginAttempt(phoneNumber, true, ipAddress, userAgent || 'unknown');
      } catch (recordError) {
        console.warn('Failed to record successful login attempt:', recordError);
      }

      res.json({
        status: "success",
        message: "OTP sent successfully",
      });
    } catch (error) {
      console.error('Failed to send OTP:', error);
      
      // Record failed attempt (with fallback)
      try {
        await recordLoginAttempt(phoneNumber, false, ipAddress, userAgent || 'unknown');
      } catch (recordError) {
        console.warn('Failed to record failed login attempt:', recordError);
      }
      
      // Check if it's a Termii API error
      if (error instanceof Error) {
        if (error.message.includes('API') || error.message.includes('Termii')) {
          throw new ApiError(503, "SMS service temporarily unavailable. Please try again later.");
        }
      }
      
      throw new ApiError(500, "Failed to send OTP. Please try again.");
    }
  } catch (error) {
    if (error instanceof ApiError) {
      next(error);
    } else {
      console.error('Unexpected error in requestOTP:', error);
      next(new ApiError(500, "Internal server error"));
    }
  }
}

export async function verifyOTP(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { phoneNumber, otp } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
    const userAgent = req.get('User-Agent');

    if (!phoneNumber || !validatePhoneNumber(phoneNumber)) {
      throw new ApiError(400, "Valid phone number is required");
    }

    const user = await prisma.user.findUnique({
      where: { phoneNumber, isDeleted: false },
      select: {
        id: true,
        phoneNumber: true,
        role: true,
        firstName: true,
        lastName: true,
        email: true,
        onboarded: true,
        isBlocked: true,
        tankSize: true,
        address: true,
      },
    });

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    if (user.isBlocked) {
      throw new ApiError(403, "Account is blocked");
    }

    // Get stored OTP meta information
    const storedOtpMeta = otpStorage.get(phoneNumber);
    if (!storedOtpMeta) {
      throw new ApiError(400, "OTP expired or not requested");
    }

    try {
      let verificationResult: { verified: boolean } = { verified: false };

      if (storedOtpMeta.isDemo) {
        if (otp !== DEMO_OTP_CODE) {
          await recordLoginAttempt(phoneNumber, false, ipAddress, userAgent);
          throw new ApiError(400, "Invalid demo OTP. Please enter 123456.");
        }
        verificationResult.verified = true;
      } else {
        const pinId = storedOtpMeta.pinId;
        if (!pinId) {
          throw new ApiError(400, "OTP expired or not requested");
        }
        verificationResult = await termiiVerifyOTP(pinId, otp);
      }
      
      if (!verificationResult.verified) {
        const pluralize = (value: number, noun: string) => `${value} ${noun}${value === 1 ? "" : "s"}`;

        // Record failed login attempt
        await recordLoginAttempt(phoneNumber, false, ipAddress, userAgent);
        
        const attempts = await getRemainingAttempts(phoneNumber, ipAddress);
        const remainingVerifications = attempts.remainingVerificationsPhone ?? attempts.remainingPhone;

        const now = new Date();
        let otpRequestInfo: string;

        if (attempts.blockedUntil && attempts.blockedUntil > now) {
          otpRequestInfo = `You have reached the maximum OTP requests. You can request another code ${describeWait(attempts.blockedUntil)}.`;
        } else {
          const hourlyRemaining = Math.max(0, attempts.remainingRequestsHour ?? 0);
          const twoHourRemaining = Math.max(0, attempts.remainingRequestsTwoHours ?? 0);
          otpRequestInfo = `You can request ${pluralize(hourlyRemaining, "more OTP")} this hour and ${pluralize(twoHourRemaining, "additional OTP")} within the next two hours before a 24-hour wait applies.`;
        }
        
        throw new ApiError(400, `Invalid OTP. You have ${remainingVerifications} verification attempt${remainingVerifications === 1 ? "" : "s"} remaining today. ${otpRequestInfo}`);
      }

      // Record successful login attempt
      await recordLoginAttempt(phoneNumber, true, ipAddress, userAgent);

      // Clear the stored pinId
      otpStorage.delete(phoneNumber);

      const { accessToken, refreshToken, sessionId } = authService.generateTokens(user.id, user.role);

      if (user.role === UserRole.DRIVER && sessionId) {
        await authService.setDriverSession(user.id, sessionId, { ipAddress, userAgent });
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          lastLoginAt: new Date(),
        },
      });

      res.json({
        status: "success",
        message: "OTP verified successfully",
        data: {
          user: {
            id: user.id,
            phoneNumber: user.phoneNumber,
            role: user.role,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            onboarded: user.onboarded,
            isBlocked: user.isBlocked,
            tankSize: user.tankSize,
            address: user.address,
          },
          accessToken,
          refreshToken,
        },
      });
    } catch (error) {
      console.error('Failed to verify OTP:', error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(400, "Invalid OTP");
    }
  } catch (error) {
    next(error);
  }
}

export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({
        success: false,
        message: "Refresh token is required",
      });
      return;
    }

    await authService.invalidateRefreshToken(refreshToken);

    res.json({
      success: true,
      message: "Successfully logged out",
    });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const updateProfile = async (
  req: Request & { user: User },
  res: Response
): Promise<void> => {
  try {
    console.log(req.user);
    const userId = req.user?.id;
    if (!userId) {
      throw new ApiError(401, "Unauthorized");
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...req.body,
        onboarded: true, // Set onboarded to true when profile is updated
      },
    });

    const { accessToken, refreshToken, sessionId } = authService.generateTokens(userId, updatedUser.role);

    if (updatedUser.role === UserRole.DRIVER && sessionId) {
      await authService.setDriverSession(userId, sessionId, {
        ipAddress: req.ip || req.connection.remoteAddress || req.socket.remoteAddress,
        userAgent: req.get('User-Agent') || undefined,
      });
    }

    res.json({
      success: true,
      message: "Profile updated successfully",
      data: {
        user: updatedUser,
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
      return;
    }

    const prismaError = error as PrismaError;
    if (prismaError.code === "P2002") {
      res.status(400).json({
        success: false,
        message: "Email already exists",
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const refreshToken = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new ApiError(400, "Refresh token is required");
    }

    const { userId } = await authService.verifyRefreshToken(refreshToken);
    const user = await prisma.user.findUnique({
      where: { id: userId, isDeleted: false },
    });

    if (!user) {
      throw new ApiError(401, "User not found");
    }

    const { accessToken, refreshToken: newRefreshToken, sessionId } = authService.generateTokens(user.id, user.role);

    if (user.role === UserRole.DRIVER && sessionId) {
      await authService.setDriverSession(user.id, sessionId, {
        ipAddress: req.ip || req.connection.remoteAddress || req.socket.remoteAddress,
        userAgent: req.get('User-Agent') || undefined,
      });
    }

    res.json({
      success: true,
      message: "Token refreshed successfully",
      data: {
        user,
        accessToken,
        refreshToken: newRefreshToken,
      },
    });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const driverLogin = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
    const userAgent = req.get('User-Agent');

    const user = await authService.findDriverByEmail(email, { isDeleted: false });
    if (!user) {
      // Record failed login attempt
      await recordLoginAttempt(email, false, ipAddress, userAgent);
      throw new ApiError(401, "Invalid credentials");
    }

    const isPasswordValid = await comparePassword(password, user.password!);
    if (!isPasswordValid) {
      // Record failed login attempt
      await recordLoginAttempt(user.phoneNumber, false, ipAddress, userAgent);
      
      // Get remaining attempts
      const attempts = await getRemainingAttempts(user.phoneNumber, ipAddress);
      throw new ApiError(401, `Invalid credentials. You have ${attempts.remainingPhone} attempts remaining for today.`);
    }

    if (user.role !== 'DRIVER') {
      // Record failed login attempt
      await recordLoginAttempt(user.phoneNumber, false, ipAddress, userAgent);
      throw new ApiError(403, "Unauthorized access");
    }

    // Record successful login attempt
    await recordLoginAttempt(user.phoneNumber, true, ipAddress, userAgent);

    const { accessToken, refreshToken, sessionId } = authService.generateTokens(user.id, user.role);
    if (sessionId) {
      await authService.setDriverSession(user.id, sessionId, {
        ipAddress,
        userAgent: userAgent || undefined,
        deviceId: (req.body?.deviceId as string | undefined) || req.get('X-Device-Id') || undefined,
      });
    }

    res.json({
      success: true,
      message: "Login successful",
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          phoneNumber: user.phoneNumber,
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
      return;
    }
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const requestPasswordReset = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    await authService.initiatePasswordReset(email);

    res.json({
      success: true,
      message: "Password reset instructions sent to your email",
    });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
      return;
    }
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;
    await authService.resetPassword(token, password);

    res.json({
      success: true,
      message: "Password reset successful",
    });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
      return;
    }
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getMe = async (req: Request & { user: User }, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id, isDeleted: false },
      select: {
        id: true,
        email: true,
        phoneNumber: true,
        role: true,
        firstName: true,
        lastName: true,
        address: true,
        city: true,
        area: true,
        tankSize: true,
        onboarded: true,
        pushToken: true,
        latitude: true,
        longitude: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    res.json({
      success: true,
      message: "User retrieved successfully",
      data: { user },
    });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const deleteProfile = async (
  req: Request & { user: any },
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new ApiError(401, "Unauthorized");
    }

    // Hash helpers (basic SHA-256); move to util if needed
    const crypto = await import('crypto');
    const sha256 = (val?: string | null) => val ? crypto.createHash('sha256').update(val).digest('hex') : null;

    // Fetch current user for hashing before scrubbing
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new ApiError(404, "User not found");
    }

    // Create deletion audit with hashed identifiers for analytics
    await prisma.userDeletionAudit.create({
      data: {
        userId,
        phoneHash: sha256(user.phoneNumber) || undefined,
        emailHash: sha256(user.email || undefined) || undefined,
        reason: 'user_requested',
      },
    });

    // Scrub PII and mark deleted while keeping aggregate fields for analytics
    await prisma.user.update({
      where: { id: userId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        isActive: false,
        pushToken: null,
        fcmToken: null,
        phoneNumber: `deleted:${user.id}`,
        email: user.email ? `deleted:${user.id}@deleted.egas` : null,
        firstName: null,
        lastName: null,
        address: null,
        area: null,
        city: null,
        street: null,
        latitude: null,
        longitude: null,
        deviceType: null,
        appType: null,
        phoneHash: sha256(user.phoneNumber),
        emailHash: sha256(user.email || undefined),
      },
    });

    // Optional: Soft-delete user orders but retain for analytics
    await prisma.order.updateMany({
      where: { userId },
      data: { isDeleted: true, deletedAt: new Date() },
    });

    // Invalidate tokens (if you maintain a token store/blacklist, add here)
    try { await tokenService.clearTokensForUser?.(userId); } catch {}

    res.json({
      success: true,
      message: "Account deleted successfully",
    });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
      return;
    }
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
