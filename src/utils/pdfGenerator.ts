// src/utils/pdfGenerator.ts
import { Client } from 'minio';
import PDFDocument from 'pdfkit';

// Configure MinIO Client
const minioClient = new Client({
  endPoint: 's3.cybernark.com',
  port: 9000,
  useSSL: false,
  accessKey: process.env.MINIO_ROOT_USER || 'minioadmin',
  secretKey: process.env.MINIO_ROOT_PASSWORD || 'tatfxs4fxutl9tgm',
});

const BUCKET_NAME = 'test';

interface PDFOptions {
  title: string;
  type: string;
  data: any;
  template: string;
  vendorId?: string;
  userId?: string;
}

export const generatePDF = async (options: PDFOptions): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });

      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk as Buffer));
      doc.on('end', async () => {
        try {
          const pdfBuffer = Buffer.concat(chunks);

          const url = await uploadToMinIO(
            pdfBuffer,
            options.title,
            options.type,
            options.vendorId,
            options.userId
          );

          resolve(url);
        } catch (error) {
          reject(error);
        }
      });

      doc.on('error', reject);

      // Header
      doc
        .fontSize(20)
        .text('CyberNark', { align: 'center' })
        .fontSize(16)
        .text(options.title, { align: 'center' })
        .moveDown();

      doc
        .fontSize(12)
        .text(`Report Type: ${options.type}`)
        .text(`Generated: ${new Date().toLocaleDateString()}`)
        .moveDown();

      // Template-based content
      switch (options.template) {
        case 'risk-assessment':
          generateRiskAssessmentPDF(doc, options.data);
          break;
        case 'compliance':
          generateCompliancePDF(doc, options.data);
          break;
        case 'supplier-evaluation':
          generateSupplierEvaluationPDF(doc, options.data);
          break;
        case 'financial':
          generateFinancialPDF(doc, options.data);
          break;
        case 'security-audit':
          generateSecurityAuditPDF(doc, options.data);
          break;
        case 'performance-review':
          generatePerformanceReviewPDF(doc, options.data);
          break;
        case 'incident-report':
          generateIncidentReportPDF(doc, options.data);
          break;
        case 'vendor-summary':
          generateVendorSummaryPDF(doc, options.data);
          break;
        default:
          doc.text('Unknown template').moveDown();
      }

      // Footer
      doc
        .moveDown(2)
        .fontSize(10)
        .text('© CyberNark - Supplier Risk Assessment Platform', { align: 'center' })
        .text('Confidential - For internal use only', { align: 'center' });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

// Upload to MinIO and return a presigned URL (7 days expiry - safest option)
const uploadToMinIO = async (
  buffer: Buffer,
  title: string,
  type: string,
  vendorId?: string,
  userId?: string
): Promise<string> => {
  const folder = vendorId ? `reports/${vendorId}` : 'reports/general';
  const timestamp = Date.now();
  const fileName = `${type.toLowerCase().replace(/\s+/g, '-')}_${timestamp}.pdf`;
  const objectName = `${folder}/${fileName}`;

  const metaData = {
    'Content-Type': 'application/pdf',
    'X-Amz-Meta-Title': title,
    'X-Amz-Meta-Type': type,
    'X-Amz-Meta-Userid': userId || 'unknown',
    'X-Amz-Meta-Generated': new Date().toISOString(),
  };

  // Upload the PDF
  await minioClient.putObject(BUCKET_NAME, objectName, buffer, buffer.length, metaData);

  // Generate presigned GET URL - valid for 7 days (maximum allowed by MinIO)
  const presignedUrl = await minioClient.presignedGetObject(
    BUCKET_NAME,
    objectName,
    60 * 60 * 24 * 7 // 7 days in seconds
  );

  return presignedUrl;
};

// ========== PDF CONTENT GENERATORS ==========

const generateRiskAssessmentPDF = (doc: PDFKit.PDFDocument, data: any) => {
  doc
    .fontSize(14)
    .text('Risk Assessment Report', { underline: true })
    .moveDown();

  doc
    .fontSize(12)
    .text(`Vendor: ${data.vendor?.name || 'N/A'}`)
    .text(`Total Suppliers Assessed: ${data.totalSuppliers}`)
    .text(`Average BIV Score: ${data.averageBIVScore?.toFixed(2) || '0'}%`)
    .moveDown();

  doc.text('Risk Distribution:');
  if (data.riskDistribution) {
    Object.entries(data.riskDistribution).forEach(([level, count]) => {
      doc.text(`  ${level}: ${count} suppliers`);
    });
  }

  doc.moveDown();

  if (data.highRiskSuppliers && data.highRiskSuppliers.length > 0) {
    doc.text('High Risk Suppliers:');
    data.highRiskSuppliers.forEach((supplier: any, index: number) => {
      doc.text(`  ${index + 1}. ${supplier.name} - Score: ${supplier.bivScore || 'N/A'} - ${supplier.vendorName || 'N/A'}`);
    });
  }

  if (data.categoryBreakdown && data.categoryBreakdown.length > 0) {
    doc.moveDown();
    doc.text('Category Breakdown:');
    data.categoryBreakdown.forEach((category: any) => {
      doc.text(`  ${category.category}: ${category.count} suppliers, Avg Score: ${category.averageBIVScore?.toFixed(2) || '0'}%`);
    });
  }
};

