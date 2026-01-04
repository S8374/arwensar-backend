"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_status_1 = __importDefault(require("http-status"));
const ApiError_1 = __importDefault(require("../../error/ApiError"));
const config_1 = require("../../config");
const globalErrorHandler = (err, req, res, next) => {
    var _a, _b;
    let statusCode = http_status_1.default.INTERNAL_SERVER_ERROR;
    let message = err.message || "Something went wrong!";
    let errorCode = err.code;
    let data = err.data;
    let stack = err.stack;
    // Handle different error types
    if (err instanceof ApiError_1.default) {
        statusCode = err.statusCode;
        message = err.message;
        errorCode = err.code;
        data = err.data;
    }
    else if (err.name === 'ValidationError') {
        statusCode = http_status_1.default.BAD_REQUEST;
        message = "Validation Error";
        data = err.errors;
    }
    else if (err.name === 'CastError') {
        statusCode = http_status_1.default.BAD_REQUEST;
        message = `Invalid ${err.path}: ${err.value}`;
    }
    else if (err.code === 11000) {
        statusCode = http_status_1.default.CONFLICT;
        message = "Duplicate field value entered";
        const field = Object.keys(err.keyValue)[0];
        data = { field, value: err.keyValue[field] };
    }
    else if (err.name === 'JsonWebTokenError') {
        statusCode = http_status_1.default.UNAUTHORIZED;
        message = "Invalid token";
        errorCode = "INVALID_TOKEN";
    }
    else if (err.name === 'TokenExpiredError') {
        statusCode = http_status_1.default.UNAUTHORIZED;
        message = "Token expired";
        errorCode = "TOKEN_EXPIRED";
    }
    else if (err.name === 'PrismaClientKnownRequestError') {
        // Handle Prisma errors
        statusCode = http_status_1.default.BAD_REQUEST;
        message = "Database error";
        if (err.code === 'P2002') {
            message = "Duplicate value";
            const field = (_b = (_a = err.meta) === null || _a === void 0 ? void 0 : _a.target) === null || _b === void 0 ? void 0 : _b[0];
            data = { field };
        }
    }
    // Clear authentication cookies for auth errors
    if (statusCode === http_status_1.default.UNAUTHORIZED || statusCode === http_status_1.default.FORBIDDEN) {
        res.clearCookie('accessToken');
        res.clearCookie('refreshToken');
    }
    // Prepare response
    const response = {
        success: false,
        message,
        errorCode,
        data,
    };
    // Include stack trace in development
    if (config_1.config.node_env === 'development') {
        response.stack = stack;
    }
    // Log error
    console.error(`[${new Date().toISOString()}] ${statusCode} ${message}`, {
        path: req.path,
        method: req.method,
        ip: req.ip,
        stack: config_1.config.node_env === 'development' ? stack : undefined
    });
    res.status(statusCode).json(response);
};
exports.default = globalErrorHandler;
