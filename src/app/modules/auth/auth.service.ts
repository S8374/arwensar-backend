// src/modules/auth/auth.service.ts
import { Plan, Subscription, User, Vendor } from "@prisma/client";
import { prisma } from "../../shared/prisma";
import httpStatus from "http-status";
import bcrypt from "bcryptjs";
import ApiError from "../../../error/ApiError";
import { config } from "../../../config";
import { jwtHelper } from "../../helper/jwtHelper";
import { mailtrapService } from "../../shared/mailtrap.service";

export interface LoginResponse {
  user: User;
  vendor?: Vendor & {
    subscription?: Subscription & {
      plan: Plan;
    } | null;
  };
  supplier?: any;
  accessToken: string;
  refreshToken: string;
}


export interface RegisterResponse {
  user: User;
  vendor: Vendor;
  message: string;
}

const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const AuthService = {
  // ========== REGISTER VENDOR ==========
  async registerVendor(payload: any): Promise<RegisterResponse> {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: payload.email }
    });

    if (existingUser) {
      throw new ApiError(httpStatus.CONFLICT, "User with this email already exists");
    }

    // Check if business email is already used
    const existingVendor = await prisma.vendor.findUnique({
      where: { businessEmail: payload.businessEmail }
    });

    if (existingVendor) {
      throw new ApiError(httpStatus.CONFLICT, "Business email already registered");
    }

    const hashPassword = await bcrypt.hash(payload.password, 10);

    const result = await prisma.$transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
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
      const vendor = await tx.vendor.create({
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
      await tx.notificationPreferences.create({
        data: {
          userId: user.id
        }
      });

      // Update user with vendorId
      await tx.user.update({
        where: { id: user.id },
        data: { vendorId: vendor.id }
      });

      return { user, vendor };
    });

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
  },

  // ========== VERIFY EMAIL ==========
  async verifyEmail(payload: any): Promise<User> {
    const otpRecord = await prisma.oTP.findFirst({
      where: {
        email: payload.email,
        otp: payload.otp,
        type: "EMAIL_VERIFICATION",
        isUsed: false,
        expiresAt: { gt: new Date() }
      }
    });

    if (!otpRecord) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid or expired OTP");
    }

    const result = await prisma.$transaction(async (tx) => {
      // Update OTP as used
      await tx.oTP.update({
        where: { id: otpRecord.id },
        data: { isUsed: true }
      });

      // Update user as verified
      const user = await tx.user.update({
        where: { email: payload.email },
        data: {
          isVerified: true,
          emailVerifiedAt: new Date()
        }
      });

      return user;
    });

    // Send welcome email
    try {
      mailtrapService.sendHtmlEmail({
        to: payload.email,
        subject: "Email Verified Successfully - CyberNark",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Email Verified Successfully! 🎉</h2>
            <p>Your email has been verified and your account is now active.</p>
            <p>You can now log in to your CyberNark dashboard and start managing your suppliers.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${config.APP.WEBSITE}/login" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                Go to Dashboard
              </a>
            </div>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">© ${new Date().getFullYear()} CyberNark. All rights reserved.</p>
          </div>
        `
      });
    } catch (error) {
      console.error("Failed to send welcome email:", error);
    }

    return result;
  },

  // ========== RESEND OTP ==========
  async resendOTP(payload: any): Promise<{ message: string }> {
    const user = await prisma.user.findUnique({
      where: { email: payload.email }
    });

    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, "User not found");
    }

    if (user.isVerified) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Email is already verified");
    }

    // Generate new OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Delete previous OTPs for this email
    await prisma.oTP.deleteMany({
      where: {
        email: payload.email,
        type: "EMAIL_VERIFICATION"
      }
    });

    // Create new OTP
    await prisma.oTP.create({
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
      mailtrapService.sendHtmlEmail({
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
    } catch (error) {
      console.error("Failed to send verification email:", error);
    }

    return {
      message: "New verification code sent to your email"
    };
  },



// ========== LOGIN ==========
async login(payload: any, req?: any): Promise<LoginResponse> {
  const { email, password } = payload;

  const user = await prisma.user.findUnique({
    where: { email }
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  if (user.status !== "ACTIVE") {
    throw new ApiError(httpStatus.FORBIDDEN, "Your account is not active");
  }

  if (!user.isVerified) {
    throw new ApiError(httpStatus.FORBIDDEN, "Please verify your email first");
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Invalid credentials");
  }

  // === SAFE & CORRECT IP EXTRACTION ===
  const getClientIp = (request: any): string => {
    if (!request || !request.headers) return "unknown";

    const forwarded = request.headers["x-forwarded-for"];
    if (forwarded) {
      return (Array.isArray(forwarded) ? forwarded[0] : forwarded.split(",")[0]).trim();
    }

    return (
      request.headers["x-real-ip"] ||
      request.headers["cf-connecting-ip"] ||
      request.headers["true-client-ip"] ||
      request.connection?.remoteAddress ||
      request.socket?.remoteAddress ||
      request.ip ||
      "unknown"
    );
  };

  const clientIp = getClientIp(req);
  const userAgent = req?.headers["user-agent"] || payload.userAgent || "unknown";

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() }
  });

  // Log activity
  await prisma.activityLog.create({
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
  let vendor: any = null;

  if (user.role === "VENDOR" && user.vendorId) {
    const vendorData = await prisma.vendor.findUnique({
      where: { id: user.vendorId }
    });

    if (vendorData) {
      const subscription = await prisma.subscription.findUnique({
        where: { userId: user.id },
        include: {
          plan: true,
          PlanLimitData: true // Optional: include usage if needed
        }
      });

      vendor = {
        ...vendorData,
        subscription: subscription ? {
          ...subscription,
          plan: subscription.plan,
        } : null
      };
    }
  }

  // === Load Supplier Profile ===
  let supplier: any = null;

  if (user.role === "SUPPLIER" && user.supplierId) {
    supplier = await prisma.supplier.findUnique({
      where: { id: user.supplierId },
      include: {
        vendor: {
          select: { id: true, companyName: true }
        }
      }
    });
  }

  // === Generate Tokens ===
  const accessToken = jwtHelper.generateToken(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      vendorId: vendor?.id || undefined,
      supplierId: supplier?.id || undefined,
    },
    config.jwt.jwt_secret as string,
    config.jwt.expires_in as string
  );

  const refreshToken = jwtHelper.generateToken(
    { userId: user.id },
    config.jwt.refresh_token_secret as string,
    config.jwt.refresh_token_expires_in as string
  );

  return {
    user,
    vendor,           // Includes subscription with plan
    supplier,
    accessToken,
    refreshToken
  };
},

  // ========== REFRESH TOKEN ==========
  async refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
    try {
      const decoded = jwtHelper.verifyToken(
        refreshToken,
        config.jwt.refresh_token_secret as string
      ) as any;

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, email: true, role: true }
      });

      if (!user) {
        throw new ApiError(httpStatus.UNAUTHORIZED, "Invalid refresh token");
      }

      const accessToken = jwtHelper.generateToken(
        {
          userId: user.id,
          email: user.email,
          role: user.role
        },
        config.jwt.jwt_secret as string,
        config.jwt.expires_in as string
      );

      return { accessToken };
    } catch (error) {
      throw new ApiError(httpStatus.UNAUTHORIZED, "Invalid or expired refresh token");
    }
  },

  // ========== FORGOT PASSWORD ==========
  async forgotPassword(payload: any): Promise<{ message: string }> {
    const user = await prisma.user.findUnique({
      where: { email: payload.email }
    });
    console.log("find the user", user);
    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, "User not found");
    }

    // Generate reset token
    const resetToken = jwtHelper.generateToken(
      {
        userId: user.id,
        email: user.email,


      },
      config.jwt.reset_pass_secret as string,
      config.jwt.reset_pass_token_expires_in as string
    );

    // Save OTP record
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.oTP.create({
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
      mailtrapService.sendHtmlEmail({
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
              <a href="${config.APP.WEBSITE}/reset-password?token=${resetToken}" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                Reset Password
              </a>
            </div>
            <p>If you didn't request this, please ignore this email.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">© ${new Date().getFullYear()} CyberNark. All rights reserved.</p>
          </div>
        `
      });
    } catch (error) {
      console.error("Failed to send password reset email:", error);
    }

    return {
      message: "Password reset instructions sent to your email"
    };
  },

  // ========== RESET PASSWORD ==========
  async resetPassword(payload: any): Promise<{ message: string }> {
    let decodedToken;
    try {
      decodedToken = jwtHelper.verifyToken(
        payload.token,
        config.jwt.reset_pass_secret as string
      ) as any;
    } catch (error) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid or expired reset token");
    }

    // Verify OTP
    const otpRecord = await prisma.oTP.findFirst({
      where: {
        userId: decodedToken.userId,
        otp: payload.otp || "000000", // If using token only, bypass OTP
        type: "PASSWORD_RESET",
        isUsed: false,
        expiresAt: { gt: new Date() }
      }
    });

    if (!otpRecord && !payload.token) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid or expired OTP");
    }

    const hashPassword = await bcrypt.hash(payload.password, 10);

    await prisma.$transaction(async (tx) => {
      // Update user password
      await tx.user.update({
        where: { id: decodedToken.userId },
        data: {
          password: hashPassword,
          needPasswordChange: false
        }
      });

      // Mark OTP as used if it exists
      if (otpRecord) {
        await tx.oTP.update({
          where: { id: otpRecord.id },
          data: { isUsed: true }
        });
      }
    });

    return {
      message: "Password reset successfully"
    };
  },


  // ========== LOGOUT ==========
  async logout(userId: string, req?: any): Promise<{ message: string }> {
    try {
      const userExists = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true }
      });

      if (userExists) {
        // Extract IP and User Agent (same logic as login)
        const getClientIp = (request: any): string => {
          return (
            (request.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
            (request.headers["x-real-ip"] as string) ||
            (request.headers["cf-connecting-ip"] as string) ||
            request.connection?.remoteAddress ||
            request.socket?.remoteAddress ||
            request.ip ||
            "unknown"
          );
        };

        const clientIp = req ? getClientIp(req) : "unknown";
        const userAgent = req?.headers["user-agent"] || "unknown";

        await prisma.activityLog.create({
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
    } catch (error) {
      console.error("Error creating logout activity log:", error);
      // Still return success — logout should not fail due to logging
      return { message: "Logged out successfully" };
    }
  },

  // ========== GET CURRENT USER (ME) ==========
  async getMe(userId: string): Promise<any> {
    const user = await prisma.user.findUnique({
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
          select :{
                   status : true ,
                   
            plan :{
              select :{
                features : true
              }
            }
          
          },
        },
        notificationPreferences: true
      }
    });

    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, "User not found");
    }

    // Remove sensitive data
    const { password, ...userWithoutPassword } = user;

    return userWithoutPassword;
  },


};