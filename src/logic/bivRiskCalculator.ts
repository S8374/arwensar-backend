// src/Logic/bivRiskCalculator.ts

import { Criticality } from "@prisma/client";

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

  // ========== CALCULATE BIV SCORES ==========
 export const calculateBIVScores=(answers: any[]): any => {
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
    const businessAnswers = answers.filter(
      (a: any) => (a.question?.bivCategory || '').toUpperCase() === 'BUSINESS'
    );
    const integrityAnswers = answers.filter(
      (a: any) => (a.question?.bivCategory || '').toUpperCase() === 'INTEGRITY'
    );
    const availabilityAnswers = answers.filter(
      (a: any) => (a.question?.bivCategory || '').toUpperCase() === 'AVAILABILITY'
    );

    console.log("Business answers:", businessAnswers.length);
    console.log("Integrity answers:", integrityAnswers.length);
    console.log("Availability answers:", availabilityAnswers.length);

    const calculateCategoryScore = (categoryAnswers: any[]) => {
      if (categoryAnswers.length === 0) return 0;

      let totalScore = 0;
      let totalMaxScore = 0;

      categoryAnswers.forEach((ans: any) => {
        // Handle score (string, number, or Decimal)
        const score = ans.score;
        const numScore =
          typeof score === 'string' ? parseFloat(score) :
            score?.toNumber ? score.toNumber() :
              Number(score) || 0;

        // Handle maxScore — it's on the answer, not question!
        const maxScore = ans.maxScore || ans.question?.maxScore || 10;

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
    const bivResult = calculateBIVScore({
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

export const getRiskLevel = (score: number): 'LOW' | 'MEDIUM' | 'HIGH' => {
  if (score >= 71) return 'LOW';
  if (score >= 41) return 'MEDIUM';
  return 'HIGH';
};

export const calculateRiskScore = (riskLevel: Criticality): number => {
    switch (riskLevel) {
      case 'LOW': return 1;
      case 'MEDIUM': return 2;
      case 'HIGH': return 3;
      default: return 2;
    }
  };