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
    getNotifications(userId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, options = {}) {
            const { page = 1, limit = 20, isRead, type, priority, sortBy = 'createdAt', sortOrder = 'desc' } = options;
            const skip = (page - 1) * limit;
            // First, get user details to determine role and associated entities
            const user = yield prisma_1.prisma.user.findUnique({
                where: { id: userId },
                select: {
                    id: true,
                    role: true,
                    vendorId: true,
                    supplierId: true,
                    email: true
                }
            });
            if (!user) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "User not found");
            }
            // Build base where clause
            const where = {
                isDeleted: false
            };
            // Role-based notification filtering
            switch (user.role) {
                case 'ADMIN':
                    // Admin sees all notifications (no additional filtering)
                    break;
                case 'VENDOR':
                    // Vendor sees notifications:
                    // 1. Sent directly to them (userId = userId)
                    // 2. Related to their suppliers
                    // 3. Related to their vendor profile
                    if (user.vendorId) {
                        // Get vendor's suppliers
                        const vendorSuppliers = yield prisma_1.prisma.supplier.findMany({
                            where: { vendorId: user.vendorId },
                            select: { id: true, userId: true }
                        });
                        const supplierUserIds = vendorSuppliers
                            .map(s => s.userId)
                            .filter(Boolean);
                        where.OR = [
                            // Notifications sent directly to vendor
                            { userId: user.id },
                            // Notifications sent to vendor's suppliers
                            ...(supplierUserIds.length > 0 ? [{ userId: { in: supplierUserIds } }] : []),
                            // Vendor-specific notifications (via metadata)
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
                        // Vendor without profile - only their own notifications
                        where.userId = user.id;
                    }
                    break;
                case 'SUPPLIER':
                    // Supplier sees:
                    // 1. Notifications sent directly to them
                    // 2. Notifications related to their supplier profile
                    // 3. Notifications from their vendor
                    if (user.supplierId) {
                        // Get supplier's vendor
                        const supplier = yield prisma_1.prisma.supplier.findUnique({
                            where: { id: user.supplierId },
                            select: { vendorId: true }
                        });
                        if (supplier) {
                            // Get vendor's user ID
                            const vendor = yield prisma_1.prisma.vendor.findUnique({
                                where: { id: supplier.vendorId },
                                select: { userId: true }
                            });
                            where.OR = [
                                // Notifications sent directly to supplier
                                { userId: user.id },
                                // Vendor's notifications that might be relevant to supplier
                                ...(vendor ? [{ userId: vendor.userId }] : []),
                                // Supplier-specific notifications (via metadata)
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
                            // Supplier without vendor relationship - only their own notifications
                            where.userId = user.id;
                        }
                    }
                    else {
                        where.userId = user.id;
                    }
                    break;
                default:
                    where.userId = user.id;
            }
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
            // Ensure we have at least one condition
            if (!where.userId && !where.OR) {
                where.userId = user.id;
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
                // Transform and filter notifications
                const transformedNotifications = yield Promise.all(notifications.map((notification) => __awaiter(this, void 0, void 0, function* () {
                    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
                    const notificationMetadata = notification.metadata;
                    // Check if user should see this notification
                    let shouldShow = false;
                    // Always show notifications sent directly to user
                    if (notification.userId === user.id) {
                        shouldShow = true;
                    }
                    else {
                        // Check role-based visibility
                        switch (user.role) {
                            case 'ADMIN':
                                shouldShow = true;
                                break;
                            case 'VENDOR':
                                if (user.vendorId) {
                                    // Check if notification is related to vendor's suppliers
                                    if (notificationMetadata === null || notificationMetadata === void 0 ? void 0 : notificationMetadata.supplierId) {
                                        const supplier = yield prisma_1.prisma.supplier.findFirst({
                                            where: {
                                                id: notificationMetadata.supplierId,
                                                vendorId: user.vendorId
                                            }
                                        });
                                        shouldShow = !!supplier;
                                    }
                                    // Check if notification is vendor-specific
                                    if ((notificationMetadata === null || notificationMetadata === void 0 ? void 0 : notificationMetadata.vendorId) === user.vendorId) {
                                        shouldShow = true;
                                    }
                                    // Check if notification is from vendor's suppliers
                                    if ((_b = (_a = notification.user) === null || _a === void 0 ? void 0 : _a.supplierProfile) === null || _b === void 0 ? void 0 : _b.id) {
                                        const supplier = yield prisma_1.prisma.supplier.findFirst({
                                            where: {
                                                id: notification.user.supplierProfile.id,
                                                vendorId: user.vendorId
                                            }
                                        });
                                        shouldShow = !!supplier;
                                    }
                                }
                                break;
                            case 'SUPPLIER':
                                if (user.supplierId) {
                                    // Check if notification is supplier-specific
                                    if ((notificationMetadata === null || notificationMetadata === void 0 ? void 0 : notificationMetadata.supplierId) === user.supplierId) {
                                        shouldShow = true;
                                    }
                                    // Check if notification is from vendor to this supplier
                                    if ((notificationMetadata === null || notificationMetadata === void 0 ? void 0 : notificationMetadata.receiverSupplierId) === user.supplierId) {
                                        shouldShow = true;
                                    }
                                    // Check if notification is from supplier's vendor
                                    if ((_d = (_c = notification.user) === null || _c === void 0 ? void 0 : _c.vendorProfile) === null || _d === void 0 ? void 0 : _d.id) {
                                        const supplier = yield prisma_1.prisma.supplier.findUnique({
                                            where: { id: user.supplierId },
                                            select: { vendorId: true }
                                        });
                                        if (supplier && notification.user.vendorProfile.id === supplier.vendorId) {
                                            shouldShow = true;
                                        }
                                    }
                                }
                                break;
                        }
                    }
                    if (!shouldShow) {
                        return null;
                    }
                    // Build transformed notification object
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
                            id: (_e = notification.user) === null || _e === void 0 ? void 0 : _e.id,
                            email: (_f = notification.user) === null || _f === void 0 ? void 0 : _f.email,
                            role: (_g = notification.user) === null || _g === void 0 ? void 0 : _g.role,
                            name: ((_h = notification.user) === null || _h === void 0 ? void 0 : _h.role) === 'VENDOR'
                                ? (_k = (_j = notification.user) === null || _j === void 0 ? void 0 : _j.vendorProfile) === null || _k === void 0 ? void 0 : _k.companyName
                                : ((_l = notification.user) === null || _l === void 0 ? void 0 : _l.role) === 'SUPPLIER'
                                    ? (_o = (_m = notification.user) === null || _m === void 0 ? void 0 : _m.supplierProfile) === null || _o === void 0 ? void 0 : _o.name
                                    : 'Admin'
                        }
                    };
                    // Add recipient info for vendor notifications to suppliers
                    if (user.role === 'VENDOR' && (notificationMetadata === null || notificationMetadata === void 0 ? void 0 : notificationMetadata.supplierId)) {
                        const supplier = yield prisma_1.prisma.supplier.findUnique({
                            where: { id: notificationMetadata.supplierId },
                            select: { name: true, email: true }
                        });
                        if (supplier) {
                            transformed.recipient = {
                                type: 'SUPPLIER',
                                name: supplier.name,
                                email: supplier.email
                            };
                        }
                    }
                    // Add recipient info for supplier notifications to vendor
                    if (user.role === 'SUPPLIER' && (notificationMetadata === null || notificationMetadata === void 0 ? void 0 : notificationMetadata.vendorId)) {
                        const vendor = yield prisma_1.prisma.vendor.findUnique({
                            where: { id: notificationMetadata.vendorId },
                            select: { companyName: true, businessEmail: true }
                        });
                        if (vendor) {
                            transformed.recipient = {
                                type: 'VENDOR',
                                name: vendor.companyName,
                                email: vendor.businessEmail
                            };
                        }
                    }
                    return transformed;
                })));
                // Filter out null notifications
                const validNotifications = transformedNotifications.filter(n => n !== null);
                return {
                    notifications: validNotifications,
                    meta: {
                        page,
                        limit,
                        total: validNotifications.length,
                        pages: Math.ceil(validNotifications.length / limit)
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
    buildRoleBasedWhereClause(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield prisma_1.prisma.user.findUnique({
                where: { id: userId },
                select: { role: true, vendorId: true, supplierId: true }
            });
            if (!user) {
                return { userId };
            }
            const where = { isDeleted: false };
            switch (user.role) {
                case 'ADMIN':
                    // Admin can see all - no additional filtering
                    break;
                case 'VENDOR':
                    if (user.vendorId) {
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
            return where;
        });
    },
    // ========== CREATE NOTIFICATION (Enhanced for role-based targeting) ==========
    createNotification(data) {
        return __awaiter(this, void 0, void 0, function* () {
            // Validate target user exists
            const targetUser = yield prisma_1.prisma.user.findUnique({
                where: { id: data.userId },
                select: { id: true, email: true, role: true }
            });
            if (!targetUser) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "Target user not found");
            }
            const notification = yield prisma_1.prisma.notification.create({
                data: {
                    userId: data.userId,
                    title: data.title,
                    message: data.message,
                    type: data.type,
                    metadata: data.metadata || {},
                    priority: data.priority || 'MEDIUM'
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
            // Send email notification if enabled
            const preferences = yield prisma_1.prisma.notificationPreferences.findUnique({
                where: { userId: data.userId }
            });
            if (preferences === null || preferences === void 0 ? void 0 : preferences.emailNotifications) {
                try {
                    yield mailtrap_service_1.mailtrapService.sendHtmlEmail({
                        to: targetUser.email,
                        subject: data.title,
                        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">${data.title}</h2>
              <p>${data.message}</p>
              ${data.metadata ? `
                <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                  ${Object.entries(data.metadata).map(([key, value]) => `
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
                    console.error("Failed to send notification email:", error);
                }
            }
            return notification;
        });
    },
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
