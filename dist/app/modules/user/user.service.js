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
exports.UserService = void 0;
const prisma_1 = require("../../shared/prisma");
const http_status_1 = __importDefault(require("http-status"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const mailtrap_service_1 = require("../../shared/mailtrap.service");
const ApiError_1 = __importDefault(require("../../../error/ApiError"));
exports.UserService = {
    // ========== GET USER PROFILE ==========
    // src/modules/user/user.service.ts
    getUserProfile(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield prisma_1.prisma.user.findUnique({
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
                                    industryType: true,
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
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "User not found");
            }
            // Transform the response to include subscription in vendorProfile
            const transformedUser = Object.assign(Object.assign({}, user), { vendorProfile: user.vendorProfile ? Object.assign(Object.assign({}, user.vendorProfile), { subscription: user.subscription }) : undefined });
            return transformedUser;
        });
    },
    // ========== UPDATE USER PROFILE ==========
    updateUserProfile(userId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield prisma_1.prisma.user.findUnique({
                where: { id: userId },
                include: {
                    vendorProfile: true,
                    supplierProfile: true,
                },
            });
            if (!user)
                throw new ApiError_1.default(404, "User not found");
            const updateData = {};
            // ===== USER TABLE =====
            if (data.profileImage)
                updateData.profileImage = data.profileImage;
            if (data.contactNumber)
                updateData.phoneNumber = data.contactNumber;
            // ===== VENDOR =====
            if (user.role === "VENDOR") {
                updateData.vendorProfile = {
                    update: Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, (data.firstName && { firstName: data.firstName })), (data.lastName && { lastName: data.lastName })), (data.companyName && { companyName: data.companyName })), (data.contactNumber && { contactNumber: data.contactNumber })), (data.industryType && { industryType: data.industryType })), (data.companyLogo && { companyLogo: data.companyLogo })),
                };
            }
            // ===== SUPPLIER =====
            if (user.role === "SUPPLIER") {
                updateData.supplierProfile = {
                    update: Object.assign(Object.assign({}, (data.firstName && { contactPerson: data.firstName })), (data.contactNumber && { phone: data.contactNumber })),
                };
            }
            return prisma_1.prisma.user.update({
                where: { id: userId },
                data: updateData,
                include: {
                    vendorProfile: true,
                    supplierProfile: true,
                },
            });
        });
    },
    // ========== UPDATE PASSWORD ==========
    updatePassword(userId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield prisma_1.prisma.user.findUnique({
                where: { id: userId }
            });
            if (!user) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "User not found");
            }
            // Verify current password
            const isPasswordValid = yield bcryptjs_1.default.compare(data.currentPassword, user.password);
            if (!isPasswordValid) {
                throw new ApiError_1.default(http_status_1.default.UNAUTHORIZED, "Current password is incorrect");
            }
            // Hash new password
            const hashPassword = yield bcryptjs_1.default.hash(data.newPassword, 10);
            yield prisma_1.prisma.user.update({
                where: { id: userId },
                data: {
                    password: hashPassword,
                    needPasswordChange: false
                }
            });
            // Create activity log
            yield prisma_1.prisma.activityLog.create({
                data: {
                    userId,
                    action: "UPDATE_PASSWORD",
                    entityType: "USER",
                    entityId: userId
                }
            });
            // Send notification email
            try {
                yield mailtrap_service_1.mailtrapService.sendHtmlEmail({
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
            }
            catch (error) {
                console.error("Failed to send password update email:", error);
            }
            return {
                message: "Password updated successfully"
            };
        });
    },
    // ========== GET NOTIFICATION PREFERENCES ==========
    getNotificationPreferences(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const preferences = yield prisma_1.prisma.notificationPreferences.findUnique({
                where: { userId }
            });
            if (!preferences) {
                // Create default preferences if not exists
                return prisma_1.prisma.notificationPreferences.create({
                    data: { userId }
                });
            }
            return preferences;
        });
    },
    // ========== UPDATE NOTIFICATION PREFERENCES ==========
    updateNotificationPreferences(userId, payload) {
        return __awaiter(this, void 0, void 0, function* () {
            const cleanData = {};
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
            const updatedPreferences = yield prisma_1.prisma.notificationPreferences.upsert({
                where: { userId },
                create: Object.assign({ userId }, cleanData),
                update: Object.assign({}, cleanData),
            });
            // ✅ CONSOLE UPDATED DATA
            console.log("Notification preferences updated:", updatedPreferences);
            return updatedPreferences;
        });
    },
    // ========== GET ACTIVITY LOGS ==========
    getActivityLogs(userId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, options = {}) {
            const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = options;
            const skip = (page - 1) * limit;
            const [logs, total] = yield Promise.all([
                prisma_1.prisma.activityLog.findMany({
                    where: { userId },
                    orderBy: { [sortBy]: sortOrder },
                    skip,
                    take: limit
                }),
                prisma_1.prisma.activityLog.count({
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
        });
    },
    // ========== SEARCH FUNCTIONALITY ==========
    search(query, userId, userRole) {
        return __awaiter(this, void 0, void 0, function* () {
            const searchConditions = [];
            if (userRole === 'VENDOR') {
                // Vendors can search their suppliers
                const vendor = yield prisma_1.prisma.vendor.findUnique({
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
            }
            else if (userRole === 'SUPPLIER') {
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
            const assessments = yield prisma_1.prisma.assessment.findMany({
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
            const problems = yield prisma_1.prisma.problem.findMany({
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
            const documents = yield prisma_1.prisma.document.findMany({
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
        });
    },
};
