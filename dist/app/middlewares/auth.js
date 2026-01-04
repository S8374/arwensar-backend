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
const config_1 = require("../../config");
const prisma_1 = require("../shared/prisma");
const ApiError_1 = __importDefault(require("../../error/ApiError"));
const jwtHelper_1 = require("../helper/jwtHelper");
const auth = (...requiredRoles) => {
    return (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b, _c;
        try {
            // 1. Get token from cookie or Authorization header
            const token = ((_a = req.cookies) === null || _a === void 0 ? void 0 : _a.accessToken) || ((_c = (_b = req.headers.authorization) === null || _b === void 0 ? void 0 : _b.split(" ")) === null || _c === void 0 ? void 0 : _c[1]);
            if (!token) {
                throw new ApiError_1.default(http_status_1.default.UNAUTHORIZED, "Authentication token is missing");
            }
            // 2. Verify JWT
            let decoded;
            try {
                decoded = jwtHelper_1.jwtHelper.verifyToken(token, config_1.config.jwt.jwt_secret);
            }
            catch (error) {
                throw new ApiError_1.default(http_status_1.default.UNAUTHORIZED, "Invalid or expired token");
            }
            if (!(decoded === null || decoded === void 0 ? void 0 : decoded.userId) || !(decoded === null || decoded === void 0 ? void 0 : decoded.role)) {
                throw new ApiError_1.default(http_status_1.default.UNAUTHORIZED, "Invalid token payload");
            }
            // 3. Check if user exists and is active
            const user = yield prisma_1.prisma.user.findUnique({
                where: { id: decoded.userId },
                select: {
                    id: true,
                    email: true,
                    role: true,
                    status: true,
                    vendorId: true,
                    supplierId: true,
                    isVerified: true,
                }
            });
            if (!user) {
                throw new ApiError_1.default(http_status_1.default.UNAUTHORIZED, "User not found");
            }
            if (user.status !== 'ACTIVE') {
                throw new ApiError_1.default(http_status_1.default.FORBIDDEN, "Your account is not active");
            }
            // 4. Check if user is verified (for non-admin users)
            if (user.role !== 'ADMIN' && !user.isVerified) {
                throw new ApiError_1.default(http_status_1.default.FORBIDDEN, "Please verify your email before accessing this resource");
            }
            // 5. Prepare user data for request
            const userData = {
                userId: user.id,
                email: user.email,
                role: user.role,
            };
            // Use vendorId from JWT or database
            if (decoded.vendorId) {
                userData.vendorId = decoded.vendorId;
            }
            else if (user.role === "VENDOR" && user.vendorId) {
                userData.vendorId = user.vendorId;
            }
            // Use supplierId from JWT or database
            if (decoded.supplierId) {
                userData.supplierId = decoded.supplierId;
            }
            else if (user.role === "SUPPLIER" && user.supplierId) {
                userData.supplierId = user.supplierId;
            }
            // 6. For suppliers, get vendor info
            if (user.role === "SUPPLIER" && userData.supplierId) {
                const supplier = yield prisma_1.prisma.supplier.findUnique({
                    where: { id: userData.supplierId },
                    select: {
                        vendorId: true,
                        vendor: {
                            select: {
                                id: true,
                                companyName: true
                            }
                        }
                    }
                });
                if (supplier) {
                    userData.vendorId = supplier.vendorId;
                    userData.vendorCompany = supplier.vendor.companyName;
                }
            }
            // 7. Attach user to request
            req.user = userData;
            // 8. Role-based access control
            if (requiredRoles.length > 0 && !requiredRoles.includes(user.role)) {
                throw new ApiError_1.default(http_status_1.default.FORBIDDEN, "You do not have permission to access this resource");
            }
            console.log(`✅ Auth passed - User: ${user.email}, Role: ${user.role}, UserId: ${user.id}`);
            next();
        }
        catch (error) {
            console.error('❌ Auth error:', error);
            next(error);
        }
    });
};
exports.default = auth;
