// src/modules/report/report.service.ts
import { Report, ReportType, ReportStatus } from "@prisma/client";
import { prisma } from "../../shared/prisma";
import httpStatus from "http-status";
import ApiError from "../../../error/ApiError";
import { mailtrapService } from "../../shared/mailtrap.service";
import { generatePDF } from "../../../utils/pdfGenerator";

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
  // ========== GENERATE REPORT ==========
  async generateReport(userId: string, data: any): Promise<Report> {
    let reportData: any = {};
    let documentUrl = "";
    let filters = data.filters || {};

    switch (data.reportType) {
      case 'RISK_ASSESSMENT':
        reportData = await this.generateRiskAssessmentReport(data, filters);
        documentUrl = await generatePDF({
          title: data.title,
          type: 'RISK_ASSESSMENT',
          data: reportData,
          template: 'risk-assessment'
        });
        break;

      case 'COMPLIANCE_REPORT':
        reportData = await this.generateComplianceReport(data, filters);
        documentUrl = await generatePDF({
          title: data.title,
          type: 'COMPLIANCE',
          data: reportData,
          template: 'compliance'
        });
        break;

      case 'SUPPLIER_EVALUATION':
        reportData = await this.generateSupplierEvaluationReport(data, filters);
        documentUrl = await generatePDF({
          title: data.title,
          type: 'SUPPLIER_EVALUATION',
          data: reportData,
          template: 'supplier-evaluation'
        });
        break;

      case 'FINANCIAL_ANALYSIS':
        reportData = await this.generateFinancialAnalysisReport(data, filters);
        documentUrl = await generatePDF({
          title: data.title,
          type: 'FINANCIAL',
          data: reportData,
          template: 'financial'
        });
        break;

      default:
        throw new ApiError(httpStatus.BAD_REQUEST, "Invalid report type");
    }

    const report = await prisma.report.create({
      data: {
        title: data.title,
        reportType: data.reportType,
        description: data.description,
        documentUrl,
        documentType: 'application/pdf',
        fileSize: 1024, // Placeholder - actual size from PDF generation
        parameters: data.parameters || {},
        filters,
        createdById: userId,
        vendorId: data.vendorId,
        supplierId: data.supplierId,
        status: 'GENERATED'
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
          reportType: data.reportType,
          documentUrl
        }
      }
    });

    return report;
  },

  // ========== GENERATE RISK ASSESSMENT REPORT ==========
  async generateRiskAssessmentReport(data: any, filters: any): Promise<any> {
    const where: any = {
      isDeleted: false,
      isActive: true
    };

    if (data.vendorId) {
      where.vendorId = data.vendorId;
    }

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
            companyName: true
          }
        },
        assessmentSubmissions: {
          where: {
            status: 'APPROVED',
            submittedAt: {
              gte: filters.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
              lte: filters.endDate || new Date()
            }
          },
          orderBy: { submittedAt: 'desc' },
          take: 1
        }
      }
    });

    const riskDistribution = suppliers.reduce((acc: any, supplier) => {
      const level = supplier.riskLevel || 'UNKNOWN';
      acc[level] = (acc[level] || 0) + 1;
      return acc;
    }, {});

    const highRiskSuppliers = suppliers
      .filter(s => s.riskLevel === 'HIGH' || s.riskLevel === 'CRITICAL')
      .map(s => ({
        id: s.id,
        name: s.name,
        email: s.email,
        bivScore: s.bivScore?.toNumber(),
        lastAssessmentDate: s.lastAssessmentDate,
        vendorName: s.vendor.companyName
      }));

    const averageBIVScore = suppliers.length > 0 ?
      suppliers.reduce((sum, s) => sum + (s.bivScore?.toNumber() || 0), 0) / suppliers.length : 0;

    return {
      generatedAt: new Date().toISOString(),
      totalSuppliers: suppliers.length,
      riskDistribution,
      averageBIVScore: parseFloat(averageBIVScore.toFixed(2)),
      highRiskSuppliers: highRiskSuppliers.slice(0, 20),
      summary: {
        lowRisk: riskDistribution.LOW || 0,
        mediumRisk: riskDistribution.MEDIUM || 0,
        highRisk: riskDistribution.HIGH || 0,
        criticalRisk: riskDistribution.CRITICAL || 0
      }
    };
  },

  // ========== GENERATE COMPLIANCE REPORT ==========
  async generateComplianceReport(data: any, filters: any): Promise<any> {
    const where: any = {
      status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'] }
    };

    if (data.vendorId) {
      where.vendorId = data.vendorId;
    }

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
          select: { title: true }
        },
        user: {
          select: { email: true }
        },
        supplier: {
          select: { name: true }
        }
      },
      orderBy: { submittedAt: 'desc' }
    });

    // Group by month
    const complianceByMonth: Record<string, { total: number; approved: number }> = {};
    submissions.forEach(submission => {
      if (submission.submittedAt) {
        const month = submission.submittedAt.toLocaleString('default', { 
          month: 'short',
          year: 'numeric'
        });
        
        if (!complianceByMonth[month]) {
          complianceByMonth[month] = { total: 0, approved: 0 };
        }
        
        complianceByMonth[month].total++;
        if (submission.status === 'APPROVED') {
          complianceByMonth[month].approved++;
        }
      }
    });

    const totalSubmissions = submissions.length;
    const approvedSubmissions = submissions.filter(s => s.status === 'APPROVED').length;
    const complianceRate = totalSubmissions > 0 ? 
      (approvedSubmissions / totalSubmissions) * 100 : 0;

    // Top performing suppliers
    const supplierPerformance = submissions.reduce((acc: any, submission) => {
      if (submission.supplierId && submission.score) {
        if (!acc[submission.supplierId]) {
          acc[submission.supplierId] = {
            name: submission.supplier?.name || 'Unknown',
            totalScore: 0,
            count: 0
          };
        }
        acc[submission.supplierId].totalScore += submission.score.toNumber();
        acc[submission.supplierId].count++;
      }
      return acc;
    }, {});

    const topPerformers = Object.values(supplierPerformance)
      .map((s: any) => ({
        name: s.name,
        averageScore: s.count > 0 ? s.totalScore / s.count : 0
      }))
      .sort((a: any, b: any) => b.averageScore - a.averageScore)
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
        pendingReviews: submissions.filter(s => s.status === 'UNDER_REVIEW').length,
        rejectedSubmissions: submissions.filter(s => s.status === 'REJECTED').length,
        complianceRate: parseFloat(complianceRate.toFixed(2))
      },
      complianceByMonth,
      topPerformers,
      recentSubmissions: submissions.slice(0, 10).map(s => ({
        id: s.id,
        assessment: s.assessment.title,
        supplier: s.supplier?.name || s.user.email,
        status: s.status,
        score: s.score?.toNumber(),
        submittedAt: s.submittedAt
      }))
    };
  },

  // ========== GENERATE SUPPLIER EVALUATION REPORT ==========
  async generateSupplierEvaluationReport(data: any, filters: any): Promise<any> {
  if (!data.supplierId) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Supplier ID is required for supplier evaluation report");
  }

  // Get basic supplier info
  const supplier = await prisma.supplier.findUnique({
    where: { id: data.supplierId },
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
    throw new ApiError(httpStatus.NOT_FOUND, "Supplier not found");
  }

  // Get assessment submissions separately
  const assessmentSubmissions = await prisma.assessmentSubmission.findMany({
    where: {
      supplierId: data.supplierId,
      status: 'APPROVED'
    },
    include: {
      assessment: {
        select: { title: true, description: true }
      },
      answers: {
        include: {
          question: {
            select: {
              question: true,
              bivCategory: true,
              maxScore: true
            }
          }
        }
      }
    },
    orderBy: { submittedAt: 'desc' }
  });

  // Get problems separately
  const startDate = filters.startDate || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const supplierProblems = await prisma.problem.findMany({
    where: {
      supplierId: data.supplierId,
      createdAt: {
        gte: startDate
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  // Calculate scores by category
  const categoryScores: Record<string, { total: number; count: number }> = {};
  let totalScore = 0;
  let totalQuestions = 0;

  assessmentSubmissions.forEach((submission) => {
    submission.answers.forEach((answer) => {
      const category = answer.question.bivCategory || 'OTHER';
      if (!categoryScores[category]) {
        categoryScores[category] = { total: 0, count: 0 };
      }
      categoryScores[category].total += answer.score?.toNumber() || 0;
      categoryScores[category].count++;
      totalScore += answer.score?.toNumber() || 0;
      totalQuestions++;
    });
  });

  const averageScores = Object.entries(categoryScores).map(([category, data]) => ({
    category,
    averageScore: data.count > 0 ? data.total / data.count : 0,
    percentage: data.count > 0 ? (data.total / (data.count * 10)) * 100 : 0
  }));

  const overallAverage = totalQuestions > 0 ? totalScore / totalQuestions : 0;
  const overallPercentage = totalQuestions > 0 ? (totalScore / (totalQuestions * 10)) * 100 : 0;

  // Problem statistics
  const problemStats = supplierProblems.reduce((acc: any, problem) => {
    const status = problem.status;
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  return {
    generatedAt: new Date().toISOString(),
    supplier: {
      id: supplier.id,
      name: supplier.name,
      email: supplier.email,
      contactPerson: supplier.contactPerson,
      category: supplier.category,
      criticality: supplier.criticality,
      vendor: supplier.vendor
    },
    scores: {
      overall: {
        average: parseFloat(overallAverage.toFixed(2)),
        percentage: parseFloat(overallPercentage.toFixed(2)),
        riskLevel: supplier.riskLevel
      },
      byCategory: averageScores,
      bivBreakdown: {
        businessScore: supplier.businessScore?.toNumber(),
        integrityScore: supplier.integrityScore?.toNumber(),
        availabilityScore: supplier.availabilityScore?.toNumber(),
        bivScore: supplier.bivScore?.toNumber()
      }
    },
    assessments: {
      total: assessmentSubmissions.length,
      lastAssessment: supplier.lastAssessmentDate,
      nextAssessmentDue: supplier.nextAssessmentDue
    },
    problems: {
      total: supplierProblems.length,
      byStatus: problemStats,
      recent: supplierProblems.slice(0, 10).map((p) => ({
        id: p.id,
        title: p.title,
        status: p.status,
        priority: p.priority,
        createdAt: p.createdAt
      }))
    },
    recommendations: this.generateSupplierRecommendations(supplier, averageScores)
  };
},

  // ========== GENERATE FINANCIAL ANALYSIS REPORT ==========
async generateFinancialAnalysisReport(data: any, filters: any): Promise<any> {
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
        select: { email: true }
      },
      subscription: {
        include: {
          plan: true
        }
      }
    },
    orderBy: { paidAt: 'desc' }
  });

  // Filter out payments without subscription to avoid errors
  const validPayments = payments.filter(p => p.subscription?.plan);

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
  const revenueByPlan: Record<string, number> = {};
  validPayments.forEach(payment => {
    const planName = payment.subscription?.plan?.name || 'Unknown Plan';
    revenueByPlan[planName] = (revenueByPlan[planName] || 0) + payment.amount.toNumber();
  });

  const totalRevenue = validPayments.reduce((sum, payment) => 
    sum + payment.amount.toNumber(), 0
  );

  const averagePayment = validPayments.length > 0 ? 
    totalRevenue / validPayments.length : 0;

  // Get currency from first valid payment or default
  const firstPayment = validPayments[0] || payments[0];
  const defaultCurrency = firstPayment?.currency || 'EUR';

  return {
    generatedAt: new Date().toISOString(),
    period: {
      start: filters.startDate || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
      end: filters.endDate || new Date()
    },
    summary: {
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      totalPayments: payments.length,
      validPayments: validPayments.length,
      invalidPayments: payments.length - validPayments.length,
      averagePayment: parseFloat(averagePayment.toFixed(2)),
      currency: defaultCurrency
    },
    revenueByMonth,
    revenueByPlan,
    topPayments: validPayments.slice(0, 10).map(p => ({
      id: p.id,
      amount: p.amount.toNumber(),
      currency: p.currency,
      paidAt: p.paidAt,
      user: p.user.email,
      plan: p.subscription?.plan?.name || 'Unknown Plan'
    }))
  };
},

  // ========== GENERATE SUPPLIER RECOMMENDATIONS ==========
  generateSupplierRecommendations(supplier: any, categoryScores: any[]): string[] {
    const recommendations: string[] = [];

    // Check BIV scores
    if (supplier.bivScore && supplier.bivScore < 40) {
      recommendations.push("Supplier is at high risk. Consider implementing immediate remediation actions.");
    }

    if (supplier.businessScore && supplier.businessScore < 50) {
      recommendations.push("Business continuity planning needs improvement. Review disaster recovery procedures.");
    }

    if (supplier.integrityScore && supplier.integrityScore < 50) {
      recommendations.push("Data integrity controls require strengthening. Implement additional verification measures.");
    }

    if (supplier.availabilityScore && supplier.availabilityScore < 50) {
      recommendations.push("Service availability needs enhancement. Review redundancy and backup systems.");
    }

    // Check contract expiry
    if (supplier.contractEndDate) {
      const daysRemaining = Math.ceil(
        (supplier.contractEndDate.getTime() - new Date().getTime()) / 
        (1000 * 60 * 60 * 24)
      );
      
      if (daysRemaining < 30) {
        recommendations.push(`Contract expires in ${daysRemaining} days. Initiate renewal process.`);
      }
    }

    // Check assessment frequency
    if (supplier.lastAssessmentDate) {
      const daysSinceLastAssessment = Math.ceil(
        (new Date().getTime() - supplier.lastAssessmentDate.getTime()) / 
        (1000 * 60 * 60 * 24)
      );
      
      if (daysSinceLastAssessment > 365) {
        recommendations.push("Annual assessment overdue. Schedule new risk assessment.");
      }
    }

    // Add category-specific recommendations
    categoryScores.forEach(category => {
      if (category.percentage < 70) {
        recommendations.push(
          `${category.category} compliance needs improvement (${category.percentage.toFixed(2)}%). ` +
          "Review related controls and processes."
        );
      }
    });

    return recommendations.slice(0, 5); // Limit to top 5 recommendations
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
    
    const skip = (page - 1) * limit;

    const where: any = {};

    // Filter by user role
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, vendorId: true, supplierId: true }
    });

    if (user?.role === 'VENDOR' && user.vendorId) {
      where.vendorId = user.vendorId;
    } else if (user?.role === 'SUPPLIER' && user.supplierId) {
      where.supplierId = user.supplierId;
    }

    if (type) {
      where.reportType = type;
    }

    if (status) {
      where.status = status;
    }

    if (vendorId) {
      where.vendorId = vendorId;
    }

    if (supplierId) {
      where.supplierId = supplierId;
    }

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where,
        include: {
          creator: {
            select: {
              id: true,
              email: true
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
        take: limit
      }),
      prisma.report.count({ where })
    ]);

    return {
      reports,
      meta: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
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

    // Check permissions
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, vendorId: true, supplierId: true }
    });

    if (user?.role === 'VENDOR' && report.vendorId !== user.vendorId) {
      throw new ApiError(httpStatus.FORBIDDEN, "You don't have permission to view this report");
    }

    if (user?.role === 'SUPPLIER' && report.supplierId !== user.supplierId) {
      throw new ApiError(httpStatus.FORBIDDEN, "You don't have permission to view this report");
    }

    // Mark as viewed if not already
    if (!report.viewedAt) {
      await prisma.report.update({
        where: { id: reportId },
        data: { viewedAt: new Date(), status: 'VIEWED' as ReportStatus }
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
    if (report.createdById !== userId) {
      throw new ApiError(httpStatus.FORBIDDEN, "You can only send reports you created");
    }

    let recipientUserId: string | undefined;

    if (recipientEmail) {
      const recipient = await prisma.user.findUnique({
        where: { email: recipientEmail }
      });

      if (!recipient) {
        throw new ApiError(httpStatus.NOT_FOUND, "Recipient not found");
      }

      recipientUserId = recipient.id;

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
                <p><strong>Generated On:</strong> ${report.createdAt.toLocaleDateString()}</p>
                ${report.description ? `<p><strong>Description:</strong> ${report.description}</p>` : ''}
              </div>
              
              <p>You can download the report using the link below:</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${report.documentUrl}" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                  Download Report
                </a>
              </div>
              
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
        status: 'SENT',
        sentAt: new Date(),
        generatedForId: recipientUserId
      }
    });

    // Create notification for recipient
    if (recipientUserId) {
      await prisma.notification.create({
        data: {
          userId: recipientUserId,
          title: "New Report Received",
          message: `You have received a new report: "${report.title}"`,
          type: 'REPORT_GENERATED',
          metadata: {
            reportId: report.id,
            reportType: report.reportType,
            sender: report.creator?.email
          }
        }
      });
    }

    return {
      message: "Report sent successfully"
    };
  },

  // ========== GET REPORT STATISTICS ==========
  async getReportStatistics(userId: string): Promise<any> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, vendorId: true }
    });

    const where: any = {};
    
    if (user?.role === 'VENDOR' && user.vendorId) {
      where.vendorId = user.vendorId;
    }

    const [totalReports, byType, byStatus, recentReports] = await Promise.all([
      prisma.report.count({ where }),
      prisma.report.groupBy({
        by: ['reportType'],
        where,
        _count: true
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
          createdAt: true
        }
      })
    ]);

    const typeStats: Record<string, number> = {};
    byType.forEach(item => {
      typeStats[item.reportType] = item._count;
    });

    const statusStats: Record<string, number> = {};
    byStatus.forEach(item => {
      statusStats[item.status] = item._count;
    });

    return {
      totalReports,
      byType: typeStats,
      byStatus: statusStats,
      recentReports
    };
  }
};