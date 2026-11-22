import type { Player, SquadRules, Team } from '../types';
import { getNextBidAmount } from '../utils/currencyUtils';
import { validateBid } from './squadRules';

interface TeamNeedFactors {
  batterNeed: number;
  bowlerNeed: number;
  allRounderNeed: number;
  wicketkeeperNeed: number;
  overseasNeed: number;
}

/**
 * Calculates how urgently a team needs each role based on their current squad counts.
 */
function calculateTeamNeeds(team: Team, rules: SquadRules): TeamNeedFactors {
  const { roleCounts, overseasCount } = team;
  
  // Ideal targets for balanced 20-player squad:
  // Batters: 6, Bowlers: 7, All-Rounders: 5, Wicketkeepers: 2
  const batterNeed = Math.max(0.2, (6 - roleCounts.batter) / 6);
  const bowlerNeed = Math.max(0.2, (7 - roleCounts.bowler) / 7);
  const allRounderNeed = Math.max(0.2, (5 - roleCounts.allRounder) / 5);
  // Crucial: A team MUST have at least 1-2 wicketkeepers
  const wicketkeeperNeed = roleCounts.wicketkeeper === 0 ? 2.5 : roleCounts.wicketkeeper === 1 ? 1.2 : 0.2;
  
  // Overseas need: if quota is close to max, overseas desirability drops
  const remainingOverseasSlots = Math.max(0, rules.maxOverseas - overseasCount);
  const overseasNeed = remainingOverseasSlots > 0 ? remainingOverseasSlots / rules.maxOverseas : 0;

  return {
    batterNeed,
    bowlerNeed,
    allRounderNeed,
    wicketkeeperNeed,
    overseasNeed
  };
}

/**
 * Calculates a team-specific maximum valuation for a given player.
 */
export function calculatePlayerValuation(
  team: Team,
  player: Player,
  rules: SquadRules
): number {
  const needs = calculateTeamNeeds(team, rules);
  
  // If player is overseas and team has no overseas slots left, valuation is 0
  if (player.isOverseas && team.overseasCount >= rules.maxOverseas) {
    return 0;
  }

  // 1. Base Market Worth estimation based on player rating (70 - 99)
  // Rating 95+ : 15 Cr - 25 Cr
  // Rating 90-94: 8 Cr - 16 Cr
  // Rating 85-89: 4 Cr - 9 Cr
  // Rating 80-84: 1.5 Cr - 4 Cr
  // Below 80   : 30 Lakhs - 1.5 Cr
  let baseWorth = player.basePrice;
  const r = player.rating;

  if (r >= 96) {
    baseWorth = 220000000; // 22 Cr
  } else if (r >= 93) {
    baseWorth = 160000000; // 16 Cr
  } else if (r >= 90) {
    baseWorth = 110000000; // 11 Cr
  } else if (r >= 86) {
    baseWorth = 65000000;  // 6.5 Cr
  } else if (r >= 82) {
    baseWorth = 35000000;  // 3.5 Cr
  } else if (r >= 78) {
    baseWorth = 15000000;  // 1.5 Cr
  } else {
    baseWorth = player.basePrice * 1.2;
  }

  // 2. Role Need Multiplier
  let roleMultiplier = 1.0;
  if (player.role === 'Wicketkeeper') {
    roleMultiplier = needs.wicketkeeperNeed;
  } else if (player.role === 'Batter') {
    roleMultiplier = needs.batterNeed;
  } else if (player.role === 'Bowler') {
    roleMultiplier = needs.bowlerNeed;
  } else if (player.role === 'All-Rounder') {
    roleMultiplier = needs.allRounderNeed;
  }

  // 3. Franchise Specific Philosophy Biases
  let franchiseBias = 1.0;
  switch (team.id) {
    case 'MI':
      if (player.role === 'Bowler' && player.bowlingStyle.includes('fast')) franchiseBias = 1.25;
      if (player.category === 'Marquee') franchiseBias = 1.2;
      break;
    case 'CSK':
      if (player.role === 'All-Rounder') franchiseBias = 1.3;
      if (player.bowlingStyle.includes('spin') || player.bowlingStyle.includes('orthodox')) franchiseBias = 1.2;
      break;
    case 'RCB':
      if (player.category === 'Marquee') franchiseBias = 1.35;
      if (player.role === 'Batter') franchiseBias = 1.2;
      break;
    case 'KKR':
      if (player.role === 'All-Rounder' || player.bowlingStyle.includes('mystery')) franchiseBias = 1.3;
      break;
    case 'SRH':
      if (player.isOverseas && player.category === 'Marquee') franchiseBias = 1.3;
      if (player.role === 'Batter' || player.bowlingStyle.includes('fast')) franchiseBias = 1.15;
      break;
    case 'RR':
      if (!player.isOverseas && player.rating >= 80) franchiseBias = 1.2;
      if (player.bowlingStyle.includes('legbreak')) franchiseBias = 1.25;
      break;
    case 'PBKS':
      // PBKS enters aggressive bidding if purse is large
      if (team.currentPurse > 600000000) franchiseBias = 1.25;
      break;
    case 'GT':
      if (player.role === 'All-Rounder') franchiseBias = 1.2;
      break;
    case 'DC':
      if (player.role === 'Wicketkeeper' || (player.role === 'Bowler' && !player.isOverseas)) franchiseBias = 1.2;
      break;
    case 'LSG':
      if (player.role === 'All-Rounder') franchiseBias = 1.25;
      break;
  }

  // 4. Wallet & Stage Constraint:
  // If a team has spent 70% of purse, they become much more conservative.
  const purseRemainingRatio = team.currentPurse / team.initialPurse;
  const purseFactor = Math.min(1.1, Math.max(0.4, purseRemainingRatio * 1.2));

  // Compute final valuation
  let valuation = baseWorth * roleMultiplier * franchiseBias * purseFactor;

  // Never evaluate below base price
  valuation = Math.max(player.basePrice, valuation);

  // Hard cap: Cannot evaluate higher than team's available purse minus reserve for min squad
  const slotsNeeded = Math.max(0, rules.minSquadSize - (team.squadCount + 1));
  const reserve = slotsNeeded * 3000000;
  const maxPossible = Math.max(0, team.currentPurse - reserve);

  return Math.min(valuation, maxPossible);
}

