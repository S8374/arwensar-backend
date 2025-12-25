// src/modules/notification/notification.service.ts (Fixed getNotifications method)
import { Notification, NotificationType, UserRole } from "@prisma/client";
import { prisma } from "../../shared/prisma";
import httpStatus from "http-status";
import { mailtrapService } from "../../shared/mailtrap.service";
import ApiError from "../../../error/ApiError";

export interface NotificationStats {
  total: number;
  unread: number;
  byType: Record<string, number>;
  byPriority: {
    low: number;
    medium: number;
    high: number;
  };
}

export const NotificationService = {
  // ========== GET NOTIFICATIONS (ROLE-BASED) ==========
  async getNotifications(
    userId: string,
    options: any = {}
  ): Promise<{ notifications: any[]; meta: any }> {
    const {
      page = 1,
      limit = 20,
      isRead,
      type,
      priority,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = options;

    const skip = (page - 1) * limit;

    // First, get user details to determine role and associated entities
    const user = await prisma.user.findUnique({
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
      throw new ApiError(httpStatus.NOT_FOUND, "User not found");
    }

    // Build base where clause
    const where: any = {
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
          const vendorSuppliers = await prisma.supplier.findMany({
            where: { vendorId: user.vendorId },
            select: { id: true, userId: true }
          });

          const supplierUserIds = vendorSuppliers
            .map(s => s.userId)
            .filter(Boolean) as string[];

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
        } else {
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
          const supplier = await prisma.supplier.findUnique({
            where: { id: user.supplierId },
            select: { vendorId: true }
          });

          if (supplier) {
            // Get vendor's user ID
            const vendor = await prisma.vendor.findUnique({
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
          } else {
            // Supplier without vendor relationship - only their own notifications
            where.userId = user.id;
          }
        } else {
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
      const [notifications, total] = await Promise.all([
        prisma.notification.findMany({
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
        prisma.notification.count({ where })
      ]);

      // Transform and filter notifications
      const transformedNotifications = await Promise.all(
        notifications.map(async (notification) => {
          const notificationMetadata = notification.metadata as any;

          // Check if user should see this notification
          let shouldShow = false;

          // Always show notifications sent directly to user
          if (notification.userId === user.id) {
            shouldShow = true;
          } else {
            // Check role-based visibility
            switch (user.role) {
              case 'ADMIN':
                shouldShow = true;
                break;

              case 'VENDOR':
                if (user.vendorId) {
                  // Check if notification is related to vendor's suppliers
                  if (notificationMetadata?.supplierId) {
                    const supplier = await prisma.supplier.findFirst({
                      where: {
                        id: notificationMetadata.supplierId,
                        vendorId: user.vendorId
                      }
                    });
                    shouldShow = !!supplier;
                  }

                  // Check if notification is vendor-specific
                  if (notificationMetadata?.vendorId === user.vendorId) {
                    shouldShow = true;
                  }

                  // Check if notification is from vendor's suppliers
                  if (notification.user?.supplierProfile?.id) {
                    const supplier = await prisma.supplier.findFirst({
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
                  if (notificationMetadata?.supplierId === user.supplierId) {
                    shouldShow = true;
                  }

                  // Check if notification is from vendor to this supplier
                  if (notificationMetadata?.receiverSupplierId === user.supplierId) {
                    shouldShow = true;
                  }

                  // Check if notification is from supplier's vendor
                  if (notification.user?.vendorProfile?.id) {
                    const supplier = await prisma.supplier.findUnique({
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
          const transformed: any = {
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
              id: notification.user?.id,
              email: notification.user?.email,
              role: notification.user?.role,
              name: notification.user?.role === 'VENDOR'
                ? notification.user?.vendorProfile?.companyName
                : notification.user?.role === 'SUPPLIER'
                  ? notification.user?.supplierProfile?.name
                  : 'Admin'
            }
          };

          // Add recipient info for vendor notifications to suppliers
          if (user.role === 'VENDOR' && notificationMetadata?.supplierId) {
            const supplier = await prisma.supplier.findUnique({
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
          if (user.role === 'SUPPLIER' && notificationMetadata?.vendorId) {
            const vendor = await prisma.vendor.findUnique({
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
        })
      );

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
    } catch (error) {
      console.error('Error fetching notifications:', error);
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        'Failed to fetch notifications'
      );
    }
  },

  // ========== GET NOTIFICATION STATS (Updated for role-based) ==========
  async getNotificationStats(userId: string): Promise<NotificationStats> {
    // Get user details
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, vendorId: true, supplierId: true }
    });

    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, "User not found");
    }

    // Build where clause based on role
    const where: any = { isDeleted: false };

    switch (user.role) {
      case 'ADMIN':
        // Admin sees all
        break;

      case 'VENDOR':
        if (user.vendorId) {
          // Get vendor's suppliers' user IDs
          const vendorSuppliers = await prisma.supplier.findMany({
            where: { vendorId: user.vendorId },
            select: { userId: true }
          });

          const supplierUserIds = vendorSuppliers
            .map(s => s.userId)
            .filter(Boolean) as string[];

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
        } else {
          where.userId = userId;
        }
        break;

      case 'SUPPLIER':
        if (user.supplierId) {
          // Get supplier's vendor
          const supplier = await prisma.supplier.findUnique({
            where: { id: user.supplierId },
            select: { vendorId: true }
          });

          if (supplier) {
            const vendor = await prisma.vendor.findUnique({
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
          } else {
            where.userId = userId;
          }
        } else {
          where.userId = userId;
        }
        break;

      default:
        where.userId = userId;
    }

    const [total, unread, byType, byPriority] = await Promise.all([
      prisma.notification.count({ where }),
      prisma.notification.count({
        where: { ...where, isRead: false }
      }),
      prisma.notification.groupBy({
        by: ['type'],
        where,
        _count: true
      }),
      prisma.notification.groupBy({
        by: ['priority'],
        where,
        _count: true
      })
    ]);

    const typeStats: Record<string, number> = {};
    byType.forEach(item => {
      typeStats[item.type] = item._count;
    });

    const priorityStats = {
      low: byPriority.find(p => p.priority === 'LOW')?._count || 0,
      medium: byPriority.find(p => p.priority === 'MEDIUM')?._count || 0,
      high: byPriority.find(p => p.priority === 'HIGH')?._count || 0
    };

    return {
      total,
      unread,
      byType: typeStats,
      byPriority: priorityStats
    };
  },

  // ========== HELPER METHOD: BUILD ROLE-BASED WHERE CLAUSE ==========
  async buildRoleBasedWhereClause(userId: string): Promise<any> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, vendorId: true, supplierId: true }
    });

    if (!user) {
      return { userId };
    }

    const where: any = { isDeleted: false };

    switch (user.role) {
      case 'ADMIN':
        // Admin can see all - no additional filtering
        break;

      case 'VENDOR':
        if (user.vendorId) {
          const vendorSuppliers = await prisma.supplier.findMany({
            where: { vendorId: user.vendorId },
            select: { userId: true }
          });

          const supplierUserIds = vendorSuppliers
            .map(s => s.userId)
            .filter(Boolean) as string[];

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
        } else {
          where.userId = userId;
        }
        break;

      case 'SUPPLIER':
        if (user.supplierId) {
          const supplier = await prisma.supplier.findUnique({
            where: { id: user.supplierId },
            select: { vendorId: true }
          });

          if (supplier) {
            const vendor = await prisma.vendor.findUnique({
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
          } else {
            where.userId = userId;
          }
        } else {
          where.userId = userId;
        }
        break;

      default:
        where.userId = userId;
    }

    return where;
  },

  // ========== CREATE NOTIFICATION (Enhanced for role-based targeting) ==========
  async createNotification(data: any): Promise<Notification> {
    // Validate target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: data.userId },
      select: { id: true, email: true, role: true }
    });

    if (!targetUser) {
      throw new ApiError(httpStatus.NOT_FOUND, "Target user not found");
    }

    const notification = await prisma.notification.create({
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
    const preferences = await prisma.notificationPreferences.findUnique({
      where: { userId: data.userId }
    });

    if (preferences?.emailNotifications) {
      try {
        await mailtrapService.sendHtmlEmail({
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
      } catch (error) {
        console.error("Failed to send notification email:", error);
      }
    }

    return notification;
  },

  // ========== CREATE SYSTEM NOTIFICATION (Enhanced) ==========
  async createSystemNotification(
    userIds: string[],
    title: string,
    message: string,
    type: NotificationType,
    metadata?: any,
    priority?: 'LOW' | 'MEDIUM' | 'HIGH'
  ): Promise<Notification[]> {
    // Validate all users exist
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true }
    });

    if (users.length !== userIds.length) {
      throw new ApiError(httpStatus.BAD_REQUEST, "One or more target users not found");
    }

    const notifications = await Promise.all(
      users.map(user =>
        prisma.notification.create({
          data: {
            userId: user.id,
            title,
            message,
            type,
            metadata: metadata || {},
            priority: priority || 'MEDIUM'
          }
        })
      )
    );

    // Send email notifications in background
    notifications.forEach(async (notification, index) => {
      const user = users[index];
      const preferences = await prisma.notificationPreferences.findUnique({
        where: { userId: user.id }
      });

      if (preferences?.emailNotifications) {
        try {
          await mailtrapService.sendHtmlEmail({
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
        } catch (error) {
          console.error("Failed to send system notification email:", error);
        }
      }
    });

    return notifications;
  },

  // ========== CREATE NOTIFICATION FOR VENDOR'S SUPPLIERS ==========
  async createNotificationForVendorSuppliers(
    vendorId: string,
    title: string,
    message: string,
    type: NotificationType,
    metadata?: any,
    priority?: 'LOW' | 'MEDIUM' | 'HIGH'
  ): Promise<Notification[]> {
    // Get vendor's suppliers
    const suppliers = await prisma.supplier.findMany({
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
      .map(s => s.user?.id)
      .filter(Boolean) as string[];

    if (supplierUserIds.length === 0) {
      return [];
    }

    // Add vendorId to metadata
    const enhancedMetadata = {
      ...metadata,
      vendorId,
      senderType: 'VENDOR'
    };

    return this.createSystemNotification(
      supplierUserIds,
      title,
      message,
      type,
      enhancedMetadata,
      priority
    );
  },

  // ========== CREATE NOTIFICATION FOR SUPPLIER'S VENDOR ==========
  async createNotificationForSupplierVendor(
    supplierId: string,
    title: string,
    message: string,
    type: NotificationType,
    metadata?: any,
    priority?: 'LOW' | 'MEDIUM' | 'HIGH'
  ): Promise<Notification | null> {
    // Get supplier's vendor
    const supplier = await prisma.supplier.findUnique({
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

    if (!supplier || !supplier.vendor?.user?.id) {
      return null;
    }

    // Add supplierId to metadata
    const enhancedMetadata = {
      ...metadata,
      supplierId,
      senderType: 'SUPPLIER'
    };

    const notification = await this.createNotification({
      userId: supplier.vendor.user.id,
      title,
      message,
      type,
      metadata: enhancedMetadata,
      priority
    });

    return notification;
  },

  // ========== MARK AS READ ==========
  async markAsRead(userId: string, data: any): Promise<{ message: string; count: number }> {
    let count = 0;

    // Get user's role-based notification query
    const where = await this.buildRoleBasedWhereClause(userId);

    if (data.markAll) {
      const result = await prisma.notification.updateMany({
        where: {
          ...where,
          isRead: false,
          isDeleted: false
        },
        data: { isRead: true }
      });
      count = result.count;
    } else if (data.notificationIds && data.notificationIds.length > 0) {
      // Verify user has permission to mark these notifications
      const notifications = await prisma.notification.findMany({
        where: {
          id: { in: data.notificationIds },
          ...where,
          isDeleted: false
        }
      });

      if (notifications.length !== data.notificationIds.length) {
        throw new ApiError(httpStatus.FORBIDDEN, "You don't have permission to mark some notifications as read");
      }

      const result = await prisma.notification.updateMany({
        where: {
          id: { in: data.notificationIds },
          ...where,
          isDeleted: false
        },
        data: { isRead: true }
      });
      count = result.count;
    } else {
      throw new ApiError(httpStatus.BAD_REQUEST, "Either notificationIds or markAll must be provided");
    }

    return {
      message: `${count} notification(s) marked as read`,
      count
    };
  },

  // ========== DELETE NOTIFICATIONS ==========
  async deleteNotifications(userId: string, notificationIds?: string[]): Promise<{ message: string; count: number }> {
    let count = 0;

    // Get user's role-based notification query
    const where = await this.buildRoleBasedWhereClause(userId);

    if (notificationIds && notificationIds.length > 0) {
      // Verify user has permission to delete these notifications
      const notifications = await prisma.notification.findMany({
        where: {
          id: { in: notificationIds },
          ...where
        }
      });

      if (notifications.length !== notificationIds.length) {
        throw new ApiError(httpStatus.FORBIDDEN, "You don't have permission to delete some notifications");
      }

      const result = await prisma.notification.updateMany({
        where: {
          id: { in: notificationIds },
          ...where
        },
        data: { isDeleted: true }
      });
      count = result.count;
    } else {
      throw new ApiError(httpStatus.BAD_REQUEST, "notificationIds must be provided");
    }

    return {
      message: `${count} notification(s) deleted`,
      count
    };
  },

  // ========== GET UNREAD COUNT ==========
  async getUnreadCount(userId: string): Promise<{ count: number }> {
    const where = await this.buildRoleBasedWhereClause(userId);

    const count = await prisma.notification.count({
      where: {
        ...where,
        isRead: false,
        isDeleted: false
      }
    });

    return { count };
  },

  // ========== CLEAR ALL NOTIFICATIONS ==========
  async clearAllNotifications(userId: string): Promise<{ message: string; count: number }> {
    const where = await this.buildRoleBasedWhereClause(userId);

    const result = await prisma.notification.updateMany({
      where: { ...where, isDeleted: false },
      data: { isDeleted: true }
    });

    return {
      message: "All notifications cleared",
      count: result.count
    };
  },
  async getTargetUsers(userId: string): Promise<any[]> {
    const user = await prisma.user.findUnique({
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
      throw new ApiError(httpStatus.NOT_FOUND, "User not found");
    }

    const targetUsers = [];

    switch (user.role) {
      case 'ADMIN':
        // Admin can send to all users except themselves
        const allUsers = await prisma.user.findMany({
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

        targetUsers.push(...allUsers.map(u => ({
          id: u.id,
          email: u.email,
          role: u.role,
          name: u.role === 'VENDOR'
            ? u.vendorProfile?.companyName
            : u.role === 'SUPPLIER'
              ? u.supplierProfile?.name
              : 'Admin User',
          profileId: u.role === 'VENDOR'
            ? u.vendorProfile?.id
            : u.role === 'SUPPLIER'
              ? u.supplierProfile?.id
              : null
        })));
        break;

      case 'VENDOR':
        if (user.vendorProfile) {
          // Vendor can send to:
          // 1. Their own suppliers who have accounts
          const suppliers = await prisma.supplier.findMany({
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
            id: s.user!.id,
            email: s.user!.email,
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
          const otherVendors = await prisma.vendor.findMany({
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
          const vendor = await prisma.vendor.findUnique({
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

          if (vendor?.user) {
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
          const otherSuppliers = await prisma.supplier.findMany({
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
            id: s.user!.id,
            email: s.user!.email,
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
  },

};