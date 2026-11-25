import type { Player, RetentionRules, Team } from '../types';
import { formatCurrency } from '../utils/currencyUtils';

export const DEFAULT_RETENTION_RULES: RetentionRules = {
  enabled: true,
  maxRetentions: 5,
  maxOverseasRetentions: 2,
  // Realistic IPL-style retention slabs: ₹18 Cr, ₹14 Cr, ₹11 Cr, ₹18 Cr, ₹14 Cr (max ₹75 Cr for 5 retentions)
  slotCosts: [180000000, 140000000, 110000000, 180000000, 140000000]
};

export interface RetentionCostItem {
  player: Player;
  slotIndex: number;
  cost: number;
}

export interface RetentionValidationResult {
  isValid: boolean;
  reason?: string;
  totalCost: number;
  items: RetentionCostItem[];
}

/**
 * Returns all players from the pool whose previousTeam matches teamId, sorted by rating descending.
 */
export function getEligibleRetentionPlayers(teamId: string, allPlayers: Player[]): Player[] {
  const normalizedTeamId = (teamId || '').trim().toUpperCase();
  return allPlayers
    .filter(p => (p.previousTeam || '').trim().toUpperCase() === normalizedTeamId)
    .sort((a, b) => (b.rating || 75) - (a.rating || 75));
}

/**
 * Calculates retention slot costs deterministically.
 * Highest-rated retained players occupy the highest retention slabs first to prevent slab-order gaming.
 */
export function calculateRetentionBreakdown(
  selectedPlayers: Player[],
  rules: RetentionRules = DEFAULT_RETENTION_RULES
): { totalCost: number; items: RetentionCostItem[] } {
  const sorted = [...selectedPlayers].sort((a, b) => (b.rating || 75) - (a.rating || 75));
  const fallbackCost = rules.slotCosts[rules.slotCosts.length - 1] ?? 40000000;

  const items: RetentionCostItem[] = sorted.map((player, idx) => {
    const cost = rules.slotCosts[idx] ?? fallbackCost;
    return {
      player,
      slotIndex: idx + 1,
      cost
    };
  });

  const totalCost = items.reduce((sum, item) => sum + item.cost, 0);
  return { totalCost, items };
}

/**
 * Validates a team's retention selection against configured rules, purse, and ownership.
 */
export function validateRetentionSelection(
  team: Team,
  selectedPlayerIds: string[],
  allPlayers: Player[],
  rules: RetentionRules = DEFAULT_RETENTION_RULES
): RetentionValidationResult {
  if (!rules.enabled) {
    return { isValid: false, reason: 'Player retention is disabled for this session.', totalCost: 0, items: [] };
  }

  if (team.retentionConfirmed) {
    return {
      isValid: false,
      reason: `${team.shortName} has already confirmed retentions. Duplicate retention submissions are not permitted.`,
      totalCost: team.retentionSpent || 0,
      items: []
    };
  }

  const uniqueIds = Array.from(new Set(selectedPlayerIds));
  if (uniqueIds.length !== selectedPlayerIds.length) {
    return { isValid: false, reason: 'Duplicate players cannot be retained.', totalCost: 0, items: [] };
  }

  if (uniqueIds.length > rules.maxRetentions) {
    return {
      isValid: false,
      reason: `Cannot retain more than ${rules.maxRetentions} players.`,
      totalCost: 0,
      items: []
    };
  }

  const playerMap = new Map(allPlayers.map(p => [p.id, p]));
  const selectedPlayers: Player[] = [];

  for (const id of uniqueIds) {
    const player = playerMap.get(id);
    if (!player) {
      return { isValid: false, reason: `Player "${id}" not found in player database.`, totalCost: 0, items: [] };
    }
    if ((player.previousTeam || '').trim().toUpperCase() !== team.id.toUpperCase()) {
      return {
        isValid: false,
        reason: `${player.name} does not belong to ${team.shortName}'s pre-auction roster.`,
        totalCost: 0,
        items: []
      };
    }
    if (player.isRetained && player.retainedBy && player.retainedBy !== team.id) {
      return {
        isValid: false,
        reason: `${player.name} is already retained by ${player.retainedBy}.`,
        totalCost: 0,
        items: []
      };
    }
    selectedPlayers.push(player);
  }

  const overseasCount = selectedPlayers.filter(p => p.isOverseas).length;
  if (overseasCount > rules.maxOverseasRetentions) {
    return {
      isValid: false,
      reason: `Cannot retain more than ${rules.maxOverseasRetentions} overseas players (selected ${overseasCount}).`,
      totalCost: 0,
      items: []
    };
  }

  const { totalCost, items } = calculateRetentionBreakdown(selectedPlayers, rules);

  if (totalCost > team.currentPurse) {
    return {
      isValid: false,
      reason: `Retention cost (${formatCurrency(totalCost)}) exceeds available purse (${formatCurrency(team.currentPurse)}).`,
      totalCost,
      items
    };
  }

  // Ensure enough purse remains to meet minimum 18-player squad at ₹30L base reserve if needed
  const minReserve = Math.max(0, 18 - selectedPlayers.length) * 3000000;
  if (team.currentPurse - totalCost < minReserve) {
    return {
      isValid: false,
      reason: `Must retain at least ${formatCurrency(minReserve)} in purse to complete minimum 18-player squad.`,
      totalCost,
      items
    };
  }

  return { isValid: true, totalCost, items };
}

