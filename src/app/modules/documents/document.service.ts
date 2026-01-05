// src/modules/document/document.service.ts
import { Document, DocumentStatus, UserRole } from "@prisma/client";
import { prisma } from "../../shared/prisma";
import httpStatus from "http-status";
import { mailtrapService } from "../../shared/mailtrap.service";
import { NotificationService } from "../notification/notification.service";
import { paginationHelper } from "../../helper/paginationHelper";
import ApiError from "../../../error/ApiError";

export interface DocumentStats {
    total: number;
    byStatus: Record<string, number>;
    byCategory: Record<string, number>;
    expiringSoon: number;
    expired: number;
    pendingReview: number;
}

export interface DocumentFilters {
    supplierId?: string;
    vendorId?: string;
    category?: string;
    type?: string;
    status?: DocumentStatus;
    search?: string;
    expiredOnly?: boolean;
    expiringSoon?: boolean;
    uploadedById?: string;
}

export const DocumentService = {

    async uploadDocument(
        userId: string,
        fileUrl: string,
        fileSize: number,
        mimeType: string,
        data: any
    ): Promise<Document> {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { role: true, vendorId: true, supplierId: true }
        });

        if (!user) {
            throw new ApiError(httpStatus.NOT_FOUND, "User not found");
        }

        let supplierId = data.supplierId;
        let vendorId = data.vendorId;

        // Role-based permission logic
        if (user.role === 'SUPPLIER') {
            supplierId = user.supplierId;
            if (!supplierId) {
                throw new ApiError(httpStatus.BAD_REQUEST, "Supplier profile not found");
            }

            const supplier = await prisma.supplier.findUnique({
                where: { id: supplierId },
                select: { vendorId: true }
            });

            if (!supplier) {
                throw new ApiError(httpStatus.NOT_FOUND, "Supplier not found");
            }

            vendorId = supplier.vendorId;
        } else if (user.role === 'VENDOR') {
            vendorId = user.vendorId;
            if (!vendorId) {
                throw new ApiError(httpStatus.BAD_REQUEST, "Vendor profile not found");
            }

            if (supplierId) {
                const supplier = await prisma.supplier.findFirst({
                    where: {
                        id: supplierId,
                        vendorId: vendorId,
                        isDeleted: false
                    }
                });

                if (!supplier) {
                    throw new ApiError(httpStatus.FORBIDDEN, "Supplier not found or doesn't belong to you");
                }
            }
        }
        // Admin can upload freely

        const documentData: any = {
            name: data.name,
            type: data.type,
            url: fileUrl,
            fileSize,
            mimeType,
            description: data.description,
            category: data.category,
            expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
            status: 'PENDING' as DocumentStatus,
            uploadedById: userId,
            supplierId,
            vendorId,
            isPrivate: data.isPrivate || false,
            accessRoles: data.accessRoles || ['ADMIN', 'VENDOR']
        };

        // Create document — ONLY include valid relations
        const document = await prisma.document.create({
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
                reviewedAt: true,       // ← ADD THESE
                reviewedBy: true,       // ← ADD THESE
                reviewNotes: true,      // ← ADD THESE
                isVerified: true,       // ← ADD THESE
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
        let supplierName: string | null = null;
        if (supplierId) {
            const supplier = await prisma.supplier.findUnique({
                where: { id: supplierId },
                select: { name: true }
            });
            supplierName = supplier?.name || null;
        }

        // Create notification if supplier uploaded
        if (user.role === 'SUPPLIER' && vendorId) {
            const vendor = await prisma.vendor.findUnique({
                where: { id: vendorId },
                select: { userId: true, companyName: true }
            });

            if (vendor?.userId) {
                await NotificationService.createNotification({
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
    },


    async getDocuments(
        userId: string,
        filters: DocumentFilters = {},
        paginationOptions: any = {}
    ): Promise<{ documents: Document[]; meta: any }> {
        const { page, limit, skip, sortBy, sortOrder } = paginationHelper.calculatePagination(paginationOptions);

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { role: true, vendorId: true, supplierId: true }
        });

        if (!user) {
            throw new ApiError(httpStatus.NOT_FOUND, "User not found");
        }

        const where: any = {};

        // Role-based access control
        if (user.role === 'SUPPLIER') {
            if (!user.supplierId) {
                throw new ApiError(httpStatus.BAD_REQUEST, "Supplier profile not found");
            }
            where.supplierId = user.supplierId;
        } else if (user.role === 'VENDOR') {
            if (!user.vendorId) {
                throw new ApiError(httpStatus.BAD_REQUEST, "Vendor profile not found");
            }

            // Get all active supplier IDs belonging to this vendor
            const supplierIds = await prisma.supplier.findMany({
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

        const [documents, total] = await Promise.all([
            prisma.document.findMany({
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
            prisma.document.count({ where })
        ]);

        return {
            documents: documents as Document[],
            meta: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        };
    },


    async getDocumentStatistics(userId: string, supplierId?: string): Promise<DocumentStats> {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { role: true, vendorId: true, supplierId: true }
        });

        if (!user) {
            throw new ApiError(httpStatus.NOT_FOUND, "User not found");
        }

        const where: any = {};

        if (user.role === 'SUPPLIER') {
            if (!user.supplierId) {
                throw new ApiError(httpStatus.BAD_REQUEST, "Supplier profile not found");
            }
            where.supplierId = user.supplierId;
        } else if (user.role === 'VENDOR') {
            if (supplierId) {
                // Check if supplier belongs to vendor
                const supplier = await prisma.supplier.findFirst({
                    where: {
                        id: supplierId,
                        vendorId: user.vendorId as string,
                        isDeleted: false
                    }
                });
                if (!supplier) {
                    throw new ApiError(httpStatus.FORBIDDEN, "Supplier not found or doesn't belong to you");
                }
                where.supplierId = supplierId;
            } else {
                if (!user.vendorId) {
                    throw new ApiError(httpStatus.BAD_REQUEST, "Vendor profile not found");
                }

                // Get all active supplier IDs belonging to this vendor
                const supplierIds = await prisma.supplier.findMany({
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

        const [
            total,
            byStatus,
            byCategory,
            expiringSoon,
            expired,
            pendingReview
        ] = await Promise.all([
            prisma.document.count({ where }),
            prisma.document.groupBy({
                by: ['status'],
                where,
                _count: { _all: true }
            }),
            prisma.document.groupBy({
                by: ['category'],
                where,
                _count: { _all: true }
            }),
            prisma.document.count({
                where: {
                    ...where,
                    expiryDate: {
                        gte: new Date(),
                        lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // +30 days
                    },
                    status: { not: 'EXPIRED' }
                }
            }),
            prisma.document.count({
                where: {
                    ...where,
                    expiryDate: { lt: new Date() },
                    status: { not: 'EXPIRED' }
                }
            }),
            prisma.document.count({
                where: {
                    ...where,
                    status: { in: ['PENDING', 'UNDER_REVIEW'] }
                }
            })
        ]);

        const statusStats: Record<string, number> = {};
        byStatus.forEach(item => {
            statusStats[item.status] = item._count._all;
        });

        const categoryStats: Record<string, number> = {};
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
    },


    async getDocumentById(documentId: string, userId: string): Promise<Document> {
        // Fetch the document with only valid relations and needed scalar fields
        const document = await prisma.document.findUnique({
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
            throw new ApiError(httpStatus.NOT_FOUND, "Document not found");
        }

        // Fetch user for permission check
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { role: true, vendorId: true, supplierId: true }
        });

        if (!user) {
            throw new ApiError(httpStatus.NOT_FOUND, "User not found");
        }

        // Manually fetch supplier + vendor data if needed for permission check
        let supplierVendorId: string | null = null;
        if (document.supplierId) {
            const supplier = await prisma.supplier.findUnique({
                where: { id: document.supplierId },
                select: { vendorId: true }
            });
            supplierVendorId = supplier?.vendorId || null;
        }

        // Permission logic using fetched data
        const canView =
            user.role === 'ADMIN' ||
            (user.role === 'VENDOR' &&
                (document.vendorId === user.vendorId ||
                    supplierVendorId === user.vendorId)) ||
            (user.role === 'SUPPLIER' && document.supplierId === user.supplierId);

        if (!canView) {
            throw new ApiError(httpStatus.FORBIDDEN, "You don't have permission to view this document");
        }

        // Optionally enrich the document with supplier and vendor names for response
        const enrichedDocument: any = {
            ...document,
            supplier: null,
            vendor: null
        };

        // Fetch supplier details if exists
        if (document.supplierId) {
            const supplier = await prisma.supplier.findUnique({
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
            const vendor = await prisma.vendor.findUnique({
                where: { id: document.vendorId },
                select: {
                    id: true,
                    companyName: true,
                    userId: true
                }
            });
            enrichedDocument.vendor = vendor;
        }

        return enrichedDocument as Document;
    },


    async updateDocument(
        documentId: string,
        userId: string,
        data: any
    ): Promise<Document> {
        const document = await prisma.document.findUnique({
            where: { id: documentId }
        });

        if (!document) {
            throw new ApiError(httpStatus.NOT_FOUND, "Document not found");
        }

        // Check permissions
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { role: true, vendorId: true, supplierId: true }
        });

        if (!user) {
            throw new ApiError(httpStatus.NOT_FOUND, "User not found");
        }

        const canUpdate =
            user.role === 'ADMIN' ||
            document.uploadedById === userId ||
            (user.role === 'VENDOR' && document.vendorId === user.vendorId) ||
            (user.role === 'SUPPLIER' && document.supplierId === user.supplierId);

        if (!canUpdate) {
            throw new ApiError(httpStatus.FORBIDDEN, "You don't have permission to update this document");
        }

        const updateData: any = { ...data };

        // Handle URL field - make sure it's a string, not an object
        if (data.url && typeof data.url === 'object') {
            // If url is an object with a 'url' property, use that
            updateData.url = data.url.url || data.url;
        } else if (data.url) {
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

        const updatedDocument = await prisma.document.update({
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
    }
    ,

    async reviewDocument(
        documentId: string,
        reviewerId: string,
        data: any
    ): Promise<Document> {
        // Fetch document with only valid relations and necessary fields
        const document = await prisma.document.findUnique({
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
            throw new ApiError(httpStatus.NOT_FOUND, "Document not found");
        }

        // Check reviewer permissions
        const reviewer = await prisma.user.findUnique({
            where: { id: reviewerId },
            select: { role: true, vendorId: true }
        });

        if (!reviewer) {
            throw new ApiError(httpStatus.NOT_FOUND, "Reviewer not found");
        }

        if (reviewer.role !== 'VENDOR' && reviewer.role !== 'ADMIN') {
            throw new ApiError(httpStatus.FORBIDDEN, "Only vendors and admins can review documents");
        }

        // Vendor ownership check: manually verify if this document belongs to the reviewer's vendor
        if (reviewer.role === 'VENDOR') {
            if (!reviewer.vendorId) {
                throw new ApiError(httpStatus.FORBIDDEN, "Reviewer has no vendor profile");
            }

            // Case 1: Document directly tied to vendor
            const isDirectVendorDoc = document.vendorId === reviewer.vendorId;

            // Case 2: Document uploaded by one of reviewer's suppliers
            let isSupplierDoc = false;
            if (document.supplierId) {
                const supplier = await prisma.supplier.findUnique({
                    where: { id: document.supplierId },
                    select: { vendorId: true }
                });
                isSupplierDoc = supplier?.vendorId === reviewer.vendorId;
            }

            if (!isDirectVendorDoc && !isSupplierDoc) {
                throw new ApiError(httpStatus.FORBIDDEN, "You can only review documents from your suppliers or your vendor account");
            }
        }

        // Update the document
        const updatedDocument = await prisma.document.update({
            where: { id: documentId },
            data: {
                status: data.status as DocumentStatus,
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
        if (document.uploadedById !== reviewerId && document.uploadedBy?.email) {
            await NotificationService.createNotification({
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
                await mailtrapService.sendHtmlEmail({
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
            } catch (error) {
                console.error("Failed to send document review email:", error);
            }
        }

        return updatedDocument as unknown as Document;
    },


    async deleteDocument(documentId: string, userId: string): Promise<{ message: string }> {
        const document = await prisma.document.findUnique({
            where: { id: documentId }
        });

        if (!document) {
            throw new ApiError(httpStatus.NOT_FOUND, "Document not found");
        }

        // Check permissions
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { role: true, vendorId: true, supplierId: true }
        });

        if (!user) {
            throw new ApiError(httpStatus.NOT_FOUND, "User not found");
        }

        const canDelete =
            user.role === 'ADMIN' ||
            document.uploadedById === userId ||
            (user.role === 'VENDOR' && document.vendorId === user.vendorId) ||
            (user.role === 'SUPPLIER' && document.supplierId === user.supplierId);

        if (!canDelete) {
            throw new ApiError(httpStatus.FORBIDDEN, "You don't have permission to delete this document");
        }

        await prisma.document.delete({
            where: { id: documentId }
        });

        return {
            message: "Document deleted successfully"
        };
    },




    async getDocumentCategories(): Promise<string[]> {
        const categories = await prisma.document.findMany({
            select: {
                category: true
            },
            distinct: ['category'],
            where: {
                category: { not: null }
            }
        });

        return categories.map(c => c.category || 'OTHER');
    },


    async getExpiringDocuments(userId: string, days: number = 30): Promise<Document[]> {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { role: true, vendorId: true, supplierId: true }
        });

        if (!user) {
            throw new ApiError(httpStatus.NOT_FOUND, "User not found");
        }

        const where: any = {
            expiryDate: {
                gte: new Date(),
                lte: new Date(new Date().setDate(new Date().getDate() + days))
            },
            status: { not: 'EXPIRED' }
        };

        if (user.role === 'SUPPLIER') {
            where.supplierId = user.supplierId;
        } else if (user.role === 'VENDOR') {
            where.OR = [
                { vendorId: user.vendorId },
                {
                    supplier: {
                        vendorId: user.vendorId
                    }
                }
            ];
        }

        const documents = await prisma.document.findMany({
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
        const documentsWithRelations = await Promise.all(
            documents.map(async (doc) => {
                let supplier = null;
                let vendor = null;

                // Fetch supplier if supplierId exists
                if (doc.supplierId) {
                    supplier = await prisma.supplier.findUnique({
                        where: { id: doc.supplierId },
                        select: { id: true, name: true }
                    });
                }

                // Fetch vendor if vendorId exists
                if (doc.vendorId) {
                    vendor = await prisma.vendor.findUnique({
                        where: { id: doc.vendorId },
                        select: { id: true, companyName: true }
                    });
                }

                return {
                    ...doc,
                    supplier,
                    vendor
                };
            })
        );

        return documentsWithRelations;
    },


    async bulkUpdateDocumentStatus(
        userId: string,
        documentIds: string[],
        status: DocumentStatus,
        reviewNotes?: string
    ): Promise<{ message: string; count: number }> {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { role: true, vendorId: true }
        });

        if (!user) {
            throw new ApiError(httpStatus.NOT_FOUND, "User not found");
        }

        if (user.role !== 'VENDOR' && user.role !== 'ADMIN') {
            throw new ApiError(httpStatus.FORBIDDEN, "Only vendors and admins can bulk update documents");
        }

        const where: any = {
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

        const updateData: any = {
            status,
            reviewedAt: new Date(),
            reviewedBy: userId,
            reviewNotes
        };

        if (status === 'APPROVED') {
            updateData.isVerified = true;
        }

        const result = await prisma.document.updateMany({
            where,
            data: updateData
        });

        return {
            message: `${result.count} documents updated successfully`,
            count: result.count
        };
    },

    async checkExpiredDocuments(): Promise<{ message: string; count: number }> {
        const expiredDocuments = await prisma.document.findMany({
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
            if (!document) continue; // Skip if document is undefined

            // Update document status
            await prisma.document.update({
                where: { id: document.id },
                data: { status: 'EXPIRED' }
            });

            count++;

            // Notify uploader - check if uploadedById exists
            if (document.uploadedById) {
                await NotificationService.createNotification({
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
                const supplier = await prisma.supplier.findUnique({
                    where: { id: document.supplierId },
                    select: {
                        userId: true,
                        name: true
                    }
                });

                // Notify supplier if they have a user and it's different from uploader
                if (supplier?.userId && supplier.userId !== document.uploadedById) {
                    await NotificationService.createNotification({
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
    },

    async getMyDocuments(userId: string): Promise<Document[]> {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { role: true, vendorId: true, supplierId: true }
        });

        if (!user) {
            throw new ApiError(httpStatus.NOT_FOUND, "User not found");
        }

        const where: any = {};

        if (user.role === 'SUPPLIER') {
            if (!user.supplierId) {
                throw new ApiError(httpStatus.BAD_REQUEST, "Supplier profile not found");
            }
            where.supplierId = user.supplierId;
        }
        else if (user.role === 'VENDOR') {
            if (!user.vendorId) {
                throw new ApiError(httpStatus.BAD_REQUEST, "Vendor profile not found");
            }

            // Vendor sees: documents directly uploaded to them + all from their suppliers
            const supplierIds = await prisma.supplier.findMany({
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
            throw new ApiError(httpStatus.FORBIDDEN, "Unauthorized role");
        }

        const documents = await prisma.document.findMany({
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
        const enriched = await Promise.all(
            documents.map(async (doc) => {
                let supplier = null;
                let vendor = null;

                if (doc.supplierId) {
                    supplier = await prisma.supplier.findUnique({
                        where: { id: doc.supplierId },
                        select: { id: true, name: true, email: true }
                    });
                }

                if (doc.vendorId) {
                    vendor = await prisma.vendor.findUnique({
                        where: { id: doc.vendorId },
                        select: { id: true, companyName: true }
                    });
                }

                return {
                    ...doc,
                    supplier,
                    vendor
                };
            })
        );

        return enriched as unknown as Document[];
    }
};