const generateCompliancePDF = (doc: PDFKit.PDFDocument, data: any) => {
  doc
    .fontSize(14)
    .text('Compliance Report', { underline: true })
    .moveDown();

  doc
    .fontSize(12)
    .text(`Period: ${new Date(data.period?.start || Date.now()).toLocaleDateString()} to ${new Date(data.period?.end || Date.now()).toLocaleDateString()}`)
    .text(`Total Submissions: ${data.summary?.totalSubmissions || 0}`)
    .text(`Approved: ${data.summary?.approvedSubmissions || 0}`)
    .text(`Compliance Rate: ${data.summary?.complianceRate?.toFixed(2) || '0'}%`)
    .moveDown();

  if (data.complianceByMonth) {
    doc.text('Monthly Compliance:');
    Object.entries(data.complianceByMonth).forEach(([month, stats]: [string, any]) => {
      const rate = stats.total > 0 ? (stats.approved / stats.total) * 100 : 0;
      doc.text(`  ${month}: ${stats.approved}/${stats.total} (${rate.toFixed(2)}%)`);
    });
  }

  if (data.topCompliantSuppliers && data.topCompliantSuppliers.length > 0) {
    doc.moveDown();
    doc.text('Top Compliant Suppliers:');
    data.topCompliantSuppliers.forEach((supplier: any, index: number) => {
      doc.text(`  ${index + 1}. ${supplier.name} - Compliance: ${supplier.complianceRate?.toFixed(2) || '0'}%`);
    });
  }
};

const generateSupplierEvaluationPDF = (doc: PDFKit.PDFDocument, data: any) => {
  doc
    .fontSize(14)
    .text('Supplier Evaluation Report', { underline: true })
    .moveDown();

  doc
    .fontSize(12)
    .text(`Supplier: ${data.supplier?.name || 'N/A'}`)
    .text(`Contact: ${data.supplier?.contactPerson || 'N/A'}`)
    .text(`Email: ${data.supplier?.email || 'N/A'}`)
    .text(`Vendor: ${data.supplier?.vendor?.companyName || 'N/A'}`)
    .moveDown();

  doc.text('Scores:');
  if (data.scores?.overall) {
    doc.text(`  Overall: ${data.scores.overall.average?.toFixed(2) || '0'}% - ${data.scores.overall.riskLevel || 'N/A'} Risk`);
  }
  if (data.scores?.bivBreakdown) {
    doc.text(`  Business: ${data.scores.bivBreakdown.businessScore?.toFixed(2) || 'N/A'}%`);
    doc.text(`  Integrity: ${data.scores.bivBreakdown.integrityScore?.toFixed(2) || 'N/A'}%`);
    doc.text(`  Availability: ${data.scores.bivBreakdown.availabilityScore?.toFixed(2) || 'N/A'}%`);
    doc.text(`  BIV Score: ${data.scores.bivBreakdown.bivScore?.toFixed(2) || 'N/A'}%`);
  }

  doc.moveDown();

  if (data.recommendations && data.recommendations.length > 0) {
    doc.text('Recommendations:');
    data.recommendations.forEach((rec: string, index: number) => {
      doc.text(`  ${index + 1}. ${rec}`);
    });
  }
};

const generateFinancialPDF = (doc: PDFKit.PDFDocument, data: any) => {
  doc
    .fontSize(14)
    .text('Financial Analysis Report', { underline: true })
    .moveDown();

  doc
    .fontSize(12)
    .text(`Period: ${new Date(data.period?.start || Date.now()).toLocaleDateString()} to ${new Date(data.period?.end || Date.now()).toLocaleDateString()}`)
    .text(`Total Revenue: ${data.summary?.totalRevenue?.toFixed(2) || '0'} ${data.summary?.currency || 'EUR'}`)
    .text(`Total Payments: ${data.summary?.totalPayments || 0}`)
    .text(`Average Payment: ${data.summary?.averagePayment?.toFixed(2) || '0'} ${data.summary?.currency || 'EUR'}`)
    .moveDown();

  if (data.revenueByMonth) {
    doc.text('Revenue by Month:');
    Object.entries(data.revenueByMonth).forEach(([month, revenue]: [string, any]) => {
      doc.text(`  ${month}: ${revenue?.toFixed(2) || '0'} ${data.summary?.currency || 'EUR'}`);
    });
  }
};

const generateSecurityAuditPDF = (doc: PDFKit.PDFDocument, data: any) => {
  doc
    .fontSize(14)
    .text('Security Audit Report', { underline: true })
    .moveDown();

  doc
    .fontSize(12)
    .text(`Vendor ID: ${data.vendorId || 'N/A'}`)
    .text(`Total Suppliers: ${data.totalSuppliers || 0}`)
    .text(`Average Security Score: ${data.securityMetrics?.averageSecurityScore?.toFixed(2) || '0'}%`)
    .text(`NIS2 Compliance Rate: ${data.securityMetrics?.nis2ComplianceRate?.toFixed(2) || '0'}%`)
    .moveDown();

  if (data.recommendations && data.recommendations.length > 0) {
    doc.text('Recommendations:');
    data.recommendations.forEach((rec: string, index: number) => {
      if (rec) doc.text(`  ${index + 1}. ${rec}`);
    });
  }
};

