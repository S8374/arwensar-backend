"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSupplierRecommendations = exports.calculateProblemStats = exports.calculateAssessmentStats = exports.calculateSupplierStats = exports.calculateNIS2Compliance = exports.calculateRecentUpdates = exports.calculateChartsData = exports.calculateAdditionalStats = exports.calculateComplianceGauge = exports.calculateComplianceOverview = exports.calculateContractStats = void 0;
// ========== CALCULATE CONTRACT STATS ==========
const calculateContractStats = (contracts, today, suppliers) => {
    const thirtyDaysFromNow = new Date(today);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    // Filter contracts with end dates
    const contractsWithEndDate = contracts.filter(c => c.contractEndDate);
    // Categorize contracts
    const expiringContracts = contractsWithEndDate.filter(c => c.contractEndDate > today &&
        c.contractEndDate <= thirtyDaysFromNow);
    const expiredContracts = contractsWithEndDate.filter(c => c.contractEndDate < today);
    const activeContracts = contractsWithEndDate.filter(c => c.contractEndDate > thirtyDaysFromNow);
    // const contractsByStatus = {
    //   active: activeContracts.length,
    //   expiring: expiringContracts.length,
    //   expired: expiredContracts.length,
    //   terminated: contracts.filter(c => !c.contractEndDate).length,
    //   total: contracts.length
    // };
    // Get recent expirations (contracts expiring soon)
    const recentExpirations = expiringContracts
        .sort((a, b) => a.contractEndDate.getTime() - b.contractEndDate.getTime())
        .slice(0, 5)
        .map(c => {
        const daysRemaining = Math.ceil((c.contractEndDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        // Find supplier details
        const supplier = suppliers.find(s => s.id === c.supplierId) || {};
        return {
            id: c.id,
            supplierId: c.supplierId,
            supplierName: c.name || supplier.name || 'Unknown Supplier',
            supplierEmail: supplier.email || c.email || '',
            contactPerson: supplier.contactPerson || c.contactPerson || '',
            category: c.category || supplier.category || '',
            criticality: c.criticality || supplier.criticality || 'MEDIUM',
            contractStartDate: c.contractStartDate,
            endDate: c.contractEndDate,
            daysRemaining,
            contractValue: c.totalContractValue || supplier.totalContractValue || 0,
            outstandingPayments: c.outstandingPayments || supplier.outstandingPayments || 0,
            status: 'EXPIRING'
        };
    });
    // Get expired contract details
    const expiredContractsDetails = expiredContracts
        .sort((a, b) => b.contractEndDate.getTime() - a.contractEndDate.getTime())
        .slice(0, 10) // Show more expired contracts since they're important
        .map(c => {
        const daysExpired = Math.ceil((today.getTime() - c.contractEndDate.getTime()) / (1000 * 60 * 60 * 24));
        // Find supplier details
        const supplier = suppliers.find(s => s.id === c.supplierId) || {};
        return {
            id: c.id,
            supplierId: c.supplierId,
            supplierName: c.name || supplier.name || 'Unknown Supplier',
            supplierEmail: supplier.email || c.email || '',
            contactPerson: supplier.contactPerson || c.contactPerson || '',
            category: c.category || supplier.category || '',
            criticality: c.criticality || supplier.criticality || 'MEDIUM',
            contractStartDate: c.contractStartDate,
            endDate: c.contractEndDate,
            daysExpired,
            contractValue: c.totalContractValue || supplier.totalContractValue || 0,
            outstandingPayments: c.outstandingPayments || supplier.outstandingPayments || 0,
            status: 'EXPIRED',
            isActive: supplier.isActive !== undefined ? supplier.isActive : true,
            invitationStatus: supplier.invitationStatus || 'ACCEPTED',
            lastAssessmentDate: supplier.lastAssessmentDate,
            bivScore: supplier.bivScore,
        };
    });
    return {
        // Summary statistics
        expiringContracts: expiringContracts.length,
        expiredContracts: expiredContracts.length,
        totalContract: contracts.length,
        // Detailed lists
        recentExpirations, // Contracts expiring soon
        expiredContractsDetails, // Expired contracts with details      
        // Risk analysis
        highRiskExpired: expiredContracts.filter(c => c.criticality === 'HIGH' || c.criticality === 'CRITICAL').length,
        overdueRenewals: expiredContracts.filter(c => daysExpired(c.contractEndDate) > 30).length
    };
    // Helper function to calculate days expired
    function daysExpired(endDate) {
        return Math.ceil((today.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24));
    }
};
exports.calculateContractStats = calculateContractStats;
// ========== CALCULATE COMPLIANCE OVERVIEW ==========
const calculateComplianceOverview = (suppliers) => {
    const riskDistribution = {
        low: suppliers.filter(s => s.riskLevel === 'LOW').length,
        medium: suppliers.filter(s => s.riskLevel === 'MEDIUM').length,
        high: suppliers.filter(s => s.riskLevel === 'HIGH').length,
        critical: suppliers.filter(s => s.riskLevel === 'CRITICAL').length
    };
    const totalSuppliers = suppliers.length;
    // const lowRisk = totalSuppliers > 0 ? (riskDistribution.low / totalSuppliers) * 100 : 0;
    // const mediumRisk = totalSuppliers > 0 ? (riskDistribution.medium / totalSuppliers) * 100 : 0;
    // const highRisk = totalSuppliers > 0 ? ((riskDistribution.high + riskDistribution.critical) / totalSuppliers) * 100 : 0;
    const lowRisk = riskDistribution.low;
    const mediumRisk = riskDistribution.medium;
    const highRisk = riskDistribution.high;
    // Calculate average BIV score
    const totalBIVScore = suppliers.reduce((sum, s) => { var _a; return sum + (((_a = s.bivScore) === null || _a === void 0 ? void 0 : _a.toNumber()) || 0); }, 0);
    const averageBIVScore = suppliers.length > 0 ? totalBIVScore / suppliers.length : 0;
    // Get top risks (suppliers with lowest BIV scores)
    const topRisks = suppliers
        .filter(s => s.bivScore !== null)
        .sort((a, b) => { var _a, _b; return (((_a = a.bivScore) === null || _a === void 0 ? void 0 : _a.toNumber()) || 0) - (((_b = b.bivScore) === null || _b === void 0 ? void 0 : _b.toNumber()) || 0); })
        .slice(0, 5)
        .map(s => {
        var _a;
        return ({
            id: s.id,
            supplierName: s.name,
            bivScore: ((_a = s.bivScore) === null || _a === void 0 ? void 0 : _a.toNumber()) || 0,
            riskLevel: s.riskLevel || 'UNKNOWN',
            lastAssessment: s.lastAssessmentDate
        });
    });
    return {
        lowRisk: parseFloat(lowRisk.toFixed(2)),
        mediumRisk: parseFloat(mediumRisk.toFixed(2)),
        highRisk: parseFloat(highRisk.toFixed(2)),
        riskDistribution,
        averageBIVScore: parseFloat(averageBIVScore.toFixed(2)),
        topRisks
    };
};
exports.calculateComplianceOverview = calculateComplianceOverview;
// ========== CALCULATE COMPLIANCE GAUGE ==========
const calculateComplianceGauge = (suppliers, assessments, problems, documents, sendedAlertNotifications) => {
    // Define compliance criteria
    const compliantSuppliers = suppliers.filter(supplier => {
        // Check if supplier has at least one approved assessment
        // const hasApprovedAssessments = assessments.some(a =>
        //   a.supplierId === supplier.id && a.status === 'APPROVED'
        // );
        // Check if supplier has active problems
        console.log("Problem", problems);
        const hasActiveProblems = problems.some(p => p.supplierId === supplier.id && p.status == 'IN_PROGRESS' && p.status == 'OPEN');
        console.log("sendedAlertNotifications", sendedAlertNotifications);
        // Check if supplier has at least one notification sent
        const hasSentNotifications = sendedAlertNotifications.some(n => { var _a; return ((_a = n.metadata) === null || _a === void 0 ? void 0 : _a.supplierId) === supplier.id; });
        // Return true only if all conditions are satisfied
        return hasActiveProblems || hasSentNotifications;
    }).length;
    console.log("Compliant Suppliers Count:", compliantSuppliers);
    console.log("Total Supplier:", suppliers.length);
    const nonCompliantSuppliers = suppliers.length - compliantSuppliers;
    // const compliancePercentage = suppliers.length > 50 ?
    //   (compliantSuppliers / suppliers.length) * 100 : 0;
    let compliancePercentage = 0;
    // Each compliant supplier = 1%
    // So if compliantSuppliers = 1 → 1%, 2 → 2%, etc.
    if (compliantSuppliers > 0) {
        compliancePercentage = compliantSuppliers;
        // Cap at 100%
        if (compliancePercentage > 100)
            compliancePercentage = 100;
    }
    console.log("Compliance Percentage:", compliancePercentage, "%");
    console.log("Compliance Percentage:", compliancePercentage, "%");
    // Calculate NIS2 compliance status
    const nis2Compliant = suppliers.filter(s => s.nis2Compliant).length;
    const partiallyCompliant = suppliers.filter(s => s.bivScore && s.bivScore >= 50 && s.bivScore < 71).length;
    // Find suppliers needing improvement
    const improvementNeeded = suppliers
        .filter(s => {
        const supplierAssessments = assessments.filter(a => a.supplierId === s.id);
        const supplierProblems = problems.filter(p => p.supplierId === s.id);
        const supplierDocuments = documents.filter(d => d.supplierId === s.id);
        const missingAssessments = supplierAssessments.length === 0 ? 1 : 0;
        const expiredDocuments = supplierDocuments.filter(d => d.expiryDate && d.expiryDate < new Date()).length;
        const pendingProblems = supplierProblems.filter(p => p.status !== 'RESOLVED').length;
        return missingAssessments > 0 || expiredDocuments > 0 || pendingProblems > 0;
    })
        .slice(0, 5)
        .map(s => {
        const supplierAssessments = assessments.filter(a => a.supplierId === s.id);
        const supplierProblems = problems.filter(p => p.supplierId === s.id);
        const supplierDocuments = documents.filter(d => d.supplierId === s.id);
        return {
            supplierId: s.id,
            supplierName: s.name,
            missingAssessments: supplierAssessments.length === 0 ? 1 : 0,
            expiredDocuments: supplierDocuments.filter(d => d.expiryDate && d.expiryDate < new Date()).length,
            pendingProblems: supplierProblems.filter(p => p.status !== 'RESOLVED').length
        };
    });
    return {
        compliantSuppliers,
        nonCompliantSuppliers,
        compliancePercentage: parseFloat(compliancePercentage.toFixed(2)),
        nis2Compliant,
        partiallyCompliant,
        nonCompliant: nonCompliantSuppliers,
        improvementNeeded
    };
};
exports.calculateComplianceGauge = calculateComplianceGauge;
// ========== CALCULATE ADDITIONAL STATS ==========
const calculateAdditionalStats = (documents, contracts, suppliers, activities, notifications, lastLoginAt) => {
    // Document stats
    const totalDocuments = documents.length;
    const pendingReview = documents.filter(d => d.status === 'PENDING' || d.status === 'UNDER_REVIEW').length;
    const expiredDocuments = documents.filter(d => d.expiryDate && d.expiryDate < new Date()).length;
    const verificationRate = totalDocuments > 0 ?
        (documents.filter(d => d.isVerified).length / totalDocuments) * 100 : 0;
    // Financial stats
    const totalContractValue = contracts.reduce((sum, c) => { var _a; return sum + (((_a = c.totalContractValue) === null || _a === void 0 ? void 0 : _a.toNumber()) || 0); }, 0);
    const outstandingPayments = contracts.reduce((sum, c) => { var _a; return sum + (((_a = c.outstandingPayments) === null || _a === void 0 ? void 0 : _a.toNumber()) || 0); }, 0);
    const averageContractValue = contracts.length > 0 ?
        totalContractValue / contracts.length : 0;
    // Performance stats (simplified)
    const averageResponseTime = 24; // Placeholder - would calculate from problem response times
    const onTimeDeliveryRate = 95; // Placeholder
    const satisfactionScore = 8.5; // Placeholder
    // Activity stats
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentActivities = activities.filter(a => a.createdAt >= sevenDaysAgo).length;
    // Calculate login frequency (simplified)
    const loginFrequency = lastLoginAt ? 5 : 0; // Placeholder
    return {
        documentStats: {
            totalDocuments,
            pendingReview,
            expiredDocuments,
            verificationRate: parseFloat(verificationRate.toFixed(2))
        },
        financialStats: {
            totalContractValue: parseFloat(totalContractValue.toFixed(2)),
            outstandingPayments: parseFloat(outstandingPayments.toFixed(2)),
            averageContractValue: parseFloat(averageContractValue.toFixed(2))
        },
        performanceStats: {
            averageResponseTime,
            onTimeDeliveryRate,
            satisfactionScore
        },
        activityStats: {
            recentActivities,
            loginFrequency,
            notificationCount: notifications
        }
    };
};
exports.calculateAdditionalStats = calculateAdditionalStats;
// ========== CALCULATE CHARTS DATA ==========
const calculateChartsData = (assessments, problems, suppliers, thirtyDaysAgo) => {
    // Generate risk trend data (last 12 weeks)
    const riskTrend = [];
    for (let i = 11; i >= 0; i--) {
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - (i * 7));
        const weekLabel = weekStart.toLocaleDateString('default', { month: 'short', day: 'numeric' });
        // Simplified - in real app, you'd query historical data
        riskTrend.push({
            date: weekLabel,
            low: Math.floor(Math.random() * 20) + 10,
            medium: Math.floor(Math.random() * 15) + 5,
            high: Math.floor(Math.random() * 10) + 1,
            critical: Math.floor(Math.random() * 5)
        });
    }
    // Generate compliance progress (last 6 months)
    const complianceProgress = [];
    for (let i = 5; i >= 0; i--) {
        const month = new Date();
        month.setMonth(month.getMonth() - i);
        const monthLabel = month.toLocaleDateString('default', { month: 'short' });
        complianceProgress.push({
            month: monthLabel,
            complianceRate: Math.floor(Math.random() * 30) + 60,
            target: 80
        });
    }
    // Assessment completion by category
    const assessmentCompletion = [
        { category: 'Initial', completed: assessments.filter(a => a.stage === 'INITIAL' && a.status === 'APPROVED').length, pending: assessments.filter(a => a.stage === 'INITIAL' && a.status !== 'APPROVED').length },
        { category: 'Full', completed: assessments.filter(a => a.stage === 'FULL' && a.status === 'APPROVED').length, pending: assessments.filter(a => a.stage === 'FULL' && a.status !== 'APPROVED').length },
        { category: 'Security', completed: Math.floor(Math.random() * 15), pending: Math.floor(Math.random() * 5) },
        { category: 'Compliance', completed: Math.floor(Math.random() * 12), pending: Math.floor(Math.random() * 8) },
        { category: 'Business', completed: Math.floor(Math.random() * 20), pending: Math.floor(Math.random() * 10) }
    ];
    // Problem resolution trend (last 8 weeks)
    const problemResolution = [];
    for (let i = 7; i >= 0; i--) {
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - (i * 7));
        const weekLabel = `Week ${8 - i}`;
        problemResolution.push({
            week: weekLabel,
            resolved: Math.floor(Math.random() * 10) + 5,
            reported: Math.floor(Math.random() * 12) + 3
        });
    }
    return {
        riskTrend,
        complianceProgress,
        assessmentCompletion,
        problemResolution
    };
};
exports.calculateChartsData = calculateChartsData;
// ========== CALCULATE RECENT UPDATES ==========
const calculateRecentUpdates = (assessments, problems, documents, contracts, suppliers) => {
    const updates = [];
    // Add recent assessment submissions
    assessments
        .filter(a => a.submittedAt)
        .slice(0, 3)
        .forEach(a => {
        var _a;
        updates.push({
            type: 'ASSESSMENT',
            title: `New Assessment Submitted`,
            description: `${((_a = a.supplier) === null || _a === void 0 ? void 0 : _a.name) || 'Supplier'} submitted ${a.assessment.title}`,
            timestamp: a.submittedAt || a.createdAt,
            priority: a.score && a.score < 50 ? 'HIGH' : 'MEDIUM',
            actionRequired: a.status === 'SUBMITTED' || a.status === 'UNDER_REVIEW'
        });
    });
    // Add recent problems
    problems
        .filter(p => p.priority === 'URGENT' || p.priority === 'HIGH')
        .slice(0, 2)
        .forEach(p => {
        var _a;
        updates.push({
            type: 'PROBLEM',
            title: `${p.priority} Priority Problem`,
            description: `${((_a = p.supplier) === null || _a === void 0 ? void 0 : _a.name) || 'Supplier'}: ${p.title}`,
            timestamp: p.createdAt,
            priority: p.priority === 'URGENT' ? 'HIGH' : 'MEDIUM',
            actionRequired: true
        });
    });
    // Add expiring contracts
    const today = new Date();
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    contracts
        .filter(c => c.contractEndDate && c.contractEndDate <= sevenDaysFromNow && c.contractEndDate > today)
        .slice(0, 2)
        .forEach(c => {
        const daysRemaining = Math.ceil((c.contractEndDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        updates.push({
            type: 'CONTRACT',
            title: `Contract Expiring Soon`,
            description: `${c.name}'s contract expires in ${daysRemaining} days`,
            timestamp: new Date(),
            priority: daysRemaining <= 3 ? 'HIGH' : 'MEDIUM',
            actionRequired: true
        });
    });
    // Add pending documents
    documents
        .filter(d => d.status === 'PENDING' || d.status === 'UNDER_REVIEW')
        .slice(0, 2)
        .forEach(d => {
        updates.push({
            type: 'DOCUMENT',
            title: `Document Pending Review`,
            description: `${d.name} requires review`,
            timestamp: d.createdAt,
            priority: 'MEDIUM',
            actionRequired: true
        });
    });
    // Sort by timestamp
    updates.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return updates.slice(0, 10);
};
exports.calculateRecentUpdates = calculateRecentUpdates;
// ========== CALCULATE NIS2 COMPLIANCE ==========
const calculateNIS2Compliance = (suppliers, today, yesterday) => {
    const compliantSuppliers = suppliers.filter(s => s.nis2Compliant).length;
    const nonCompliantSuppliers = suppliers.length - compliantSuppliers;
    // Calculate NIS2 compliance score (weighted average)
    let totalNIS2Score = 0;
    suppliers.forEach(supplier => {
        if (supplier.nis2Compliant) {
            totalNIS2Score += 100;
        }
        else if (supplier.bivScore) {
            // Use BIV score as proxy for NIS2 compliance
            totalNIS2Score += Math.min(supplier.bivScore.toNumber(), 100);
        }
        else {
            totalNIS2Score += 0;
        }
    });
    const overallScore = suppliers.length > 0 ? totalNIS2Score / suppliers.length : 0;
    // Calculate today's improvement (simplified - in real app, track historical data)
    const todayImprovement = Math.random() * 5; // Placeholder
    // Determine trend
    let trend = 'STABLE';
    if (todayImprovement > 1)
        trend = 'UP';
    else if (todayImprovement < -1)
        trend = 'DOWN';
    return {
        overallScore: parseFloat(overallScore.toFixed(2)),
        todayImprovement: parseFloat(todayImprovement.toFixed(2)),
        totalImprovement: parseFloat((overallScore - 50).toFixed(2)), // Placeholder
        trend,
        lastUpdated: new Date(),
        compliantSuppliers,
        nonCompliantSuppliers
    };
};
exports.calculateNIS2Compliance = calculateNIS2Compliance;
// ========== CALCULATE SUPPLIER STATS ==========
const calculateSupplierStats = (suppliers, vendorId, thirtyDaysAgo) => {
    const pendingInvitations = suppliers.filter(s => !s.userId && s.invitationStatus === 'PENDING').length;
    const recentAdditions = suppliers.filter(s => s.createdAt >= thirtyDaysAgo).length;
    return {
        totalSuppliers: suppliers.length,
        activeSuppliers: suppliers.filter(s => s.isActive).length,
        pendingInvitations,
        recentAdditions
    };
};
exports.calculateSupplierStats = calculateSupplierStats;
// ========== CALCULATE ASSESSMENT STATS ==========
const calculateAssessmentStats = (assessments, suppliers) => {
    const pendingAssessments = assessments.filter(a => a.status === 'PENDING').length;
    const completedAssessments = assessments.filter(a => a.status === 'APPROVED').length;
    // Calculate overdue assessments (submitted > 7 days ago and not approved)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const overdueAssessments = assessments.filter(a => a.submittedAt &&
        a.submittedAt < sevenDaysAgo &&
        a.status !== 'APPROVED').length;
    // Calculate submission rate
    const totalRequiredAssessments = suppliers.length * 2; // Assuming 2 assessments per supplier
    const submissionRate = totalRequiredAssessments > 0 ?
        (completedAssessments / totalRequiredAssessments) * 100 : 0;
    // Get recent submissions
    const recentSubmissions = assessments
        .filter(a => a.submittedAt)
        .slice(0, 5)
        .map(a => {
        var _a, _b;
        return ({
            id: a.id,
            supplierName: ((_a = a.supplier) === null || _a === void 0 ? void 0 : _a.name) || 'Unknown',
            assessmentTitle: a.assessment.title,
            submittedAt: a.submittedAt || a.createdAt,
            score: ((_b = a.score) === null || _b === void 0 ? void 0 : _b.toNumber()) || null
        });
    });
    return {
        pendingAssessments,
        completedAssessments,
        overdueAssessments,
        submissionRate: parseFloat(submissionRate.toFixed(2)),
        recentSubmissions
    };
};
exports.calculateAssessmentStats = calculateAssessmentStats;
// ========== CALCULATE PROBLEM STATS ==========
const calculateProblemStats = (problems) => {
    const criticalProblems = problems.filter(p => p.priority === 'URGENT' || p.priority === 'HIGH').length;
    const problemsByPriority = {
        urgent: problems.filter(p => p.priority === 'URGENT').length,
        high: problems.filter(p => p.priority === 'HIGH').length,
        medium: problems.filter(p => p.priority === 'MEDIUM').length,
        low: problems.filter(p => p.priority === 'LOW').length
    };
    // Calculate average resolution time (simplified)
    const resolvedProblems = problems.filter(p => p.status === 'RESOLVED' && p.resolvedAt && p.createdAt);
    let totalResolutionTime = 0;
    resolvedProblems.forEach(p => {
        const resolutionTime = p.resolvedAt.getTime() - p.createdAt.getTime();
        totalResolutionTime += resolutionTime / (1000 * 60 * 60); // Convert to hours
    });
    const averageResolutionTime = resolvedProblems.length > 0 ?
        totalResolutionTime / resolvedProblems.length : 0;
    // Calculate unresolved overdue problems
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const unresolvedOverdue = problems.filter(p => p.status !== 'RESOLVED' &&
        p.createdAt < sevenDaysAgo).length;
    return {
        activeProblems: problems.length,
        criticalProblems,
        problemsByPriority,
        averageResolutionTime: parseFloat(averageResolutionTime.toFixed(2)),
        unresolvedOverdue
    };
};
exports.calculateProblemStats = calculateProblemStats;
// ========== GENERATE SUPPLIER RECOMMENDATIONS ==========
const generateSupplierRecommendations = (supplier, categoryScores, evidenceCompletionRate) => {
    const recommendations = [];
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
        const daysRemaining = Math.ceil((new Date(supplier.contractEndDate).getTime() - new Date().getTime()) /
            (1000 * 60 * 60 * 24));
        if (daysRemaining < 30) {
            recommendations.push(`Contract expires in ${daysRemaining} days. Initiate renewal process immediately.`);
        }
        else if (daysRemaining < 90) {
            recommendations.push(`Contract expires in ${daysRemaining} days. Start renewal discussions.`);
        }
    }
    // Check assessment frequency
    if (supplier.lastAssessmentDate) {
        const daysSinceLastAssessment = Math.ceil((new Date().getTime() - new Date(supplier.lastAssessmentDate).getTime()) /
            (1000 * 60 * 60 * 24));
        if (daysSinceLastAssessment > 365) {
            recommendations.push("Annual assessment overdue. Schedule new comprehensive risk assessment.");
        }
        else if (daysSinceLastAssessment > 180) {
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
            recommendations.push(`${category.category} compliance needs improvement (${category.percentage.toFixed(2)}%). ` +
                "Review related controls, provide training, and conduct follow-up assessment.");
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
};
exports.generateSupplierRecommendations = generateSupplierRecommendations;
