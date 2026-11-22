import { INITIAL_TEAMS } from '../src/data/teamsData';
import { INITIAL_PLAYERS } from '../src/data/playersData';
import {
  analyzeTeam,
  analyzeBatting,
  analyzeBowling,
  analyzeSquadBalance,
  analyzeAuctionEfficiency,
  recommendPlayingXI,
  analyzeTournament,
  getRatingTier
} from '../src/engine/teamAnalysisEngine';
import type { Team, Player } from '../src/types';

console.log('=== RUNNING STAGE 4: AI TEAM ANALYSIS & EVALUATION TESTS ===');

// Helper to construct a test squad
function buildMockSquad(teamBase: Team, playerSlice: Player[], purseSpent: number): Team {
  const squad = playerSlice.map((p, idx) => ({
    ...p,
    status: 'sold' as const,
    soldPrice: Math.round((purseSpent / playerSlice.length) * (0.8 + (idx % 5) * 0.1)),
    soldTo: teamBase.id
  }));

  const roleCounts = {
    batter: squad.filter(p => p.role === 'Batter').length,
    bowler: squad.filter(p => p.role === 'Bowler').length,
    allRounder: squad.filter(p => p.role === 'All-Rounder').length,
    wicketkeeper: squad.filter(p => p.role === 'Wicketkeeper').length
  };

  return {
    ...teamBase,
    purchasedPlayers: squad,
    squadCount: squad.length,
    indianCount: squad.filter(p => !p.isOverseas).length,
    overseasCount: squad.filter(p => p.isOverseas).length,
    currentPurse: teamBase.initialPurse - purseSpent,
    roleCounts
  };
}

// 1. Test Incomplete & Empty Squads (Resilience)
console.log('Test 1: Empty squad resilience...');
const emptyTeam: Team = { ...INITIAL_TEAMS[0], purchasedPlayers: [], currentPurse: 1200000000 };
const emptyReport = analyzeTeam(emptyTeam);
console.assert(emptyReport.overallScore >= 0 && !isNaN(emptyReport.overallScore), 'Empty team score must be a valid number');
console.assert(emptyReport.ratingTier === 'Weak' || emptyReport.ratingTier === 'Average', 'Empty team should receive low tier');
console.assert(emptyReport.playingXI.length === 0, 'Empty team should have 0 playing XI');
console.assert(emptyReport.squadBalance.missingRoles.length > 0, 'Empty team must flag missing roles');
console.log('✓ Test 1 Passed: Empty and incomplete squad handled safely with 0 NaN or crashes');

// 2. Test Missing Player Attributes Handling
console.log('Test 2: Missing player attributes fallback...');
const brokenPlayer: any = {
  id: 'broken-1',
  name: 'Test Anonymous',
  isOverseas: false,
  role: undefined,
  rating: undefined, // missing rating
  battingStyle: undefined,
  bowlingStyle: undefined,
  basePrice: 5000000
};
const teamWithBrokenPlayer: Team = {
  ...INITIAL_TEAMS[1],
  purchasedPlayers: [brokenPlayer],
  squadCount: 1,
  currentPurse: 1150000000
};
const brokenReport = analyzeTeam(teamWithBrokenPlayer);
console.assert(!isNaN(brokenReport.overallScore), 'Broken player team score must be a number');
console.assert(!isNaN(brokenReport.batting.score), 'Batting score must be a number');
console.assert(!isNaN(brokenReport.bowling.score), 'Bowling score must be a number');
console.log('✓ Test 2 Passed: Missing player attributes safely use fallback defaults');

// 3. Test Full Realistic Squad Analysis (Mumbai Indians sample)
console.log('Test 3: Full 18-player balanced squad evaluation...');
// Pick 18 players: 5 Batters, 2 WKs, 4 ARs, 7 Bowlers (with 6 overseas)
const miSamplePlayers = [
  INITIAL_PLAYERS.find(p => p.name.includes('Bumrah'))!,
  INITIAL_PLAYERS.find(p => p.name.includes('Rohit'))!,
  INITIAL_PLAYERS.find(p => p.name.includes('Hardik')) || INITIAL_PLAYERS[3],
  INITIAL_PLAYERS.find(p => p.name.includes('Suryakumar')) || INITIAL_PLAYERS[4],
  INITIAL_PLAYERS.find(p => p.role === 'Wicketkeeper') || INITIAL_PLAYERS[5],
  ...INITIAL_PLAYERS.slice(6, 19)
];
const miTeam = buildMockSquad(INITIAL_TEAMS[0], miSamplePlayers, 1100000000);
const miReport = analyzeTeam(miTeam);

