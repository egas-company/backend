import { z } from "zod";

export const adminAuthSchema = {
  signup: z.object({
    email: z.string().email("Invalid email format"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
        "Password must contain at least one uppercase letter, one lowercase letter, one number and one special character"
      ),
    firstName: z.string().min(2, "First name is required"),
    lastName: z.string().min(2, "Last name is required"),
    phoneNumber: z
      .string()
      .regex(/^\+234[0-9]{10}$/, "Invalid Nigerian phone number format"),
  }),

  login: z.object({
    email: z.string().email("Invalid email format"),
    password: z.string().min(8, "Password is required"),
  }),
};

export const adminSchema = {
  createDriver: z.object({
    email: z.string().email(),
    password: z.string().min(6),
    firstName: z.string(),
    lastName: z.string(),
    phoneNumber: z.string(),
  }),
  updateDriver: z.object({
    email: z.string().email().optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    phoneNumber: z.string().optional(),
  }),
};
