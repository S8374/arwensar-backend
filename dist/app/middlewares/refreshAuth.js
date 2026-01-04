"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_status_1 = __importDefault(require("http-status"));
const jwtHelper_1 = require("../helper/jwtHelper");
const prisma_1 = require("../shared/prisma");
const ApiError_1 = __importDefault(require("../../error/ApiError"));
const config_1 = require("../../config");
const refreshAuth = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        // Get refresh token from cookies
        const refreshToken = (_a = req.cookies) === null || _a === void 0 ? void 0 : _a.refreshToken;
        if (!refreshToken) {
            throw new ApiError_1.default(http_status_1.default.UNAUTHORIZED, "Refresh token is required");
        }
        // Verify refresh token
        let decoded;
        try {
            decoded = jwtHelper_1.jwtHelper.verifyToken(refreshToken, config_1.config.jwt.refresh_token_secret);
        }
        catch (error) {
            throw new ApiError_1.default(http_status_1.default.UNAUTHORIZED, "Invalid or expired refresh token");
        }
        // Check if user exists and is active
        const user = yield prisma_1.prisma.user.findUnique({
            where: { id: decoded.userId },
            select: {
                id: true,
                email: true,
                role: true,
                status: true,
                vendorId: true,
                supplierId: true
            }
        });
        if (!user) {
            throw new ApiError_1.default(http_status_1.default.UNAUTHORIZED, "User not found");
        }
        if (user.status !== 'ACTIVE') {
            throw new ApiError_1.default(http_status_1.default.FORBIDDEN, "Account is not active");
        }
        // Generate new access token
        const tokenPayload = {
            userId: user.id,
            email: user.email,
            role: user.role,
            vendorId: user.vendorId,
            supplierId: user.supplierId
        };
        const newAccessToken = jwtHelper_1.jwtHelper.generateToken(tokenPayload, config_1.config.jwt.jwt_secret, config_1.config.jwt.expires_in);
        // Set new access token in cookie
        res.cookie("accessToken", newAccessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 60 * 60 * 1000 // 1 hour
        });
        // Return new token in response
        res.locals.newAccessToken = newAccessToken;
        res.locals.user = tokenPayload;
        next();
    }
    catch (error) {
        // Clear cookies on error
        res.clearCookie("accessToken");
        res.clearCookie("refreshToken");
        next(error);
    }
});
exports.default = refreshAuth;
