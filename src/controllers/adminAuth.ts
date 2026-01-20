import { Request, Response } from "express";
import { authService } from "../services/auth";
import { ApiError } from "../utils/ApiError";
import { comparePassword, hashPassword } from "../utils/password";
import { UserRole } from "@prisma/client";
import { prisma } from "../lib/prisma";

export const adminAuthController = {
  async signup(req: Request, res: Response) {
    try {
      const { email, password, firstName, lastName, phoneNumber } = req.body;

      // Check if email already exists
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        throw new ApiError(400, "Email already registered");
      }

      // Hash password
      const hashedPassword = await hashPassword(password);

      // Create new admin
      const newAdmin = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName,
          lastName,
          phoneNumber,
          role: UserRole.ADMIN,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phoneNumber: true,
          role: true,
          createdAt: true,
        },
      });

      // Generate tokens for immediate login
      const { accessToken, refreshToken } = authService.generateTokens(newAdmin.id, newAdmin.role);

      res.status(201).json({
        success: true,
        message: "Admin account created successfully",
        data: {
          user: newAdmin,
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
      console.error("Admin signup error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;

      const admin = await authService.findUserByEmail(email);
      if (!admin || admin.role !== UserRole.ADMIN) {
        throw new ApiError(401, "Invalid credentials");
      }

      const isPasswordValid = await comparePassword(password, admin.password!);
      if (!isPasswordValid) {
        throw new ApiError(401, "Invalid credentials");
      }

      const { accessToken, refreshToken } = authService.generateTokens(admin.id, admin.role);

      res.json({
        success: true,
        message: "Login successful",
        data: {
          user: {
            id: admin.id,
            email: admin.email,
            role: admin.role,
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
  },
};
