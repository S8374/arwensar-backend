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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const prisma_1 = require("../../shared/prisma");
const http_status_1 = __importDefault(require("http-status"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const ApiError_1 = __importDefault(require("../../../error/ApiError"));
const config_1 = require("../../../config");
const jwtHelper_1 = require("../../helper/jwtHelper");
const mailtrap_service_1 = require("../../shared/mailtrap.service");
const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};
exports.AuthService = {
    // ========== REGISTER VENDOR ==========
    registerVendor(payload) {
        return __awaiter(this, void 0, void 0, function* () {
            // Check if user already exists
            const existingUser = yield prisma_1.prisma.user.findUnique({
                where: { email: payload.email }
            });
            if (existingUser) {
                throw new ApiError_1.default(http_status_1.default.CONFLICT, "User with this email already exists");
            }
            // Check if business email is already used
            const existingVendor = yield prisma_1.prisma.vendor.findUnique({
                where: { businessEmail: payload.businessEmail }
            });
            if (existingVendor) {
                throw new ApiError_1.default(http_status_1.default.CONFLICT, "Business email already registered");
            }
            const hashPassword = yield bcryptjs_1.default.hash(payload.password, 10);
            const result = yield prisma_1.prisma.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                // Create user
                const user = yield tx.user.create({
                    data: {
                        email: payload.email,
                        password: hashPassword,
                        role: "VENDOR",
                        isVerified: false,
                        needPasswordChange: false,
                        status: "ACTIVE"
                    }
                });
                // Create vendor
                const vendor = yield tx.vendor.create({
                    data: {
                        companyName: payload.companyName,
                        businessEmail: payload.businessEmail,
                        contactNumber: payload.contactNumber,
                        industryType: payload.industryType,
                        firstName: payload.firstName,
                        lastName: payload.lastName,
                        termsAccepted: payload.termsAccepted,
                        userId: user.id,
                        isActive: true
                    }
                });
                // Create notification preferences
                yield tx.notificationPreferences.create({
                    data: {
                        userId: user.id
                    }
                });
                // Update user with vendorId
                yield tx.user.update({
                    where: { id: user.id },
                    data: { vendorId: vendor.id }
                });
                return { user, vendor };
            }));
            // // Generate and send OTP
            // const otp = generateOTP();
            // const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
            // await prisma.oTP.create({
            //   data: {
            //     email: payload.email,
            //     otp,
            //     type: "EMAIL_VERIFICATION",
            //     expiresAt,
            //     userId: result.user.id
            //   }
            // });
            // // Send verification email
            // try {
            //   await mailtrapService.sendOTPEmail({
            //     email: payload.email,
            //     name: payload.firstName || payload.companyName,
            //     otp: otp,
            //     type: 'verification'
            //   });
            // } catch (error) {
            //   console.error("Failed to send verification email:", error);
            // }
            return {
                user: result.user,
                vendor: result.vendor,
                message: "Registration successful. Please check your email for verification code."
            };
        });
    },
    // ========== VERIFY EMAIL ==========
    verifyEmail(payload) {
        return __awaiter(this, void 0, void 0, function* () {
            const otpRecord = yield prisma_1.prisma.oTP.findFirst({
                where: {
                    email: payload.email,
                    otp: payload.otp,
                    type: "EMAIL_VERIFICATION",
                    isUsed: false,
                    expiresAt: { gt: new Date() }
                }
            });
            if (!otpRecord) {
                throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, "Invalid or expired OTP");
            }
            const result = yield prisma_1.prisma.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                // Update OTP as used
                yield tx.oTP.update({
                    where: { id: otpRecord.id },
                    data: { isUsed: true }
                });
                // Update user as verified
                const user = yield tx.user.update({
                    where: { email: payload.email },
                    data: {
                        isVerified: true,
                        emailVerifiedAt: new Date()
                    }
                });
                return user;
            }));
            // Send welcome email
            try {
                mailtrap_service_1.mailtrapService.sendHtmlEmail({
                    to: payload.email,
                    subject: "Email Verified Successfully - CyberNark",
                    html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Email Verified Successfully! 🎉</h2>
            <p>Your email has been verified and your account is now active.</p>
            <p>You can now log in to your CyberNark dashboard and start managing your suppliers.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${config_1.config.APP.WEBSITE}/login" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                Go to Dashboard
              </a>
            </div>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">© ${new Date().getFullYear()} CyberNark. All rights reserved.</p>
          </div>
        `
                });
            }
            catch (error) {
                console.error("Failed to send welcome email:", error);
            }
            return result;
        });
    },
    // ========== RESEND OTP ==========
    resendOTP(payload) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield prisma_1.prisma.user.findUnique({
                where: { email: payload.email }
            });
            if (!user) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "User not found");
            }
            if (user.isVerified) {
                throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, "Email is already verified");
            }
            // Generate new OTP
            const otp = generateOTP();
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
            // Delete previous OTPs for this email
            yield prisma_1.prisma.oTP.deleteMany({
                where: {
                    email: payload.email,
                    type: "EMAIL_VERIFICATION"
                }
            });
            // Create new OTP
            yield prisma_1.prisma.oTP.create({
                data: {
                    email: payload.email,
                    otp,
                    type: "EMAIL_VERIFICATION",
                    expiresAt,
                    userId: user.id
                }
            });
            // Send new verification email
            try {
                mailtrap_service_1.mailtrapService.sendHtmlEmail({
                    to: payload.email,
                    subject: "New Verification Code - CyberNark",
                    html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">New Verification Code</h2>
            <p>Here is your new verification code:</p>
            <div style="background-color: #f4f4f4; padding: 20px; border-radius: 5px; text-align: center; margin: 20px 0;">
              <div style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #007bff; margin: 15px 0;">
                ${otp}
              </div>
              <p style="margin: 0; color: #666;">This code will expire in 10 minutes</p>
            </div>
            <p>If you didn't request this code, please ignore this email.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">© ${new Date().getFullYear()} CyberNark. All rights reserved.</p>
          </div>
        `
                });
            }
            catch (error) {
                console.error("Failed to send verification email:", error);
            }
            return {
                message: "New verification code sent to your email"
            };
        });
    },
    // ========== LOGIN ==========
    login(payload, req) {
        return __awaiter(this, void 0, void 0, function* () {
            const { email, password } = payload;
            const user = yield prisma_1.prisma.user.findUnique({
                where: { email }
            });
            if (!user) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "User not found");
            }
            if (user.status !== "ACTIVE") {
                throw new ApiError_1.default(http_status_1.default.FORBIDDEN, "Your account is not active");
            }
            if (!user.isVerified) {
                throw new ApiError_1.default(http_status_1.default.FORBIDDEN, "Please verify your email first");
            }
            const isPasswordValid = yield bcryptjs_1.default.compare(password, user.password);
            if (!isPasswordValid) {
                throw new ApiError_1.default(http_status_1.default.UNAUTHORIZED, "Invalid credentials");
            }
            // === SAFE & CORRECT IP EXTRACTION ===
            const getClientIp = (request) => {
                var _a, _b;
                if (!request || !request.headers)
                    return "unknown";
                const forwarded = request.headers["x-forwarded-for"];
                if (forwarded) {
                    return (Array.isArray(forwarded) ? forwarded[0] : forwarded.split(",")[0]).trim();
                }
                return (request.headers["x-real-ip"] ||
                    request.headers["cf-connecting-ip"] ||
                    request.headers["true-client-ip"] ||
                    ((_a = request.connection) === null || _a === void 0 ? void 0 : _a.remoteAddress) ||
                    ((_b = request.socket) === null || _b === void 0 ? void 0 : _b.remoteAddress) ||
                    request.ip ||
                    "unknown");
            };
            const clientIp = getClientIp(req);
            const userAgent = (req === null || req === void 0 ? void 0 : req.headers["user-agent"]) || payload.userAgent || "unknown";
            // Update last login
            yield prisma_1.prisma.user.update({
                where: { id: user.id },
                data: { lastLoginAt: new Date() }
            });
            // Log activity
            yield prisma_1.prisma.activityLog.create({
                data: {
                    userId: user.id,
                    action: "LOGIN",
                    entityType: "USER",
                    entityId: user.id,
                    ipAddress: clientIp,
                    userAgent: userAgent,
                    details: {
                        ip: clientIp,
                        userAgent: userAgent,
                        timestamp: new Date().toISOString(),
                        method: "email_password"
                    }
                }
            });
            // === Load Vendor + Subscription (with Plan) ===
            let vendor = null;
            if (user.role === "VENDOR" && user.vendorId) {
                const vendorData = yield prisma_1.prisma.vendor.findUnique({
                    where: { id: user.vendorId }
                });
                if (vendorData) {
                    const subscription = yield prisma_1.prisma.subscription.findUnique({
                        where: { userId: user.id },
                        include: {
                            plan: true,
                            PlanLimitData: true // Optional: include usage if needed
                        }
                    });
                    vendor = Object.assign(Object.assign({}, vendorData), { subscription: subscription ? Object.assign(Object.assign({}, subscription), { plan: subscription.plan }) : null });
                }
            }
            // === Load Supplier Profile ===
            let supplier = null;
            if (user.role === "SUPPLIER" && user.supplierId) {
                supplier = yield prisma_1.prisma.supplier.findUnique({
                    where: { id: user.supplierId },
                    include: {
                        vendor: {
                            select: { id: true, companyName: true }
                        }
                    }
                });
            }
            // === Generate Tokens ===
            const accessToken = jwtHelper_1.jwtHelper.generateToken({
                userId: user.id,
                email: user.email,
                role: user.role,
                vendorId: (vendor === null || vendor === void 0 ? void 0 : vendor.id) || undefined,
                supplierId: (supplier === null || supplier === void 0 ? void 0 : supplier.id) || undefined,
            }, config_1.config.jwt.jwt_secret, config_1.config.jwt.expires_in);
            const refreshToken = jwtHelper_1.jwtHelper.generateToken({ userId: user.id }, config_1.config.jwt.refresh_token_secret, config_1.config.jwt.refresh_token_expires_in);
            return {
                user,
                vendor, // Includes subscription with plan
                supplier,
                accessToken,
                refreshToken
            };
        });
    },
    // ========== REFRESH TOKEN ==========
    refreshToken(refreshToken) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const decoded = jwtHelper_1.jwtHelper.verifyToken(refreshToken, config_1.config.jwt.refresh_token_secret);
                const user = yield prisma_1.prisma.user.findUnique({
                    where: { id: decoded.userId },
                    select: { id: true, email: true, role: true }
                });
                if (!user) {
                    throw new ApiError_1.default(http_status_1.default.UNAUTHORIZED, "Invalid refresh token");
                }
                const accessToken = jwtHelper_1.jwtHelper.generateToken({
                    userId: user.id,
                    email: user.email,
                    role: user.role
                }, config_1.config.jwt.jwt_secret, config_1.config.jwt.expires_in);
                return { accessToken };
            }
            catch (error) {
                throw new ApiError_1.default(http_status_1.default.UNAUTHORIZED, "Invalid or expired refresh token");
            }
        });
    },
    // ========== FORGOT PASSWORD ==========
    forgotPassword(payload) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield prisma_1.prisma.user.findUnique({
                where: { email: payload.email }
            });
            console.log("find the user", user);
            if (!user) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "User not found");
            }
            // Generate reset token
            const resetToken = jwtHelper_1.jwtHelper.generateToken({
                userId: user.id,
                email: user.email,
            }, config_1.config.jwt.reset_pass_secret, config_1.config.jwt.reset_pass_token_expires_in);
            // Save OTP record
            const otp = generateOTP();
            const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
            yield prisma_1.prisma.oTP.create({
                data: {
                    email: payload.email,
                    otp,
                    type: "PASSWORD_RESET",
                    expiresAt,
                    userId: user.id
                }
            });
            // Send password reset email
            try {
                mailtrap_service_1.mailtrapService.sendHtmlEmail({
                    to: payload.email,
                    subject: "Password Reset Request - CyberNark",
                    html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Password Reset Request</h2>
            <p>You requested to reset your password. Please use the following code to reset your password:</p>
            <div style="background-color: #f4f4f4; padding: 20px; border-radius: 5px; text-align: center; margin: 20px 0;">
              <div style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #007bff; margin: 15px 0;">
                ${otp}
              </div>
              <p style="margin: 0; color: #666;">This code will expire in 1 hour</p>
            </div>
            <p>Or click the link below:</p>
            <div style="text-align: center; margin: 20px 0;">
              <a href="${config_1.config.APP.WEBSITE}/reset-password?token=${resetToken}" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                Reset Password
              </a>
            </div>
            <p>If you didn't request this, please ignore this email.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">© ${new Date().getFullYear()} CyberNark. All rights reserved.</p>
          </div>
        `
                });
            }
            catch (error) {
                console.error("Failed to send password reset email:", error);
            }
            return {
                message: "Password reset instructions sent to your email"
            };
        });
    },
    // ========== RESET PASSWORD ==========
    resetPassword(payload) {
        return __awaiter(this, void 0, void 0, function* () {
            let decodedToken;
            try {
                decodedToken = jwtHelper_1.jwtHelper.verifyToken(payload.token, config_1.config.jwt.reset_pass_secret);
            }
            catch (error) {
                throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, "Invalid or expired reset token");
            }
            // Verify OTP
            const otpRecord = yield prisma_1.prisma.oTP.findFirst({
                where: {
                    userId: decodedToken.userId,
                    otp: payload.otp || "000000", // If using token only, bypass OTP
                    type: "PASSWORD_RESET",
                    isUsed: false,
                    expiresAt: { gt: new Date() }
                }
            });
            if (!otpRecord && !payload.token) {
                throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, "Invalid or expired OTP");
            }
            const hashPassword = yield bcryptjs_1.default.hash(payload.password, 10);
            yield prisma_1.prisma.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                // Update user password
                yield tx.user.update({
                    where: { id: decodedToken.userId },
                    data: {
                        password: hashPassword,
                        needPasswordChange: false
                    }
                });
                // Mark OTP as used if it exists
                if (otpRecord) {
                    yield tx.oTP.update({
                        where: { id: otpRecord.id },
                        data: { isUsed: true }
                    });
                }
            }));
            return {
                message: "Password reset successfully"
            };
        });
    },
    // ========== LOGOUT ==========
    logout(userId, req) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userExists = yield prisma_1.prisma.user.findUnique({
                    where: { id: userId },
                    select: { id: true }
                });
                if (userExists) {
                    // Extract IP and User Agent (same logic as login)
                    const getClientIp = (request) => {
                        var _a, _b, _c, _d;
                        return (((_b = (_a = request.headers["x-forwarded-for"]) === null || _a === void 0 ? void 0 : _a.split(",")[0]) === null || _b === void 0 ? void 0 : _b.trim()) ||
                            request.headers["x-real-ip"] ||
                            request.headers["cf-connecting-ip"] ||
                            ((_c = request.connection) === null || _c === void 0 ? void 0 : _c.remoteAddress) ||
                            ((_d = request.socket) === null || _d === void 0 ? void 0 : _d.remoteAddress) ||
                            request.ip ||
                            "unknown");
                    };
                    const clientIp = req ? getClientIp(req) : "unknown";
                    const userAgent = (req === null || req === void 0 ? void 0 : req.headers["user-agent"]) || "unknown";
                    yield prisma_1.prisma.activityLog.create({
                        data: {
                            userId,
                            action: "LOGOUT",
                            entityType: "USER",
                            entityId: userId,
                            ipAddress: clientIp,
                            userAgent: userAgent,
                            details: {
                                ip: clientIp,
                                userAgent: userAgent,
                                timestamp: new Date().toISOString()
                            }
                        }
                    });
                }
                return { message: "Logged out successfully" };
            }
            catch (error) {
                console.error("Error creating logout activity log:", error);
                // Still return success — logout should not fail due to logging
                return { message: "Logged out successfully" };
            }
        });
    },
    // ========== GET CURRENT USER (ME) ==========
    getMe(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield prisma_1.prisma.user.findUnique({
                where: { id: userId },
                include: {
                    vendorProfile: {
                        include: {
                            // Vendors don't have direct subscription relationship
                            // Subscription is linked to User, not Vendor
                            suppliers: {
                                where: { isDeleted: false },
                                select: {
                                    id: true,
                                    name: true,
                                    email: true,
                                    riskLevel: true,
                                    bivScore: true
                                },
                                take: 5
                            }
                        }
                    },
                    // Subscription is on User model, not Vendor
                    subscription: {
                        select: {
                            status: true,
                            plan: {
                                select: {
                                    features: true
                                }
                            }
                        },
                    },
                    notificationPreferences: true
                }
            });
            if (!user) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "User not found");
            }
            // Remove sensitive data
            const { password } = user, userWithoutPassword = __rest(user, ["password"]);
            return userWithoutPassword;
        });
    },
};
