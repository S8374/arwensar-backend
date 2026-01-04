"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisRateLimiter = exports.otpLimiter = exports.passwordResetLimiter = exports.authLimiter = exports.generalLimiter = void 0;
// src/middleware/rateLimiter.ts
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const rate_limit_redis_1 = __importDefault(require("rate-limit-redis"));
const http_status_1 = __importDefault(require("http-status"));
const ApiError_1 = __importDefault(require("../../error/ApiError"));
const redis_1 = require("../shared/redis");
// Create Redis store for rate limiting
const createRedisStore = () => {
    if (!redis_1.redisClient.isOpen) {
        throw new Error("Redis client is not connected");
    }
    return new rate_limit_redis_1.default({
        sendCommand: (...args) => redis_1.redisClient.sendCommand(args),
        prefix: "rate-limit:"
    });
};
// General rate limiter
exports.generalLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    handler: (req, res) => {
        throw new ApiError_1.default(http_status_1.default.TOO_MANY_REQUESTS, "Too many requests, please try again later");
    }
});
// Strict rate limiter for auth endpoints
exports.authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    handler: (req, res) => {
        throw new ApiError_1.default(http_status_1.default.TOO_MANY_REQUESTS, "Too many authentication attempts, please try again later");
    }
});
// Password reset rate limiter
exports.passwordResetLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // Limit each IP to 3 password reset requests per hour
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    handler: (req, res) => {
        throw new ApiError_1.default(http_status_1.default.TOO_MANY_REQUESTS, "Too many password reset attempts, please try again in an hour");
    }
});
// OTP verification rate limiter
exports.otpLimiter = (0, express_rate_limit_1.default)({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 10, // Limit each IP to 10 OTP attempts per 5 minutes
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    handler: (req, res) => {
        throw new ApiError_1.default(http_status_1.default.TOO_MANY_REQUESTS, "Too many OTP attempts, please try again in 5 minutes");
    }
});
// Optional: Redis-based rate limiter for production
exports.redisRateLimiter = (0, express_rate_limit_1.default)({
    store: createRedisStore(),
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        throw new ApiError_1.default(http_status_1.default.TOO_MANY_REQUESTS, "Too many requests, please try again later");
    }
});
