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
exports.generatePDF = void 0;
// src/utils/pdfGenerator.ts
const minio_1 = require("minio");
const pdfkit_1 = __importDefault(require("pdfkit"));
// Configure MinIO Client
const minioClient = new minio_1.Client({
    endPoint: 's3.cybernark.com',
    port: 9000,
    useSSL: false,
    accessKey: process.env.MINIO_ROOT_USER || 'minioadmin',
    secretKey: process.env.MINIO_ROOT_PASSWORD || 'tatfxs4fxutl9tgm',
});
const BUCKET_NAME = 'test';
const generatePDF = (options) => __awaiter(void 0, void 0, void 0, function* () {
    return new Promise((resolve, reject) => {
        try {
            const doc = new pdfkit_1.default({ margin: 50 });
            const chunks = [];
            doc.on('data', (chunk) => chunks.push(chunk));
            doc.on('end', () => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const pdfBuffer = Buffer.concat(chunks);
                    const url = yield uploadToMinIO(pdfBuffer, options.title, options.type, options.vendorId, options.userId);
                    resolve(url);
                }
                catch (error) {
                    reject(error);
                }
            }));
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
        }
        catch (error) {
            reject(error);
        }
    });
});
exports.generatePDF = generatePDF;
// Upload to MinIO and return a presigned URL (7 days expiry - safest option)
const uploadToMinIO = (buffer, title, type, vendorId, userId) => __awaiter(void 0, void 0, void 0, function* () {
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
    yield minioClient.putObject(BUCKET_NAME, objectName, buffer, buffer.length, metaData);
    // Generate presigned GET URL - valid for 7 days (maximum allowed by MinIO)
    const presignedUrl = yield minioClient.presignedGetObject(BUCKET_NAME, objectName, 60 * 60 * 24 * 7 // 7 days in seconds
    );
    return presignedUrl;
});
// ========== PDF CONTENT GENERATORS ==========
const generateRiskAssessmentPDF = (doc, data) => {
    var _a, _b;
    doc
        .fontSize(14)
        .text('Risk Assessment Report', { underline: true })
        .moveDown();
    doc
        .fontSize(12)
        .text(`Vendor: ${((_a = data.vendor) === null || _a === void 0 ? void 0 : _a.name) || 'N/A'}`)
        .text(`Total Suppliers Assessed: ${data.totalSuppliers}`)
        .text(`Average BIV Score: ${((_b = data.averageBIVScore) === null || _b === void 0 ? void 0 : _b.toFixed(2)) || '0'}%`)
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
        data.highRiskSuppliers.forEach((supplier, index) => {
            doc.text(`  ${index + 1}. ${supplier.name} - Score: ${supplier.bivScore || 'N/A'} - ${supplier.vendorName || 'N/A'}`);
        });
    }
    if (data.categoryBreakdown && data.categoryBreakdown.length > 0) {
        doc.moveDown();
        doc.text('Category Breakdown:');
        data.categoryBreakdown.forEach((category) => {
            var _a;
            doc.text(`  ${category.category}: ${category.count} suppliers, Avg Score: ${((_a = category.averageBIVScore) === null || _a === void 0 ? void 0 : _a.toFixed(2)) || '0'}%`);
        });
    }
};
const generateCompliancePDF = (doc, data) => {
    var _a, _b, _c, _d, _e, _f;
    doc
        .fontSize(14)
        .text('Compliance Report', { underline: true })
        .moveDown();
    doc
        .fontSize(12)
        .text(`Period: ${new Date(((_a = data.period) === null || _a === void 0 ? void 0 : _a.start) || Date.now()).toLocaleDateString()} to ${new Date(((_b = data.period) === null || _b === void 0 ? void 0 : _b.end) || Date.now()).toLocaleDateString()}`)
        .text(`Total Submissions: ${((_c = data.summary) === null || _c === void 0 ? void 0 : _c.totalSubmissions) || 0}`)
        .text(`Approved: ${((_d = data.summary) === null || _d === void 0 ? void 0 : _d.approvedSubmissions) || 0}`)
        .text(`Compliance Rate: ${((_f = (_e = data.summary) === null || _e === void 0 ? void 0 : _e.complianceRate) === null || _f === void 0 ? void 0 : _f.toFixed(2)) || '0'}%`)
        .moveDown();
    if (data.complianceByMonth) {
        doc.text('Monthly Compliance:');
        Object.entries(data.complianceByMonth).forEach(([month, stats]) => {
            const rate = stats.total > 0 ? (stats.approved / stats.total) * 100 : 0;
            doc.text(`  ${month}: ${stats.approved}/${stats.total} (${rate.toFixed(2)}%)`);
        });
    }
    if (data.topCompliantSuppliers && data.topCompliantSuppliers.length > 0) {
        doc.moveDown();
        doc.text('Top Compliant Suppliers:');
        data.topCompliantSuppliers.forEach((supplier, index) => {
            var _a;
            doc.text(`  ${index + 1}. ${supplier.name} - Compliance: ${((_a = supplier.complianceRate) === null || _a === void 0 ? void 0 : _a.toFixed(2)) || '0'}%`);
        });
    }
};
const generateSupplierEvaluationPDF = (doc, data) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
    doc
        .fontSize(14)
        .text('Supplier Evaluation Report', { underline: true })
        .moveDown();
    doc
        .fontSize(12)
        .text(`Supplier: ${((_a = data.supplier) === null || _a === void 0 ? void 0 : _a.name) || 'N/A'}`)
        .text(`Contact: ${((_b = data.supplier) === null || _b === void 0 ? void 0 : _b.contactPerson) || 'N/A'}`)
        .text(`Email: ${((_c = data.supplier) === null || _c === void 0 ? void 0 : _c.email) || 'N/A'}`)
        .text(`Vendor: ${((_e = (_d = data.supplier) === null || _d === void 0 ? void 0 : _d.vendor) === null || _e === void 0 ? void 0 : _e.companyName) || 'N/A'}`)
        .moveDown();
    doc.text('Scores:');
    if ((_f = data.scores) === null || _f === void 0 ? void 0 : _f.overall) {
        doc.text(`  Overall: ${((_g = data.scores.overall.average) === null || _g === void 0 ? void 0 : _g.toFixed(2)) || '0'}% - ${data.scores.overall.riskLevel || 'N/A'} Risk`);
    }
    if ((_h = data.scores) === null || _h === void 0 ? void 0 : _h.bivBreakdown) {
        doc.text(`  Business: ${((_j = data.scores.bivBreakdown.businessScore) === null || _j === void 0 ? void 0 : _j.toFixed(2)) || 'N/A'}%`);
        doc.text(`  Integrity: ${((_k = data.scores.bivBreakdown.integrityScore) === null || _k === void 0 ? void 0 : _k.toFixed(2)) || 'N/A'}%`);
        doc.text(`  Availability: ${((_l = data.scores.bivBreakdown.availabilityScore) === null || _l === void 0 ? void 0 : _l.toFixed(2)) || 'N/A'}%`);
        doc.text(`  BIV Score: ${((_m = data.scores.bivBreakdown.bivScore) === null || _m === void 0 ? void 0 : _m.toFixed(2)) || 'N/A'}%`);
    }
    doc.moveDown();
    if (data.recommendations && data.recommendations.length > 0) {
        doc.text('Recommendations:');
        data.recommendations.forEach((rec, index) => {
            doc.text(`  ${index + 1}. ${rec}`);
        });
    }
};
const generateFinancialPDF = (doc, data) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    doc
        .fontSize(14)
        .text('Financial Analysis Report', { underline: true })
        .moveDown();
    doc
        .fontSize(12)
        .text(`Period: ${new Date(((_a = data.period) === null || _a === void 0 ? void 0 : _a.start) || Date.now()).toLocaleDateString()} to ${new Date(((_b = data.period) === null || _b === void 0 ? void 0 : _b.end) || Date.now()).toLocaleDateString()}`)
        .text(`Total Revenue: ${((_d = (_c = data.summary) === null || _c === void 0 ? void 0 : _c.totalRevenue) === null || _d === void 0 ? void 0 : _d.toFixed(2)) || '0'} ${((_e = data.summary) === null || _e === void 0 ? void 0 : _e.currency) || 'EUR'}`)
        .text(`Total Payments: ${((_f = data.summary) === null || _f === void 0 ? void 0 : _f.totalPayments) || 0}`)
        .text(`Average Payment: ${((_h = (_g = data.summary) === null || _g === void 0 ? void 0 : _g.averagePayment) === null || _h === void 0 ? void 0 : _h.toFixed(2)) || '0'} ${((_j = data.summary) === null || _j === void 0 ? void 0 : _j.currency) || 'EUR'}`)
        .moveDown();
    if (data.revenueByMonth) {
        doc.text('Revenue by Month:');
        Object.entries(data.revenueByMonth).forEach(([month, revenue]) => {
            var _a;
            doc.text(`  ${month}: ${(revenue === null || revenue === void 0 ? void 0 : revenue.toFixed(2)) || '0'} ${((_a = data.summary) === null || _a === void 0 ? void 0 : _a.currency) || 'EUR'}`);
        });
    }
};
const generateSecurityAuditPDF = (doc, data) => {
    var _a, _b, _c, _d;
    doc
        .fontSize(14)
        .text('Security Audit Report', { underline: true })
        .moveDown();
    doc
        .fontSize(12)
        .text(`Vendor ID: ${data.vendorId || 'N/A'}`)
        .text(`Total Suppliers: ${data.totalSuppliers || 0}`)
        .text(`Average Security Score: ${((_b = (_a = data.securityMetrics) === null || _a === void 0 ? void 0 : _a.averageSecurityScore) === null || _b === void 0 ? void 0 : _b.toFixed(2)) || '0'}%`)
        .text(`NIS2 Compliance Rate: ${((_d = (_c = data.securityMetrics) === null || _c === void 0 ? void 0 : _c.nis2ComplianceRate) === null || _d === void 0 ? void 0 : _d.toFixed(2)) || '0'}%`)
        .moveDown();
    if (data.recommendations && data.recommendations.length > 0) {
        doc.text('Recommendations:');
        data.recommendations.forEach((rec, index) => {
            if (rec)
                doc.text(`  ${index + 1}. ${rec}`);
        });
    }
};
const generatePerformanceReviewPDF = (doc, data) => {
    var _a, _b, _c, _d, _e;
    doc
        .fontSize(14)
        .text('Performance Review Report', { underline: true })
        .moveDown();
    doc
        .fontSize(12)
        .text(`Vendor ID: ${data.vendorId || 'N/A'}`)
        .text(`Period: ${new Date(((_a = data.period) === null || _a === void 0 ? void 0 : _a.start) || Date.now()).toLocaleDateString()} to ${new Date(((_b = data.period) === null || _b === void 0 ? void 0 : _b.end) || Date.now()).toLocaleDateString()}`)
        .text(`Total Suppliers: ${((_c = data.summary) === null || _c === void 0 ? void 0 : _c.totalSuppliers) || 0}`)
        .text(`Overall Performance: ${((_e = (_d = data.summary) === null || _d === void 0 ? void 0 : _d.overallPerformance) === null || _e === void 0 ? void 0 : _e.toFixed(2)) || '0'}%`)
        .moveDown();
    if (data.topPerformers && data.topPerformers.length > 0) {
        doc.text('Top Performers:');
        data.topPerformers.forEach((supplier, index) => {
            var _a;
            doc.text(`  ${index + 1}. ${supplier.name} - Score: ${((_a = supplier.performanceScore) === null || _a === void 0 ? void 0 : _a.toFixed(2)) || '0'}%`);
        });
    }
};
const generateIncidentReportPDF = (doc, data) => {
    var _a, _b, _c, _d, _e, _f;
    doc
        .fontSize(14)
        .text('Incident Report', { underline: true })
        .moveDown();
    doc
        .fontSize(12)
        .text(`Vendor ID: ${data.vendorId || 'N/A'}`)
        .text(`Period: ${new Date(((_a = data.period) === null || _a === void 0 ? void 0 : _a.start) || Date.now()).toLocaleDateString()} to ${new Date(((_b = data.period) === null || _b === void 0 ? void 0 : _b.end) || Date.now()).toLocaleDateString()}`)
        .text(`Total Problems: ${((_c = data.summary) === null || _c === void 0 ? void 0 : _c.totalProblems) || 0}`)
        .text(`Open Problems: ${((_d = data.summary) === null || _d === void 0 ? void 0 : _d.openProblems) || 0}`)
        .text(`SLA Breach Rate: ${((_f = (_e = data.summary) === null || _e === void 0 ? void 0 : _e.slaBreachRate) === null || _f === void 0 ? void 0 : _f.toFixed(2)) || '0'}%`)
        .moveDown();
    if (data.topSuppliersWithIssues && data.topSuppliersWithIssues.length > 0) {
        doc.text('Top Suppliers with Issues:');
        data.topSuppliersWithIssues.forEach((supplier, index) => {
            doc.text(`  ${index + 1}. ${supplier.name} - Issues: ${supplier.count}, SLA Breaches: ${supplier.slaBreaches}`);
        });
    }
};
const generateVendorSummaryPDF = (doc, data) => {
    var _a, _b, _c, _d;
    doc
        .fontSize(14)
        .text('Vendor Summary Report', { underline: true })
        .moveDown();
    doc
        .fontSize(12)
        .text(`Vendor: ${((_a = data.vendor) === null || _a === void 0 ? void 0 : _a.name) || 'N/A'}`)
        .text(`Email: ${((_b = data.vendor) === null || _b === void 0 ? void 0 : _b.email) || 'N/A'}`)
        .text(`Generated: ${new Date().toLocaleDateString()}`)
        .moveDown();
    doc.text('Summary Statistics:');
    if (data.summary) {
        doc.text(`  Total Suppliers: ${data.summary.totalSuppliers || 0}`);
        doc.text(`  Active Suppliers: ${data.summary.activeSuppliers || 0}`);
        doc.text(`  High Risk Suppliers: ${data.summary.highRiskSuppliers || 0}`);
        doc.text(`  Average BIV Score: ${((_c = data.summary.averageBIVScore) === null || _c === void 0 ? void 0 : _c.toFixed(2)) || '0'}%`);
        doc.text(`  Average Compliance Rate: ${((_d = data.summary.averageComplianceRate) === null || _d === void 0 ? void 0 : _d.toFixed(2)) || '0'}%`);
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
        data.topPerformers.forEach((supplier, index) => {
            var _a;
            doc.text(`  ${index + 1}. ${supplier.name} - Score: ${((_a = supplier.bivScore) === null || _a === void 0 ? void 0 : _a.toFixed(2)) || '0'}% - Risk: ${supplier.riskLevel}`);
        });
    }
    if (data.upcomingExpiries && data.upcomingExpiries.length > 0) {
        doc.moveDown();
        doc.text('Upcoming Contract Expiries (next 90 days):');
        data.upcomingExpiries.forEach((supplier, index) => {
            doc.text(`  ${index + 1}. ${supplier.name} - ${supplier.daysRemaining} days remaining`);
        });
    }
};
