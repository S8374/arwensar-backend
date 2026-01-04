// src/error/ApiError.ts
class ApiError extends Error {
  statusCode: number;
  isOperational: boolean;
  data?: any;
  code?: string;

  constructor(
    statusCode: number,
    message: string | object, // Allow both string and object

    data?: any,
    code?: string,
    isOperational = true,
    stack = ''
  ) {
    super(typeof message === 'string' ? message : JSON.stringify(message) );
    this.statusCode = statusCode;
    this.data = data;
    this.code = code;
    this.isOperational = isOperational;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  // Static methods for common auth errors
  static unauthorized(message = "Unauthorized access") {
    return new ApiError(401, message, null, "UNAUTHORIZED");
  }

  static forbidden(message = "Access forbidden") {
    return new ApiError(403, message, null, "FORBIDDEN");
  }

  static tokenExpired() {
    return new ApiError(401, "Token has expired", null, "TOKEN_EXPIRED");
  }

  static invalidToken() {
    return new ApiError(401, "Invalid token", null, "INVALID_TOKEN");
  }

  static accountNotVerified() {
    return new ApiError(403, "Account not verified", null, "ACCOUNT_NOT_VERIFIED");
  }

  static accountSuspended() {
    return new ApiError(403, "Account suspended", null, "ACCOUNT_SUSPENDED");
  }

  static accountDeleted() {
    return new ApiError(403, "Account deleted", null, "ACCOUNT_DELETED");
  }

  static rateLimited() {
    return new ApiError(429, "Too many requests", null, "RATE_LIMITED");
  }
}

export default ApiError;