// src/middleware/globalErrorHandler.ts
import { Request, Response, NextFunction } from "express";
import httpStatus from "http-status";
import ApiError from "../../error/ApiError";
import { config } from "../../config";

const globalErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let statusCode: number = httpStatus.INTERNAL_SERVER_ERROR;
  let message = err.message || "Something went wrong!";
  let errorCode = err.code;
  let data = err.data;
  let stack = err.stack;

  // Handle different error types
  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    errorCode = err.code;
    data = err.data;
  } else if (err.name === 'ValidationError') {
    statusCode = httpStatus.BAD_REQUEST;
    message = "Validation Error";
    data = err.errors;
  } else if (err.name === 'CastError') {
    statusCode = httpStatus.BAD_REQUEST;
    message = `Invalid ${err.path}: ${err.value}`;
  } else if (err.code === 11000) {
    statusCode = httpStatus.CONFLICT;
    message = "Duplicate field value entered";
    const field = Object.keys(err.keyValue)[0];
    data = { field, value: err.keyValue[field] };
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = httpStatus.UNAUTHORIZED;
    message = "Invalid token";
    errorCode = "INVALID_TOKEN";
  } else if (err.name === 'TokenExpiredError') {
    statusCode = httpStatus.UNAUTHORIZED;
    message = "Token expired";
    errorCode = "TOKEN_EXPIRED";
  } else if (err.name === 'PrismaClientKnownRequestError') {
    // Handle Prisma errors
    statusCode = httpStatus.BAD_REQUEST;
    message = "Database error";
    
    if (err.code === 'P2002') {
      message = "Duplicate value";
      const field = err.meta?.target?.[0];
      data = { field };
    }
  }

  // Clear authentication cookies for auth errors
  if (statusCode === httpStatus.UNAUTHORIZED || statusCode === httpStatus.FORBIDDEN) {
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
  }

  // Prepare response
  const response: any = {
    success: false,
    message,
    errorCode,
    data,
  };

  // Include stack trace in development
  if (config.node_env === 'development') {
    response.stack = stack;
  }

  // Log error
  console.error(`[${new Date().toISOString()}] ${statusCode} ${message}`, {
    path: req.path,
    method: req.method,
    ip: req.ip,
    stack: config.node_env === 'development' ? stack : undefined
  });

  res.status(statusCode).json(response);
};

export default globalErrorHandler;