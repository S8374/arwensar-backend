// src/Logic/bivRiskCalculator.ts

export interface BIVScoreInput {
  businessScore: number;
  integrityScore: number;
  availabilityScore: number;
}

export interface BIVScoreResult {
  bivScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  breakdown: {
    business: number;
    integrity: number;
    availability: number;
  };
}

export const calculateBIVScore = (input: BIVScoreInput): BIVScoreResult => {
  const { businessScore, integrityScore, availabilityScore } = input;
  
  // Apply weights: Business(40%), Integrity(30%), Availability(30%)
  const weightedBusiness = businessScore * 0.4;
  const weightedIntegrity = integrityScore * 0.3;
  const weightedAvailability = availabilityScore * 0.3;
  
  const bivScore = weightedBusiness + weightedIntegrity + weightedAvailability;
  
  // Determine risk level
  let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  if (bivScore >= 71) {
    riskLevel = 'LOW';
  } else if (bivScore >= 41) {
    riskLevel = 'MEDIUM';
  } else {
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

export const getRiskLevel = (score: number): 'LOW' | 'MEDIUM' | 'HIGH' => {
  if (score >= 71) return 'LOW';
  if (score >= 41) return 'MEDIUM';
  return 'HIGH';
};