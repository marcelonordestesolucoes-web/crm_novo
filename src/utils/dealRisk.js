/**
 * Calculates the risk score and classification for a deal based on its qualification.
 * 
 * Logic:
 * - budget: true = +2, false = -2
 * - decisionMaker: true = +2, false = -3
 * - urgency: true = +2, false = -1
 * - proposal: true = +1, false = 0
 * 
 * Classification:
 * - score <= 0: "high"
 * - score between 1 and 3: "medium"
 * - score >= 4: "low"
 * 
 * @param {Object} qualification - The qualification object from the deal.
 * @returns {Object|null} - { score, risk } or null if no data.
 */
export const calculateDealRisk = (qualification) => {
  if (!qualification || Object.keys(qualification).length === 0) return { score: 0, risk: 'low' };

  let score = 0;

  if (qualification.budget !== undefined) {
    score += qualification.budget ? 2 : -2;
  }
  if (qualification.decisionMaker !== undefined) {
    score += qualification.decisionMaker ? 2 : -3;
  }
  if (qualification.urgency !== undefined) {
    score += qualification.urgency ? 2 : -1;
  }
  if (qualification.proposal !== undefined) {
    score += qualification.proposal ? 1 : 0;
  }

  let risk = 'low';
  if (score <= 0) {
    risk = 'high';
  } else if (score >= 1 && score <= 3) {
    risk = 'medium';
  }

  return { score, risk };
};
