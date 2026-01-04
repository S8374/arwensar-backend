"use strict";
// src/Logic/bivRiskCalculator.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRiskLevel = exports.calculateBIVScore = void 0;
const calculateBIVScore = (input) => {
    const { businessScore, integrityScore, availabilityScore } = input;
    // Apply weights: Business(40%), Integrity(30%), Availability(30%)
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
const getRiskLevel = (score) => {
    if (score >= 71)
        return 'LOW';
    if (score >= 41)
        return 'MEDIUM';
    return 'HIGH';
};
exports.getRiskLevel = getRiskLevel;
