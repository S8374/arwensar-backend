// src/utils/pdfGenerator.ts
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

interface PDFOptions {
  title: string;
  type: string;
  data: any;
  template: string;
}

export const generatePDF = async (options: PDFOptions): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      
      // Create uploads directory if it doesn't exist
      const uploadsDir = path.join(__dirname, '../../uploads/reports');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      
      const filename = `${options.type.toLowerCase()}_${Date.now()}.pdf`;
      const filePath = path.join(uploadsDir, filename);
      const stream = fs.createWriteStream(filePath);
      
      doc.pipe(stream);
      
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
      }
      
      // Add footer
      doc
        .moveDown(2)
        .fontSize(10)
        .text('© CyberNark - Supplier Risk Assessment Platform', { align: 'center' })
        .text('Confidential - For internal use only', { align: 'center' });
      
      doc.end();
      
      stream.on('finish', () => {
        const publicUrl = `/uploads/reports/${filename}`;
        resolve(publicUrl);
      });
      
      stream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
};

const generateRiskAssessmentPDF = (doc: PDFKit.PDFDocument, data: any) => {
  doc
    .fontSize(14)
    .text('Risk Assessment Report', { underline: true })
    .moveDown();
  
  doc
    .fontSize(12)
    .text(`Total Suppliers Assessed: ${data.totalSuppliers}`)
    .text(`Average BIV Score: ${data.averageBIVScore.toFixed(2)}%`)
    .moveDown();
  
  // Risk distribution
  doc.text('Risk Distribution:');
  Object.entries(data.riskDistribution).forEach(([level, count]) => {
    doc.text(`  ${level}: ${count} suppliers`);
  });
  
  doc.moveDown();
  
  // High risk suppliers
  if (data.highRiskSuppliers && data.highRiskSuppliers.length > 0) {
    doc.text('High Risk Suppliers:');
    data.highRiskSuppliers.forEach((supplier: any, index: number) => {
      doc.text(`  ${index + 1}. ${supplier.name} - Score: ${supplier.bivScore || 'N/A'} - ${supplier.vendorName}`);
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
    .text(`Period: ${new Date(data.period.start).toLocaleDateString()} to ${new Date(data.period.end).toLocaleDateString()}`)
    .text(`Total Submissions: ${data.summary.totalSubmissions}`)
    .text(`Approved: ${data.summary.approvedSubmissions}`)
    .text(`Compliance Rate: ${data.summary.complianceRate.toFixed(2)}%`)
    .moveDown();
  
  // Monthly compliance
  doc.text('Monthly Compliance:');
  Object.entries(data.complianceByMonth).forEach(([month, stats]: [string, any]) => {
    const rate = stats.total > 0 ? (stats.approved / stats.total) * 100 : 0;
    doc.text(`  ${month}: ${stats.approved}/${stats.total} (${rate.toFixed(2)}%)`);
  });
};

const generateSupplierEvaluationPDF = (doc: PDFKit.PDFDocument, data: any) => {
  doc
    .fontSize(14)
    .text('Supplier Evaluation Report', { underline: true })
    .moveDown();
  
  // Supplier info
  doc
    .fontSize(12)
    .text(`Supplier: ${data.supplier.name}`)
    .text(`Contact: ${data.supplier.contactPerson}`)
    .text(`Email: ${data.supplier.email}`)
    .text(`Vendor: ${data.supplier.vendor.companyName}`)
    .moveDown();
  
  // Scores
  doc.text('Scores:');
  doc.text(`  Overall: ${data.scores.overall.average.toFixed(2)}% - ${data.scores.overall.riskLevel} Risk`);
  doc.text(`  Business: ${data.scores.bivBreakdown.businessScore?.toFixed(2) || 'N/A'}%`);
  doc.text(`  Integrity: ${data.scores.bivBreakdown.integrityScore?.toFixed(2) || 'N/A'}%`);
  doc.text(`  Availability: ${data.scores.bivBreakdown.availabilityScore?.toFixed(2) || 'N/A'}%`);
  doc.text(`  BIV Score: ${data.scores.bivBreakdown.bivScore?.toFixed(2) || 'N/A'}%`);
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
    .text(`Period: ${new Date(data.period.start).toLocaleDateString()} to ${new Date(data.period.end).toLocaleDateString()}`)
    .text(`Total Revenue: ${data.summary.totalRevenue.toFixed(2)} ${data.summary.currency}`)
    .text(`Total Payments: ${data.summary.totalPayments}`)
    .text(`Average Payment: ${data.summary.averagePayment.toFixed(2)} ${data.summary.currency}`)
    .moveDown();
  
  // Revenue by month
  doc.text('Revenue by Month:');
  Object.entries(data.revenueByMonth).forEach(([month, revenue]: [string, any]) => {
    doc.text(`  ${month}: ${revenue.toFixed(2)} ${data.summary.currency}`);
  });
};