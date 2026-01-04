// src/modules/report/report.service.ts
import { Report, ReportType, ReportStatus, UserRole } from "@prisma/client";
import { prisma } from "../../shared/prisma";
import httpStatus from "http-status";
import ApiError from "../../../error/ApiError";
import { mailtrapService } from "../../shared/mailtrap.service";
import { generatePDF } from "../../../utils/pdfGenerator";
import fs from "fs";
import path from "path";

export interface ReportFilters {
  vendorId?: string;
  supplierId?: string;
  startDate?: Date;
  endDate?: Date;
  riskLevel?: string[];
  status?: string[];
  type?: ReportType[];
}

export const ReportService = {
  // ========== VALIDATE USER PERMISSIONS ==========
  async validateUserPermissions(userId: string, requestedVendorId?: string, requestedSupplierId?: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        vendorProfile: {
          select: { id: true }
        },
        supplierProfile: {
          select: { id: true, vendorId: true }
        }
      }
    });
    console.log("user", user);
    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, "User not found");
    }

    let finalVendorId: string | undefined;
    let finalSupplierId: string | undefined;

    // For ADMIN: Can access any vendor/supplier
    if (user.role === UserRole.ADMIN) {
      if (requestedVendorId) {
        // Verify vendor exists
        const vendor = await prisma.vendor.findUnique({
          where: { id: requestedVendorId }
        });
        if (!vendor) {
          throw new ApiError(httpStatus.NOT_FOUND, "Vendor not found");
        }
        finalVendorId = requestedVendorId;
      }

      if (requestedSupplierId) {
        // Verify supplier exists and get its vendor
        const supplier = await prisma.supplier.findUnique({
          where: { id: requestedSupplierId }
        });
        console.log("Reqested supplier", supplier);
        if (!supplier) {
          throw new ApiError(httpStatus.NOT_FOUND, "Supplier not found");
        }
        finalSupplierId = requestedSupplierId;
        if (!finalVendorId) {
          finalVendorId = supplier.vendorId;
        }
      }
    }
    // For VENDOR: Can only access their own vendors and their suppliers
    else if (user.role === UserRole.VENDOR) {
      if (!user.vendorProfile) {
        throw new ApiError(httpStatus.FORBIDDEN, "Vendor profile not found");
      }

      finalVendorId = user.vendorProfile.id;

      // Vendor can't access other vendors
      if (requestedVendorId && requestedVendorId !== finalVendorId) {
        throw new ApiError(httpStatus.FORBIDDEN, "Access to other vendor data is not allowed");
      }

      if (requestedSupplierId) {
        // Verify supplier belongs to this vendor
        const supplier = await prisma.supplier.findFirst({
          where: {
            id: requestedSupplierId,
            vendorId: finalVendorId
          }
        });
        if (!supplier) {
          throw new ApiError(httpStatus.FORBIDDEN, "Supplier does not belong to your vendor");
        }
        finalSupplierId = requestedSupplierId;
      }
    }
    // For SUPPLIER: Can only access their own data
    else if (user.role === UserRole.SUPPLIER) {
      if (!user.supplierProfile) {
        throw new ApiError(httpStatus.FORBIDDEN, "Supplier profile not found");
      }

      finalSupplierId = user.supplierProfile.id;
      finalVendorId = user.supplierProfile.vendorId;
      console.log("finalSupplierId", finalSupplierId);
      console.log("finalVendorId", finalVendorId)
      // Supplier can only generate reports for themselves
      if (requestedSupplierId && requestedSupplierId !== finalSupplierId) {
        throw new ApiError(httpStatus.FORBIDDEN, "Access to other supplier data is not allowed");
      }
    }

    return { finalVendorId, finalSupplierId, userRole: user.role };
  },

  // ========== GENERATE REPORT ==========
  async generateReport(userId: string, data: any): Promise<Report> {
    // Validate permissions
    const { finalVendorId, finalSupplierId, userRole } = await this.validateUserPermissions(
      userId,
      data.vendorId,
      data.supplierId
    );

    if (!finalVendorId) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Vendor ID is required to generate report"
      );
    }

    // Verify vendor exists
    const vendor = await prisma.vendor.findUnique({
      where: { id: finalVendorId }
    });

    if (!vendor) {
      throw new ApiError(httpStatus.NOT_FOUND, "Vendor not found");
    }

    let reportData: any = {};
    let documentUrl = "";
    let filters = data.filters || {};

    // Map frontend report type to backend enum if needed
    let reportType: ReportType;
    if (typeof data.reportType === 'string') {
      // Convert frontend string to enum
      switch (data.reportType.toUpperCase()) {
        case 'RISK_ASSESSMENT':
        case 'RISK':
          reportType = ReportType.RISK_ASSESSMENT;
          break;
        case 'COMPLIANCE_REPORT':
        case 'COMPLIANCE':
          reportType = ReportType.COMPLIANCE_REPORT;
          break;
        case 'SUPPLIER_EVALUATION':
        case 'SUPPLIER':
          reportType = ReportType.SUPPLIER_EVALUATION;
          break;
        case 'FINANCIAL_ANALYSIS':
        case 'FINANCIAL':
          reportType = ReportType.FINANCIAL_ANALYSIS;
          break;
        case 'SECURITY_AUDIT':
        case 'SECURITY':
          reportType = ReportType.SECURITY_AUDIT;
          break;
        case 'PERFORMANCE_REVIEW':
        case 'PERFORMANCE':
          reportType = ReportType.PERFORMANCE_REVIEW;
          break;
        case 'INCIDENT_REPORT':
        case 'INCIDENT':
          reportType = ReportType.INCIDENT_REPORT;
          break;
        case 'CUSTOM':
          reportType = ReportType.CUSTOM;
          break;
        default:
          throw new ApiError(httpStatus.BAD_REQUEST, `Invalid report type: ${data.reportType}`);
      }
    } else {
      reportType = data.reportType;
    }

    // Generate report based on type
    switch (reportType) {
      case ReportType.RISK_ASSESSMENT:
        reportData = await this.generateRiskAssessmentReport({
          vendorId: finalVendorId,
          supplierId: finalSupplierId
        }, filters);
        documentUrl = await generatePDF({
          title: data.title,
          type: 'RISK_ASSESSMENT',
          data: reportData,
          template: 'risk-assessment',
          vendorId: finalVendorId,
          userId: userId
        });
        break;

      case ReportType.COMPLIANCE_REPORT:
        reportData = await this.generateComplianceReport({
          vendorId: finalVendorId,
          supplierId: finalSupplierId
        }, filters);
        documentUrl = await generatePDF({
          title: data.title,
          type: 'COMPLIANCE',
          data: reportData,
          template: 'compliance',
          vendorId: finalVendorId,
          userId: userId
        });
        break;

      case ReportType.SUPPLIER_EVALUATION:
        if (!finalSupplierId) {
          throw new ApiError(
            httpStatus.BAD_REQUEST,
            "Supplier ID is required for supplier evaluation report"
          );
        }
        reportData = await this.generateSupplierEvaluationReport({
          vendorId: finalVendorId,
          supplierId: finalSupplierId
        }, filters);
        documentUrl = await generatePDF({
          title: data.title,
          type: 'SUPPLIER_EVALUATION',
          data: reportData,
          template: 'supplier-evaluation',
          vendorId: finalVendorId,
          userId: userId
        });
        break;

      case ReportType.FINANCIAL_ANALYSIS:
        if (userRole !== UserRole.ADMIN) {
          throw new ApiError(
            httpStatus.FORBIDDEN,
            "Only admin can generate financial analysis reports"
          );
        }
        reportData = await this.generateFinancialAnalysisReport({
          vendorId: finalVendorId,
          supplierId: finalSupplierId
        }, filters);
        documentUrl = await generatePDF({
          title: data.title,
          type: 'FINANCIAL',
          data: reportData,
          template: 'financial',
          vendorId: finalVendorId,
          userId: userId
        });
        break;

      case ReportType.SECURITY_AUDIT:
        reportData = await this.generateSecurityAuditReport({
          vendorId: finalVendorId,
          supplierId: finalSupplierId
        }, filters);
        documentUrl = await generatePDF({
          title: data.title,
          type: 'SECURITY_AUDIT',
          data: reportData,
          template: 'security-audit',
          vendorId: finalVendorId,
          userId: userId
        });
        break;

      case ReportType.PERFORMANCE_REVIEW:
        reportData = await this.generatePerformanceReviewReport({
          vendorId: finalVendorId,
          supplierId: finalSupplierId
        }, filters);
        documentUrl = await generatePDF({
          title: data.title,
          type: 'PERFORMANCE_REVIEW',
          data: reportData,
          template: 'performance-review',
          vendorId: finalVendorId,
          userId: userId
        });
        break;

      case ReportType.INCIDENT_REPORT:
        reportData = await this.generateIncidentReport({
          vendorId: finalVendorId,
          supplierId: finalSupplierId
        }, filters);
        documentUrl = await generatePDF({
          title: data.title,
          type: 'INCIDENT_REPORT',
          data: reportData,
          template: 'incident-report',
          vendorId: finalVendorId,
          userId: userId
        });
        break;

      case ReportType.CUSTOM:
        reportData = await this.generateVendorSummaryReport(
          finalVendorId,      // vendorId
          userId,             // userId
          {
            vendorId: finalVendorId,
            supplierId: finalSupplierId
          },
          filters             // filters
        );

        documentUrl = await generatePDF({
          title: data.title,
          type: 'VENDOR_SUMMARY',
          data: reportData,
          template: 'vendor-summary',
          vendorId: finalVendorId,
          userId: userId
        });
        break;


      default:
        throw new ApiError(httpStatus.BAD_REQUEST, `Invalid report type: ${data.reportType}`);
    }

    // Calculate actual file size
    let fileSize = 1024;
    if (documentUrl) {
      try {
        const filePath = path.join(
          __dirname,
          '../..',
          documentUrl.replace('/', '')
        );
        const stats = fs.statSync(filePath);
        fileSize = stats.size;
      } catch (error) {
        console.error("Could not get file size:", error);
      }
    }

    // Create report record
    const report = await prisma.report.create({
      data: {
        title: data.title,
        reportType: reportType,
        description: data.description,
        documentUrl,
        documentType: 'application/pdf',
        fileSize,
        parameters: data.parameters || {},
        filters,
        createdById: userId,
        vendorId: finalVendorId,
        supplierId: finalSupplierId || null,
        status: ReportStatus.GENERATED
      }
    });

    // Create notification
    await prisma.notification.create({
      data: {
        userId,
        title: "Report Generated",
        message: `Report "${data.title}" has been generated successfully`,
        type: 'REPORT_GENERATED',
        metadata: {
          reportId: report.id,
          reportType: report.reportType,
          documentUrl
        }
      }
    });

    return report;
  },

  // ========== GENERATE VENDOR SUMMARY REPORT (OVERALL SUPPLIERS) ==========
  async generateVendorSummaryReport(vendorId: string, userId: string, data: { vendorId: string; supplierId?: string; }, filters: any): Promise<any> {
    const where: any = {
      vendorId: data.vendorId,
      isDeleted: false
    };

    if (data.supplierId) {
      where.id = data.supplierId;
    }

    // Get vendor details
    const vendor = await prisma.vendor.findUnique({
      where: { id: data.vendorId },
      select: {
        companyName: true,
        businessEmail: true,
        contactNumber: true
      }
    });

    if (!vendor) {
      throw new ApiError(httpStatus.NOT_FOUND, "Vendor not found");
    }

    // Get all suppliers
    const suppliers = await prisma.supplier.findMany({
      where,
      include: {
        vendor: {
          select: {
            companyName: true
          }
        },
        assessmentSubmissions: {
          where: {
            status: 'APPROVED',
            submittedAt: {
              gte: filters.startDate || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
              lte: filters.endDate || new Date()
            }
          },
          orderBy: { submittedAt: 'desc' },
          take: 1
        }
      }
    });

    // Calculate summary statistics
    const totalSuppliers = suppliers.length;
    const activeSuppliers = suppliers.filter(s => s.isActive).length;
    const highRiskSuppliers = suppliers.filter(s => s.riskLevel === 'HIGH' || s.riskLevel === 'CRITICAL').length;

    // Calculate scores
    const averageBIVScore = totalSuppliers > 0 ?
      suppliers.reduce((sum, s) => sum + (s.bivScore?.toNumber() || 0), 0) / totalSuppliers : 0;

    const averageComplianceRate = totalSuppliers > 0 ?
      suppliers.reduce((sum, s) => sum + (s.complianceRate?.toNumber() || 0), 0) / totalSuppliers : 0;

    // Risk distribution
    const riskDistribution = suppliers.reduce((acc: any, supplier) => {
      const level = supplier.riskLevel || 'UNKNOWN';
      acc[level] = (acc[level] || 0) + 1;
      return acc;
    }, {});

    // Category breakdown
    const categoryBreakdown = suppliers.reduce((acc: any, supplier) => {
      const category = supplier.category || 'UNCATEGORIZED';
      if (!acc[category]) {
        acc[category] = {
          count: 0,
          totalBIVScore: 0,
          highRisk: 0
        };
      }
      acc[category].count++;
      acc[category].totalBIVScore += supplier.bivScore?.toNumber() || 0;
      if (supplier.riskLevel === 'HIGH' || supplier.riskLevel === 'CRITICAL') {
        acc[category].highRisk++;
      }
      return acc;
    }, {});

    // Get recent problems
    const recentProblems = await prisma.problem.findMany({
      where: {
        vendorId: data.vendorId,
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    // Get upcoming contract expiries
    const upcomingExpiries = suppliers.filter(s =>
      s.contractEndDate &&
      s.contractEndDate < new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // Next 90 days
    ).map(s => ({
      id: s.id,
      name: s.name,
      contractEndDate: s.contractEndDate,
      daysRemaining: Math.ceil(
        (s.contractEndDate!.getTime() - new Date().getTime()) /
        (1000 * 60 * 60 * 24)
      )
    }));

    // Get overdue assessments
    const overdueAssessments = suppliers.filter(s =>
      s.nextAssessmentDue &&
      s.nextAssessmentDue < new Date()
    ).map(s => ({
      id: s.id,
      name: s.name,
      nextAssessmentDue: s.nextAssessmentDue,
      daysOverdue: Math.ceil(
        (new Date().getTime() - s.nextAssessmentDue!.getTime()) /
        (1000 * 60 * 60 * 24)
      )
    }));

    // Top performing suppliers
    const topPerformers = suppliers
      .filter(s => s.bivScore && s.bivScore.toNumber() > 70)
      .sort((a, b) => (b.bivScore?.toNumber() || 0) - (a.bivScore?.toNumber() || 0))
      .slice(0, 10)
      .map(s => ({
        id: s.id,
        name: s.name,
        bivScore: s.bivScore?.toNumber(),
        riskLevel: s.riskLevel,
        category: s.category
      }));

    return {
      generatedAt: new Date().toISOString(),
      vendor: {
        id: data.vendorId,
        name: vendor.companyName,
        email: vendor.businessEmail
      },
      summary: {
        totalSuppliers,
        activeSuppliers,
        highRiskSuppliers,
        averageBIVScore: parseFloat(averageBIVScore.toFixed(2)),
        averageComplianceRate: parseFloat(averageComplianceRate.toFixed(2)),
        recentProblems: recentProblems.length,
        upcomingExpiries: upcomingExpiries.length,
        overdueAssessments: overdueAssessments.length
      },
      riskDistribution,
      categoryBreakdown: Object.entries(categoryBreakdown).map(([category, data]: [string, any]) => ({
        category,
        count: data.count,
        averageBIVScore: parseFloat((data.totalBIVScore / data.count).toFixed(2)),
        highRiskPercentage: parseFloat(((data.highRisk / data.count) * 100).toFixed(2))
      })),
      topPerformers,
      upcomingExpiries: upcomingExpiries.slice(0, 10),
      overdueAssessments: overdueAssessments.slice(0, 10),
      recentProblems: recentProblems.slice(0, 10).map(p => ({
        id: p.id,
        title: p.title,
        status: p.status,
        priority: p.priority,
        createdAt: p.createdAt
      }))
    };
  },

  // ========== GENERATE RISK ASSESSMENT REPORT ==========
  async generateRiskAssessmentReport(data: { vendorId: string; supplierId?: string }, filters: any): Promise<any> {
    const where: any = {
      vendorId: data.vendorId,
      isDeleted: false,
      isActive: true
    };

    if (data.supplierId) {
      where.id = data.supplierId;
    }

    if (filters.riskLevel && filters.riskLevel.length > 0) {
      where.riskLevel = { in: filters.riskLevel };
    }

    const suppliers = await prisma.supplier.findMany({
      where,
      include: {
        vendor: {
          select: {
            companyName: true,
            businessEmail: true
          }
        }
      }
    });

    // Get assessment submissions separately for each supplier
    const suppliersWithSubmissions = await Promise.all(
      suppliers.map(async (supplier) => {
        const assessmentSubmissions = await prisma.assessmentSubmission.findMany({
          where: {
            supplierId: supplier.id,
            status: 'APPROVED',
            submittedAt: {
              gte: filters.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
              lte: filters.endDate || new Date()
            }
          },
          orderBy: { submittedAt: 'desc' },
          take: 1
        });

        return {
          ...supplier,
          assessmentSubmissions
        };
      })
    );

    const riskDistribution = suppliersWithSubmissions.reduce((acc: any, supplier) => {
      const level = supplier.riskLevel || 'UNKNOWN';
      acc[level] = (acc[level] || 0) + 1;
      return acc;
    }, {});

    const highRiskSuppliers = suppliersWithSubmissions
      .filter(s => s.riskLevel === 'HIGH' || s.riskLevel === 'CRITICAL')
      .map(s => ({
        id: s.id,
        name: s.name,
        email: s.email,
        bivScore: s.bivScore?.toNumber(),
        businessScore: s.businessScore?.toNumber(),
        integrityScore: s.integrityScore?.toNumber(),
        availabilityScore: s.availabilityScore?.toNumber(),
        lastAssessmentDate: s.lastAssessmentDate,
        vendorName: s.vendor.companyName
      }));

    const averageBIVScore = suppliersWithSubmissions.length > 0 ?
      suppliersWithSubmissions.reduce((sum, s) => sum + (s.bivScore?.toNumber() || 0), 0) / suppliersWithSubmissions.length : 0;

    const categoryBreakdown = suppliersWithSubmissions.reduce((acc: any, supplier) => {
      const category = supplier.category || 'UNCATEGORIZED';
      if (!acc[category]) {
        acc[category] = {
          count: 0,
          totalBIVScore: 0,
          highRisk: 0
        };
      }
      acc[category].count++;
      acc[category].totalBIVScore += supplier.bivScore?.toNumber() || 0;
      if (supplier.riskLevel === 'HIGH' || supplier.riskLevel === 'CRITICAL') {
        acc[category].highRisk++;
      }
      return acc;
    }, {});

    return {
      generatedAt: new Date().toISOString(),
      vendor: {
        id: data.vendorId,
        name: suppliersWithSubmissions[0]?.vendor.companyName || 'Unknown'
      },
      totalSuppliers: suppliersWithSubmissions.length,
      riskDistribution,
      averageBIVScore: parseFloat(averageBIVScore.toFixed(2)),
      highRiskSuppliers: highRiskSuppliers.slice(0, 20),
      categoryBreakdown: Object.entries(categoryBreakdown).map(([category, data]: [string, any]) => ({
        category,
        count: data.count,
        averageBIVScore: parseFloat((data.totalBIVScore / data.count).toFixed(2)),
        highRiskPercentage: parseFloat(((data.highRisk / data.count) * 100).toFixed(2))
      })),
      summary: {
        lowRisk: riskDistribution.LOW || 0,
        mediumRisk: riskDistribution.MEDIUM || 0,
        highRisk: riskDistribution.HIGH || 0,
        criticalRisk: riskDistribution.CRITICAL || 0,
        totalHighRisk: (riskDistribution.HIGH || 0) + (riskDistribution.CRITICAL || 0)
      }
    };
  },

  // ========== GENERATE COMPLIANCE REPORT ==========
  async generateComplianceReport(data: { vendorId: string; supplierId?: string }, filters: any): Promise<any> {
    const where: any = {
      vendorId: data.vendorId,
      status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'] }
    };

    if (data.supplierId) {
      where.supplierId = data.supplierId;
    }

    if (filters.startDate || filters.endDate) {
      where.submittedAt = {};
      if (filters.startDate) where.submittedAt.gte = new Date(filters.startDate);
      if (filters.endDate) where.submittedAt.lte = new Date(filters.endDate);
    }

    const submissions = await prisma.assessmentSubmission.findMany({
      where,
      include: {
        assessment: {
          select: { title: true, stage: true }
        },
        supplier: {
          select: { name: true, email: true }
        }
      },
      orderBy: { submittedAt: 'desc' }
    });

    // Group by month and type
    const complianceByMonth: Record<string, { total: number; approved: number; initial: number; full: number }> = {};
    submissions.forEach(submission => {
      if (submission.submittedAt) {
        const month = submission.submittedAt.toLocaleString('default', {
          month: 'short',
          year: 'numeric'
        });

        if (!complianceByMonth[month]) {
          complianceByMonth[month] = { total: 0, approved: 0, initial: 0, full: 0 };
        }

        complianceByMonth[month].total++;
        if (submission.status === 'APPROVED') {
          complianceByMonth[month].approved++;
        }
        if (submission.stage === 'INITIAL') {
          complianceByMonth[month].initial++;
        } else {
          complianceByMonth[month].full++;
        }
      }
    });

    const totalSubmissions = submissions.length;
    const approvedSubmissions = submissions.filter(s => s.status === 'APPROVED').length;
    const initialAssessments = submissions.filter(s => s.stage === 'INITIAL').length;
    const fullAssessments = submissions.filter(s => s.stage === 'FULL').length;
    const complianceRate = totalSubmissions > 0 ?
      (approvedSubmissions / totalSubmissions) * 100 : 0;

    // Supplier compliance ranking
    const supplierCompliance: Record<string, {
      name: string;
      total: number;
      approved: number;
      averageScore: number;
      lastAssessment: Date | null;
    }> = {};

    submissions.forEach(submission => {
      if (submission.supplier) {
        const supplierId = submission.supplierId;
        if (!supplierCompliance[supplierId]) {
          supplierCompliance[supplierId] = {
            name: submission.supplier.name,
            total: 0,
            approved: 0,
            averageScore: 0,
            lastAssessment: null
          };
        }
        supplierCompliance[supplierId].total++;
        if (submission.status === 'APPROVED') {
          supplierCompliance[supplierId].approved++;
        }
        supplierCompliance[supplierId].averageScore += submission.score?.toNumber() || 0;
        if (!supplierCompliance[supplierId].lastAssessment ||
          (submission.submittedAt && submission.submittedAt > supplierCompliance[supplierId].lastAssessment!)) {
          supplierCompliance[supplierId].lastAssessment = submission.submittedAt;
        }
      }
    });

    const topCompliantSuppliers = Object.entries(supplierCompliance)
      .map(([id, data]) => ({
        id,
        name: data.name,
        complianceRate: data.total > 0 ? (data.approved / data.total) * 100 : 0,
        averageScore: data.total > 0 ? data.averageScore / data.total : 0,
        lastAssessment: data.lastAssessment
      }))
      .sort((a, b) => b.complianceRate - a.complianceRate)
      .slice(0, 10);

    return {
      generatedAt: new Date().toISOString(),
      period: {
        start: filters.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: filters.endDate || new Date()
      },
      summary: {
        totalSubmissions,
        approvedSubmissions,
        initialAssessments,
        fullAssessments,
        pendingReviews: submissions.filter(s => s.status === 'UNDER_REVIEW').length,
        requiresAction: submissions.filter(s => s.status === 'REQUIRES_ACTION').length,
        rejectedSubmissions: submissions.filter(s => s.status === 'REJECTED').length,
        complianceRate: parseFloat(complianceRate.toFixed(2))
      },
      complianceByMonth,
      topCompliantSuppliers,
      recentSubmissions: submissions.slice(0, 10).map(s => ({
        id: s.id,
        assessment: s.assessment.title,
        supplier: s.supplier?.name || 'Unknown',
        stage: s.stage,
        status: s.status,
        score: s.score?.toNumber(),
        submittedAt: s.submittedAt
      }))
    };
  },

  // ========== GENERATE SUPPLIER EVALUATION REPORT ==========
  async generateSupplierEvaluationReport(data: { vendorId: string; supplierId: string }, filters: any): Promise<any> {
    const supplier = await prisma.supplier.findUnique({
      where: {
        id: data.supplierId,
        vendorId: data.vendorId
      },
      include: {
        vendor: {
          select: {
            companyName: true,
            businessEmail: true,
            contactNumber: true
          }
        }
      }
    });

    if (!supplier) {
      throw new ApiError(httpStatus.NOT_FOUND, "Supplier not found or not accessible");
    }

    // Get assessment submissions separately
    const assessmentSubmissions = await prisma.assessmentSubmission.findMany({
      where: {
        supplierId: data.supplierId,
        status: 'APPROVED',
        submittedAt: {
          gte: filters.startDate || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
          lte: filters.endDate || new Date()
        }
      },
      include: {
        assessment: {
          select: { title: true, description: true, stage: true }
        },
        answers: {
          include: {
            question: {
              select: {
                question: true,
                bivCategory: true,
                maxScore: true,
                evidenceRequired: true
              }
            }
          }
        }
      },
      orderBy: { submittedAt: 'desc' }
    });

    // Get supplier documents separately (using the Document model)
    const documents = await prisma.document.findMany({
      where: {
        supplierId: data.supplierId,
        status: 'APPROVED',
        category: {
          in: ['Certificate', 'License', 'Compliance', 'Contract']
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Get supplier problems separately
    const startDate = filters.startDate || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const problems = await prisma.problem.findMany({
      where: {
        supplierId: data.supplierId,
        createdAt: {
          gte: startDate
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Calculate scores by category
    const categoryScores: Record<string, { total: number; count: number; maxScore: number }> = {};
    const evidenceStatus: Record<string, { required: number; submitted: number; approved: number }> = {
      BUSINESS: { required: 0, submitted: 0, approved: 0 },
      INTEGRITY: { required: 0, submitted: 0, approved: 0 },
      AVAILABILITY: { required: 0, submitted: 0, approved: 0 }
    };

    let totalScore = 0;
    let totalQuestions = 0;
    let totalEvidenceRequired = 0;
    let totalEvidenceSubmitted = 0;
    let totalEvidenceApproved = 0;

    assessmentSubmissions.forEach((submission) => {
      submission.answers.forEach((answer) => {
        const category = answer.question.bivCategory || 'OTHER';
        if (!categoryScores[category]) {
          categoryScores[category] = { total: 0, count: 0, maxScore: 0 };
        }
        categoryScores[category].total += answer.score?.toNumber() || 0;
        categoryScores[category].count++;
        categoryScores[category].maxScore += answer.question.maxScore;

        // Track evidence status
        if (answer.question.evidenceRequired) {
          totalEvidenceRequired++;
          const bivCat = answer.question.bivCategory;
          if (bivCat && evidenceStatus[bivCat]) {
            evidenceStatus[bivCat].required++;
          }
          if (answer.evidence) {
            totalEvidenceSubmitted++;
            if (bivCat && evidenceStatus[bivCat]) {
              evidenceStatus[bivCat].submitted++;
            }
          }
          if (answer.evidenceStatus === 'APPROVED') {
            totalEvidenceApproved++;
            if (bivCat && evidenceStatus[bivCat]) {
              evidenceStatus[bivCat].approved++;
            }
          }
        }

        totalScore += answer.score?.toNumber() || 0;
        totalQuestions++;
      });
    });

    const averageScores = Object.entries(categoryScores).map(([category, data]) => ({
      category,
      averageScore: data.count > 0 ? data.total / data.count : 0,
      maxPossible: data.maxScore,
      percentage: data.count > 0 ? (data.total / data.maxScore) * 100 : 0
    }));

    const overallAverage = totalQuestions > 0 ? totalScore / totalQuestions : 0;
    const overallPercentage = totalQuestions > 0 ?
      (totalScore / assessmentSubmissions.reduce((sum, s) => sum + (s.assessment?.stage === 'INITIAL' ? 100 : 1000), 0)) * 100 : 0;

    // Problem statistics
    const problemStats = problems.reduce((acc: any, problem) => {
      const status = problem.status;
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    // Calculate evidence completion rate
    const evidenceCompletionRate = totalEvidenceRequired > 0 ?
      (totalEvidenceApproved / totalEvidenceRequired) * 100 : 100;

    return {
      generatedAt: new Date().toISOString(),
      supplier: {
        id: supplier.id,
        name: supplier.name,
        email: supplier.email,
        contactPerson: supplier.contactPerson,
        category: supplier.category,
        criticality: supplier.criticality,
        nis2Compliant: supplier.nis2Compliant,
        contractStartDate: supplier.contractStartDate,
        contractEndDate: supplier.contractEndDate,
        totalContractValue: supplier.totalContractValue?.toNumber(),
        vendor: supplier.vendor
      },
      scores: {
        overall: {
          average: parseFloat(overallAverage.toFixed(2)),
          percentage: parseFloat(overallPercentage.toFixed(2)),
          riskLevel: supplier.riskLevel,
          complianceRate: supplier.complianceRate?.toNumber()
        },
        byCategory: averageScores,
        bivBreakdown: {
          businessScore: supplier.businessScore?.toNumber(),
          integrityScore: supplier.integrityScore?.toNumber(),
          availabilityScore: supplier.availabilityScore?.toNumber(),
          bivScore: supplier.bivScore?.toNumber()
        },
        evidence: {
          required: totalEvidenceRequired,
          submitted: totalEvidenceSubmitted,
          approved: totalEvidenceApproved,
          completionRate: parseFloat(evidenceCompletionRate.toFixed(2)),
          byCategory: evidenceStatus
        }
      },
      assessments: {
        total: assessmentSubmissions.length,
        initial: assessmentSubmissions.filter(s => s.stage === 'INITIAL').length,
        full: assessmentSubmissions.filter(s => s.stage === 'FULL').length,
        lastAssessment: supplier.lastAssessmentDate,
        nextAssessmentDue: supplier.nextAssessmentDue,
        initialCompleted: supplier.initialAssessmentCompleted,
        fullCompleted: supplier.fullAssessmentCompleted
      },
      documents: {
        total: documents.length,
        byCategory: documents.reduce((acc: any, doc) => {
          const category = doc.category || 'Other';
          acc[category] = (acc[category] || 0) + 1;
          return acc;
        }, {}),
        expiringSoon: documents.filter(doc =>
          doc.expiryDate && new Date(doc.expiryDate) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        ).length
      },
      problems: {
        total: problems.length,
        byStatus: problemStats,
        byPriority: problems.reduce((acc: any, p) => {
          acc[p.priority] = (acc[p.priority] || 0) + 1;
          return acc;
        }, {}),
        slaBreaches: problems.filter(p => p.slaBreached).length,
        recent: problems.slice(0, 10).map(p => ({
          id: p.id,
          title: p.title,
          status: p.status,
          priority: p.priority,
          createdAt: p.createdAt,
          resolvedAt: p.resolvedAt
        }))
      },
      performance: {
        onTimeDeliveryRate: supplier.onTimeDeliveryRate?.toNumber(),
        averageResponseTime: supplier.averageResponseTime,
        outstandingPayments: supplier.outstandingPayments?.toNumber()
      },
      recommendations: this.generateSupplierRecommendations(supplier, averageScores, evidenceCompletionRate)
    };
  },

  // ========== GENERATE FINANCIAL ANALYSIS REPORT ==========
  async generateFinancialAnalysisReport(data: { vendorId?: string; supplierId?: string }, filters: any): Promise<any> {
    const where: any = {
      status: 'SUCCEEDED'
    };

    if (data.vendorId) {
      where.user = {
        vendorProfile: {
          id: data.vendorId
        }
      };
    }

    if (filters.startDate || filters.endDate) {
      where.paidAt = {};
      if (filters.startDate) where.paidAt.gte = new Date(filters.startDate);
      if (filters.endDate) where.paidAt.lte = new Date(filters.endDate);
    }

    const payments = await prisma.payment.findMany({
      where,
      include: {
        user: {
          include: {
            vendorProfile: {
              select: { companyName: true }
            }
          }
        },
        subscription: {
          include: {
            plan: true
          }
        }
      },
      orderBy: { paidAt: 'desc' }
    });

    // Filter valid payments
    const validPayments = payments.filter(p => p.subscription?.plan);

    // Group by vendor
    const revenueByVendor: Record<string, { name: string; total: number; payments: number }> = {};
    validPayments.forEach(payment => {
      const vendorName = payment.user.vendorProfile?.companyName || 'Unknown Vendor';
      if (!revenueByVendor[vendorName]) {
        revenueByVendor[vendorName] = { name: vendorName, total: 0, payments: 0 };
      }
      revenueByVendor[vendorName].total += payment.amount.toNumber();
      revenueByVendor[vendorName].payments++;
    });

    // Revenue by month
    const revenueByMonth: Record<string, number> = {};
    validPayments.forEach(payment => {
      if (payment.paidAt) {
        const month = payment.paidAt.toLocaleString('default', {
          month: 'short',
          year: 'numeric'
        });
        revenueByMonth[month] = (revenueByMonth[month] || 0) + payment.amount.toNumber();
      }
    });

    // Revenue by plan
    const revenueByPlan: Record<string, { name: string; total: number; customers: number }> = {};
    validPayments.forEach(payment => {
      const planName = payment.subscription?.plan?.name || 'Unknown Plan';
      if (!revenueByPlan[planName]) {
        revenueByPlan[planName] = { name: planName, total: 0, customers: 0 };
      }
      revenueByPlan[planName].total += payment.amount.toNumber();
      revenueByPlan[planName].customers++;
    });

    const totalRevenue = validPayments.reduce((sum, payment) =>
      sum + payment.amount.toNumber(), 0
    );

    const averagePayment = validPayments.length > 0 ?
      totalRevenue / validPayments.length : 0;

    // Get subscription statistics
    const subscriptions = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE'
      },
      include: {
        plan: true,
        user: {
          include: {
            vendorProfile: true
          }
        }
      }
    });

    const planDistribution = subscriptions.reduce((acc: any, sub) => {
      const planName = sub.plan.name;
      acc[planName] = (acc[planName] || 0) + 1;
      return acc;
    }, {});

    return {
      generatedAt: new Date().toISOString(),
      period: {
        start: filters.startDate || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
        end: filters.endDate || new Date()
      },
      summary: {
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        totalPayments: validPayments.length,
        averagePayment: parseFloat(averagePayment.toFixed(2)),
        activeSubscriptions: subscriptions.length,
        currency: validPayments[0]?.currency || 'EUR'
      },
      revenueByMonth,
      revenueByVendor: Object.values(revenueByVendor)
        .sort((a, b) => b.total - a.total)
        .slice(0, 10),
      revenueByPlan: Object.values(revenueByPlan)
        .sort((a, b) => b.total - a.total),
      planDistribution,
      topPayments: validPayments.slice(0, 10).map(p => ({
        id: p.id,
        amount: p.amount.toNumber(),
        currency: p.currency,
        paidAt: p.paidAt,
        vendor: p.user.vendorProfile?.companyName || 'Unknown',
        plan: p.subscription?.plan?.name || 'Unknown',
        billingCycle: p.subscription?.billingCycle
      }))
    };
  },

  // ========== GENERATE SECURITY AUDIT REPORT ==========
  async generateSecurityAuditReport(data: { vendorId: string; supplierId?: string }, filters: any): Promise<any> {
    const where: any = {
      vendorId: data.vendorId,
      isDeleted: false
    };

    if (data.supplierId) {
      where.id = data.supplierId;
    }

    const suppliers = await prisma.supplier.findMany({
      where,
      include: {
        vendor: {
          select: {
            companyName: true
          }
        }
      }
    });

    // Get assessment submissions separately for each supplier
    const suppliersWithSecurityData = await Promise.all(
      suppliers.map(async (supplier) => {
        const securitySubmissions = await prisma.assessmentSubmission.findMany({
          where: {
            supplierId: supplier.id,
            status: 'APPROVED',
            assessment: {
              categories: {
                some: {
                  title: {
                    contains: 'Security',
                    mode: 'insensitive'
                  }
                }
              }
            }
          },
          include: {
            answers: {
              where: {
                question: {
                  bivCategory: {
                    in: ['BUSINESS', 'INTEGRITY', 'AVAILABILITY']
                  }
                }
              }
            }
          }
        });

        // Get security documents
        const securityDocuments = await prisma.document.findMany({
          where: {
            supplierId: supplier.id,
            category: {
              in: ['Certificate', 'License', 'Compliance']
            },
            status: 'APPROVED'
          }
        });

        return {
          ...supplier,
          securitySubmissions,
          securityDocuments
        };
      })
    );

    // Calculate security metrics
    const securityMetrics = suppliersWithSecurityData.map(supplier => {
      const securitySubmissions = supplier.securitySubmissions;
      const securityDocuments = supplier.securityDocuments;

      let securityScore = 0;
      let totalSecurityQuestions = 0;

      securitySubmissions.forEach(submission => {
        submission.answers.forEach(answer => {
          totalSecurityQuestions++;
          securityScore += answer.score?.toNumber() || 0;
        });
      });

      const avgSecurityScore = totalSecurityQuestions > 0 ?
        (securityScore / totalSecurityQuestions) * 10 : 0;

      return {
        id: supplier.id,
        name: supplier.name,
        securityScore: parseFloat(avgSecurityScore.toFixed(2)),
        securityDocuments: securityDocuments.length,
        nis2Compliant: supplier.nis2Compliant,
        lastAssessmentDate: supplier.lastAssessmentDate,
        riskLevel: supplier.riskLevel
      };
    });

    const averageSecurityScore = securityMetrics.length > 0 ?
      securityMetrics.reduce((sum, s) => sum + s.securityScore, 0) / securityMetrics.length : 0;

    const nis2CompliantCount = securityMetrics.filter(s => s.nis2Compliant).length;
    const nis2ComplianceRate = securityMetrics.length > 0 ?
      (nis2CompliantCount / securityMetrics.length) * 100 : 0;

    return {
      generatedAt: new Date().toISOString(),
      vendorId: data.vendorId,
      totalSuppliers: suppliers.length,
      securityMetrics: {
        averageSecurityScore: parseFloat(averageSecurityScore.toFixed(2)),
        nis2ComplianceRate: parseFloat(nis2ComplianceRate.toFixed(2)),
        nis2CompliantCount,
        highRiskSuppliers: securityMetrics.filter(s => s.riskLevel === 'HIGH' || s.riskLevel === 'CRITICAL').length
      },
      suppliers: securityMetrics
        .sort((a, b) => b.securityScore - a.securityScore)
        .slice(0, 20),
      recommendations: [
        nis2ComplianceRate < 80 ? "Consider implementing NIS2 compliance training for suppliers" : "",
        averageSecurityScore < 70 ? "Review and strengthen security assessment criteria" : "",
        "Regular security audits should be conducted every 6 months"
      ].filter(r => r)
    };
  },

  // ========== GENERATE PERFORMANCE REVIEW REPORT ==========
  async generatePerformanceReviewReport(data: { vendorId: string; supplierId?: string }, filters: any): Promise<any> {
    const where: any = {
      vendorId: data.vendorId,
      isDeleted: false
    };

    if (data.supplierId) {
      where.id = data.supplierId;
    }

    const suppliers = await prisma.supplier.findMany({
      where,
      include: {
        vendor: {
          select: {
            companyName: true
          }
        }
      }
    });

    // Get data separately for each supplier
    const suppliersWithPerformanceData = await Promise.all(
      suppliers.map(async (supplier) => {
        const submissions = await prisma.assessmentSubmission.findMany({
          where: {
            supplierId: supplier.id,
            status: 'APPROVED',
            submittedAt: {
              gte: filters.startDate || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
            }
          },
          orderBy: { submittedAt: 'desc' }
        });

        const problems = await prisma.problem.findMany({
          where: {
            supplierId: supplier.id,
            createdAt: {
              gte: filters.startDate || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
            }
          }
        });

        return {
          ...supplier,
          submissions,
          problems
        };
      })
    );

    // Calculate performance metrics
    const performanceMetrics = suppliersWithPerformanceData.map(supplier => {
      const submissions = supplier.submissions;
      const problems = supplier.problems;

      const latestSubmission = submissions[0];
      const avgScore = submissions.length > 0 ?
        submissions.reduce((sum, s) => sum + (s.score?.toNumber() || 0), 0) / submissions.length : 0;

      const openProblems = problems.filter(p => p.status !== 'RESOLVED' && p.status !== 'CLOSED').length;
      const slaBreaches = problems.filter(p => p.slaBreached).length;

      let performanceScore = avgScore;
      if (openProblems > 0) performanceScore -= (openProblems * 5);
      if (slaBreaches > 0) performanceScore -= (slaBreaches * 10);
      performanceScore = Math.max(0, performanceScore);

      return {
        id: supplier.id,
        name: supplier.name,
        performanceScore: parseFloat(performanceScore.toFixed(2)),
        averageAssessmentScore: parseFloat(avgScore.toFixed(2)),
        totalProblems: problems.length,
        openProblems,
        slaBreaches,
        onTimeDeliveryRate: supplier.onTimeDeliveryRate?.toNumber(),
        averageResponseTime: supplier.averageResponseTime,
        lastAssessmentDate: latestSubmission?.submittedAt || supplier.lastAssessmentDate
      };
    });

    const overallPerformance = performanceMetrics.length > 0 ?
      performanceMetrics.reduce((sum, s) => sum + s.performanceScore, 0) / performanceMetrics.length : 0;

    const topPerformers = performanceMetrics
      .sort((a, b) => b.performanceScore - a.performanceScore)
      .slice(0, 10);

    const underPerformers = performanceMetrics
      .filter(s => s.performanceScore < 60)
      .sort((a, b) => a.performanceScore - b.performanceScore)
      .slice(0, 10);

    return {
      generatedAt: new Date().toISOString(),
      vendorId: data.vendorId,
      period: {
        start: filters.startDate || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        end: filters.endDate || new Date()
      },
      summary: {
        totalSuppliers: suppliers.length,
        overallPerformance: parseFloat(overallPerformance.toFixed(2)),
        suppliersWithIssues: performanceMetrics.filter(s => s.openProblems > 0 || s.slaBreaches > 0).length,
        averageResponseTime: performanceMetrics.length > 0 ?
          performanceMetrics.reduce((sum, s) => sum + (s.averageResponseTime || 0), 0) / performanceMetrics.length : 0
      },
      topPerformers,
      underPerformers,
      keyMetrics: {
        averageOnTimeDelivery: performanceMetrics.length > 0 ?
          performanceMetrics.reduce((sum, s) => sum + (s.onTimeDeliveryRate || 0), 0) / performanceMetrics.length : 0,
        problemResolutionRate: performanceMetrics.length > 0 ?
          ((performanceMetrics.reduce((sum, s) => sum + s.totalProblems, 0) -
            performanceMetrics.reduce((sum, s) => sum + s.openProblems, 0)) /
            performanceMetrics.reduce((sum, s) => sum + s.totalProblems, 0)) * 100 : 100
      }
    };
  },

  // ========== GENERATE INCIDENT REPORT ==========
  async generateIncidentReport(data: { vendorId: string; supplierId?: string }, filters: any): Promise<any> {
    const where: any = {
      vendorId: data.vendorId
    };

    if (data.supplierId) {
      where.supplierId = data.supplierId;
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
      if (filters.endDate) where.createdAt.lte = new Date(filters.endDate);
    }

    // Get problems
    const problems = await prisma.problem.findMany({
      where,
      include: {
        reportedBy: {
          select: { email: true }
        },
        assignedTo: {
          select: { email: true }
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Get supplier details separately
    const problemsWithSuppliers = await Promise.all(
      problems.map(async (problem) => {
        const supplier = await prisma.supplier.findUnique({
          where: { id: problem.supplierId },
          select: { name: true, email: true }
        });

        return {
          ...problem,
          supplier
        };
      })
    );

    // Group by type
    const problemsByType = problemsWithSuppliers.reduce((acc: any, problem) => {
      acc[problem.type] = (acc[problem.type] || 0) + 1;
      return acc;
    }, {});

    // Group by priority
    const problemsByPriority = problemsWithSuppliers.reduce((acc: any, problem) => {
      acc[problem.priority] = (acc[problem.priority] || 0) + 1;
      return acc;
    }, {});

    // Group by status
    const problemsByStatus = problemsWithSuppliers.reduce((acc: any, problem) => {
      acc[problem.status] = (acc[problem.status] || 0) + 1;
      return acc;
    }, {});

    // Calculate resolution times
    const resolvedProblems = problemsWithSuppliers.filter(p => p.resolvedAt && p.createdAt);
    const resolutionTimes = resolvedProblems.map(p => {
      const resolutionTime = p.resolvedAt!.getTime() - p.createdAt.getTime();
      return resolutionTime / (1000 * 60 * 60 * 24); // Convert to days
    });

    const averageResolutionTime = resolutionTimes.length > 0 ?
      resolutionTimes.reduce((sum, time) => sum + time, 0) / resolutionTimes.length : 0;

    const slaBreaches = problemsWithSuppliers.filter(p => p.slaBreached).length;
    const slaBreachRate = problemsWithSuppliers.length > 0 ? (slaBreaches / problemsWithSuppliers.length) * 100 : 0;

    // Group by supplier
    const problemsBySupplier: Record<string, { name: string; count: number; slaBreaches: number }> = {};
    problemsWithSuppliers.forEach(problem => {
      const supplierName = problem.supplier?.name || 'Unknown';
      if (!problemsBySupplier[supplierName]) {
        problemsBySupplier[supplierName] = { name: supplierName, count: 0, slaBreaches: 0 };
      }
      problemsBySupplier[supplierName].count++;
      if (problem.slaBreached) {
        problemsBySupplier[supplierName].slaBreaches++;
      }
    });

    return {
      generatedAt: new Date().toISOString(),
      vendorId: data.vendorId,
      period: {
        start: filters.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: filters.endDate || new Date()
      },
      summary: {
        totalProblems: problemsWithSuppliers.length,
        openProblems: problemsWithSuppliers.filter(p => p.status !== 'RESOLVED' && p.status !== 'CLOSED').length,
        resolvedProblems: problemsWithSuppliers.filter(p => p.status === 'RESOLVED' || p.status === 'CLOSED').length,
        slaBreaches,
        slaBreachRate: parseFloat(slaBreachRate.toFixed(2)),
        averageResolutionTime: parseFloat(averageResolutionTime.toFixed(2))
      },
      breakdown: {
        byType: problemsByType,
        byPriority: problemsByPriority,
        byStatus: problemsByStatus
      },
      topSuppliersWithIssues: Object.values(problemsBySupplier)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      recentProblems: problemsWithSuppliers.slice(0, 10).map(p => ({
        id: p.id,
        title: p.title,
        type: p.type,
        priority: p.priority,
        status: p.status,
        supplier: p.supplier?.name,
        reportedBy: p.reportedBy?.email,
        createdAt: p.createdAt,
        resolvedAt: p.resolvedAt,
        slaBreached: p.slaBreached
      }))
    };
  },

  // ========== GENERATE SUPPLIER RECOMMENDATIONS ==========
  generateSupplierRecommendations(supplier: any, categoryScores: any[], evidenceCompletionRate: number): string[] {
    const recommendations: string[] = [];

    // Check overall scores
    if (supplier.bivScore && supplier.bivScore < 40) {
      recommendations.push("Supplier is at high risk. Consider implementing immediate remediation actions and schedule a review meeting.");
    }

    if (supplier.businessScore && supplier.businessScore < 50) {
      recommendations.push("Business continuity planning needs improvement. Review disaster recovery procedures and conduct a business impact analysis.");
    }

    if (supplier.integrityScore && supplier.integrityScore < 50) {
      recommendations.push("Data integrity controls require strengthening. Implement additional verification measures and access controls.");
    }

    if (supplier.availabilityScore && supplier.availabilityScore < 50) {
      recommendations.push("Service availability needs enhancement. Review redundancy, backup systems, and consider implementing SLAs for uptime.");
    }

    // Check evidence completion
    if (evidenceCompletionRate < 80) {
      recommendations.push(`Evidence completion rate is low (${evidenceCompletionRate.toFixed(2)}%). Request missing evidence from supplier.`);
    }

    // Check NIS2 compliance
    if (!supplier.nis2Compliant) {
      recommendations.push("Supplier is not NIS2 compliant. Require NIS2 compliance assessment and implementation plan.");
    }

    // Check contract expiry
    if (supplier.contractEndDate) {
      const daysRemaining = Math.ceil(
        (new Date(supplier.contractEndDate).getTime() - new Date().getTime()) /
        (1000 * 60 * 60 * 24)
      );

      if (daysRemaining < 30) {
        recommendations.push(`Contract expires in ${daysRemaining} days. Initiate renewal process immediately.`);
      } else if (daysRemaining < 90) {
        recommendations.push(`Contract expires in ${daysRemaining} days. Start renewal discussions.`);
      }
    }

    // Check assessment frequency
    if (supplier.lastAssessmentDate) {
      const daysSinceLastAssessment = Math.ceil(
        (new Date().getTime() - new Date(supplier.lastAssessmentDate).getTime()) /
        (1000 * 60 * 60 * 24)
      );

      if (daysSinceLastAssessment > 365) {
        recommendations.push("Annual assessment overdue. Schedule new comprehensive risk assessment.");
      } else if (daysSinceLastAssessment > 180) {
        recommendations.push("Last assessment was more than 6 months ago. Consider interim review.");
      }
    }

    // Check outstanding payments
    if (supplier.outstandingPayments && supplier.outstandingPayments > 0) {
      recommendations.push(`Supplier has outstanding payments (${supplier.outstandingPayments.toFixed(2)}). Review payment terms and follow up.`);
    }

    // Check delivery performance
    if (supplier.onTimeDeliveryRate && supplier.onTimeDeliveryRate < 90) {
      recommendations.push(`On-time delivery rate is low (${supplier.onTimeDeliveryRate.toFixed(2)}%). Review logistics and delivery processes.`);
    }

    // Check response time
    if (supplier.averageResponseTime && supplier.averageResponseTime > 48) {
      recommendations.push(`Average response time is high (${supplier.averageResponseTime} hours). Implement communication protocol improvements.`);
    }

    // Add category-specific recommendations
    categoryScores.forEach(category => {
      if (category.percentage < 70) {
        recommendations.push(
          `${category.category} compliance needs improvement (${category.percentage.toFixed(2)}%). ` +
          "Review related controls, provide training, and conduct follow-up assessment."
        );
      }
    });

    // Add positive recommendations for good performance
    if (supplier.bivScore && supplier.bivScore > 80) {
      recommendations.push("Supplier demonstrates excellent overall performance. Consider long-term partnership and potential strategic collaboration.");
    }

    if (evidenceCompletionRate > 95) {
      recommendations.push("Excellent evidence management. Supplier shows strong compliance documentation practices.");
    }

    // Limit to top recommendations
    return recommendations.slice(0, 8);
  },

  // ========== GET VENDOR REPORT OPTIONS ==========
  async getVendorReportOptions(vendorId: string) {
    const suppliers = await prisma.supplier.findMany({
      where: {
        vendorId,
        isDeleted: false,
        isActive: true
      },
      select: {
        id: true,
        name: true,
        email: true,
        category: true,
        criticality: true,
        riskLevel: true,
        bivScore: true,
        lastAssessmentDate: true
      },
      orderBy: { name: 'asc' }
    });

    return {
      suppliers,
      totalSuppliers: suppliers.length,
      highRiskSuppliers: suppliers.filter(s =>
        s.riskLevel === 'HIGH' || s.riskLevel === 'CRITICAL'
      ).length,
      overdueAssessments: suppliers.filter(s =>
        s.lastAssessmentDate &&
        (new Date().getTime() - s.lastAssessmentDate.getTime()) > (90 * 24 * 60 * 60 * 1000)
      ).length
    };
  },

  // ========== GET REPORTS ==========
  async getReports(userId: string, options: any = {}): Promise<{ reports: Report[]; meta: any }> {
    const {
      page = 1,
      limit = 20,
      type,
      status,
      vendorId,
      supplierId,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = options;

    // Convert string values to numbers
    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;

    // Validate permissions
    const { finalVendorId, finalSupplierId } = await this.validateUserPermissions(
      userId,
      vendorId,
      supplierId
    );

    const where: any = { isDeleted: false };

    // Apply permission-based filters
    if (finalVendorId) {
      where.vendorId = finalVendorId;
    }

    if (finalSupplierId) {
      where.supplierId = finalSupplierId;
    }

    if (type) {
      where.reportType = type;
    }

    if (status) {
      where.status = status;
    }

    console.log("Query where clause:", JSON.stringify(where, null, 2));
    console.log("Skip:", skip, "Take:", limitNumber);

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where,
        include: {
          creator: {
            select: {
              id: true,
              email: true,
              role: true
            }
          },
          generatedFor: {
            select: {
              id: true,
              email: true
            }
          }
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limitNumber // Use the converted number
      }),
      prisma.report.count({ where })
    ]);

    return {
      reports,
      meta: {
        page: pageNumber,
        limit: limitNumber,
        total,
        pages: Math.ceil(total / limitNumber)
      }
    };
  },

  // ========== GET REPORT BY ID ==========
  async getReportById(reportId: string, userId: string): Promise<Report | null> {
    const report = await prisma.report.findUnique({
      where: { id: reportId },
      include: {
        creator: {
          select: {
            id: true,
            email: true,
            role: true
          }
        },
        generatedFor: {
          select: {
            id: true,
            email: true
          }
        }
      }
    });

    if (!report) {
      throw new ApiError(httpStatus.NOT_FOUND, "Report not found");
    }

    // Validate permissions
    await this.validateUserPermissions(
      userId,
      report.vendorId,
      report.supplierId || undefined
    );

    // Mark as viewed if not already
    if (!report.viewedAt) {
      await prisma.report.update({
        where: { id: reportId },
        data: { viewedAt: new Date(), status: ReportStatus.VIEWED }
      });
    }

    return report;
  },

  // ========== UPDATE REPORT ==========
  async updateReport(reportId: string, userId: string, data: any): Promise<Report> {
    const report = await prisma.report.findUnique({
      where: { id: reportId }
    });

    if (!report) {
      throw new ApiError(httpStatus.NOT_FOUND, "Report not found");
    }

    // Check permissions
    if (report.createdById !== userId) {
      throw new ApiError(httpStatus.FORBIDDEN, "You can only update reports you created");
    }

    const updatedReport = await prisma.report.update({
      where: { id: reportId },
      data: {
        title: data.title,
        description: data.description,
        status: data.status
      }
    });

    return updatedReport;
  },

  // ========== DELETE REPORT ==========
  async deleteReport(reportId: string, userId: string): Promise<{ message: string }> {
    const report = await prisma.report.findUnique({
      where: { id: reportId }
    });

    if (!report) {
      throw new ApiError(httpStatus.NOT_FOUND, "Report not found");
    }

    // Check permissions
    if (report.createdById !== userId) {
      throw new ApiError(httpStatus.FORBIDDEN, "You can only delete reports you created");
    }

    await prisma.report.update({
      where: { id: reportId },
      data: { isDeleted: true }
    });

    return {
      message: "Report deleted successfully"
    };
  },

  // ========== SEND REPORT ==========
  async sendReport(reportId: string, userId: string, recipientEmail?: string): Promise<{ message: string }> {
    const report = await prisma.report.findUnique({
      where: { id: reportId },
      include: {
        creator: {
          select: { email: true }
        }
      }
    });

    if (!report) {
      throw new ApiError(httpStatus.NOT_FOUND, "Report not found");
    }

    // Check permissions
    await this.validateUserPermissions(
      userId,
      report.vendorId,
      report.supplierId || undefined
    );

    let recipientUserId: string | undefined;

    if (recipientEmail) {
      const recipient = await prisma.user.findUnique({
        where: { email: recipientEmail }
      });

      if (!recipient) {
        throw new ApiError(httpStatus.NOT_FOUND, "Recipient not found");
      }

      recipientUserId = recipient.id;

      // Get vendor name for email
      const vendor = await prisma.vendor.findUnique({
        where: { id: report.vendorId },
        select: { companyName: true }
      });

      // Send email with report
      try {
        await mailtrapService.sendHtmlEmail({
          to: recipientEmail,
          subject: `Report: ${report.title}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">${report.title}</h2>
              <p>You have received a new report from ${report.creator?.email}.</p>
              
              <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
                <p><strong>Report Type:</strong> ${report.reportType}</p>
                <p><strong>Vendor:</strong> ${vendor?.companyName || 'N/A'}</p>
                <p><strong>Generated On:</strong> ${report.createdAt.toLocaleDateString()}</p>
                ${report.description ? `<p><strong>Description:</strong> ${report.description}</p>` : ''}
              </div>
              
              <p>You can download the report using the link below:</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${report.documentUrl}" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                  Download Report
                </a>
              </div>
              
              <p style="color: #666; font-size: 14px; margin-top: 30px;">
                This report contains confidential information. Please handle it with care and do not share with unauthorized parties.
              </p>
              
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
              <p style="color: #666; font-size: 12px;">© ${new Date().getFullYear()} CyberNark. All rights reserved.</p>
            </div>
          `
        });
      } catch (error) {
        console.error("Failed to send report email:", error);
        throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, "Failed to send report email");
      }
    }

    // Update report status
    await prisma.report.update({
      where: { id: reportId },
      data: {
        status: ReportStatus.SENT,
        sentAt: new Date(),
        generatedForId: recipientUserId || null
      }
    });

    // Create notification for recipient
    if (recipientUserId) {
      await prisma.notification.create({
        data: {
          userId: recipientUserId,
          title: "New Report Received",
          message: `You have received a new report: "${report.title}" from ${report.creator?.email}`,
          type: 'REPORT_GENERATED',
          metadata: {
            reportId: report.id,
            reportType: report.reportType,
            sender: report.creator?.email,
            documentUrl: report.documentUrl
          }
        }
      });
    }

    return {
      message: recipientEmail ? "Report sent successfully" : "Report marked as sent"
    };
  },

  // ========== GET REPORT STATISTICS ==========
  async getReportStatistics(userId: string): Promise<any> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, vendorId: true, supplierId: true }
    });

    const where: any = { isDeleted: false };

    if (user?.role === UserRole.VENDOR && user.vendorId) {
      where.vendorId = user.vendorId;
    } else if (user?.role === UserRole.SUPPLIER && user.supplierId) {
      where.supplierId = user.supplierId;
    }

    const [totalReports, byType, byStatus, recentReports] = await Promise.all([
      prisma.report.count({ where }),
      prisma.report.groupBy({
        by: ['reportType'],
        where,
        _count: true,
        _max: { createdAt: true }
      }),
      prisma.report.groupBy({
        by: ['status'],
        where,
        _count: true
      }),
      prisma.report.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          title: true,
          reportType: true,
          status: true,
          createdAt: true,
          fileSize: true
        }
      })
    ]);

    const typeStats: Record<string, { count: number; latest: Date | null }> = {};
    byType.forEach(item => {
      typeStats[item.reportType] = {
        count: item._count,
        latest: item._max.createdAt
      };
    });

    const statusStats: Record<string, number> = {};
    byStatus.forEach(item => {
      statusStats[item.status] = item._count;
    });

    // Calculate total file size
    const totalFileSize = recentReports.reduce((sum, report) => sum + (report.fileSize || 0), 0);

    return {
      totalReports,
      byType: typeStats,
      byStatus: statusStats,
      recentReports,
      storageUsage: {
        total: totalFileSize,
        average: recentReports.length > 0 ? totalFileSize / recentReports.length : 0
      }
    };
  },

  // ========== BULK GENERATE REPORTS ==========
  async bulkGenerateReports(userId: string, data: {
    reportType: ReportType;
    title: string;
    description?: string;
    vendorId?: string;
    supplierIds?: string[];
    filters?: any;
  }): Promise<{ message: string; reports: Report[] }> {
    const { finalVendorId } = await this.validateUserPermissions(userId, data.vendorId);

    if (!finalVendorId) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Vendor ID is required");
    }

    let suppliers: any[] = [];

    if (data.supplierIds && data.supplierIds.length > 0) {
      // Generate reports for specific suppliers
      suppliers = await prisma.supplier.findMany({
        where: {
          id: { in: data.supplierIds },
          vendorId: finalVendorId,
          isDeleted: false
        }
      });
    } else {
      // Generate reports for all suppliers
      suppliers = await prisma.supplier.findMany({
        where: {
          vendorId: finalVendorId,
          isDeleted: false
        }
      });
    }

    if (suppliers.length === 0) {
      throw new ApiError(httpStatus.NOT_FOUND, "No suppliers found");
    }

    const reports: Report[] = [];

    // Generate report for each supplier
    for (const supplier of suppliers) {
      try {
        const report = await this.generateReport(userId, {
          ...data,
          supplierId: supplier.id,
          vendorId: finalVendorId,
          title: `${data.title} - ${supplier.name}`
        });
        reports.push(report);
      } catch (error) {
        console.error(`Failed to generate report for supplier ${supplier.id}:`, error);
        // Continue with other suppliers
      }
    }

    return {
      message: `Successfully generated ${reports.length} out of ${suppliers.length} reports`,
      reports
    };
  },

  // ========== UPLOAD EXTERNAL REPORT ==========
  async uploadExternalReport(userId: string, data: {
    title: string;
    reportType: ReportType;
    description?: string;
    vendorId?: string;
    supplierId?: string;
    documentUrl: string;
    fileSize: number;
    documentType: string;
    parameters?: any;
  }): Promise<Report> {
    // Validate permissions
    const { finalVendorId, finalSupplierId } = await this.validateUserPermissions(
      userId,
      data.vendorId,
      data.supplierId
    );

    if (!finalVendorId) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Vendor ID is required");
    }

    const report = await prisma.report.create({
      data: {
        title: data.title,
        reportType: data.reportType,
        description: data.description,
        documentUrl: data.documentUrl,
        documentType: data.documentType,
        fileSize: data.fileSize,
        parameters: data.parameters || {},
        createdById: userId,
        vendorId: finalVendorId,
        supplierId: finalSupplierId || null,
        status: ReportStatus.GENERATED
      }
    });

    // Create notification
    await prisma.notification.create({
      data: {
        userId,
        title: "External Report Uploaded",
        message: `External report "${data.title}" has been uploaded successfully`,
        type: 'REPORT_GENERATED',
        metadata: {
          reportId: report.id,
          reportType: data.reportType,
          documentUrl: data.documentUrl
        }
      }
    });

    return report;
  }
};