const generatePerformanceReviewPDF = (doc: PDFKit.PDFDocument, data: any) => {
  doc
    .fontSize(14)
    .text('Performance Review Report', { underline: true })
    .moveDown();

  doc
    .fontSize(12)
    .text(`Vendor ID: ${data.vendorId || 'N/A'}`)
    .text(`Period: ${new Date(data.period?.start || Date.now()).toLocaleDateString()} to ${new Date(data.period?.end || Date.now()).toLocaleDateString()}`)
    .text(`Total Suppliers: ${data.summary?.totalSuppliers || 0}`)
    .text(`Overall Performance: ${data.summary?.overallPerformance?.toFixed(2) || '0'}%`)
    .moveDown();

  if (data.topPerformers && data.topPerformers.length > 0) {
    doc.text('Top Performers:');
    data.topPerformers.forEach((supplier: any, index: number) => {
      doc.text(`  ${index + 1}. ${supplier.name} - Score: ${supplier.performanceScore?.toFixed(2) || '0'}%`);
    });
  }
};

const generateIncidentReportPDF = (doc: PDFKit.PDFDocument, data: any) => {
  doc
    .fontSize(14)
    .text('Incident Report', { underline: true })
    .moveDown();

  doc
    .fontSize(12)
    .text(`Vendor ID: ${data.vendorId || 'N/A'}`)
    .text(`Period: ${new Date(data.period?.start || Date.now()).toLocaleDateString()} to ${new Date(data.period?.end || Date.now()).toLocaleDateString()}`)
    .text(`Total Problems: ${data.summary?.totalProblems || 0}`)
    .text(`Open Problems: ${data.summary?.openProblems || 0}`)
    .text(`SLA Breach Rate: ${data.summary?.slaBreachRate?.toFixed(2) || '0'}%`)
    .moveDown();

  if (data.topSuppliersWithIssues && data.topSuppliersWithIssues.length > 0) {
    doc.text('Top Suppliers with Issues:');
    data.topSuppliersWithIssues.forEach((supplier: any, index: number) => {
      doc.text(`  ${index + 1}. ${supplier.name} - Issues: ${supplier.count}, SLA Breaches: ${supplier.slaBreaches}`);
    });
  }
};

const generateVendorSummaryPDF = (doc: PDFKit.PDFDocument, data: any) => {
  doc
    .fontSize(14)
    .text('Vendor Summary Report', { underline: true })
    .moveDown();

  doc
    .fontSize(12)
    .text(`Vendor: ${data.vendor?.name || 'N/A'}`)
    .text(`Email: ${data.vendor?.email || 'N/A'}`)
    .text(`Generated: ${new Date().toLocaleDateString()}`)
    .moveDown();

  doc.text('Summary Statistics:');
  if (data.summary) {
    doc.text(`  Total Suppliers: ${data.summary.totalSuppliers || 0}`);
    doc.text(`  Active Suppliers: ${data.summary.activeSuppliers || 0}`);
    doc.text(`  High Risk Suppliers: ${data.summary.highRiskSuppliers || 0}`);
    doc.text(`  Average BIV Score: ${data.summary.averageBIVScore?.toFixed(2) || '0'}%`);
    doc.text(`  Average Compliance Rate: ${data.summary.averageComplianceRate?.toFixed(2) || '0'}%`);
    doc.text(`  Recent Problems: ${data.summary.recentProblems || 0}`);
    doc.text(`  Upcoming Expiries: ${data.summary.upcomingExpiries || 0}`);
    doc.text(`  Overdue Assessments: ${data.summary.overdueAssessments || 0}`);
  }

  doc.moveDown();

  if (data.riskDistribution) {
    doc.text('Risk Distribution:');
    Object.entries(data.riskDistribution).forEach(([level, count]) => {
      doc.text(`  ${level}: ${count} suppliers`);
    });
  }

  if (data.topPerformers && data.topPerformers.length > 0) {
    doc.moveDown();
    doc.text('Top Performing Suppliers:');
    data.topPerformers.forEach((supplier: any, index: number) => {
      doc.text(`  ${index + 1}. ${supplier.name} - Score: ${supplier.bivScore?.toFixed(2) || '0'}% - Risk: ${supplier.riskLevel}`);
    });
  }

  if (data.upcomingExpiries && data.upcomingExpiries.length > 0) {
    doc.moveDown();
    doc.text('Upcoming Contract Expiries (next 90 days):');
    data.upcomingExpiries.forEach((supplier: any, index: number) => {
      doc.text(`  ${index + 1}. ${supplier.name} - ${supplier.daysRemaining} days remaining`);
    });
  }
};