/**
 * Applies validated retention selections to a Team and returns the updated Team and updated PlayerPool.
 * Prevents duplicate deduction if retentionConfirmed is already true.
 */
export function applyTeamRetention(
  team: Team,
  items: RetentionCostItem[],
  allPlayers: Player[]
): { updatedTeam: Team; updatedPlayerPool: Player[] } {
  if (team.retentionConfirmed) {
    throw new Error(`Retention already confirmed for ${team.shortName}.`);
  }

  const totalCost = items.reduce((sum, item) => sum + item.cost, 0);
  const retainedMap = new Map(items.map(item => [item.player.id, item.cost]));

  const retainedPlayerObjects: Player[] = items.map(item => ({
    ...item.player,
    status: 'retained',
    isRetained: true,
    retentionCost: item.cost,
    retainedBy: team.id,
    soldTo: team.id,
    soldPrice: item.cost
  }));

  const updatedPlayerPool = allPlayers.map(p => {
    const cost = retainedMap.get(p.id);
    if (cost !== undefined) {
      return {
        ...p,
        status: 'retained' as const,
        isRetained: true,
        retentionCost: cost,
        retainedBy: team.id,
        soldTo: team.id,
        soldPrice: cost
      };
    }
    return p;
  });

  const indianRetained = retainedPlayerObjects.filter(p => !p.isOverseas).length;
  const overseasRetained = retainedPlayerObjects.filter(p => p.isOverseas).length;

  const roleCounts = { ...team.roleCounts };
  for (const p of retainedPlayerObjects) {
    if (p.role === 'Batter') roleCounts.batter += 1;
    else if (p.role === 'Bowler') roleCounts.bowler += 1;
    else if (p.role === 'All-Rounder') roleCounts.allRounder += 1;
    else if (p.role === 'Wicketkeeper') roleCounts.wicketkeeper += 1;
  }

  const updatedTeam: Team = {
    ...team,
    currentPurse: Math.max(0, team.currentPurse - totalCost),
    purchasedPlayers: [...team.purchasedPlayers, ...retainedPlayerObjects],
    retainedPlayers: retainedPlayerObjects,
    retentionSpent: totalCost,
    retentionConfirmed: true,
    squadCount: team.squadCount + retainedPlayerObjects.length,
    indianCount: team.indianCount + indianRetained,
    overseasCount: team.overseasCount + overseasRetained,
    roleCounts
  };

  return { updatedTeam, updatedPlayerPool };
}
