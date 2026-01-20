"use strict";
// src/Logic/bivRiskCalculator.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateRiskScore = exports.getRiskLevel = exports.calculateBIVScores = exports.calculateBIVScore = void 0;
const calculateBIVScore = (input) => {
    const { businessScore, integrityScore, availabilityScore } = input;
    const weightedBusiness = businessScore * 0.4;
    const weightedIntegrity = integrityScore * 0.3;
    const weightedAvailability = availabilityScore * 0.3;
    const bivScore = weightedBusiness + weightedIntegrity + weightedAvailability;
    // Determine risk level
    let riskLevel;
    if (bivScore >= 71) {
        riskLevel = 'LOW';
    }
    else if (bivScore >= 41) {
        riskLevel = 'MEDIUM';
    }
    else {
        riskLevel = 'HIGH';
    }
    return {
        bivScore: parseFloat(bivScore.toFixed(2)),
        riskLevel,
        breakdown: {
            business: parseFloat(weightedBusiness.toFixed(2)),
            integrity: parseFloat(weightedIntegrity.toFixed(2)),
            availability: parseFloat(weightedAvailability.toFixed(2)),
        }
    };
};
exports.calculateBIVScore = calculateBIVScore;
// ========== CALCULATE BIV SCORES ==========
const calculateBIVScores = (answers) => {
    if (!answers || answers.length === 0) {
        return {
            businessScore: 0,
            integrityScore: 0,
            availabilityScore: 0,
            bivScore: 0,
            riskLevel: 'HIGH',
            breakdown: { business: 0, integrity: 0, availability: 0 }
        };
    }
    console.log("Raw answers received:", answers);
    // Filter answers by category (case-insensitive, safe access)
    const businessAnswers = answers.filter((a) => { var _a; return (((_a = a.question) === null || _a === void 0 ? void 0 : _a.bivCategory) || '').toUpperCase() === 'BUSINESS'; });
    const integrityAnswers = answers.filter((a) => { var _a; return (((_a = a.question) === null || _a === void 0 ? void 0 : _a.bivCategory) || '').toUpperCase() === 'INTEGRITY'; });
    const availabilityAnswers = answers.filter((a) => { var _a; return (((_a = a.question) === null || _a === void 0 ? void 0 : _a.bivCategory) || '').toUpperCase() === 'AVAILABILITY'; });
    console.log("Business answers:", businessAnswers.length);
    console.log("Integrity answers:", integrityAnswers.length);
    console.log("Availability answers:", availabilityAnswers.length);
    const calculateCategoryScore = (categoryAnswers) => {
        if (categoryAnswers.length === 0)
            return 0;
        let totalScore = 0;
        let totalMaxScore = 0;
        categoryAnswers.forEach((ans) => {
            var _a;
            // Handle score (string, number, or Decimal)
            const score = ans.score;
            const numScore = typeof score === 'string' ? parseFloat(score) :
                (score === null || score === void 0 ? void 0 : score.toNumber) ? score.toNumber() :
                    Number(score) || 0;
            // Handle maxScore — it's on the answer, not question!
            const maxScore = ans.maxScore || ((_a = ans.question) === null || _a === void 0 ? void 0 : _a.maxScore) || 10;
            totalScore += numScore;
            totalMaxScore += maxScore;
        });
        return totalMaxScore > 0
            ? parseFloat(((totalScore / totalMaxScore) * 100).toFixed(2))
            : 0;
    };
    const businessScore = calculateCategoryScore(businessAnswers);
    const integrityScore = calculateCategoryScore(integrityAnswers);
    const availabilityScore = calculateCategoryScore(availabilityAnswers);
    // Use your existing BIV calculator
    const bivResult = (0, exports.calculateBIVScore)({
        businessScore,
        integrityScore,
        availabilityScore
    });
    return {
        businessScore,
        integrityScore,
        availabilityScore,
        bivScore: bivResult.bivScore,
        riskLevel: bivResult.riskLevel,
        breakdown: bivResult.breakdown
    };
};
exports.calculateBIVScores = calculateBIVScores;
const getRiskLevel = (score) => {
    if (score >= 71)
        return 'LOW';
    if (score >= 41)
        return 'MEDIUM';
    return 'HIGH';
};
exports.getRiskLevel = getRiskLevel;
const calculateRiskScore = (riskLevel) => {
    switch (riskLevel) {
        case 'LOW': return 1;
        case 'MEDIUM': return 2;
        case 'HIGH': return 3;
        default: return 2;
    }
};
exports.calculateRiskScore = calculateRiskScore;
