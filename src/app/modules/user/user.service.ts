// src/modules/user/user.service.ts
import { User, NotificationPreferences } from "@prisma/client";
import { prisma } from "../../shared/prisma";
import httpStatus from "http-status";
import bcrypt from "bcryptjs";
import { mailtrapService } from "../../shared/mailtrap.service";
import ApiError from "../../../error/ApiError";

export const UserService = {
  // ========== GET USER PROFILE ==========
  // src/modules/user/user.service.ts
  async getUserProfile(userId: string): Promise<User & { vendor?: any; supplier?: any; subscription?: any }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        vendorProfile: {
          include: {
            user: {
              include: {
                subscription: {
                  include: {
                    plan: true
                  }
                }
              }
            }
          }
        },
        supplierProfile: {
          include: {
            vendor: {
              select: {
                id: true,
                companyName: true,
                industryType : true,
              }
            }
          }
        },
        subscription: {
          include: {
            plan: true
          }
        },
        notificationPreferences: true
      }
    });

    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, "User not found");
    }

    // Transform the response to include subscription in vendorProfile
    const transformedUser = {
      ...user,
      vendorProfile: user.vendorProfile ? {
        ...user.vendorProfile,
        subscription: user.subscription
      } : undefined
    };

    return transformedUser;
  },

  // ========== UPDATE USER PROFILE ==========
 async updateUserProfile(userId: string, data: any) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      vendorProfile: true,
      supplierProfile: true,
    },
  });

  if (!user) throw new ApiError(404, "User not found");

  const updateData: any = {};

  // ===== USER TABLE =====
  if (data.profileImage) updateData.profileImage = data.profileImage;
  if (data.contactNumber) updateData.phoneNumber = data.contactNumber;

  // ===== VENDOR =====
  if (user.role === "VENDOR") {
    updateData.vendorProfile = {
      update: {
        ...(data.firstName && { firstName: data.firstName }),
        ...(data.lastName && { lastName: data.lastName }),
        ...(data.companyName && { companyName: data.companyName }),
        ...(data.contactNumber && { contactNumber: data.contactNumber }),
        ...(data.industryType && { industryType: data.industryType }),
        ...(data.companyLogo && { companyLogo: data.companyLogo }),
      },
    };
  }

  // ===== SUPPLIER =====
  if (user.role === "SUPPLIER") {
    updateData.supplierProfile = {
      update: {
        ...(data.firstName && { contactPerson: data.firstName }),
        ...(data.contactNumber && { phone: data.contactNumber }),
      },
    };
  }

  return prisma.user.update({
    where: { id: userId },
    data: updateData,
    include: {
      vendorProfile: true,
      supplierProfile: true,
    },
  });
}

  ,

  // ========== UPDATE PASSWORD ==========
  async updatePassword(userId: string, data: any): Promise<{ message: string }> {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, "User not found");
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(data.currentPassword, user.password);
    if (!isPasswordValid) {
      throw new ApiError(httpStatus.UNAUTHORIZED, "Current password is incorrect");
    }

    // Hash new password
    const hashPassword = await bcrypt.hash(data.newPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashPassword,
        needPasswordChange: false
      }
    });

    // Create activity log
    await prisma.activityLog.create({
      data: {
        userId,
        action: "UPDATE_PASSWORD",
        entityType: "USER",
        entityId: userId
      }
    });

    // Send notification email
    try {
      await mailtrapService.sendHtmlEmail({
        to: user.email,
        subject: "Password Updated Successfully - CyberNark",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Password Updated Successfully</h2>
            <p>Your CyberNark account password has been successfully updated.</p>
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p style="margin: 0; color: #666;">
                <strong>Security Tip:</strong> If you didn't make this change, please contact support immediately.
              </p>
            </div>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">© ${new Date().getFullYear()} CyberNark. All rights reserved.</p>
          </div>
        `
      });
    } catch (error) {
      console.error("Failed to send password update email:", error);
    }

    return {
      message: "Password updated successfully"
    };
  },

  // ========== GET NOTIFICATION PREFERENCES ==========
  async getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
    const preferences = await prisma.notificationPreferences.findUnique({
      where: { userId }
    });

    if (!preferences) {
      // Create default preferences if not exists
      return prisma.notificationPreferences.create({
        data: { userId }
      });
    }

    return preferences;
  },

  // ========== UPDATE NOTIFICATION PREFERENCES ==========
  async updateNotificationPreferences(
    userId: string,
    payload: any
  ): Promise<NotificationPreferences> {

    const cleanData: any = {};

    const allowedFields = [
      "emailNotifications",
      "pushNotifications",
      "riskAlerts",
      "contractReminders",
      "complianceUpdates",
      "assessmentReminders",
      "problemAlerts",
      "reportAlerts",
      "paymentAlerts",
      "messageAlerts",
      "digestFrequency",
      "quietHoursStart",
      "quietHoursEnd",
    ];

    for (const field of allowedFields) {
      if (payload[field] !== undefined) {
        cleanData[field] = payload[field];
      }
    }

    const updatedPreferences = await prisma.notificationPreferences.upsert({
      where: { userId },
      create: {
        userId,
        ...cleanData,
      },
      update: {
        ...cleanData,
      },
    });

    // ✅ CONSOLE UPDATED DATA
    console.log("Notification preferences updated:", updatedPreferences);

    return updatedPreferences;
  }
,
  // ========== GET ACTIVITY LOGS ==========
  async getActivityLogs(userId: string, options: any = {}) {
    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = options;
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where: { userId },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit
      }),
      prisma.activityLog.count({
        where: { userId }
      })
    ]);

    return {
      logs,
      meta: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  },

  // ========== SEARCH FUNCTIONALITY ==========
  async search(query: string, userId: string, userRole: string) {
    const searchConditions: any = [];

    if (userRole === 'VENDOR') {
      // Vendors can search their suppliers
      const vendor = await prisma.vendor.findUnique({
        where: { userId },
        select: { id: true }
      });

      if (vendor) {
        searchConditions.push({
          supplier: {
            vendorId: vendor.id,
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { email: { contains: query, mode: 'insensitive' } },
              { contactPerson: { contains: query, mode: 'insensitive' } },
              { category: { contains: query, mode: 'insensitive' } }
            ]
          }
        });
      }
    } else if (userRole === 'SUPPLIER') {
      // Suppliers can search their assessments
      searchConditions.push({
        assessment: {
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } }
          ]
        }
      });
    }

    // Search assessments
    const assessments = await prisma.assessment.findMany({
      where: {
        isActive: true,
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } }
        ]
      },
      take: 10
    });

    // Search problems
    const problems = await prisma.problem.findMany({
      where: {
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } }
        ]
      },
      include: {
        reportedBy: {
          select: { email: true }
        }
      },
      take: 10
    });

    // Search documents
    const documents = await prisma.document.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { type: { contains: query, mode: 'insensitive' } }
        ]
      },
      take: 10
    });

    return {
      assessments,
      problems: problems.map(p => ({
        id: p.id,
        title: p.title,
        description: p.description.substring(0, 100) + '...',
        status: p.status,
        reportedBy: p.reportedBy.email
      })),
      documents
    };
  }
  ,


};