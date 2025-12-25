// src/utils/pdfGenerator.ts
import PDFDocument from 'pdfkit';
import cloudinary from 'cloudinary';
import stream from 'stream';

// Configure Cloudinary
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

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

      // Create a buffer to hold PDF data
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', async () => {
        try {
          const pdfBuffer = Buffer.concat(chunks);

          // Upload to Cloudinary
          const cloudinaryUrl = await uploadToCloudinary(
            pdfBuffer,
            options.title,
            options.type,
            options.vendorId,
            options.userId
          );

          resolve(cloudinaryUrl);
        } catch (error) {
          reject(error);
        }
      });

      doc.on('error', reject);

      // Add header
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

      // Add content based on template
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
      }

      // Add footer
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

// Upload to Cloudinary
const uploadToCloudinary = async (
  buffer: Buffer,
  title: string,
  type: string,
  vendorId?: string,
  userId?: string
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.v2.uploader.upload_stream(
      {
        folder: `reports/${vendorId || 'general'}`,
        public_id: `${type.toLowerCase()}_${Date.now()}`,
        resource_type: 'auto',
        tags: ['report', type.toLowerCase(), vendorId ? `vendor-${vendorId}` : ''],
        context: {
          caption: title,
          alt: `${type} Report - ${title}`,
          userId: userId || 'unknown'
        }
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else if (result) {
          resolve(result.secure_url);
        } else {
          reject(new Error('Upload failed'));
        }
      }
    );

    // Create a readable stream from buffer
    const bufferStream = new stream.PassThrough();
    bufferStream.end(buffer);
    bufferStream.pipe(uploadStream);
  });
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

  // Risk distribution
  doc.text('Risk Distribution:');
  if (data.riskDistribution) {
    Object.entries(data.riskDistribution).forEach(([level, count]) => {
      doc.text(`  ${level}: ${count} suppliers`);
    });
  }

  doc.moveDown();

  // High risk suppliers
  if (data.highRiskSuppliers && data.highRiskSuppliers.length > 0) {
    doc.text('High Risk Suppliers:');
    data.highRiskSuppliers.forEach((supplier: any, index: number) => {
      doc.text(`  ${index + 1}. ${supplier.name} - Score: ${supplier.bivScore || 'N/A'} - ${supplier.vendorName || 'N/A'}`);
    });
  }

  // Category breakdown
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

  // Monthly compliance
  if (data.complianceByMonth) {
    doc.text('Monthly Compliance:');
    Object.entries(data.complianceByMonth).forEach(([month, stats]: [string, any]) => {
      const rate = stats.total > 0 ? (stats.approved / stats.total) * 100 : 0;
      doc.text(`  ${month}: ${stats.approved}/${stats.total} (${rate.toFixed(2)}%)`);
    });
  }

  // Top compliant suppliers
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

  // Supplier info
  doc
    .fontSize(12)
    .text(`Supplier: ${data.supplier?.name || 'N/A'}`)
    .text(`Contact: ${data.supplier?.contactPerson || 'N/A'}`)
    .text(`Email: ${data.supplier?.email || 'N/A'}`)
    .text(`Vendor: ${data.supplier?.vendor?.companyName || 'N/A'}`)
    .moveDown();

  // Scores
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

  // Recommendations
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

  // Revenue by month
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

  // Recommendations
  if (data.recommendations && data.recommendations.length > 0) {
    doc.text('Recommendations:');
    data.recommendations.forEach((rec: string, index: number) => {
      if (rec) {
        doc.text(`  ${index + 1}. ${rec}`);
      }
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

  // Top performers
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

  // Top suppliers with issues
  if (data.topSuppliersWithIssues && data.topSuppliersWithIssues.length > 0) {
    doc.text('Top Suppliers with Issues:');
    data.topSuppliersWithIssues.forEach((supplier: any, index: number) => {
      doc.text(`  ${index + 1}. ${supplier.name} - Issues: ${supplier.count}, SLA Breaches: ${supplier.slaBreaches}`);
    });
  }
};


// Add this function:
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

  // Summary Statistics
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

  // Risk Distribution
  if (data.riskDistribution) {
    doc.text('Risk Distribution:');
    Object.entries(data.riskDistribution).forEach(([level, count]) => {
      doc.text(`  ${level}: ${count} suppliers`);
    });
  }

  // Top Performers
  if (data.topPerformers && data.topPerformers.length > 0) {
    doc.moveDown();
    doc.text('Top Performing Suppliers:');
    data.topPerformers.forEach((supplier: any, index: number) => {
      doc.text(`  ${index + 1}. ${supplier.name} - Score: ${supplier.bivScore?.toFixed(2) || '0'}% - Risk: ${supplier.riskLevel}`);
    });
  }

  // Upcoming Expiries
  if (data.upcomingExpiries && data.upcomingExpiries.length > 0) {
    doc.moveDown();
    doc.text('Upcoming Contract Expiries (next 90 days):');
    data.upcomingExpiries.forEach((supplier: any, index: number) => {
      doc.text(`  ${index + 1}. ${supplier.name} - ${supplier.daysRemaining} days remaining`);
    });
  }
};