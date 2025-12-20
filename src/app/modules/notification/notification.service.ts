// src/modules/notification/notification.service.ts
import { Notification, NotificationType } from "@prisma/client";
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
  // ========== GET NOTIFICATIONS ==========
  async getNotifications(userId: string, options: any = {}): Promise<{ notifications: Notification[]; meta: any }> {
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

    const where: any = { 
      userId,
      isDeleted: false
    };

    if (isRead !== undefined) {
      where.isRead = isRead === 'true';
    }

    if (type) {
      where.type = type;
    }

    if (priority) {
      where.priority = priority;
    }

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit
      }),
      prisma.notification.count({ where })
    ]);

    return {
      notifications,
      meta: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  },

  // ========== GET NOTIFICATION STATS ==========
  async getNotificationStats(userId: string): Promise<NotificationStats> {
    const [total, unread, byType, byPriority] = await Promise.all([
      prisma.notification.count({
        where: { userId, isDeleted: false }
      }),
      prisma.notification.count({
        where: { userId, isRead: false, isDeleted: false }
      }),
      prisma.notification.groupBy({
        by: ['type'],
        where: { userId, isDeleted: false },
        _count: true
      }),
      prisma.notification.groupBy({
        by: ['priority'],
        where: { userId, isDeleted: false },
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

  // ========== MARK AS READ ==========
  async markAsRead(userId: string, data: any): Promise<{ message: string; count: number }> {
    let count = 0;

    if (data.markAll) {
      const result = await prisma.notification.updateMany({
        where: { 
          userId,
          isRead: false,
          isDeleted: false
        },
        data: { isRead: true }
      });
      count = result.count;
    } else if (data.notificationIds && data.notificationIds.length > 0) {
      const result = await prisma.notification.updateMany({
        where: { 
          id: { in: data.notificationIds },
          userId,
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

    if (notificationIds && notificationIds.length > 0) {
      const result = await prisma.notification.updateMany({
        where: { 
          id: { in: notificationIds },
          userId
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

  // ========== CREATE NOTIFICATION ==========
  async createNotification(data: any): Promise<Notification> {
    const notification = await prisma.notification.create({
      data: {
        userId: data.userId,
        title: data.title,
        message: data.message,
        type: data.type,
        metadata: data.metadata || {},
        priority: data.priority || 'MEDIUM'
      }
    });

    // Send email notification if enabled
    const preferences = await prisma.notificationPreferences.findUnique({
      where: { userId: data.userId }
    });

    if (preferences?.emailNotifications) {
      const user = await prisma.user.findUnique({
        where: { id: data.userId },
        select: { email: true }
      });

      if (user) {
        try {
          await mailtrapService.sendHtmlEmail({
            to: user.email,
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
    }

    return notification;
  },

  // ========== CREATE SYSTEM NOTIFICATION ==========
  async createSystemNotification(
    userIds: string[],
    title: string,
    message: string,
    type: NotificationType,
    metadata?: any,
    priority?: 'LOW' | 'MEDIUM' | 'HIGH'
  ): Promise<Notification[]> {
    const notifications = await Promise.all(
      userIds.map(userId =>
        prisma.notification.create({
          data: {
            userId,
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
    notifications.forEach(async (notification) => {
      const preferences = await prisma.notificationPreferences.findUnique({
        where: { userId: notification.userId }
      });

      if (preferences?.emailNotifications) {
        const user = await prisma.user.findUnique({
          where: { id: notification.userId },
          select: { email: true }
        });

        if (user) {
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
      }
    });

    return notifications;
  },

  // ========== GET UNREAD COUNT ==========
  async getUnreadCount(userId: string): Promise<{ count: number }> {
    const count = await prisma.notification.count({
      where: { 
        userId,
        isRead: false,
        isDeleted: false
      }
    });

    return { count };
  },

  // ========== CLEAR ALL NOTIFICATIONS ==========
  async clearAllNotifications(userId: string): Promise<{ message: string; count: number }> {
    const result = await prisma.notification.updateMany({
      where: { userId },
      data: { isDeleted: true }
    });

    return {
      message: "All notifications cleared",
      count: result.count
    };
  }
};