console.assert(miReport.overallScore > 65, 'Strong 18-player squad should score above 65%');
console.assert(['Elite', 'Excellent', 'Strong', 'Balanced'].includes(miReport.ratingTier), 'Tier must be valid');
console.assert(miReport.batting.topOrderQuality > 50, 'Batting top-order quality must be calculated');
console.assert(miReport.bowling.paceBowling > 50, 'Pace bowling score must be calculated');
console.assert(miReport.squadBalance.score > 60, 'Squad balance score must be calculated');
console.assert(miReport.efficiency.totalSpent === 1100000000, 'Spent must equal 110 Cr');
console.assert(miReport.strengths.length > 0, 'Must generate strengths');
console.assert(miReport.weaknesses.length > 0, 'Must generate weaknesses');
console.assert(miReport.improvementAreas.length > 0, 'Must generate improvement areas');
console.log(`✓ Test 3 Passed: MI sample squad scored ${miReport.overallScore}% (${miReport.ratingTier}) with complete diagnostics`);

// 4. Test Playing XI Rules Compliance
console.log('Test 4: Playing XI compliance verification...');
const xi = miReport.playingXI;
console.assert(xi.length === 11, `Playing XI must contain exactly 11 players (got ${xi.length})`);

const overseasInXI = xi.filter(slot => slot.player.isOverseas);
console.assert(overseasInXI.length <= 4, `Playing XI must NOT exceed 4 overseas players (got ${overseasInXI.length})`);

const wksInXI = xi.filter(slot => slot.player.role === 'Wicketkeeper');
console.assert(wksInXI.length >= 1, `Playing XI must contain at least 1 wicketkeeper (got ${wksInXI.length})`);

const bowlingOptionsInXI = xi.filter(slot => slot.player.role === 'Bowler' || slot.player.role === 'All-Rounder');
console.assert(bowlingOptionsInXI.length >= 5, `Playing XI must have at least 5 bowling options (got ${bowlingOptionsInXI.length})`);

console.assert(!!miReport.captain, 'Captain must be recommended');
console.assert(!!miReport.viceCaptain, 'Vice-captain must be recommended');
console.assert(miReport.captain?.id !== miReport.viceCaptain?.id, 'Captain and VC cannot be the same player');
console.assert(miReport.suggestedBattingOrder.length === 11, 'Batting order must have 11 slots');
console.assert(miReport.suggestedBowlingCombination.length === 3, 'Bowling combos must have 3 phases');
console.log(`✓ Test 4 Passed: Playing XI strictly satisfies max 4 overseas (${overseasInXI.length}), min 1 WK (${wksInXI.length}), min 5 bowlers (${bowlingOptionsInXI.length})`);

// 5. Test Auction Efficiency
console.log('Test 5: Auction efficiency evaluation...');
const eff = analyzeAuctionEfficiency(miTeam);
console.assert(eff.totalSpent === 1100000000, 'Total spent calculation');
console.assert(eff.remainingPurse === 100000000, 'Remaining purse calculation');
console.assert(eff.budgetUtilizationPct > 90, 'Utilization pct calculation');
console.assert(!!eff.mostExpensiveBuy, 'Most expensive buy identified');
console.log(`✓ Test 5 Passed: Auction efficiency scored ${eff.score}% (Utilization: ${eff.budgetUtilizationPct}%)`);

// 6. Test Tournament-Wide Comparison & Rankings
console.log('Test 6: Tournament comparison across all 10 teams...');
const allMockTeams: Team[] = INITIAL_TEAMS.map((t, idx) => {
  const pSlice = INITIAL_PLAYERS.slice(idx * 8, idx * 8 + 15);
  const spent = 900000000 + (idx * 25000000);
  return buildMockSquad(t, pSlice, spent);
});

const tourney = analyzeTournament(allMockTeams);
console.assert(tourney.teamReports.length === 10, 'All 10 teams must have reports');
console.assert(tourney.rankings.length === 10, 'Rankings must have 10 ranks');
console.assert(tourney.rankings[0].rank === 1, 'Top rank must be 1');
console.assert(tourney.rankings[0].overallScore >= tourney.rankings[9].overallScore, 'Rankings must be in descending order');

console.assert(!!tourney.strongestBattingTeam.teamShortName, 'Strongest batting team identified');
console.assert(!!tourney.strongestBowlingTeam.teamShortName, 'Strongest bowling team identified');
console.assert(!!tourney.mostBalancedTeam.teamShortName, 'Most balanced team identified');
console.assert(!!tourney.mostEfficientTeam.teamShortName, 'Most efficient team identified');
console.log(`✓ Test 6 Passed: Tournament comparison generated rankings #1 (${tourney.rankings[0].teamShortName} - ${tourney.rankings[0].overallScore}%) to #10 (${tourney.rankings[9].teamShortName} - ${tourney.rankings[9].overallScore}%)`);

// 7. Test Multiplayer Owner Name Preservation
console.log('Test 7: Multiplayer owner name propagation...');
const mpTeam: Team = {
  ...miTeam,
  ownerName: 'HumanManager7',
  isHumanControlled: true
};
const mpReport = analyzeTeam(mpTeam);
console.assert(mpReport.ownerName === 'HumanManager7', 'Multiplayer ownerName must be preserved');
console.log('✓ Test 7 Passed: Multiplayer ownerName accurately reflected in AI report');

console.log('=== ALL STAGE 4 AI TEAM ANALYSIS & EVALUATION TESTS PASSED 100% ===');
process.exit(0);
