import { Request, Response, NextFunction } from "express";
import { UserRole, UserPayload } from "../types/user";
import { authService } from "../services/auth";
import { ApiError } from "../utils/ApiError";

export interface AuthRequest extends Request {
  user?: UserPayload;
}

// Add array of public routes
const PUBLIC_ROUTES = [
  '/api/auth/request-otp',
  '/api/auth/verify-otp',
  '/api/auth/refresh-token'
];

export const authenticate = async (
  req: AuthRequest,
  _: Response,
  next: NextFunction
) => {
  try {
    // Check if route is public
    const isPublicRoute = PUBLIC_ROUTES.some(route => 
      req.path.endsWith(route)
    );
    
    if (isPublicRoute) {
      return next();
    }

    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      console.error('No authorization token provided for route:', req.path);
      throw new ApiError(401, "Authentication required");
    }

    const verifiedUser = await authService.verifyAccessToken(token);

    req.user = {
      id: verifiedUser.id,
      userId: verifiedUser.id,
      phoneNumber: verifiedUser.phoneNumber || "",
      role: verifiedUser.role as unknown as UserRole,
    } as UserPayload;

    console.log('Authentication successful for user:', verifiedUser.id);
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    next(new ApiError(401, "Authentication failed"));
  }
};

export const authorize = (roles: UserRole[]) => {
  return (req: AuthRequest, _: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role as UserRole)) {
      throw new ApiError(403, "Unauthorized access");
    }
    next();
  };
};
