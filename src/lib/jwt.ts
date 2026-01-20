import jwt, { SignOptions } from "jsonwebtoken";
import { config } from "../config";

export const generateTokens = (user: any) => {
  const accessPayload = {
    userId: user.userId,
    role: user.role,
    phoneNumber: user.phoneNumber,
  };

  const accessOptions: SignOptions = {
    expiresIn: config.jwt.accessExpiresIn as unknown as SignOptions["expiresIn"],
  };

  const refreshOptions: SignOptions = {
    expiresIn: config.jwt.refreshExpiresIn as unknown as SignOptions["expiresIn"],
  };

  const token = jwt.sign(
    accessPayload,
    config.jwt.secret,
    accessOptions
  );

  const refreshToken = jwt.sign(
    { userId: user.userId },
    config.jwt.secret,
    refreshOptions
  );

  return { token, refreshToken };
};
