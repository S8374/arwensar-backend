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
exports.DocumentService = void 0;
const prisma_1 = require("../../shared/prisma");
const http_status_1 = __importDefault(require("http-status"));
const mailtrap_service_1 = require("../../shared/mailtrap.service");
const notification_service_1 = require("../notification/notification.service");
const paginationHelper_1 = require("../../helper/paginationHelper");
const ApiError_1 = __importDefault(require("../../../error/ApiError"));
exports.DocumentService = {
    uploadDocument(userId, fileUrl, fileSize, mimeType, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield prisma_1.prisma.user.findUnique({
                where: { id: userId },
                select: { role: true, vendorId: true, supplierId: true }
            });
            if (!user) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "User not found");
            }
            let supplierId = data.supplierId;
            let vendorId = data.vendorId;
            // Role-based permission logic
            if (user.role === 'SUPPLIER') {
                supplierId = user.supplierId;
                if (!supplierId) {
                    throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, "Supplier profile not found");
                }
                const supplier = yield prisma_1.prisma.supplier.findUnique({
                    where: { id: supplierId },
                    select: { vendorId: true }
                });
                if (!supplier) {
                    throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "Supplier not found");
                }
                vendorId = supplier.vendorId;
            }
            else if (user.role === 'VENDOR') {
                vendorId = user.vendorId;
                if (!vendorId) {
                    throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, "Vendor profile not found");
                }
                if (supplierId) {
                    const supplier = yield prisma_1.prisma.supplier.findFirst({
                        where: {
                            id: supplierId,
                            vendorId: vendorId,
                            isDeleted: false
                        }
                    });
                    if (!supplier) {
                        throw new ApiError_1.default(http_status_1.default.FORBIDDEN, "Supplier not found or doesn't belong to you");
                    }
                }
            }
            // Admin can upload freely
            const documentData = {
                name: data.name,
                type: data.type,
                url: fileUrl,
                fileSize,
                mimeType,
                description: data.description,
                category: data.category,
                expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
                status: 'PENDING',
                uploadedById: userId,
                supplierId,
                vendorId,
                isPrivate: data.isPrivate || false,
                accessRoles: data.accessRoles || ['ADMIN', 'VENDOR']
            };
            // Create document — ONLY include valid relations
            const document = yield prisma_1.prisma.document.create({
                data: documentData,
                select: {
                    id: true,
                    name: true,
                    type: true,
                    url: true,
                    fileSize: true,
                    mimeType: true,
                    description: true,
                    category: true,
                    expiryDate: true,
                    status: true,
                    isPrivate: true,
                    accessRoles: true,
                    createdAt: true,
                    updatedAt: true,
                    reviewedAt: true, // ← ADD THESE
                    reviewedBy: true, // ← ADD THESE
                    reviewNotes: true, // ← ADD THESE
                    isVerified: true, // ← ADD THESE
                    supplierId: true,
                    vendorId: true,
                    uploadedById: true,
                    uploadedBy: {
                        select: {
                            id: true,
                            email: true,
                            role: true
                        }
                    }
                }
            });
            // Fetch supplier name separately for notification (since no relation)
            let supplierName = null;
            if (supplierId) {
                const supplier = yield prisma_1.prisma.supplier.findUnique({
                    where: { id: supplierId },
                    select: { name: true }
                });
                supplierName = (supplier === null || supplier === void 0 ? void 0 : supplier.name) || null;
            }
            // Create notification if supplier uploaded
            if (user.role === 'SUPPLIER' && vendorId) {
                const vendor = yield prisma_1.prisma.vendor.findUnique({
                    where: { id: vendorId },
                    select: { userId: true, companyName: true }
                });
                if (vendor === null || vendor === void 0 ? void 0 : vendor.userId) {
                    yield notification_service_1.NotificationService.createNotification({
                        userId: vendor.userId,
                        title: "New Document Uploaded",
                        message: `Supplier ${supplierName || 'Unknown'} uploaded a new document: ${document.name}`,
                        type: 'SYSTEM_ALERT',
                        metadata: {
                            documentId: document.id,
                            documentName: document.name,
                            supplierId: document.supplierId,
                            supplierName
                        }
                    });
                    // Send email (optional)
                    //     try {
                    //         // You'll need vendor email — fetch from user if needed
                    //         const vendorUser = await prisma.user.findUnique({
                    //             where: { id: vendor.userId },
                    //             select: { email: true }
                    //         });
                    //         if (vendorUser?.email) {
                    //             await mailtrapService.sendHtmlEmail({
                    //                 to: vendorUser.email,
                    //                 subject: `New Document Uploaded by ${supplierName || 'Supplier'}`,
                    //                 html: `
                    //   <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    //     <h2 style="color: #333;">New Document Uploaded</h2>
                    //     <p>Supplier <strong>${supplierName || 'A supplier'}</strong> has uploaded a new document.</p>
                    //     <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
                    //       <h3 style="margin-top: 0;">Document Details:</h3>
                    //       <p><strong>Name:</strong> ${document.name}</p>
                    //       <p><strong>Type:</strong> ${document.type}</p>
                    //       <p><strong>Category:</strong> ${document.category || 'N/A'}</p>
                    //       ${document.description ? `<p><strong>Description:</strong> ${document.description}</p>` : ''}
                    //     </div>
                    //     <p>Please review and approve/reject this document.</p>
                    //     <div style="text-align: center; margin: 30px 0;">
                    //       <a href="${process.env.FRONTEND_URL}/documents/${document.id}" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                    //         Review Document
                    //       </a>
                    //     </div>
                    //     <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                    //     <p style="color: #666; font-size: 12px;">© ${new Date().getFullYear()} CyberNark. All rights reserved.</p>
                    //   </div>
                    // `
                    //             });
                    //         }
                    //     } catch (error) {
                    //         console.error("Failed to send document upload email:", error);
                    //     }
                }
            }
            return document;
        });
    },
    getDocuments(userId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, filters = {}, paginationOptions = {}) {
            const { page, limit, skip, sortBy, sortOrder } = paginationHelper_1.paginationHelper.calculatePagination(paginationOptions);
            const user = yield prisma_1.prisma.user.findUnique({
                where: { id: userId },
                select: { role: true, vendorId: true, supplierId: true }
            });
            if (!user) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "User not found");
            }
            const where = {};
            // Role-based access control
            if (user.role === 'SUPPLIER') {
                if (!user.supplierId) {
                    throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, "Supplier profile not found");
                }
                where.supplierId = user.supplierId;
            }
            else if (user.role === 'VENDOR') {
                if (!user.vendorId) {
                    throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, "Vendor profile not found");
                }
                // Get all active supplier IDs belonging to this vendor
                const supplierIds = yield prisma_1.prisma.supplier.findMany({
                    where: {
                        vendorId: user.vendorId,
                        isDeleted: false
                    },
                    select: { id: true }
                }).then(suppliers => suppliers.map(s => s.id));
                where.OR = [
                    { vendorId: user.vendorId },
                    { supplierId: { in: supplierIds } }
                ];
            }
            // Apply user-provided filters (these can override or combine with the role-based where)
            if (filters.supplierId) {
                where.supplierId = filters.supplierId;
            }
            if (filters.vendorId) {
                where.vendorId = filters.vendorId;
            }
            if (filters.category) {
                where.category = filters.category;
            }
            if (filters.type) {
                where.type = filters.type;
            }
            if (filters.status) {
                where.status = filters.status;
            }
            if (filters.uploadedById) {
                where.uploadedById = filters.uploadedById;
            }
            if (filters.search) {
                where.OR = [
                    { name: { contains: filters.search, mode: 'insensitive' } },
                    { description: { contains: filters.search, mode: 'insensitive' } },
                    { type: { contains: filters.search, mode: 'insensitive' } }
                ];
            }
            if (filters.expiredOnly) {
                where.expiryDate = { lt: new Date() };
                where.status = { not: 'EXPIRED' };
            }
            if (filters.expiringSoon) {
                const thirtyDaysFromNow = new Date();
                thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
                where.expiryDate = {
                    gte: new Date(),
                    lte: thirtyDaysFromNow
                };
                where.status = { not: 'EXPIRED' };
            }
            const [documents, total] = yield Promise.all([
                prisma_1.prisma.document.findMany({
                    where,
                    select: {
                        id: true,
                        name: true,
                        type: true,
                        url: true,
                        fileSize: true,
                        mimeType: true,
                        description: true,
                        category: true,
                        expiryDate: true,
                        status: true,
                        reviewedAt: true,
                        reviewedBy: true,
                        reviewNotes: true,
                        isVerified: true,
                        isPrivate: true,
                        accessRoles: true,
                        createdAt: true,
                        updatedAt: true,
                        supplierId: true,
                        vendorId: true,
                        uploadedById: true,
                        uploadedBy: {
                            select: {
                                id: true,
                                email: true,
                                role: true,
                                profileImage: true
                            }
                        }
                    },
                    orderBy: { [sortBy]: sortOrder },
                    skip,
                    take: limit
                }),
                prisma_1.prisma.document.count({ where })
            ]);
            return {
                documents: documents,
                meta: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            };
        });
    },
    getDocumentStatistics(userId, supplierId) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield prisma_1.prisma.user.findUnique({
                where: { id: userId },
                select: { role: true, vendorId: true, supplierId: true }
            });
            if (!user) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "User not found");
            }
            const where = {};
            if (user.role === 'SUPPLIER') {
                if (!user.supplierId) {
                    throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, "Supplier profile not found");
                }
                where.supplierId = user.supplierId;
            }
            else if (user.role === 'VENDOR') {
                if (supplierId) {
                    // Check if supplier belongs to vendor
                    const supplier = yield prisma_1.prisma.supplier.findFirst({
                        where: {
                            id: supplierId,
                            vendorId: user.vendorId,
                            isDeleted: false
                        }
                    });
                    if (!supplier) {
                        throw new ApiError_1.default(http_status_1.default.FORBIDDEN, "Supplier not found or doesn't belong to you");
                    }
                    where.supplierId = supplierId;
                }
                else {
                    if (!user.vendorId) {
                        throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, "Vendor profile not found");
                    }
                    // Get all active supplier IDs belonging to this vendor
                    const supplierIds = yield prisma_1.prisma.supplier.findMany({
                        where: {
                            vendorId: user.vendorId,
                            isDeleted: false
                        },
                        select: { id: true }
                    }).then(suppliers => suppliers.map(s => s.id));
                    where.OR = [
                        { vendorId: user.vendorId },
                        { supplierId: { in: supplierIds } }
                    ];
                }
            }
            const [total, byStatus, byCategory, expiringSoon, expired, pendingReview] = yield Promise.all([
                prisma_1.prisma.document.count({ where }),
                prisma_1.prisma.document.groupBy({
                    by: ['status'],
                    where,
                    _count: { _all: true }
                }),
                prisma_1.prisma.document.groupBy({
                    by: ['category'],
                    where,
                    _count: { _all: true }
                }),
                prisma_1.prisma.document.count({
                    where: Object.assign(Object.assign({}, where), { expiryDate: {
                            gte: new Date(),
                            lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // +30 days
                        }, status: { not: 'EXPIRED' } })
                }),
                prisma_1.prisma.document.count({
                    where: Object.assign(Object.assign({}, where), { expiryDate: { lt: new Date() }, status: { not: 'EXPIRED' } })
                }),
                prisma_1.prisma.document.count({
                    where: Object.assign(Object.assign({}, where), { status: { in: ['PENDING', 'UNDER_REVIEW'] } })
                })
            ]);
            const statusStats = {};
            byStatus.forEach(item => {
                statusStats[item.status] = item._count._all;
            });
            const categoryStats = {};
            byCategory.forEach(item => {
                categoryStats[item.category || 'UNCATEGORIZED'] = item._count._all;
            });
            return {
                total,
                byStatus: statusStats,
                byCategory: categoryStats,
                expiringSoon,
                expired,
                pendingReview
            };
        });
    },
    getDocumentById(documentId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Fetch the document with only valid relations and needed scalar fields
            const document = yield prisma_1.prisma.document.findUnique({
                where: { id: documentId },
                select: {
                    id: true,
                    name: true,
                    type: true,
                    url: true,
                    fileSize: true,
                    mimeType: true,
                    description: true,
                    category: true,
                    expiryDate: true,
                    status: true,
                    reviewedAt: true,
                    reviewedBy: true,
                    reviewNotes: true,
                    isVerified: true,
                    isPrivate: true,
                    accessRoles: true,
                    createdAt: true,
                    updatedAt: true,
                    supplierId: true,
                    vendorId: true,
                    uploadedById: true,
                    uploadedBy: {
                        select: {
                            id: true,
                            email: true,
                            role: true,
                            profileImage: true // optional, if you want
                        }
                    }
                }
            });
            if (!document) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "Document not found");
            }
            // Fetch user for permission check
            const user = yield prisma_1.prisma.user.findUnique({
                where: { id: userId },
                select: { role: true, vendorId: true, supplierId: true }
            });
            if (!user) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "User not found");
            }
            // Manually fetch supplier + vendor data if needed for permission check
            let supplierVendorId = null;
            if (document.supplierId) {
                const supplier = yield prisma_1.prisma.supplier.findUnique({
                    where: { id: document.supplierId },
                    select: { vendorId: true }
                });
                supplierVendorId = (supplier === null || supplier === void 0 ? void 0 : supplier.vendorId) || null;
            }
            // Permission logic using fetched data
            const canView = user.role === 'ADMIN' ||
                (user.role === 'VENDOR' &&
                    (document.vendorId === user.vendorId ||
                        supplierVendorId === user.vendorId)) ||
                (user.role === 'SUPPLIER' && document.supplierId === user.supplierId);
            if (!canView) {
                throw new ApiError_1.default(http_status_1.default.FORBIDDEN, "You don't have permission to view this document");
            }
            // Optionally enrich the document with supplier and vendor names for response
            const enrichedDocument = Object.assign(Object.assign({}, document), { supplier: null, vendor: null });
            // Fetch supplier details if exists
            if (document.supplierId) {
                const supplier = yield prisma_1.prisma.supplier.findUnique({
                    where: { id: document.supplierId },
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
                enrichedDocument.supplier = supplier;
            }
            // Fetch vendor details if exists
            if (document.vendorId) {
                const vendor = yield prisma_1.prisma.vendor.findUnique({
                    where: { id: document.vendorId },
                    select: {
                        id: true,
                        companyName: true,
                        userId: true
                    }
                });
                enrichedDocument.vendor = vendor;
            }
            return enrichedDocument;
        });
    },
    updateDocument(documentId, userId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const document = yield prisma_1.prisma.document.findUnique({
                where: { id: documentId }
            });
            if (!document) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "Document not found");
            }
            // Check permissions
            const user = yield prisma_1.prisma.user.findUnique({
                where: { id: userId },
                select: { role: true, vendorId: true, supplierId: true }
            });
            if (!user) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "User not found");
            }
            const canUpdate = user.role === 'ADMIN' ||
                document.uploadedById === userId ||
                (user.role === 'VENDOR' && document.vendorId === user.vendorId) ||
                (user.role === 'SUPPLIER' && document.supplierId === user.supplierId);
            if (!canUpdate) {
                throw new ApiError_1.default(http_status_1.default.FORBIDDEN, "You don't have permission to update this document");
            }
            const updateData = Object.assign({}, data);
            // Handle URL field - make sure it's a string, not an object
            if (data.url && typeof data.url === 'object') {
                // If url is an object with a 'url' property, use that
                updateData.url = data.url.url || data.url;
            }
            else if (data.url) {
                updateData.url = data.url;
            }
            if (data.expiryDate) {
                updateData.expiryDate = new Date(data.expiryDate);
            }
            // Remove any undefined fields
            Object.keys(updateData).forEach(key => {
                if (updateData[key] === undefined) {
                    delete updateData[key];
                }
            });
            console.log("Updating document with data:", updateData); // Debug log
            const updatedDocument = yield prisma_1.prisma.document.update({
                where: { id: documentId },
                data: updateData,
                include: {
                    uploadedBy: {
                        select: {
                            id: true,
                            email: true,
                            role: true
                        }
                    }
                }
            });
            return updatedDocument;
        });
    },
    reviewDocument(documentId, reviewerId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            // Fetch document with only valid relations and necessary fields
            const document = yield prisma_1.prisma.document.findUnique({
                where: { id: documentId },
                select: {
                    id: true,
                    name: true,
                    vendorId: true,
                    supplierId: true,
                    uploadedById: true,
                    uploadedBy: {
                        select: {
                            id: true,
                            email: true,
                            role: true
                        }
                    }
                }
            });
            if (!document) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "Document not found");
            }
            // Check reviewer permissions
            const reviewer = yield prisma_1.prisma.user.findUnique({
                where: { id: reviewerId },
                select: { role: true, vendorId: true }
            });
            if (!reviewer) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "Reviewer not found");
            }
            if (reviewer.role !== 'VENDOR' && reviewer.role !== 'ADMIN') {
                throw new ApiError_1.default(http_status_1.default.FORBIDDEN, "Only vendors and admins can review documents");
            }
            // Vendor ownership check: manually verify if this document belongs to the reviewer's vendor
            if (reviewer.role === 'VENDOR') {
                if (!reviewer.vendorId) {
                    throw new ApiError_1.default(http_status_1.default.FORBIDDEN, "Reviewer has no vendor profile");
                }
                // Case 1: Document directly tied to vendor
                const isDirectVendorDoc = document.vendorId === reviewer.vendorId;
                // Case 2: Document uploaded by one of reviewer's suppliers
                let isSupplierDoc = false;
                if (document.supplierId) {
                    const supplier = yield prisma_1.prisma.supplier.findUnique({
                        where: { id: document.supplierId },
                        select: { vendorId: true }
                    });
                    isSupplierDoc = (supplier === null || supplier === void 0 ? void 0 : supplier.vendorId) === reviewer.vendorId;
                }
                if (!isDirectVendorDoc && !isSupplierDoc) {
                    throw new ApiError_1.default(http_status_1.default.FORBIDDEN, "You can only review documents from your suppliers or your vendor account");
                }
            }
            // Update the document
            const updatedDocument = yield prisma_1.prisma.document.update({
                where: { id: documentId },
                data: {
                    status: data.status,
                    reviewedAt: new Date(),
                    reviewedBy: reviewerId,
                    reviewNotes: data.reviewNotes,
                    isVerified: data.status === 'APPROVED'
                },
                select: {
                    id: true,
                    name: true,
                    type: true,
                    url: true,
                    category: true,
                    status: true,
                    reviewedAt: true,
                    reviewedBy: true,
                    reviewNotes: true,
                    isVerified: true,
                    isPrivate: true,
                    accessRoles: true,
                    createdAt: true,
                    updatedAt: true,
                    supplierId: true,
                    vendorId: true,
                    uploadedById: true,
                    uploadedBy: {
                        select: {
                            id: true,
                            email: true,
                            role: true
                        }
                    }
                }
            });
            // Notify uploader if different from reviewer
            if (document.uploadedById !== reviewerId && ((_a = document.uploadedBy) === null || _a === void 0 ? void 0 : _a.email)) {
                yield notification_service_1.NotificationService.createNotification({
                    userId: document.uploadedById,
                    title: `Document ${data.status}`,
                    message: `Your document "${document.name}" has been ${data.status.toLowerCase()}`,
                    type: 'SYSTEM_ALERT',
                    metadata: {
                        documentId: updatedDocument.id,
                        documentName: updatedDocument.name,
                        status: data.status,
                        reviewNotes: data.reviewNotes,
                        reviewedBy: reviewer.role
                    }
                });
                // Send email to uploader
                try {
                    yield mailtrap_service_1.mailtrapService.sendHtmlEmail({
                        to: document.uploadedBy.email,
                        subject: `Document ${data.status}: ${document.name}`,
                        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Document ${data.status}</h2>
            <p>Your document <strong>"${document.name}"</strong> has been ${data.status.toLowerCase()}.</p>
            
            ${data.reviewNotes ? `
              <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
                <h3 style="margin-top: 0;">Review Notes:</h3>
                <p>${data.reviewNotes}</p>
              </div>
            ` : ''}
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL}/documents/${updatedDocument.id}" 
                 style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                View Document
              </a>
            </div>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">© ${new Date().getFullYear()} CyberNark. All rights reserved.</p>
          </div>
        `
                    });
                }
                catch (error) {
                    console.error("Failed to send document review email:", error);
                }
            }
            return updatedDocument;
        });
    },
    deleteDocument(documentId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const document = yield prisma_1.prisma.document.findUnique({
                where: { id: documentId }
            });
            if (!document) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "Document not found");
            }
            // Check permissions
            const user = yield prisma_1.prisma.user.findUnique({
                where: { id: userId },
                select: { role: true, vendorId: true, supplierId: true }
            });
            if (!user) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "User not found");
            }
            const canDelete = user.role === 'ADMIN' ||
                document.uploadedById === userId ||
                (user.role === 'VENDOR' && document.vendorId === user.vendorId) ||
                (user.role === 'SUPPLIER' && document.supplierId === user.supplierId);
            if (!canDelete) {
                throw new ApiError_1.default(http_status_1.default.FORBIDDEN, "You don't have permission to delete this document");
            }
            yield prisma_1.prisma.document.delete({
                where: { id: documentId }
            });
            return {
                message: "Document deleted successfully"
            };
        });
    },
    getDocumentCategories() {
        return __awaiter(this, void 0, void 0, function* () {
            const categories = yield prisma_1.prisma.document.findMany({
                select: {
                    category: true
                },
                distinct: ['category'],
                where: {
                    category: { not: null }
                }
            });
            return categories.map(c => c.category || 'OTHER');
        });
    },
    getExpiringDocuments(userId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, days = 30) {
            const user = yield prisma_1.prisma.user.findUnique({
                where: { id: userId },
                select: { role: true, vendorId: true, supplierId: true }
            });
            if (!user) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "User not found");
            }
            const where = {
                expiryDate: {
                    gte: new Date(),
                    lte: new Date(new Date().setDate(new Date().getDate() + days))
                },
                status: { not: 'EXPIRED' }
            };
            if (user.role === 'SUPPLIER') {
                where.supplierId = user.supplierId;
            }
            else if (user.role === 'VENDOR') {
                where.OR = [
                    { vendorId: user.vendorId },
                    {
                        supplier: {
                            vendorId: user.vendorId
                        }
                    }
                ];
            }
            const documents = yield prisma_1.prisma.document.findMany({
                where,
                include: {
                    // Only include relations that exist in your schema
                    uploadedBy: {
                        select: {
                            id: true,
                            email: true
                        }
                    }
                },
                orderBy: {
                    expiryDate: 'asc'
                }
            });
            // If you need supplier/vendor info, fetch them separately
            const documentsWithRelations = yield Promise.all(documents.map((doc) => __awaiter(this, void 0, void 0, function* () {
                let supplier = null;
                let vendor = null;
                // Fetch supplier if supplierId exists
                if (doc.supplierId) {
                    supplier = yield prisma_1.prisma.supplier.findUnique({
                        where: { id: doc.supplierId },
                        select: { id: true, name: true }
                    });
                }
                // Fetch vendor if vendorId exists
                if (doc.vendorId) {
                    vendor = yield prisma_1.prisma.vendor.findUnique({
                        where: { id: doc.vendorId },
                        select: { id: true, companyName: true }
                    });
                }
                return Object.assign(Object.assign({}, doc), { supplier,
                    vendor });
            })));
            return documentsWithRelations;
        });
    },
    bulkUpdateDocumentStatus(userId, documentIds, status, reviewNotes) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield prisma_1.prisma.user.findUnique({
                where: { id: userId },
                select: { role: true, vendorId: true }
            });
            if (!user) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "User not found");
            }
            if (user.role !== 'VENDOR' && user.role !== 'ADMIN') {
                throw new ApiError_1.default(http_status_1.default.FORBIDDEN, "Only vendors and admins can bulk update documents");
            }
            const where = {
                id: { in: documentIds }
            };
            if (user.role === 'VENDOR') {
                where.OR = [
                    { vendorId: user.vendorId },
                    {
                        supplier: {
                            vendorId: user.vendorId
                        }
                    }
                ];
            }
            const updateData = {
                status,
                reviewedAt: new Date(),
                reviewedBy: userId,
                reviewNotes
            };
            if (status === 'APPROVED') {
                updateData.isVerified = true;
            }
            const result = yield prisma_1.prisma.document.updateMany({
                where,
                data: updateData
            });
            return {
                message: `${result.count} documents updated successfully`,
                count: result.count
            };
        });
    },
    checkExpiredDocuments() {
        return __awaiter(this, void 0, void 0, function* () {
            const expiredDocuments = yield prisma_1.prisma.document.findMany({
                where: {
                    expiryDate: { lt: new Date() },
                    status: { not: 'EXPIRED' }
                },
                include: {
                    uploadedBy: {
                        select: { id: true, email: true }
                    }
                }
            });
            let count = 0;
            for (const document of expiredDocuments) {
                // Add null check for document
                if (!document)
                    continue; // Skip if document is undefined
                // Update document status
                yield prisma_1.prisma.document.update({
                    where: { id: document.id },
                    data: { status: 'EXPIRED' }
                });
                count++;
                // Notify uploader - check if uploadedById exists
                if (document.uploadedById) {
                    yield notification_service_1.NotificationService.createNotification({
                        userId: document.uploadedById,
                        title: "Document Expired",
                        message: `Your document "${document.name}" has expired`,
                        type: 'SYSTEM_ALERT',
                        metadata: {
                            documentId: document.id,
                            documentName: document.name,
                            expiryDate: document.expiryDate
                        }
                    });
                }
                // Find related supplier if document has supplierId
                if (document.supplierId) {
                    const supplier = yield prisma_1.prisma.supplier.findUnique({
                        where: { id: document.supplierId },
                        select: {
                            userId: true,
                            name: true
                        }
                    });
                    // Notify supplier if they have a user and it's different from uploader
                    if ((supplier === null || supplier === void 0 ? void 0 : supplier.userId) && supplier.userId !== document.uploadedById) {
                        yield notification_service_1.NotificationService.createNotification({
                            userId: supplier.userId,
                            title: "Document Expired",
                            message: `A document for your supplier profile has expired: ${document.name}`,
                            type: 'SYSTEM_ALERT',
                            metadata: {
                                documentId: document.id,
                                documentName: document.name,
                                expiryDate: document.expiryDate,
                                supplierName: supplier.name
                            }
                        });
                    }
                }
            }
            return {
                message: `${count} documents marked as expired`,
                count
            };
        });
    },
    getMyDocuments(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield prisma_1.prisma.user.findUnique({
                where: { id: userId },
                select: { role: true, vendorId: true, supplierId: true }
            });
            if (!user) {
                throw new ApiError_1.default(http_status_1.default.NOT_FOUND, "User not found");
            }
            const where = {};
            if (user.role === 'SUPPLIER') {
                if (!user.supplierId) {
                    throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, "Supplier profile not found");
                }
                where.supplierId = user.supplierId;
            }
            else if (user.role === 'VENDOR') {
                if (!user.vendorId) {
                    throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, "Vendor profile not found");
                }
                // Vendor sees: documents directly uploaded to them + all from their suppliers
                const supplierIds = yield prisma_1.prisma.supplier.findMany({
                    where: { vendorId: user.vendorId, isDeleted: false },
                    select: { id: true }
                }).then(suppliers => suppliers.map(s => s.id));
                where.OR = [
                    { vendorId: user.vendorId },
                    { supplierId: { in: supplierIds } }
                ];
            }
            else if (user.role === 'ADMIN') {
                // Admin sees everything (optional: limit or filter later)
                // where = {} → all documents
            }
            else {
                throw new ApiError_1.default(http_status_1.default.FORBIDDEN, "Unauthorized role");
            }
            const documents = yield prisma_1.prisma.document.findMany({
                where,
                select: {
                    id: true,
                    name: true,
                    type: true,
                    url: true,
                    fileSize: true,
                    mimeType: true,
                    description: true,
                    category: true,
                    expiryDate: true,
                    status: true,
                    reviewedAt: true,
                    reviewNotes: true,
                    isVerified: true,
                    isPrivate: true,
                    createdAt: true,
                    updatedAt: true,
                    supplierId: true,
                    vendorId: true,
                    uploadedById: true,
                    uploadedBy: {
                        select: {
                            id: true,
                            email: true,
                            role: true,
                            profileImage: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            });
            // Enrich with supplier/vendor names (optional, for better UX)
            const enriched = yield Promise.all(documents.map((doc) => __awaiter(this, void 0, void 0, function* () {
                let supplier = null;
                let vendor = null;
                if (doc.supplierId) {
                    supplier = yield prisma_1.prisma.supplier.findUnique({
                        where: { id: doc.supplierId },
                        select: { id: true, name: true, email: true }
                    });
                }
                if (doc.vendorId) {
                    vendor = yield prisma_1.prisma.vendor.findUnique({
                        where: { id: doc.vendorId },
                        select: { id: true, companyName: true }
                    });
                }
                return Object.assign(Object.assign({}, doc), { supplier,
                    vendor });
            })));
            return enriched;
        });
    }
};
