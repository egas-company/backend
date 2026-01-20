import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { ApiError } from "../utils/ApiError";
import { logger } from "../lib/logger";

export const errorHandler = (
  err: Error,
  _: Request,
  res: Response,
  __: NextFunction
) => {
  let error = err;

  if (!(error instanceof ApiError)) {
    const statusCode = error instanceof ZodError ? 400 : 500;
    const message =
      error instanceof ZodError ? "Validation error" : "Internal server error";
    error = new ApiError(statusCode, message, false);
  }

  const response = {
    success: false,
    message: error.message,
    ...(process.env.NODE_ENV === "development" && {
      stack: err.stack,
    }),
  };

  if (!(error as ApiError).isOperational) {
    logger.error(error);
  }

  res.status((error as ApiError).statusCode).json(response);
};
