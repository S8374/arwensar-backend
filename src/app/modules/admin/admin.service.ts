// src/modules/admin/admin.service.ts
import { Plan, Assessment, Vendor, Supplier, User, Criticality } from "@prisma/client";

import httpStatus from "http-status";
import { prisma } from "../../shared/prisma";
import ApiError from "../../../error/ApiError";


export interface AdminDashboardStats {
  totalVendors: number;
  totalSuppliers: number;
  totalActiveSubscriptions: number;
  totalRevenue: number;
  pendingVerifications: number;
  recentVendors: Array<{
    id: string;
    companyName: string;
    email: string;
    createdAt: Date;
  }>;
  topSuppliers: Array<{
    id: string;
    name: string;
    email: string;
    bivScore: number | null;
    riskLevel: Criticality | null;
    vendorName: string;
  }>;
  riskDistribution: {
    high: number;
    medium: number;
    low: number;
  };
  revenueChart: Array<{
    month: string;
    revenue: number;
  }>;
}
export interface VendorWithDetails {
  id: string;
  companyName: string;
  businessEmail: string;
  contactNumber: string;
  industryType: string;
  firstName?: string | null;
  lastName?: string | null;
  termsAccepted: boolean;
  companyLogo?: string | null;
  isDeleted: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  user: {
    id: string;
    email: string;
    role: string;
    status: string;
    isVerified: boolean;
    createdAt: Date;
    subscription?: {
      id: string;
      status: string;
      billingCycle: string;
      currentPeriodStart?: Date | null;
      currentPeriodEnd?: Date | null;
      plan: {
        id: string;
        name: string;
        type: string;
        price: number;
        currency: string;
        supplierLimit: number;
      };
    } | null;
  };
  suppliers: Array<{
    id: string;
    name: string;
    email: string;
    isActive: boolean;
    riskLevel?: string | null;
  }>;
}
export const AdminService = {
  // ========== DASHBOARD ==========
  async getDashboardStats(): Promise<AdminDashboardStats> {
    const [
      totalVendors,
      totalSuppliers,
      subscriptions,
      payments,
      pendingVerifications,
      vendors
    ] = await Promise.all([
      prisma.vendor.count({ where: { isDeleted: false } }),
      prisma.supplier.count({ where: { isDeleted: false } }),
      prisma.subscription.findMany({
        where: { status: 'ACTIVE' },
        include: { plan: true }
      }),
      prisma.payment.findMany({
        where: {
          status: 'SUCCEEDED',
          paidAt: {
            gte: new Date(new Date().getFullYear(), 0, 1)
          }
        }
      }),
      prisma.user.count({ where: { isVerified: false } }),
      prisma.vendor.findMany({
        where: { isDeleted: false },
        include: { user: true },
        orderBy: { createdAt: 'desc' },
        take: 5
      })
    ]);

    const suppliers = await prisma.supplier.findMany({
      where: {
        isDeleted: false,
        isActive: true,
        bivScore: { not: null }
      },
      include: {
        vendor: { select: { companyName: true } },
        user: { select: { email: true } }
      },
      orderBy: { bivScore: 'asc' },
      take: 10
    });

    const riskDistribution = await prisma.supplier.groupBy({
      by: ['riskLevel'],
      where: {
        isDeleted: false,
        isActive: true,
        riskLevel: { not: null }
      },
      _count: true
    });

    const totalRevenue = payments.reduce((sum, payment) =>
      sum + payment.amount.toNumber(), 0
    );

    // Generate revenue chart (last 6 months)
    const revenueChart = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = month.toLocaleString('default', { month: 'short' });

      const monthRevenue = payments
        .filter(p =>
          p.paidAt &&
          p.paidAt.getMonth() === month.getMonth() &&
          p.paidAt.getFullYear() === month.getFullYear()
        )
        .reduce((sum, p) => sum + p.amount.toNumber(), 0);

      revenueChart.push({
        month: monthName,
        revenue: monthRevenue
      });
    }

    return {
      totalVendors,
      totalSuppliers,
      totalActiveSubscriptions: subscriptions.length,
      totalRevenue,
      pendingVerifications,
      recentVendors: vendors.map(v => ({
        id: v.id,
        companyName: v.companyName,
        email: v.businessEmail,
        createdAt: v.createdAt
      })),
      topSuppliers: suppliers.map(s => ({
        id: s.id,
        name: s.name,
        email: s.email,
        bivScore: s.bivScore?.toNumber() || null,
        riskLevel: s.riskLevel,
        vendorName: s.vendor.companyName
      })),
      riskDistribution: {
        high: riskDistribution.find(r => r.riskLevel === 'HIGH')?._count || 0,
        medium: riskDistribution.find(r => r.riskLevel === 'MEDIUM')?._count || 0,
        low: riskDistribution.find(r => r.riskLevel === 'LOW')?._count || 0
      },
      revenueChart
    };
  },

  // ========== PLANS MANAGEMENT ==========
  async createPlan(data: any): Promise<Plan> {
    // Check if plan with same name/type exists
    const existingPlan = await prisma.plan.findFirst({
      where: {
        OR: [
          { name: data.name },
          { type: data.type }
        ]
      }
    });

    if (existingPlan) {
      throw new ApiError(httpStatus.CONFLICT, "Plan with this name or type already exists");
    }

    const plan = await prisma.plan.create({
      data: {
        name: data.name,
        description: data.description,
        type: data.type,
        billingCycle: data.billingCycle,
        price: data.price,
        currency: data.currency || 'EUR',
        supplierLimit: data.supplierLimit,
        assessmentLimit: data.assessmentLimit,
        storageLimit: data.storageLimit,
        userLimit: data.userLimit,
        features: data.features || {},
        trialDays: data.trialDays || 14,
        isActive: data.isActive !== undefined ? data.isActive : true,
        isDefault: data.isDefault || false
      }
    });

    return plan;
  },

  async updatePlan(planId: string, data: any): Promise<Plan> {
    const plan = await prisma.plan.findUnique({
      where: { id: planId }
    });

    if (!plan) {
      throw new ApiError(httpStatus.NOT_FOUND, "Plan not found");
    }

    if (plan.isDeleted) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Cannot update deleted plan");
    }

    const updatedPlan = await prisma.plan.update({
      where: { id: planId },
      data: {
        name: data.name,
        description: data.description,
        type: data.type,
        billingCycle: data.billingCycle,
        price: data.price,
        currency: data.currency,
        supplierLimit: data.supplierLimit,
        assessmentLimit: data.assessmentLimit,
        storageLimit: data.storageLimit,
        userLimit: data.userLimit,
        features: data.features,
        trialDays: data.trialDays,
        isActive: data.isActive,
        isDefault: data.isDefault,
        stripePriceId: data.stripePriceId,
        stripeProductId: data.stripeProductId
      }
    });

    return updatedPlan;
  },

  async deletePlan(planId: string): Promise<Plan> {
    const plan = await prisma.plan.findUnique({
      where: { id: planId }
    });

    if (!plan) {
      throw new ApiError(httpStatus.NOT_FOUND, "Plan not found");
    }

    // Check if plan has active subscriptions
    const activeSubscriptions = await prisma.subscription.count({
      where: {
        planId,
        status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] }
      }
    });

    if (activeSubscriptions > 0) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Cannot delete plan with active subscriptions");
    }

    const deletedPlan = await prisma.plan.update({
      where: { id: planId },
      data: { isDeleted: true, isActive: false }
    });

    return deletedPlan;
  },

  async getAllPlans(): Promise<Plan[]> {
    return prisma.plan.findMany({
      where: { isDeleted: false },
      orderBy: { price: 'asc' }
    });
  },

  async getPlanById(planId: string): Promise<Plan | null> {
    return prisma.plan.findUnique({
      where: { id: planId, isDeleted: false }
    });
  },

  // ========== ASSESSMENTS MANAGEMENT ==========