export interface AIBidDecision {
  shouldBid: boolean;
  team: Team;
  proposedBid: number;
  reason: string;
}

/**
 * Evaluates all AI teams to find the best candidate to challenge the current bid.
 * Returns the winning AI team that wants to bid, or null if no AI wants to bid higher.
 */
export function getNextAIBidder(
  aiTeams: Team[],
  player: Player,
  currentBid: number,
  highestBidderTeamId: string | null,
  userTeamId: string,
  rules: SquadRules
): AIBidDecision | null {
  const nextBid = getNextBidAmount(currentBid, player.basePrice, rules);

  // Filter eligible teams:
  // 1. Must not be the current highest bidder
  // 2. Must not be the user team
  // 3. Must pass squad and purse validation
  const eligibleTeams = aiTeams.filter(team => {
    if (team.id === highestBidderTeamId) return false;
    if (team.id === userTeamId) return false;
    const validation = validateBid(team, player, nextBid, rules);
    return validation.isValid;
  });

  if (eligibleTeams.length === 0) {
    return null;
  }

  // Evaluate each team's appetite for this player at the nextBid price
  const candidateDecisions: { team: Team; valuation: number; interestScore: number }[] = [];

  for (const team of eligibleTeams) {
    const valuation = calculatePlayerValuation(team, player, rules);

    // If valuation is greater than next bid, this team is interested!
    if (valuation >= nextBid) {
      // Calculate enthusiasm: margin between valuation and next bid
      const marginRatio = (valuation - nextBid) / valuation;
      // Add slight randomized variance (0.85 - 1.15) to simulate human auction room tension
      const variance = 0.85 + Math.random() * 0.3;
      const interestScore = marginRatio * variance;

      // Only enter if interest score crosses threshold or if opening the bid
      if (currentBid === 0 || interestScore > 0.05) {
        candidateDecisions.push({
          team,
          valuation,
          interestScore
        });
      }
    }
  }

  if (candidateDecisions.length === 0) {
    return null;
  }

  // Sort by highest interest score
  candidateDecisions.sort((a, b) => b.interestScore - a.interestScore);

  // Select the top interested team
  const chosen = candidateDecisions[0];

  return {
    shouldBid: true,
    team: chosen.team,
    proposedBid: nextBid,
    reason: `${chosen.team.shortName} bids ${nextBid} (Valuation: ${Math.round(chosen.valuation / 100000)}L)`
  };
}
