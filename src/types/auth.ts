import { UserRole } from '@prisma/client';

export interface TokenPayload {
  userId: string;
  phoneNumber: string;
  role: UserRole;
  jti?: string;
  iat?: number;
  exp?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    user: {
      id: string;
      phoneNumber: string;
      role: UserRole;
      firstName?: string | null;
      lastName?: string | null;
      email?: string | null;
      onboarded: boolean;
    };
    accessToken: string;
    refreshToken: string;
  };
}
