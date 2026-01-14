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
exports.NotificationService = void 0;
const prisma_1 = require("../../shared/prisma");
const http_status_1 = __importDefault(require("http-status"));
const mailtrap_service_1 = require("../../shared/mailtrap.service");
const ApiError_1 = __importDefault(require("../../../error/ApiError"));
exports.NotificationService = {
    // ========== GET NOTIFICATIONS (ROLE-BASED) ==========
    // async getNotifications(
    //   userId: string,
    //   options: any = {}
    // ): Promise<{ notifications: any[]; meta: any }> {
    //   const {
    //     page = 1,
    //     limit = 20,
    //     isRead,
    //     type,
    //     priority,
    //     sortBy = 'createdAt',
    //     sortOrder = 'desc'
    //   } = options;
    //   const skip = (page - 1) * limit;
    //   // First, get user details to determine role and associated entities
    //   const user = await prisma.user.findUnique({
    //     where: { id: userId },
    //     select: {
    //       id: true,
    //       role: true,
    //       vendorId: true,
    //       supplierId: true,
    //       email: true
    //     }
    //   });
    //   if (!user) {
    //     throw new ApiError(httpStatus.NOT_FOUND, "User not found");
    //   }
    //   // Build base where clause
    //   const where: any = {
    //     isDeleted: false
    //   };
    //   // Role-based notification filtering
    //   switch (user.role) {
    //     case 'ADMIN':
    //       // Admin sees all notifications (no additional filtering)
    //       break;
    //     case 'VENDOR':
    //       // Vendor sees notifications:
    //       // 1. Sent directly to them (userId = userId)
    //       // 2. Related to their suppliers
    //       // 3. Related to their vendor profile
    //       if (user.vendorId) {
    //         // Get vendor's suppliers
    //         const vendorSuppliers = await prisma.supplier.findMany({
    //           where: { vendorId: user.vendorId },
    //           select: { id: true, userId: true }
    //         });
    //         const supplierUserIds = vendorSuppliers
    //           .map(s => s.userId)
    //           .filter(Boolean) as string[];
    //         where.OR = [
    //           // Notifications sent directly to vendor
    //           { userId: user.id },
    //           // Notifications sent to vendor's suppliers
    //           ...(supplierUserIds.length > 0 ? [{ userId: { in: supplierUserIds } }] : []),
    //           // Vendor-specific notifications (via metadata)
    //           {
    //             metadata: {
    //               path: ['vendorId'],
    //               equals: user.vendorId
    //             }
    //           },
    //           {
    //             metadata: {
    //               path: ['receiverVendorId'],
    //               equals: user.vendorId
    //             }
    //           }
    //         ];
    //       } else {
    //         // Vendor without profile - only their own notifications
    //         where.userId = user.id;
    //       }
    //       break;
    //     case 'SUPPLIER':
    //       // Supplier sees:
    //       // 1. Notifications sent directly to them
    //       // 2. Notifications related to their supplier profile
    //       // 3. Notifications from their vendor
    //       if (user.supplierId) {
    //         // Get supplier's vendor
    //         const supplier = await prisma.supplier.findUnique({
    //           where: { id: user.supplierId },
    //           select: { vendorId: true }
    //         });
    //         if (supplier) {
    //           // Get vendor's user ID
    //           const vendor = await prisma.vendor.findUnique({
    //             where: { id: supplier.vendorId },
    //             select: { userId: true }
    //           });
    //           where.OR = [
    //             // Notifications sent directly to supplier
    //             { userId: user.id },
    //             // Vendor's notifications that might be relevant to supplier
    //             ...(vendor ? [{ userId: vendor.userId }] : []),
    //             // Supplier-specific notifications (via metadata)
    //             {
    //               metadata: {
    //                 path: ['supplierId'],
    //                 equals: user.supplierId
    //               }
    //             },
    //             {
    //               metadata: {
    //                 path: ['receiverSupplierId'],
    //                 equals: user.supplierId
    //               }
    //             }
    //           ];
    //         } 
    //       } else {
    //         where.userId = user.id;
    //       }
    //       break;
    //     default:
    //       where.userId = user.id;
    //   }
    //   // Apply additional filters
    //   if (isRead !== undefined) {
    //     where.isRead = isRead === 'true';
    //   }
    //   if (type) {
    //     where.type = type;
    //   }
    //   if (priority) {
    //     where.priority = priority;
    //   }
    //   // Ensure we have at least one condition
    //   if (!where.userId && !where.OR) {
    //     where.userId = user.id;
    //   }
    //   try {
    //     const [notifications, total] = await Promise.all([
    //       prisma.notification.findMany({
    //         where,
    //         orderBy: { [sortBy]: sortOrder },
    //         skip,
    //         take: limit,
    //         include: {
    //           user: {
    //             select: {
    //               id: true,
    //               email: true,
    //               role: true,
    //               vendorProfile: {
    //                 select: {
    //                   id: true,
    //                   companyName: true
    //                 }
    //               },
    //               supplierProfile: {
    //                 select: {
    //                   id: true,
    //                   name: true
    //                 }
    //               }
    //             }
    //           }
    //         }
    //       }),
    //       prisma.notification.count({ where })
    //     ]);
    //     // Transform and filter notifications
    //     const transformedNotifications = await Promise.all(
    //       notifications.map(async (notification) => {
    //         const notificationMetadata = notification.metadata as any;
    //         // Check if user should see this notification
    //         let shouldShow = false;
    //         // Always show notifications sent directly to user
    //         if (notification.userId === user.id) {
    //           shouldShow = true;
    //         } else {
    //           // Check role-based visibility
    //           switch (user.role) {
    //             case 'ADMIN':
    //               shouldShow = true;
    //               break;
    //             case 'VENDOR':
    //               if (user.vendorId) {
    //                 // Check if notification is related to vendor's suppliers
    //                 if (notificationMetadata?.supplierId) {
    //                   const supplier = await prisma.supplier.findFirst({
    //                     where: {
    //                       id: notificationMetadata.supplierId,
    //                       vendorId: user.vendorId
    //                     }
    //                   });
    //                   shouldShow = !!supplier;
    //                 }
    //                 // Check if notification is vendor-specific
    //                 if (notificationMetadata?.vendorId === user.vendorId) {
    //                   shouldShow = true;
    //                 }
    //                 // Check if notification is from vendor's suppliers
    //                 if (notification.user?.supplierProfile?.id) {
    //                   const supplier = await prisma.supplier.findFirst({
    //                     where: {
    //                       id: notification.user.supplierProfile.id,
    //                       vendorId: user.vendorId
    //                     }
    //                   });
    //                   shouldShow = !!supplier;
    //                 }
    //               }
    //               break;
    //             case 'SUPPLIER':
    //               if (user.supplierId) {
    //                 // Check if notification is supplier-specific
    //                 if (notificationMetadata?.supplierId === user.supplierId) {
    //                   shouldShow = true;
    //                 }
    //                 // Check if notification is from vendor to this supplier
    //                 if (notificationMetadata?.receiverSupplierId === user.supplierId) {
    //                   shouldShow = true;
    //                 }
    //                 // Check if notification is from supplier's vendor
    //                 if (notification.user?.vendorProfile?.id) {
    //                   const supplier = await prisma.supplier.findUnique({
    //                     where: { id: user.supplierId },
    //                     select: { vendorId: true }
    //                   });
    //                   if (supplier && notification.user.vendorProfile.id === supplier.vendorId) {
    //                     shouldShow = true;
    //                   }
    //                 }
    //               }
    //               break;
    //           }
    //         }
    //         if (!shouldShow) {
    //           return null;
    //         }
    //         // Build transformed notification object
    //         const transformed: any = {
    //           id: notification.id,
    //           userId: notification.userId,
    //           title: notification.title,
    //           message: notification.message,
    //           type: notification.type,
    //           metadata: notification.metadata,
    //           isRead: notification.isRead,
    //           isDeleted: notification.isDeleted,
    //           priority: notification.priority,
    //           createdAt: notification.createdAt,
    //           updatedAt: notification.updatedAt,
    //           sender: {
    //             id: notification.user?.id,
    //             email: notification.user?.email,
    //             role: notification.user?.role,
    //             name: notification.user?.role === 'VENDOR'
    //               ? notification.user?.vendorProfile?.companyName
    //               : notification.user?.role === 'SUPPLIER'
    //                 ? notification.user?.supplierProfile?.name
    //                 : 'Admin'
    //           }
    //         };
    //         // Add recipient info for vendor notifications to suppliers
    //         if (user.role === 'VENDOR' && notificationMetadata?.supplierId) {
    //           const supplier = await prisma.supplier.findUnique({
    //             where: { id: notificationMetadata.supplierId },
    //             select: { name: true, email: true }
    //           });
    //           if (supplier) {
    //             transformed.recipient = {
    //               type: 'SUPPLIER',
    //               name: supplier.name,
    //               email: supplier.email
    //             };
    //           }
    //         }
    //         // Add recipient info for supplier notifications to vendor
    //         if (user.role === 'SUPPLIER' && notificationMetadata?.vendorId) {
    //           const vendor = await prisma.vendor.findUnique({
    //             where: { id: notificationMetadata.vendorId },
    //             select: { companyName: true, businessEmail: true }
    //           });
    //           if (vendor) {
    //             transformed.recipient = {
    //               type: 'VENDOR',
    //               name: vendor.companyName,
    //               email: vendor.businessEmail
    //             };
    //           }
    //         }
    //         return transformed;
    //       })
    //     );
    //     // Filter out null notifications
    //     const validNotifications = transformedNotifications.filter(n => n !== null);
    //     return {
    //       notifications: validNotifications,
    //       meta: {
    //         page,
    //         limit,
    //         total: validNotifications.length,
    //         pages: Math.ceil(validNotifications.length / limit)
    //       }
    //     };
    //   } catch (error) {
    //     console.error('Error fetching notifications:', error);
    //     throw new ApiError(
    //       httpStatus.INTERNAL_SERVER_ERROR,
    //       'Failed to fetch notifications'
    //     );
    //   }
    // },
    getNotifications(userId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, options = {}) {
            const { page = 1, limit = 20, isRead, type, priority, sortBy = 'createdAt', sortOrder = 'desc' } = options;
            const skip = (page - 1) * limit;
            // Verify user exists
            const user = yield prisma_1.prisma.user.findUnique({
                where: { id: userId },
                select: { id: true }
            });
            if (!user) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "User not found");
            }
            // SIMPLE: Only get notifications where userId matches
            const where = {
                userId: userId, // CRITICAL: Only this user's notifications
                isDeleted: false
            };
            // Apply additional filters
            if (isRead !== undefined) {
                where.isRead = isRead === 'true';
            }
            if (type) {
                where.type = type;
            }
            if (priority) {
                where.priority = priority;
            }
            try {
                const [notifications, total] = yield Promise.all([
                    prisma_1.prisma.notification.findMany({
                        where,
                        orderBy: { [sortBy]: sortOrder },
                        skip,
                        take: limit,
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    email: true,
                                    role: true,
                                    vendorProfile: {
                                        select: {
                                            id: true,
                                            companyName: true
                                        }
                                    },
                                    supplierProfile: {
                                        select: {
                                            id: true,
                                            name: true
                                        }
                                    }
                                }
                            }
                        }
                    }),
                    prisma_1.prisma.notification.count({ where })
                ]);
                // Transform notifications
                const transformedNotifications = notifications.map((notification) => {
                    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
                    const notificationMetadata = notification.metadata;
                    const transformed = {
                        id: notification.id,
                        userId: notification.userId,
                        title: notification.title,
                        message: notification.message,
                        type: notification.type,
                        metadata: notification.metadata,
                        isRead: notification.isRead,
                        isDeleted: notification.isDeleted,
                        priority: notification.priority,
                        createdAt: notification.createdAt,
                        updatedAt: notification.updatedAt,
                        sender: {
                            id: (_a = notification.user) === null || _a === void 0 ? void 0 : _a.id,
                            email: (_b = notification.user) === null || _b === void 0 ? void 0 : _b.email,
                            role: (_c = notification.user) === null || _c === void 0 ? void 0 : _c.role,
                            name: ((_d = notification.user) === null || _d === void 0 ? void 0 : _d.role) === 'VENDOR'
                                ? (_f = (_e = notification.user) === null || _e === void 0 ? void 0 : _e.vendorProfile) === null || _f === void 0 ? void 0 : _f.companyName
                                : ((_g = notification.user) === null || _g === void 0 ? void 0 : _g.role) === 'SUPPLIER'
                                    ? (_j = (_h = notification.user) === null || _h === void 0 ? void 0 : _h.supplierProfile) === null || _j === void 0 ? void 0 : _j.name
                                    : ((_k = notification.user) === null || _k === void 0 ? void 0 : _k.email) || 'System'
                        }
                    };
                    // Optional: Add context info based on metadata
                    if (notificationMetadata === null || notificationMetadata === void 0 ? void 0 : notificationMetadata.supplierId) {
                        transformed.supplierContext = {
                            id: notificationMetadata.supplierId,
                            name: notificationMetadata.supplierName
                        };
                    }
                    if (notificationMetadata === null || notificationMetadata === void 0 ? void 0 : notificationMetadata.vendorId) {
                        transformed.vendorContext = {
                            id: notificationMetadata.vendorId,
                            name: notificationMetadata.vendorName || notificationMetadata.vendorCompanyName
                        };
                    }
                    return transformed;
                });
                return {
                    notifications: transformedNotifications,
                    meta: {
                        page,
                        limit,
                        total,
                        pages: Math.ceil(total / limit)
                    }
                };
            }
            catch (error) {
                console.error('Error fetching notifications:', error);
                throw new ApiError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, 'Failed to fetch notifications');
            }
        });
    },
    // ========== GET NOTIFICATION STATS (Updated for role-based) ==========
    getNotificationStats(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            // Get user details
            const user = yield prisma_1.prisma.user.findUnique({
                where: { id: userId },
                select: { role: true, vendorId: true, supplierId: true }
            });
            if (!user) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "User not found");
            }
            // Build where clause based on role
            const where = { isDeleted: false };
            switch (user.role) {
                case 'ADMIN':
                    // Admin sees all
                    break;
                case 'VENDOR':
                    if (user.vendorId) {
                        // Get vendor's suppliers' user IDs
                        const vendorSuppliers = yield prisma_1.prisma.supplier.findMany({
                            where: { vendorId: user.vendorId },
                            select: { userId: true }
                        });
                        const supplierUserIds = vendorSuppliers
                            .map(s => s.userId)
                            .filter(Boolean);
                        where.OR = [
                            { userId: userId },
                            { userId: { in: supplierUserIds } },
                            {
                                metadata: {
                                    path: ['vendorId'],
                                    equals: user.vendorId
                                }
                            },
                            {
                                metadata: {
                                    path: ['receiverVendorId'],
                                    equals: user.vendorId
                                }
                            }
                        ];
                    }
                    else {
                        where.userId = userId;
                    }
                    break;
                case 'SUPPLIER':
                    if (user.supplierId) {
                        // Get supplier's vendor
                        const supplier = yield prisma_1.prisma.supplier.findUnique({
                            where: { id: user.supplierId },
                            select: { vendorId: true }
                        });
                        if (supplier) {
                            const vendor = yield prisma_1.prisma.vendor.findUnique({
                                where: { id: supplier.vendorId },
                                select: { userId: true }
                            });
                            where.OR = [
                                { userId: userId },
                                ...(vendor ? [{ userId: vendor.userId }] : []),
                                {
                                    metadata: {
                                        path: ['supplierId'],
                                        equals: user.supplierId
                                    }
                                },
                                {
                                    metadata: {
                                        path: ['receiverSupplierId'],
                                        equals: user.supplierId
                                    }
                                }
                            ];
                        }
                        else {
                            where.userId = userId;
                        }
                    }
                    else {
                        where.userId = userId;
                    }
                    break;
                default:
                    where.userId = userId;
            }
            const [total, unread, byType, byPriority] = yield Promise.all([
                prisma_1.prisma.notification.count({ where }),
                prisma_1.prisma.notification.count({
                    where: Object.assign(Object.assign({}, where), { isRead: false })
                }),
                prisma_1.prisma.notification.groupBy({
                    by: ['type'],
                    where,
                    _count: true
                }),
                prisma_1.prisma.notification.groupBy({
                    by: ['priority'],
                    where,
                    _count: true
                })
            ]);
            const typeStats = {};
            byType.forEach(item => {
                typeStats[item.type] = item._count;
            });
            const priorityStats = {
                low: ((_a = byPriority.find(p => p.priority === 'LOW')) === null || _a === void 0 ? void 0 : _a._count) || 0,
                medium: ((_b = byPriority.find(p => p.priority === 'MEDIUM')) === null || _b === void 0 ? void 0 : _b._count) || 0,
                high: ((_c = byPriority.find(p => p.priority === 'HIGH')) === null || _c === void 0 ? void 0 : _c._count) || 0
            };
            return {
                total,
                unread,
                byType: typeStats,
                byPriority: priorityStats
            };
        });
    },
    // ========== HELPER METHOD: BUILD ROLE-BASED WHERE CLAUSE ==========
    // async buildRoleBasedWhereClause(userId: string): Promise<any> {
    //   const user = await prisma.user.findUnique({
    //     where: { id: userId },
    //     select: { role: true, vendorId: true, supplierId: true }
    //   });
    //   if (!user) {
    //     return { userId };
    //   }
    //   const where: any = { isDeleted: false };
    //   switch (user.role) {
    //     case 'ADMIN':
    //       // Admin can see all - no additional filtering
    //       break;
    //     case 'VENDOR':
    //       if (user.vendorId) {
    //         const vendorSuppliers = await prisma.supplier.findMany({
    //           where: { vendorId: user.vendorId },
    //           select: { userId: true }
    //         });
    //         const supplierUserIds = vendorSuppliers
    //           .map(s => s.userId)
    //           .filter(Boolean) as string[];
    //         where.OR = [
    //           { userId: userId },
    //           { userId: { in: supplierUserIds } },
    //           {
    //             metadata: {
    //               path: ['vendorId'],
    //               equals: user.vendorId
    //             }
    //           },
    //           {
    //             metadata: {
    //               path: ['receiverVendorId'],
    //               equals: user.vendorId
    //             }
    //           }
    //         ];
    //       } else {
    //         where.userId = userId;
    //       }
    //       break;
    //     case 'SUPPLIER':
    //       if (user.supplierId) {
    //         const supplier = await prisma.supplier.findUnique({
    //           where: { id: user.supplierId },
    //           select: { vendorId: true }
    //         });
    //         if (supplier) {
    //           const vendor = await prisma.vendor.findUnique({
    //             where: { id: supplier.vendorId },
    //             select: { userId: true }
    //           });
    //           where.OR = [
    //             { userId: userId },
    //             ...(vendor ? [{ userId: vendor.userId }] : []),
    //             {
    //               metadata: {
    //                 path: ['supplierId'],
    //                 equals: user.supplierId
    //               }
    //             },
    //             {
    //               metadata: {
    //                 path: ['receiverSupplierId'],
    //                 equals: user.supplierId
    //               }
    //             }
    //           ];
    //         } else {
    //           where.userId = userId;
    //         }
    //       } else {
    //         where.userId = userId;
    //       }
    //       break;
    //     default:
    //       where.userId = userId;
    //   }
    //   return where;
    // },
    buildRoleBasedWhereClause(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield prisma_1.prisma.user.findUnique({
                where: { id: userId },
                select: { role: true, vendorId: true, supplierId: true }
            });
            if (!user) {
                return { userId, isDeleted: false };
            }
            const baseWhere = { isDeleted: false };
            switch (user.role) {
                case 'ADMIN':
                    // Admin sees only their own notifications
                    return Object.assign(Object.assign({}, baseWhere), { userId });
                case 'VENDOR': {
                    if (!user.vendorId) {
                        return Object.assign(Object.assign({}, baseWhere), { userId });
                    }
                    const suppliers = yield prisma_1.prisma.supplier.findMany({
                        where: { vendorId: user.vendorId },
                        select: { userId: true }
                    });
                    const supplierUserIds = suppliers
                        .map(s => s.userId)
                        .filter(Boolean);
                    return Object.assign(Object.assign({}, baseWhere), { OR: [
                            { userId },
                        ] });
                }
                case 'SUPPLIER': {
                    if (!user.supplierId) {
                        return Object.assign(Object.assign({}, baseWhere), { userId });
                    }
                    return Object.assign(Object.assign({}, baseWhere), { OR: [
                            { userId }
                        ] });
                }
                default:
                    return Object.assign(Object.assign({}, baseWhere), { userId });
            }
        });
    },
    // async createNotification(data: any): Promise<Notification | null> {
    //   const targetUser = await prisma.user.findUnique({
    //     where: { id: data.userId },
    //     select: { id: true, email: true, role: true }
    //   });
    //   if (!targetUser) {
    //     throw new ApiError(httpStatus.NOT_FOUND, "Target user not found");
    //   }
    //   let preferences = await prisma.notificationPreferences.findUnique({
    //     where: { userId: data.userId }
    //   });
    //   // Create default preferences if not exist
    //   if (!preferences) {
    //     preferences = await prisma.notificationPreferences.create({
    //       data: { userId: data.userId }
    //     });
    //   }
    //   // Check notification type preference
    //   const allowNotification = this.shouldSendNotificationForType(
    //     data.type,
    //     preferences
    //   );
    //   if (!allowNotification) {
    //     console.log(`Notification type ${data.type} disabled for user ${data.userId}`);
    //     return null;
    //   }
    //   // Create notification (DB)
    //   const notification = await prisma.notification.create({
    //     data: {
    //       userId: data.userId,
    //       title: data.title,
    //       message: data.message,
    //       type: data.type,
    //       metadata: data.metadata || {},
    //       priority: data.priority || "MEDIUM"
    //     },
    //     include: {
    //       user: {
    //         select: {
    //           id: true,
    //           email: true,
    //           role: true
    //         }
    //       }
    //     }
    //   });
    //   // Email disabled globally
    //   if (!preferences.emailNotifications) {
    //     return notification;
    //   }
    //   // Quiet hours check
    //   if (this.isInQuietHours(preferences)) {
    //     console.log(`Quiet hours active for user ${data.userId}`);
    //     return notification;
    //   }
    //   // Send email
    //   try {
    //     await mailtrapService.sendHtmlEmail({
    //       to: targetUser.email,
    //       subject: data.title,
    //       html: this.generateEmailTemplate(data, targetUser)
    //     });
    //   } catch (error) {
    //     console.error("Failed to send notification email:", error);
    //   }
    //   return notification;
    // }
    createNotification(data) {
        return __awaiter(this, void 0, void 0, function* () {
            const targetUser = yield prisma_1.prisma.user.findUnique({
                where: { id: data.userId },
                select: { id: true, email: true }
            });
            if (!targetUser || !targetUser.email) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "Target user not found or email missing");
            }
            // ===============================
            // GET / CREATE PREFERENCES
            // ===============================
            let preferences = yield prisma_1.prisma.notificationPreferences.findUnique({
                where: { userId: data.userId }
            });
            if (!preferences) {
                preferences = yield prisma_1.prisma.notificationPreferences.create({
                    data: {
                        userId: data.userId,
                        emailNotifications: true // ✅ DEFAULT ENABLED
                    }
                });
            }
            // ===============================
            // 1️⃣ DB NOTIFICATION (TYPE BASED)
            // ===============================
            const allowDbNotification = this.shouldSendNotificationForType(data.type, preferences);
            let notification = null;
            if (allowDbNotification) {
                notification = yield prisma_1.prisma.notification.create({
                    data: {
                        userId: data.userId,
                        title: data.title,
                        message: data.message,
                        type: data.type,
                        metadata: data.metadata || {},
                        priority: data.priority || "MEDIUM"
                    }
                });
            }
            else {
                console.log(`[DB Notification Skipped] type=${data.type}, user=${data.userId}`);
            }
            // ===============================
            // 2️⃣ EMAIL (GLOBAL SWITCH)
            // ===============================
            if (!preferences.emailNotifications) {
                console.log(`[Email Disabled by User] user=${data.userId}`);
                return notification;
            }
            // if (this.isInQuietHours(preferences)) {
            //   console.log(`[Email Blocked by Quiet Hours] user=${data.userId}`);
            //   return notification;
            // }
            // ===============================
            // 3️⃣ SEND EMAIL
            // ===============================
            try {
                yield mailtrap_service_1.mailtrapService.sendHtmlEmail({
                    to: targetUser.email,
                    subject: data.title,
                    html: this.generateEmailTemplate(data, targetUser)
                });
                console.log(`[Email Sent] to=${targetUser.email}, type=${data.type}`);
            }
            catch (error) {
                console.error(`[Email Failed]`, error);
            }
            return notification;
        });
    },
    // Helper method to check if specific notification type should be sent
    shouldSendNotificationForType(type, preferences) {
        switch (type) {
            case 'RISK_ALERT':
                return preferences.riskAlerts;
            case 'CONTRACT_EXPIRY':
                return preferences.contractReminders;
            case 'CONTRACT_EXPIRING_SOON':
                return preferences.contractReminders;
            case 'ASSESSMENT_DUE':
                return preferences.assessmentReminders; //ok
            case 'ASSESSMENT_SUBMITTED':
                return preferences.assessmentReminders; //ok
            case 'ASSESSMENT_APPROVED':
                return preferences.assessmentReminders; //ok
            case 'ASSESSMENT_REJECTED':
                return preferences.assessmentReminders;
            case 'PROBLEM_REPORTED':
                return preferences.problemAlerts;
            case 'PROBLEM_UPDATED':
                return preferences.problemAlerts;
            case 'PROBLEM_RESOLVED':
                return preferences.problemAlerts;
            case 'SLA_BREACHED':
                return preferences.problemAlerts;
            case 'REPORT_GENERATED':
                return preferences.reportAlerts;
            case 'PAYMENT_SUCCESS':
                return preferences.paymentAlerts;
            case 'PAYMENT_FAILED':
                return preferences.paymentAlerts;
            case 'EVIDENCE_REQUESTED':
            case 'EVIDENCE_APPROVED':
            case 'EVIDENCE_REJECTED':
                return preferences.paymentAlerts;
            case 'INVITATION_SENT':
            case 'INVITATION_ACCEPTED':
            case 'SYSTEM_ALERT':
                return preferences.systemAlerts;
            default:
                return true;
        }
    },
    // Helper method to check if current time is in quiet hours
    isInQuietHours(preferences) {
        if (!preferences.quietHoursStart || !preferences.quietHoursEnd) {
            return false;
        }
        const now = new Date();
        const currentHour = now.getHours();
        const start = preferences.quietHoursStart;
        const end = preferences.quietHoursEnd;
        if (start <= end) {
            // Quiet hours don't cross midnight (e.g., 22:00 to 08:00)
            return currentHour >= start && currentHour < end;
        }
        else {
            // Quiet hours cross midnight (e.g., 22:00 to 08:00)
            return currentHour >= start || currentHour < end;
        }
    },
    // Helper method to generate email template
    generateEmailTemplate(data, user) {
        // let actionButton = '';
        // Add appropriate action buttons based on notification type
        // if (data.metadata) {
        //   if (data.metadata.assessmentId) {
        //     actionButton = `
        //       <div style="text-align: center; margin: 30px 0;">
        //         <a href="${process.env.FRONTEND_URL}/assessments/${data.metadata.assessmentId}" 
        //            style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
        //           View Assessment
        //         </a>
        //       </div>
        //     `;
        //   } else if (data.metadata.problemId) {
        //     actionButton = `
        //       <div style="text-align: center; margin: 30px 0;">
        //         <a href="${process.env.FRONTEND_URL}/problems/${data.metadata.problemId}" 
        //            style="background-color: #dc3545; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
        //           View Problem
        //         </a>
        //       </div>
        //     `;
        //   } else if (data.metadata.reportId) {
        //     actionButton = `
        //       <div style="text-align: center; margin: 30px 0;">
        //         <a href="${process.env.FRONTEND_URL}/reports/${data.metadata.reportId}" 
        //            style="background-color: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
        //           View Report
        //         </a>
        //       </div>
        //     `;
        //   }
        // }
        return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
        <h2 style="color: #333; margin: 0;">${data.title}</h2>
      </div>
      
      <div style="color: #666; line-height: 1.6;">
        <p>Hello ${user.role === 'VENDOR' ? 'Vendor' : user.role === 'SUPPLIER' ? 'Supplier' : 'User'},</p>
        <p>${data.message}</p>
        
        ${data.metadata ? `
          <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #007bff;">
            <h3 style="margin-top: 0; color: #555;">Details:</h3>
            ${Object.entries(data.metadata).map(([key, value]) => `
              <p style="margin: 8px 0;">
                <strong style="color: #333;">${this.formatKey(key)}:</strong> 
                <span style="color: #666;">${this.formatValue(value)}</span>
              </p>
            `).join('')}
          </div>
        ` : ''}
      </div>
        
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #888;">
        <p>
          <strong>Note:</strong> You can manage your notification preferences in your account settings.
        </p>
        <p>
          <a href="${process.env.FRONTEND_URL}/settings/notifications" style="color: #007bff; text-decoration: none;">
            Manage Notification Preferences
          </a>
        </p>
        <p style="margin-top: 20px;">
          © ${new Date().getFullYear()} CyberNark. All rights reserved.<br>
          This is an automated message, please do not reply.
        </p>
      </div>
    </div>
  `;
    },
    // Helper method to format metadata keys
    formatKey(key) {
        return key
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase())
            .replace(/_/g, ' ');
    },
    // Helper method to format metadata values
    formatValue(value) {
        if (value === null || value === undefined)
            return 'N/A';
        if (typeof value === 'object')
            return JSON.stringify(value);
        if (typeof value === 'string' && value.includes('http')) {
            return `<a href="${value}" style="color: #007bff;">View</a>`;
        }
        return String(value);
    },
    // ========== CREATE SYSTEM NOTIFICATION (Enhanced with preference checking) ==========
    // async createSystemNotification(
    //   userIds: string[],
    //   title: string,
    //   message: string,
    //   type: NotificationType,
    //   metadata?: any,
    //   priority?: 'LOW' | 'MEDIUM' | 'HIGH'
    // ): Promise<Notification[]> {
    //   const notifications: Notification[] = [];
    //   for (const userId of userIds) {
    //     try {
    //       const notification = await this.createNotification({
    //         userId,
    //         title,
    //         message,
    //         type,
    //         metadata: metadata || {},
    //         priority: priority || 'MEDIUM'
    //       });
    //       notifications.push(notification);
    //     } catch (error) {
    //       console.error(`Failed to create notification for user ${userId}:`, error);
    //       // Continue with other users even if one fails
    //     }
    //   }
    //   return notifications;
    // }
    // ========== BULK CREATE NOTIFICATIONS WITH PREFERENCE CHECK ==========
    // async bulkCreateNotifications(
    //   notificationsData: Array<{
    //     userId: string;
    //     title: string;
    //     message: string;
    //     type: NotificationType;
    //     metadata?: any;
    //     priority?: 'LOW' | 'MEDIUM' | 'HIGH';
    //   }>
    // ): Promise<{ created: number; failed: number; notifications: Notification[] }> {
    //   let created = 0;
    //   let failed = 0;
    //   const notifications: Notification[] = [];
    //   for (const data of notificationsData) {
    //     try {
    //       const notification = await this.createNotification(data);
    //       notifications.push(notification);
    //       created++;
    //     } catch (error) {
    //       console.error(`Failed to create notification for user ${data.userId}:`, error);
    //       failed++;
    //     }
    //   }
    //   return {
    //     created,
    //     failed,
    //     notifications
    //   };
    // },
    // ========== CREATE SYSTEM NOTIFICATION (Enhanced) ==========
    createSystemNotification(userIds, title, message, type, metadata, priority) {
        return __awaiter(this, void 0, void 0, function* () {
            // Validate all users exist
            const users = yield prisma_1.prisma.user.findMany({
                where: { id: { in: userIds } },
                select: { id: true, email: true }
            });
            if (users.length !== userIds.length) {
                throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, "One or more target users not found");
            }
            const notifications = yield Promise.all(users.map(user => prisma_1.prisma.notification.create({
                data: {
                    userId: user.id,
                    title,
                    message,
                    type,
                    metadata: metadata || {},
                    priority: priority || 'MEDIUM'
                }
            })));
            // Send email notifications in background
            notifications.forEach((notification, index) => __awaiter(this, void 0, void 0, function* () {
                const user = users[index];
                const preferences = yield prisma_1.prisma.notificationPreferences.findUnique({
                    where: { userId: user.id }
                });
                if (preferences === null || preferences === void 0 ? void 0 : preferences.emailNotifications) {
                    try {
                        yield mailtrap_service_1.mailtrapService.sendHtmlEmail({
                            to: user.email,
                            subject: title,
                            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #333;">${title}</h2>
                <p>${message}</p>
                ${metadata ? `
                  <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    ${Object.entries(metadata).map(([key, value]) => `
                      <p style="margin: 5px 0;"><strong>${key}:</strong> ${value}</p>
                    `).join('')}
                  </div>
                ` : ''}
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="color: #666; font-size: 12px;">
                  © ${new Date().getFullYear()} CyberNark. All rights reserved.
                </p>
              </div>
            `
                        });
                    }
                    catch (error) {
                        console.error("Failed to send system notification email:", error);
                    }
                }
            }));
            return notifications;
        });
    },
    // ========== CREATE NOTIFICATION FOR VENDOR'S SUPPLIERS ==========
    createNotificationForVendorSuppliers(vendorId, title, message, type, metadata, priority) {
        return __awaiter(this, void 0, void 0, function* () {
            // Get vendor's suppliers
            const suppliers = yield prisma_1.prisma.supplier.findMany({
                where: {
                    vendorId,
                    isActive: true,
                    isDeleted: false,
                    user: { isNot: null }
                },
                include: {
                    user: {
                        select: { id: true, email: true }
                    }
                }
            });
            const supplierUserIds = suppliers
                .map(s => { var _a; return (_a = s.user) === null || _a === void 0 ? void 0 : _a.id; })
                .filter(Boolean);
            if (supplierUserIds.length === 0) {
                return [];
            }
            // Add vendorId to metadata
            const enhancedMetadata = Object.assign(Object.assign({}, metadata), { vendorId, senderType: 'VENDOR' });
            return this.createSystemNotification(supplierUserIds, title, message, type, enhancedMetadata, priority);
        });
    },
    // ========== CREATE NOTIFICATION FOR SUPPLIER'S VENDOR ==========
    createNotificationForSupplierVendor(supplierId, title, message, type, metadata, priority) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            // Get supplier's vendor
            const supplier = yield prisma_1.prisma.supplier.findUnique({
                where: { id: supplierId },
                include: {
                    vendor: {
                        include: {
                            user: {
                                select: { id: true, email: true }
                            }
                        }
                    }
                }
            });
            if (!supplier || !((_b = (_a = supplier.vendor) === null || _a === void 0 ? void 0 : _a.user) === null || _b === void 0 ? void 0 : _b.id)) {
                return null;
            }
            // Add supplierId to metadata
            const enhancedMetadata = Object.assign(Object.assign({}, metadata), { supplierId, senderType: 'SUPPLIER' });
            const notification = yield this.createNotification({
                userId: supplier.vendor.user.id,
                title,
                message,
                type,
                metadata: enhancedMetadata,
                priority
            });
            return notification;
        });
    },
    // ========== MARK AS READ ==========
    markAsRead(userId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            let count = 0;
            // Get user's role-based notification query
            const where = yield this.buildRoleBasedWhereClause(userId);
            if (data.markAll) {
                const result = yield prisma_1.prisma.notification.updateMany({
                    where: Object.assign(Object.assign({}, where), { isRead: false, isDeleted: false }),
                    data: { isRead: true }
                });
                count = result.count;
            }
            else if (data.notificationIds && data.notificationIds.length > 0) {
                // Verify user has permission to mark these notifications
                const notifications = yield prisma_1.prisma.notification.findMany({
                    where: Object.assign(Object.assign({ id: { in: data.notificationIds } }, where), { isDeleted: false })
                });
                if (notifications.length !== data.notificationIds.length) {
                    throw new ApiError_1.default(http_status_1.default.FORBIDDEN, "You don't have permission to mark some notifications as read");
                }
                const result = yield prisma_1.prisma.notification.updateMany({
                    where: Object.assign(Object.assign({ id: { in: data.notificationIds } }, where), { isDeleted: false }),
                    data: { isRead: true }
                });
                count = result.count;
            }
            else {
                throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, "Either notificationIds or markAll must be provided");
            }
            return {
                message: `${count} notification(s) marked as read`,
                count
            };
        });
    },
    // ========== DELETE NOTIFICATIONS ==========
    deleteNotifications(userId, notificationIds) {
        return __awaiter(this, void 0, void 0, function* () {
            let count = 0;
            // Get user's role-based notification query
            const where = yield this.buildRoleBasedWhereClause(userId);
            if (notificationIds && notificationIds.length > 0) {
                // Verify user has permission to delete these notifications
                const notifications = yield prisma_1.prisma.notification.findMany({
                    where: Object.assign({ id: { in: notificationIds } }, where)
                });
                if (notifications.length !== notificationIds.length) {
                    throw new ApiError_1.default(http_status_1.default.FORBIDDEN, "You don't have permission to delete some notifications");
                }
                const result = yield prisma_1.prisma.notification.updateMany({
                    where: Object.assign({ id: { in: notificationIds } }, where),
                    data: { isDeleted: true }
                });
                count = result.count;
            }
            else {
                throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, "notificationIds must be provided");
            }
            return {
                message: `${count} notification(s) deleted`,
                count
            };
        });
    },
    // ========== GET UNREAD COUNT ==========
    getUnreadCount(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const where = yield this.buildRoleBasedWhereClause(userId);
            const count = yield prisma_1.prisma.notification.count({
                where: Object.assign(Object.assign({}, where), { isRead: false, isDeleted: false })
            });
            console.log(" find count ", count);
            return { count };
        });
    },
    // ========== CLEAR ALL NOTIFICATIONS ==========
    clearAllNotifications(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const where = yield this.buildRoleBasedWhereClause(userId);
            const result = yield prisma_1.prisma.notification.updateMany({
                where: Object.assign(Object.assign({}, where), { isDeleted: false }),
                data: { isDeleted: true }
            });
            return {
                message: "All notifications cleared",
                count: result.count
            };
        });
    },
    getTargetUsers(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield prisma_1.prisma.user.findUnique({
                where: { id: userId },
                include: {
                    vendorProfile: true,
                    supplierProfile: {
                        include: {
                            vendor: {
                                include: {
                                    user: {
                                        select: {
                                            id: true,
                                            email: true,
                                            role: true
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            });
            if (!user) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "User not found");
            }
            const targetUsers = [];
            switch (user.role) {
                case 'ADMIN':
                    // Admin can send to all users except themselves
                    const allUsers = yield prisma_1.prisma.user.findMany({
                        where: {
                            id: { not: userId },
                            status: 'ACTIVE',
                            isVerified: true
                        },
                        include: {
                            vendorProfile: {
                                select: {
                                    id: true,
                                    companyName: true
                                }
                            },
                            supplierProfile: {
                                select: {
                                    id: true,
                                    name: true
                                }
                            }
                        }
                    });
                    targetUsers.push(...allUsers.map(u => {
                        var _a, _b, _c, _d;
                        return ({
                            id: u.id,
                            email: u.email,
                            role: u.role,
                            name: u.role === 'VENDOR'
                                ? (_a = u.vendorProfile) === null || _a === void 0 ? void 0 : _a.companyName
                                : u.role === 'SUPPLIER'
                                    ? (_b = u.supplierProfile) === null || _b === void 0 ? void 0 : _b.name
                                    : 'Admin User',
                            profileId: u.role === 'VENDOR'
                                ? (_c = u.vendorProfile) === null || _c === void 0 ? void 0 : _c.id
                                : u.role === 'SUPPLIER'
                                    ? (_d = u.supplierProfile) === null || _d === void 0 ? void 0 : _d.id
                                    : null
                        });
                    }));
                    break;
                case 'VENDOR':
                    if (user.vendorProfile) {
                        // Vendor can send to:
                        // 1. Their own suppliers who have accounts
                        const suppliers = yield prisma_1.prisma.supplier.findMany({
                            where: {
                                vendorId: user.vendorProfile.id,
                                isActive: true,
                                isDeleted: false,
                                user: { isNot: null }
                            },
                            include: {
                                user: {
                                    select: {
                                        id: true,
                                        email: true,
                                        role: true
                                    }
                                }
                            }
                        });
                        targetUsers.push(...suppliers.map(s => ({
                            id: s.user.id,
                            email: s.user.email,
                            role: 'SUPPLIER',
                            name: s.name,
                            profileId: s.id,
                            additionalInfo: {
                                supplierId: s.id,
                                contactPerson: s.contactPerson,
                                phone: s.phone
                            }
                        })));
                        // 2. Other vendors (if they want to collaborate)
                        const otherVendors = yield prisma_1.prisma.vendor.findMany({
                            where: {
                                id: { not: user.vendorProfile.id },
                                isActive: true,
                                isDeleted: false,
                                user: {
                                    status: 'ACTIVE'
                                }
                            },
                            include: {
                                user: {
                                    select: {
                                        id: true,
                                        email: true,
                                        role: true
                                    }
                                }
                            }
                        });
                        targetUsers.push(...otherVendors.map(v => ({
                            id: v.userId,
                            email: v.businessEmail,
                            role: 'VENDOR',
                            name: v.companyName,
                            profileId: v.id,
                            additionalInfo: {
                                contactPerson: `${v.firstName} ${v.lastName}`,
                                businessEmail: v.businessEmail
                            }
                        })));
                    }
                    break;
                case 'SUPPLIER':
                    if (user.supplierProfile) {
                        // Supplier can send to:
                        // 1. Their vendor
                        const vendor = yield prisma_1.prisma.vendor.findUnique({
                            where: { id: user.supplierProfile.vendorId },
                            include: {
                                user: {
                                    select: {
                                        id: true,
                                        email: true,
                                        role: true
                                    }
                                }
                            }
                        });
                        if (vendor === null || vendor === void 0 ? void 0 : vendor.user) {
                            targetUsers.push({
                                id: vendor.user.id,
                                email: vendor.user.email,
                                role: 'VENDOR',
                                name: vendor.companyName,
                                profileId: vendor.id,
                                additionalInfo: {
                                    contactPerson: `${vendor.firstName} ${vendor.lastName}`,
                                    businessEmail: vendor.businessEmail
                                }
                            });
                        }
                        // 2. Other suppliers under same vendor (if they want to collaborate)
                        const otherSuppliers = yield prisma_1.prisma.supplier.findMany({
                            where: {
                                vendorId: user.supplierProfile.vendorId,
                                id: { not: user.supplierProfile.id },
                                isActive: true,
                                isDeleted: false,
                                user: {
                                    status: 'ACTIVE'
                                }
                            },
                            include: {
                                user: {
                                    select: {
                                        id: true,
                                        email: true,
                                        role: true
                                    }
                                }
                            }
                        });
                        targetUsers.push(...otherSuppliers.map(s => ({
                            id: s.user.id,
                            email: s.user.email,
                            role: 'SUPPLIER',
                            name: s.name,
                            profileId: s.id,
                            additionalInfo: {
                                contactPerson: s.contactPerson,
                                phone: s.phone
                            }
                        })));
                    }
                    break;
            }
            return targetUsers;
        });
    },
};