// src/modules/admin/admin.service.ts - Updated createAssessment method
async createAssessment(data: any): Promise<Assessment> {
  // Check if assessment with same examId exists
  const existingAssessment = await prisma.assessment.findUnique({
    where: { examId: data.examId }
  });

  if (existingAssessment) {
    throw new ApiError(httpStatus.CONFLICT, "Assessment with this exam ID already exists");
  }

  // Validate that createdBy user exists
  const user = await prisma.user.findUnique({
    where: { id: data.createdBy }
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

 if (!data.vendorId) {
  throw new ApiError(httpStatus.BAD_REQUEST, "vendorId is required");
}

const assessment = await prisma.assessment.create({
  data: {
    examId: data.examId,
    title: data.title,
    description: data.description,
    isActive: data.isActive !== undefined ? data.isActive : true,
    isTemplate: data.isTemplate || false,
    stage: data.stage || 'FULL',
    totalPoints: data.totalPoints || 100,
    passingScore: data.passingScore,
    timeLimit: data.timeLimit,
    createdByUser: { connect: { id: data.createdBy } },
    vendorId: data.vendorId, // ✅ required
    categories: {
      create: data.categories.map((category: any) => ({
        categoryId: category.categoryId,
        title: category.title,
        description: category.description,
        order: category.order || 1,
        weight: category.weight,
        maxScore: category.maxScore || 100,
        questions: {
          create: category.questions.map((question: any) => ({
            questionId: question.questionId,
            question: question.question,
            description: question.description,
            order: question.order || 1,
            isDocument: question.isDocument || false,
            isInputField: question.isInputField || false,
            answerType: question.answerType || 'YES',
            required: question.required !== undefined ? question.required : true,
            weight: question.weight,
            maxScore: question.maxScore || 10,
            helpText: question.helpText,
            bivCategory: question.bivCategory,
            evidenceRequired: question.evidenceRequired || false
          }))
        }
      }))
    }
  },
  include: {
    categories: { include: { questions: true } },
    createdByUser: { select: { id: true, email: true, role: true } }
  }
});


  return assessment;
},

  async updateAssessment(assessmentId: string, data: any): Promise<Assessment> {
    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId }
    });

    if (!assessment) {
      throw new ApiError(httpStatus.NOT_FOUND, "Assessment not found");
    }

    const updatedAssessment = await prisma.assessment.update({
      where: { id: assessmentId },
      data: {
        title: data.title,
        description: data.description,
        isActive: data.isActive,
        isTemplate: data.isTemplate,
        stage: data.stage,
        totalPoints: data.totalPoints,
        passingScore: data.passingScore,
        timeLimit: data.timeLimit,
        updatedBy: data.updatedBy
      },
      include: {
        categories: {
          include: {
            questions: true
          }
        }
      }
    });

    return updatedAssessment;
  },

  async deleteAssessment(assessmentId: string): Promise<Assessment> {
    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId }
    });

    if (!assessment) {
      throw new ApiError(httpStatus.NOT_FOUND, "Assessment not found");
    }

    // Check if assessment has submissions
    const submissionsCount = await prisma.assessmentSubmission.count({
      where: { assessmentId }
    });

    if (submissionsCount > 0) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Cannot delete assessment with existing submissions");
    }

    const deletedAssessment = await prisma.assessment.update({
      where: { id: assessmentId },
      data: { isActive: false }
    });

    return deletedAssessment;
  },

  async getAllAssessments(): Promise<Assessment[]> {
    return prisma.assessment.findMany({
      where: { isActive: true },
      include: {
        categories: {
          include: {
            questions: true
          }
        },
        createdByUser: {
          select: {
            id: true,
            email: true,
            role: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  },

  async getAssessmentById(assessmentId: string): Promise<Assessment | null> {
    return prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: {
        categories: {
          include: {
            questions: true
          }
        },
        createdByUser: {
          select: {
            id: true,
            email: true,
            role: true
          }
        }
      }
    });
  },

  // ========== USER MANAGEMENT ==========
  async getAllVendors(): Promise<VendorWithDetails[]> {
    const vendors = await prisma.vendor.findMany({
      where: { isDeleted: false },
      include: {
        user: {
          include: {
            subscription: {
              include: {
                plan: {
                  select: {
                    id: true,
                    name: true,
                    type: true,
                    price: true,
                    currency: true,
                    supplierLimit: true
                  }
                }
              }
            }
          }
        },
        suppliers: {
          where: { isDeleted: false },
          select: {
            id: true,
            name: true,
            email: true,
            isActive: true,
            riskLevel: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return vendors as VendorWithDetails[];
  },

  async getAllSuppliers(): Promise<Supplier[]> {
    return prisma.supplier.findMany({
      where: { isDeleted: false },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            status: true,
            isVerified: true,
            createdAt: true
          }
        },
        vendor: {
          select: {
            id: true,
            companyName: true,
            businessEmail: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  },

  async updateUserStatus(userId: string, status: string): Promise<User> {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, "User not found");
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { status: status as any }
    });

    return updatedUser;
  },

  // ========== REPORTS ==========
  // In admin.service.ts - Fix the generateSystemReport function
  async generateSystemReport(type: string, filters: any): Promise<any> {
    let reportData: any = {};

    switch (type) {
      case 'FINANCIAL_ANALYSIS':
        const payments = await prisma.payment.findMany({
          where: {
            status: 'SUCCEEDED',
            paidAt: {
              gte: new Date(new Date().setFullYear(new Date().getFullYear() - 1))
            }
          },
          include: {
            user: {
              select: { email: true }
            },
            subscription: {
              include: {
                plan: true
              }
            }
          }
        });

        const revenueByMonth = payments.reduce((acc: any, payment) => {
          const month = payment.paidAt?.toLocaleString('default', { month: 'long', year: 'numeric' });
          if (month) {
            acc[month] = (acc[month] || 0) + payment.amount.toNumber();
          }
          return acc;
        }, {});

        // Fix: Handle null subscription
        const topPlans = payments
          .filter(p => p.subscription?.plan) // Filter out null subscriptions
          .map(p => p.subscription!.plan.name) // Use non-null assertion after filtering
          .filter((name, index, self) => self.indexOf(name) === index) // Get unique names
          .slice(0, 5);

        reportData = {
          totalRevenue: payments.reduce((sum, p) => sum + p.amount.toNumber(), 0),
          totalPayments: payments.length,
          revenueByMonth,
          topPlans
        };
        break;

      case 'RISK_ASSESSMENT':
        const suppliers = await prisma.supplier.findMany({
          where: {
            isDeleted: false,
            isActive: true,
            bivScore: { not: null }
          },
          include: {
            vendor: {
              select: { companyName: true }
            },
            assessmentSubmissions: {
              where: { status: 'APPROVED' },
              orderBy: { createdAt: 'desc' },
              take: 1
            }
          }
        });

        const riskBreakdown = suppliers.reduce((acc: any, supplier) => {
          const level = supplier.riskLevel || 'UNKNOWN';
          acc[level] = (acc[level] || 0) + 1;
          return acc;
        }, {});

        const averageBIVScore = suppliers.length > 0
          ? suppliers.reduce((sum, s) => sum + (s.bivScore?.toNumber() || 0), 0) / suppliers.length
          : 0;

        reportData = {
          totalSuppliers: suppliers.length,
          riskBreakdown,
          averageBIVScore: parseFloat(averageBIVScore.toFixed(2)),
          highRiskSuppliers: suppliers
            .filter(s => s.riskLevel === 'HIGH')
            .map(s => ({
              id: s.id,
              name: s.name,
              email: s.email,
              bivScore: s.bivScore?.toNumber(),
              vendor: s.vendor.companyName
            })),
          lowRiskSuppliers: suppliers
            .filter(s => s.riskLevel === 'LOW')
            .slice(0, 10)
        };
        break;

      case 'COMPLIANCE_REPORT':
        const submissions = await prisma.assessmentSubmission.findMany({
          where: {
            submittedAt: {
              gte: new Date(new Date().setMonth(new Date().getMonth() - 6))
            }
          },
          include: {
            assessment: {
              select: { title: true }
            },
            user: {
              select: { email: true }
            }
          }
        });

        const complianceByMonth = submissions.reduce((acc: any, submission) => {
          const month = submission.submittedAt?.toLocaleString('default', { month: 'long', year: 'numeric' });
          if (month) {
            if (!acc[month]) {
              acc[month] = { total: 0, approved: 0 };
            }
            acc[month].total++;
            if (submission.status === 'APPROVED') {
              acc[month].approved++;
            }
          }
          return acc;
        }, {});

        const approvedSubmissionsCount = submissions.filter(s => s.status === 'APPROVED').length;
        const complianceRate = submissions.length > 0
          ? (approvedSubmissionsCount / submissions.length) * 100
          : 0;

        reportData = {
          totalSubmissions: submissions.length,
          approvedSubmissions: approvedSubmissionsCount,
          complianceRate: parseFloat(complianceRate.toFixed(2)),
          complianceByMonth,
          pendingReviews: submissions.filter(s => s.status === 'UNDER_REVIEW').length
        };
        break;

      default:
        throw new ApiError(httpStatus.BAD_REQUEST, "Invalid report type");
    }

    return reportData;
  }
};