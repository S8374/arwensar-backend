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
exports.ProblemService = void 0;
const prisma_1 = require("../../shared/prisma");
const http_status_1 = __importDefault(require("http-status"));
const mailtrap_service_1 = require("../../shared/mailtrap.service");
const notification_service_1 = require("../notification/notification.service");
const ApiError_1 = __importDefault(require("../../../error/ApiError"));
exports.ProblemService = {
    // ========== CREATE PROBLEM ==========
    createProblem(userId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            // Get authenticated user
            const user = yield prisma_1.prisma.user.findUnique({
                where: { id: userId },
                select: { role: true, vendorId: true, supplierId: true }
            });
            if (!user) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "User not found");
            }
            let supplierId;
            let vendorId;
            // Determine supplierId and vendorId based on role
            if (user.role === 'VENDOR') {
                // Vendor reporting problem about a supplier
                if (!data.supplierId) {
                    throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, "supplierId is required when vendor reports a problem");
                }
                supplierId = data.supplierId;
                vendorId = user.vendorId;
            }
            else if (user.role === 'SUPPLIER') {
                // Supplier reporting problem to their vendor
                if (!user.supplierId) {
                    throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, "Your account is not linked to a supplier profile");
                }
                supplierId = user.supplierId;
                // Get vendorId from supplier's profile
                const supplierProfile = yield prisma_1.prisma.supplier.findUnique({
                    where: { id: user.supplierId },
                    select: { vendorId: true }
                });
                if (!(supplierProfile === null || supplierProfile === void 0 ? void 0 : supplierProfile.vendorId)) {
                    throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, "Your supplier profile is not linked to a vendor");
                }
                vendorId = supplierProfile.vendorId;
            }
            else {
                throw new ApiError_1.default(http_status_1.default.FORBIDDEN, "Unauthorized role");
            }
            // Fetch supplier with relations
            const supplier = yield prisma_1.prisma.supplier.findUnique({
                where: { id: supplierId },
                include: {
                    vendor: {
                        select: { userId: true, companyName: true }
                    },
                    user: {
                        select: { id: true, email: true }
                    }
                }
            });
            if (!supplier) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "Supplier not found");
            }
            // Final permission check
            if (user.role === 'VENDOR' && supplier.vendorId !== user.vendorId) {
                throw new ApiError_1.default(http_status_1.default.FORBIDDEN, "You can only create problems for your own suppliers");
            }
            const problemData = {
                title: data.title,
                description: data.description,
                type: data.type,
                direction: data.direction,
                priority: data.priority,
                reportedById: userId,
                vendorId,
                supplierId,
                status: 'OPEN',
                attachments: data.attachments || []
            };
            if (data.dueDate) {
                problemData.dueDate = new Date(data.dueDate);
            }
            const problem = yield prisma_1.prisma.problem.create({
                data: problemData,
                include: {
                    reportedBy: {
                        select: {
                            id: true,
                            email: true,
                            role: true
                        }
                    }
                }
            });
            // Return with supplier info
            const problemWithSupplier = Object.assign(Object.assign({}, problem), { supplier: {
                    id: supplier.id,
                    name: supplier.name,
                    email: supplier.email,
                    companyName: supplier.vendor.companyName
                } });
            // Create initial message if provided
            if (data.initialMessage) {
                yield prisma_1.prisma.problemMessage.create({
                    data: {
                        content: data.initialMessage,
                        isInternal: data.isInternal || false,
                        attachments: data.attachments || [],
                        problemId: problem.id,
                        senderId: userId
                    }
                });
            }
            // === NOTIFICATIONS & EMAILS ===
            const notifications = [];
            // Notify the other party
            if (data.direction === 'VENDOR_TO_SUPPLIER' && ((_a = supplier.user) === null || _a === void 0 ? void 0 : _a.id)) {
                notifications.push(notification_service_1.NotificationService.createNotification({
                    userId: supplier.user.id,
                    title: "New Problem Reported",
                    message: `Your vendor has reported a problem: ${data.title}`,
                    type: 'PROBLEM_REPORTED',
                    metadata: {
                        problemId: problem.id,
                        title: data.title,
                        priority: data.priority
                    },
                    priority: data.priority === 'URGENT' ? 'HIGH' : 'MEDIUM'
                }));
                // Email to supplier
                try {
                    yield mailtrap_service_1.mailtrapService.sendHtmlEmail({
                        to: supplier.user.email,
                        subject: `New Problem Reported: ${data.title}`,
                        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>New Problem Reported</h2>
              <p>Your vendor has reported an issue regarding your services.</p>
              <div style="background:#f8f9fa;padding:20px;border-radius:8px;margin:20px 0;">
                <p><strong>Title:</strong> ${data.title}</p>
                <p><strong>Description:</strong> ${data.description}</p>
                <p><strong>Priority:</strong> ${data.priority}</p>
                ${data.dueDate ? `<p><strong>Due:</strong> ${new Date(data.dueDate).toLocaleDateString()}</p>` : ''}
              </div>
              <p>Please log in to respond.</p>
              <a href="${process.env.FRONTEND_URL}/problems/${problem.id}" style="background:#007bff;color:white;padding:12px 30px;text-decoration:none;border-radius:5px;display:inline-block;">
                View Problem
              </a>
            </div>
          `
                    });
                }
                catch (error) {
                    console.error("Failed to send email:", error);
                }
            }
            if (data.direction === 'SUPPLIER_TO_VENDOR' && supplier.vendor.userId) {
                notifications.push(notification_service_1.NotificationService.createNotification({
                    userId: supplier.vendor.userId,
                    title: "Problem Reported by Supplier",
                    message: `${supplier.name} reported: ${data.title}`,
                    type: 'PROBLEM_REPORTED',
                    metadata: {
                        problemId: problem.id,
                        title: data.title,
                        priority: data.priority,
                        supplierName: supplier.name
                    },
                    priority: data.priority === 'URGENT' ? 'HIGH' : 'MEDIUM'
                }));
            }
            yield Promise.all(notifications);
            return problemWithSupplier;
        });
    },
    // ========== GET PROBLEMS ==========
    getProblems(userId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, options = {}) {
            const { page = 1, limit = 20, status, priority, type, direction, supplierId, assignedToId, sortBy = 'createdAt', sortOrder = 'desc' } = options;
            const skip = (page - 1) * limit;
            const user = yield prisma_1.prisma.user.findUnique({
                where: { id: userId },
                select: { role: true, vendorId: true, supplierId: true }
            });
            if (!user) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "User not found");
            }
            const where = {};
            // Filter by user role
            if (user.role === 'VENDOR' && user.vendorId) {
                where.vendorId = user.vendorId;
            }
            else if (user.role === 'SUPPLIER' && user.supplierId) {
                where.supplierId = user.supplierId;
            }
            if (status) {
                where.status = status;
            }
            if (priority) {
                where.priority = priority;
            }
            if (type) {
                where.type = type;
            }
            if (direction) {
                where.direction = direction;
            }
            if (supplierId) {
                where.supplierId = supplierId;
            }
            if (assignedToId) {
                where.assignedToId = assignedToId;
            }
            const [problems, total] = yield Promise.all([
                prisma_1.prisma.problem.findMany({
                    where,
                    include: {
                        reportedBy: {
                            select: {
                                id: true,
                                email: true,
                                role: true
                            }
                        },
                        assignedTo: {
                            select: {
                                id: true,
                                email: true
                            }
                        },
                        _count: {
                            select: {
                                messages: true
                            }
                        }
                    },
                    orderBy: { [sortBy]: sortOrder },
                    skip,
                    take: limit
                }),
                prisma_1.prisma.problem.count({ where })
            ]);
            // Get suppliers for all problems in one query
            const supplierIds = problems.map(p => p.supplierId).filter(Boolean);
            const suppliers = yield prisma_1.prisma.supplier.findMany({
                where: { id: { in: supplierIds } },
                select: {
                    id: true,
                    name: true,
                    email: true
                }
            });
            // Map suppliers to problems
            const supplierMap = new Map(suppliers.map(s => [s.id, s]));
            const problemsWithSuppliers = problems.map(problem => (Object.assign(Object.assign({}, problem), { supplier: supplierMap.get(problem.supplierId) || null })));
            return {
                problems: problemsWithSuppliers,
                meta: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            };
        });
    },
    // ========== GET PROBLEM BY ID ==========
    getProblemById(problemId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            // First get the problem without supplier
            const problem = yield prisma_1.prisma.problem.findUnique({
                where: { id: problemId },
                include: {
                    reportedBy: {
                        select: {
                            id: true,
                            email: true,
                            role: true
                        }
                    },
                    assignedTo: {
                        select: {
                            id: true,
                            email: true
                        }
                    },
                    messages: {
                        include: {
                            sender: {
                                select: {
                                    id: true,
                                    email: true,
                                    role: true
                                }
                            }
                        },
                        orderBy: { createdAt: 'asc' }
                    }
                }
            });
            if (!problem) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "Problem not found");
            }
            // Then get supplier separately
            const supplier = yield prisma_1.prisma.supplier.findUnique({
                where: { id: problem.supplierId },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    vendor: {
                        select: {
                            id: true,
                            companyName: true
                        }
                    }
                }
            });
            // Combine problem and supplier
            const problemWithSupplier = Object.assign(Object.assign({}, problem), { supplier: supplier || null });
            // Check permissions
            const user = yield prisma_1.prisma.user.findUnique({
                where: { id: userId },
                select: { role: true, vendorId: true, supplierId: true }
            });
            if (!user) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "User not found");
            }
            if (user.role === 'VENDOR' && problem.vendorId !== user.vendorId) {
                throw new ApiError_1.default(http_status_1.default.FORBIDDEN, "You don't have permission to view this problem");
            }
            if (user.role === 'SUPPLIER' && problem.supplierId !== user.supplierId) {
                throw new ApiError_1.default(http_status_1.default.FORBIDDEN, "You don't have permission to view this problem");
            }
            return problemWithSupplier;
        });
    },
    // ========== UPDATE PROBLEM ==========
    updateProblem(problemId, userId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const problem = yield prisma_1.prisma.problem.findUnique({
                where: { id: problemId }
            });
            if (!problem) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "Problem not found");
            }
            // Check permissions
            const user = yield prisma_1.prisma.user.findUnique({
                where: { id: userId },
                select: { role: true, vendorId: true, supplierId: true }
            });
            if (!user) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "User not found");
            }
            if (user.role === 'VENDOR' && problem.vendorId !== user.vendorId) {
                throw new ApiError_1.default(http_status_1.default.FORBIDDEN, "You don't have permission to update this problem");
            }
            if (user.role === 'SUPPLIER' && problem.reportedById !== userId) {
                throw new ApiError_1.default(http_status_1.default.FORBIDDEN, "You can only update problems you reported");
            }
            const updateData = Object.assign({}, data);
            if (data.dueDate) {
                updateData.dueDate = new Date(data.dueDate);
            }
            // Check if status is being changed to RESOLVED
            const wasResolved = problem.status !== 'RESOLVED' && data.status === 'RESOLVED';
            if (wasResolved) {
                updateData.resolvedAt = new Date();
            }
            // Check if assignedTo is being changed
            const wasAssigned = !problem.assignedToId && data.assignedToId;
            const assignmentChanged = problem.assignedToId !== data.assignedToId;
            const updatedProblem = yield prisma_1.prisma.problem.update({
                where: { id: problemId },
                data: updateData,
                include: {
                    reportedBy: {
                        select: {
                            id: true,
                            email: true
                        }
                    },
                    assignedTo: {
                        select: {
                            id: true,
                            email: true
                        }
                    }
                }
            });
            // Get supplier separately
            const supplier = yield prisma_1.prisma.supplier.findUnique({
                where: { id: problem.supplierId },
                select: {
                    id: true,
                    name: true,
                    user: {
                        select: { id: true, email: true }
                    }
                }
            });
            const updatedProblemWithSupplier = Object.assign(Object.assign({}, updatedProblem), { supplier: supplier || null });
            // Create notifications for status changes
            if (data.status && data.status !== problem.status) {
                const statusChangeNotification = {
                    userId: problem.reportedById,
                    title: `Problem Status Updated`,
                    message: `Problem "${problem.title}" status changed from ${problem.status} to ${data.status}`,
                    type: 'PROBLEM_UPDATED',
                    metadata: {
                        problemId: problem.id,
                        oldStatus: problem.status,
                        newStatus: data.status,
                        updatedBy: user.role
                    }
                };
                yield notification_service_1.NotificationService.createNotification(statusChangeNotification);
                // Notify assigned user if different from reporter
                if (problem.assignedToId && problem.assignedToId !== problem.reportedById) {
                    yield notification_service_1.NotificationService.createNotification(Object.assign(Object.assign({}, statusChangeNotification), { userId: problem.assignedToId }));
                }
                // Notify supplier user if vendor is changing status
                if (user.role === 'VENDOR' && ((_a = supplier === null || supplier === void 0 ? void 0 : supplier.user) === null || _a === void 0 ? void 0 : _a.id)) {
                    yield notification_service_1.NotificationService.createNotification(Object.assign(Object.assign({}, statusChangeNotification), { userId: supplier.user.id }));
                }
            }
            // Create notification for assignment
            if (wasAssigned || assignmentChanged) {
                if (data.assignedToId) {
                    yield notification_service_1.NotificationService.createNotification({
                        userId: data.assignedToId,
                        title: "Problem Assigned to You",
                        message: `You have been assigned to problem: "${problem.title}"`,
                        type: 'PROBLEM_UPDATED',
                        metadata: {
                            problemId: problem.id,
                            title: problem.title,
                            priority: problem.priority,
                            assignedBy: user.role
                        }
                    });
                }
            }
            // Create notification for resolution
            if (wasResolved) {
                const resolutionNotification = {
                    userId: problem.reportedById,
                    title: "Problem Resolved",
                    message: `Problem "${problem.title}" has been resolved`,
                    type: 'PROBLEM_RESOLVED',
                    metadata: {
                        problemId: problem.id,
                        title: problem.title,
                        resolvedAt: new Date().toISOString(),
                        resolvedBy: user.role
                    }
                };
                yield notification_service_1.NotificationService.createNotification(resolutionNotification);
                // Notify all parties involved
                const involvedUsers = [
                    problem.reportedById,
                    problem.assignedToId,
                    (_b = supplier === null || supplier === void 0 ? void 0 : supplier.user) === null || _b === void 0 ? void 0 : _b.id
                ].filter((id, index, self) => id && self.indexOf(id) === index);
                yield Promise.all(involvedUsers.map(userId => notification_service_1.NotificationService.createNotification(Object.assign(Object.assign({}, resolutionNotification), { userId: userId }))));
            }
            return updatedProblemWithSupplier;
        });
    },
    // ========== CREATE MESSAGE ==========
    createMessage(problemId, userId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            // Get problem without supplier
            const problem = yield prisma_1.prisma.problem.findUnique({
                where: { id: problemId },
                include: {
                    reportedBy: {
                        select: { id: true, email: true }
                    },
                    assignedTo: {
                        select: { id: true, email: true }
                    }
                }
            });
            if (!problem) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "Problem not found");
            }
            // Get supplier separately
            const supplier = yield prisma_1.prisma.supplier.findUnique({
                where: { id: problem.supplierId },
                select: {
                    id: true,
                    name: true,
                    user: {
                        select: { id: true, email: true }
                    },
                    vendor: {
                        select: {
                            userId: true
                        }
                    }
                }
            });
            // Check permissions
            const user = yield prisma_1.prisma.user.findUnique({
                where: { id: userId },
                select: { role: true, vendorId: true, supplierId: true }
            });
            if (!user) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "User not found");
            }
            const canMessage = 
            // Reporter can always message
            problem.reportedById === userId ||
                // Assigned person can message
                problem.assignedToId === userId ||
                // Vendor can message their supplier problems
                (user.role === 'VENDOR' && problem.vendorId === user.vendorId) ||
                // Supplier can message their own problems
                (user.role === 'SUPPLIER' && problem.supplierId === user.supplierId);
            if (!canMessage) {
                throw new ApiError_1.default(http_status_1.default.FORBIDDEN, "You don't have permission to message this problem");
            }
            // Update first response time if this is the first message from vendor/assigned
            const updateData = {};
            if (!problem.firstResponseAt &&
                (user.role === 'VENDOR' || userId === problem.assignedToId)) {
                updateData.firstResponseAt = new Date();
            }
            // Update problem
            if (Object.keys(updateData).length > 0) {
                yield prisma_1.prisma.problem.update({
                    where: { id: problemId },
                    data: updateData
                });
            }
            const message = yield prisma_1.prisma.problemMessage.create({
                data: {
                    content: data.content,
                    isInternal: data.isInternal || false,
                    attachments: data.attachments || [],
                    problemId,
                    senderId: userId
                },
                include: {
                    sender: {
                        select: {
                            id: true,
                            email: true,
                            role: true
                        }
                    }
                }
            });
            // Determine who to notify
            const recipients = new Set();
            // Always notify the other party in the conversation
            if (problem.reportedById !== userId) {
                recipients.add(problem.reportedById);
            }
            if (problem.assignedToId && problem.assignedToId !== userId) {
                recipients.add(problem.assignedToId);
            }
            // Notify vendor if supplier is messaging
            if (user.role === 'SUPPLIER' && ((_a = supplier === null || supplier === void 0 ? void 0 : supplier.vendor) === null || _a === void 0 ? void 0 : _a.userId)) {
                recipients.add(supplier.vendor.userId);
            }
            // Notify supplier if vendor is messaging and message is not internal
            if (user.role === 'VENDOR' && !data.isInternal && ((_b = supplier === null || supplier === void 0 ? void 0 : supplier.user) === null || _b === void 0 ? void 0 : _b.id)) {
                recipients.add(supplier.user.id);
            }
            // Create notifications
            yield Promise.all(Array.from(recipients).map(recipientId => notification_service_1.NotificationService.createNotification({
                userId: recipientId,
                title: "New Message on Problem",
                message: `New message on problem: "${problem.title}"`,
                type: 'PROBLEM_UPDATED',
                metadata: {
                    problemId: problem.id,
                    title: problem.title,
                    sender: user.role,
                    messagePreview: data.content.substring(0, 100)
                }
            })));
            return message;
        });
    },
    // ========== GET PROBLEM STATISTICS ==========
    getProblemStatistics(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield prisma_1.prisma.user.findUnique({
                where: { id: userId },
                select: { role: true, vendorId: true, supplierId: true }
            });
            if (!user) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "User not found");
            }
            const where = {};
            if (user.role === 'VENDOR' && user.vendorId) {
                where.vendorId = user.vendorId;
            }
            else if (user.role === 'SUPPLIER' && user.supplierId) {
                where.supplierId = user.supplierId;
            }
            const [total, byStatus, byPriority, byType, overdue, recentlyResolved] = yield Promise.all([
                prisma_1.prisma.problem.count({ where }),
                prisma_1.prisma.problem.groupBy({
                    by: ['status'],
                    where,
                    _count: true
                }),
                prisma_1.prisma.problem.groupBy({
                    by: ['priority'],
                    where,
                    _count: true
                }),
                prisma_1.prisma.problem.groupBy({
                    by: ['type'],
                    where,
                    _count: true
                }),
                prisma_1.prisma.problem.count({
                    where: Object.assign(Object.assign({}, where), { dueDate: { lt: new Date() }, status: { not: 'RESOLVED' } })
                }),
                prisma_1.prisma.problem.count({
                    where: Object.assign(Object.assign({}, where), { status: 'RESOLVED', resolvedAt: {
                            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
                        } })
                })
            ]);
            const statusStats = {};
            byStatus.forEach(item => {
                statusStats[item.status] = item._count;
            });
            const priorityStats = {};
            byPriority.forEach(item => {
                priorityStats[item.priority] = item._count;
            });
            const typeStats = {};
            byType.forEach(item => {
                typeStats[item.type] = item._count;
            });
            return {
                total,
                byStatus: statusStats,
                byPriority: priorityStats,
                byType: typeStats,
                overdue,
                recentlyResolved
            };
        });
    },
    // ========== DELETE PROBLEM ==========
    deleteProblem(problemId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const problem = yield prisma_1.prisma.problem.findUnique({
                where: { id: problemId }
            });
            if (!problem) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "Problem not found");
            }
            // Check permissions - only admin or reporter can delete
            const user = yield prisma_1.prisma.user.findUnique({
                where: { id: userId },
                select: { role: true, vendorId: true }
            });
            if (!user) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "User not found");
            }
            const canDelete = user.role === 'ADMIN' ||
                (user.role === 'VENDOR' && problem.vendorId === user.vendorId) ||
                problem.reportedById === userId;
            if (!canDelete) {
                throw new ApiError_1.default(http_status_1.default.FORBIDDEN, "You don't have permission to delete this problem");
            }
            yield prisma_1.prisma.problem.delete({
                where: { id: problemId }
            });
            return {
                message: "Problem deleted successfully"
            };
        });
    },
    // ========== HELPER METHODS ==========
    getPriorityColor(priority) {
        switch (priority) {
            case 'URGENT': return '#dc3545';
            case 'HIGH': return '#fd7e14';
            case 'MEDIUM': return '#ffc107';
            case 'LOW': return '#28a745';
            default: return '#6c757d';
        }
    },
    // ========== CHECK SLA BREACHES ==========
    checkSLABreaches() {
        return __awaiter(this, void 0, void 0, function* () {
            const problems = yield prisma_1.prisma.problem.findMany({
                where: {
                    dueDate: { lt: new Date() },
                    status: { not: 'RESOLVED' },
                    slaBreached: false
                }
            });
            for (const problem of problems) {
                yield prisma_1.prisma.problem.update({
                    where: { id: problem.id },
                    data: { slaBreached: true }
                });
                // Create SLA breach notification
                yield notification_service_1.NotificationService.createNotification({
                    userId: problem.reportedById,
                    title: "SLA Breach Alert",
                    message: `Problem "${problem.title}" has breached its SLA deadline`,
                    type: 'SLA_BREACHED',
                    metadata: {
                        problemId: problem.id,
                        title: problem.title,
                        dueDate: problem.dueDate,
                        priority: problem.priority
                    },
                    priority: 'HIGH'
                });
                // Notify assigned person if exists
                if (problem.assignedToId) {
                    yield notification_service_1.NotificationService.createNotification({
                        userId: problem.assignedToId,
                        title: "SLA Breach Alert",
                        message: `Assigned problem "${problem.title}" has breached its SLA deadline`,
                        type: 'SLA_BREACHED',
                        metadata: {
                            problemId: problem.id,
                            title: problem.title,
                            dueDate: problem.dueDate
                        },
                        priority: 'HIGH'
                    });
                }
            }
        });
    }
};
