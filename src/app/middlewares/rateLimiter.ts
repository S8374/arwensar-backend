// src/middleware/rateLimiter.ts
import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";

import httpStatus from "http-status";
import ApiError from "../../error/ApiError";
import { redisClient } from "../shared/redis";

// Create Redis store for rate limiting
const createRedisStore = () => {
  if (!redisClient.isOpen) {
    throw new Error("Redis client is not connected");
  }
  
  return new RedisStore({
    sendCommand: (...args: string[]) => redisClient.sendCommand(args),
    prefix: "rate-limit:"
  });
};

// General rate limiter
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  handler: (req, res) => {
    throw new ApiError(
      httpStatus.TOO_MANY_REQUESTS,
      "Too many requests, please try again later"
    );
  }
});

// Strict rate limiter for auth endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (req, res) => {
    throw new ApiError(
      httpStatus.TOO_MANY_REQUESTS,
      "Too many authentication attempts, please try again later"
    );
  }
});

// Password reset rate limiter
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 password reset requests per hour
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  handler: (req, res) => {
    throw new ApiError(
      httpStatus.TOO_MANY_REQUESTS,
      "Too many password reset attempts, please try again in an hour"
    );
  }
});

// OTP verification rate limiter
export const otpLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // Limit each IP to 10 OTP attempts per 5 minutes
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  handler: (req, res) => {
    throw new ApiError(
      httpStatus.TOO_MANY_REQUESTS,
      "Too many OTP attempts, please try again in 5 minutes"
    );
  }
});

// Optional: Redis-based rate limiter for production
export const redisRateLimiter = rateLimit({
  store: createRedisStore(),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    throw new ApiError(
      httpStatus.TOO_MANY_REQUESTS,
      "Too many requests, please try again later"
    );
  }
});