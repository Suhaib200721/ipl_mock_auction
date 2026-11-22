import type { Player, SquadRules, Team } from '../types';
import { DEFAULT_RULES, formatCurrency } from '../utils/currencyUtils';

export interface BidValidationResult {
  isValid: boolean;
  reason?: string;
}

/**
 * Validates whether a team is eligible to place a specific bid on a player.
 */
export function validateBid(
  team: Team,
  player: Player,
  bidAmount: number,
  rules: SquadRules = DEFAULT_RULES
): BidValidationResult {
  // 1. Check basic purse affordability
  if (team.currentPurse < bidAmount) {
    return {
      isValid: false,
      reason: `Insufficient purse. Required: ${formatCurrency(bidAmount)}, Available: ${formatCurrency(team.currentPurse)}.`
    };
  }

  // 2. Check maximum squad capacity
  if (team.squadCount >= rules.maxSquadSize) {
    return {
      isValid: false,
      reason: `Maximum squad size of ${rules.maxSquadSize} players reached.`
    };
  }

  // 3. Check overseas quota
  if (player.isOverseas && team.overseasCount >= rules.maxOverseas) {
    return {
      isValid: false,
      reason: `Maximum overseas player quota (${rules.maxOverseas}/${rules.maxOverseas}) reached.`
    };
  }

  // 4. Reserve budget rule for minimum squad requirement
  // Team must reach at least minSquadSize (default 18).
  // If team currently has squadCount, after this purchase they have squadCount + 1.
  // Remaining players needed = Math.max(0, rules.minSquadSize - (team.squadCount + 1)).
  // Minimum cost per slot is ₹30 Lakhs (3,000,000).
  const slotsNeeded = Math.max(0, rules.minSquadSize - (team.squadCount + 1));
  const minCostPerSlot = 3000000; // 30 Lakhs
  const requiredReserve = slotsNeeded * minCostPerSlot;
  const purseAfterBid = team.currentPurse - bidAmount;

  if (purseAfterBid < requiredReserve) {
    return {
      isValid: false,
      reason: `Budget reserve rule: Must keep ${formatCurrency(requiredReserve)} to complete minimum ${rules.minSquadSize} squad members.`
    };
  }

  return { isValid: true };
}

/**
 * Updates a team state after purchasing a player
 */
export function updateTeamPurchasedPlayer(
  team: Team,
  player: Player,
  finalPrice: number
): Team {
  const isOverseas = player.isOverseas;
  const roleKey = player.role === 'Batter'
    ? 'batter'
    : player.role === 'Bowler'
    ? 'bowler'
    : player.role === 'All-Rounder'
    ? 'allRounder'
    : 'wicketkeeper';

  return {
    ...team,
    currentPurse: Math.max(0, team.currentPurse - finalPrice),
    squadCount: team.squadCount + 1,
    indianCount: isOverseas ? team.indianCount : team.indianCount + 1,
    overseasCount: isOverseas ? team.overseasCount + 1 : team.overseasCount,
    roleCounts: {
      ...team.roleCounts,
      [roleKey]: team.roleCounts[roleKey] + 1
    },
    purchasedPlayers: [
      ...team.purchasedPlayers,
      {
        ...player,
        status: 'sold',
        soldPrice: finalPrice,
        soldTo: team.id
      }
    ]
  };
}
