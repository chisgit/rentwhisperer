import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";

interface ApiError extends Error {
  statusCode?: number;
}

export const errorHandler = (
  err: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const statusCode = err.statusCode || 500;
  
  logger.error(`Error: ${err.message}`);
  console.log(`Error occurred: ${err.message}`);
  
  if (process.env.NODE_ENV === "development") {
    console.log(err.stack);
  }
  
  res.status(statusCode).json({
    error: true,
    message: err.message,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
};
