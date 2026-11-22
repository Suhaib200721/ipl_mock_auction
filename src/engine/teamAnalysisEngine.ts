import type {
  Player,
  Team,
  TeamTier,
  PlayingXISlot,
  BattingAnalysis,
  BowlingAnalysis,
  SquadBalanceAnalysis,
  AuctionEfficiencyAnalysis,
  TeamAnalysisReport,
  TournamentComparison
} from '../types';

/**
 * Clamp a number between min and max
 */
function clamp(val: number, min: number = 0, max: number = 100): number {
  return Math.max(min, Math.min(max, Math.round(val)));
}

/**
 * Assign qualitative rating tier based on numerical score (0-100)
 */
export function getRatingTier(score: number): TeamTier {
  if (score >= 90) return 'Elite';
  if (score >= 80) return 'Excellent';
  if (score >= 70) return 'Strong';
  if (score >= 60) return 'Balanced';
  if (score >= 50) return 'Average';
  return 'Weak';
}

/**
 * 1. BATTING ANALYSIS
 */
export function analyzeBatting(players: Player[]): BattingAnalysis {
  if (!players || players.length === 0) {
    return {
      score: 0,
      topOrderQuality: 0,
      middleOrderStability: 0,
      finishingAbility: 0,
      battingDepth: 0,
      summary: 'No batters signed in the squad.'
    };
  }

  // Sort batters/wicketkeepers/all-rounders by rating
  const battingTalent = players
    .filter(p => p.role === 'Batter' || p.role === 'Wicketkeeper' || p.role === 'All-Rounder')
    .sort((a, b) => (b.rating || 75) - (a.rating || 75));

  // Top-order quality (top 3 bats)
  const top3 = battingTalent.slice(0, 3);
  const topOrderAvg = top3.length > 0 ? top3.reduce((s, p) => s + (p.rating || 75), 0) / top3.length : 50;
  const topOrderQuality = clamp(((topOrderAvg - 65) / 35) * 100);

  // Middle-order stability (next 3 bats)
  const middle3 = battingTalent.slice(3, 6);
  const middleAvg = middle3.length > 0 ? middle3.reduce((s, p) => s + (p.rating || 75), 0) / middle3.length : (topOrderAvg * 0.7);
  const middleOrderStability = clamp(((middleAvg - 65) / 35) * 100);

  // Finishing ability (look for high-rated all-rounders or aggressive finishers)
  const allRounders = players.filter(p => p.role === 'All-Rounder');
  const finisherPool = [...allRounders, ...battingTalent.slice(4)];
  const finisherTop = finisherPool.sort((a, b) => (b.rating || 75) - (a.rating || 75)).slice(0, 2);
  const finisherAvg = finisherTop.length > 0 ? finisherTop.reduce((s, p) => s + (p.rating || 75), 0) / finisherTop.length : 50;
  const finishingBonus = allRounders.length >= 2 ? 10 : allRounders.length === 1 ? 5 : 0;
  const finishingAbility = clamp(((finisherAvg - 65) / 35) * 90 + finishingBonus);

  // Batting depth (how many competent bats down to pos 8)
  const batsDownTo8 = battingTalent.slice(0, 8);
  const depthAvg = batsDownTo8.length > 0 ? batsDownTo8.reduce((s, p) => s + (p.rating || 75), 0) / batsDownTo8.length : 40;
  const depthPenalty = batsDownTo8.length < 7 ? (7 - batsDownTo8.length) * 12 : 0;
  const battingDepth = clamp(((depthAvg - 65) / 35) * 100 - depthPenalty);

  // Overall Batting Score
  const score = clamp(
    topOrderQuality * 0.35 +
    middleOrderStability * 0.30 +
    finishingAbility * 0.20 +
    battingDepth * 0.15
  );

  let summary = '';
  if (score >= 85) summary = 'Explosive and deep batting lineup capable of chasing down 200+ totals effortlessly.';
  else if (score >= 75) summary = 'Solid batting core with dependable top-order anchors and capable middle-order.';
  else if (score >= 60) summary = 'Balanced batting lineup, but lacks proven boundary-hitting finishers in the death overs.';
  else summary = 'Vulnerable batting unit with thin depth; heavily dependent on 1-2 key individuals.';

  return {
    score,
    topOrderQuality,
    middleOrderStability,
    finishingAbility,
    battingDepth,
    summary
  };
}

/**
 * 2. BOWLING ANALYSIS
 */
export function analyzeBowling(players: Player[]): BowlingAnalysis {
  if (!players || players.length === 0) {
    return {
      score: 0,
      paceBowling: 0,
      spinBowling: 0,
      deathOvers: 0,
      powerplay: 0,
      bowlingDepth: 0,
      paceBowlersCount: 0,
      spinBowlersCount: 0,
      summary: 'No bowlers signed in the squad.'
    };
  }

  const bowlersAndAR = players.filter(p => p.role === 'Bowler' || p.role === 'All-Rounder');

  // Classify pace vs spin based on bowlingStyle
  const paceBowlers = bowlersAndAR.filter(p => {
    const s = (p.bowlingStyle || '').toLowerCase();
    return s.includes('fast') || s.includes('medium') || s.includes('seam') || s.includes('pace');
  });

  const spinBowlers = bowlersAndAR.filter(p => {
    const s = (p.bowlingStyle || '').toLowerCase();
    return s.includes('spin') || s.includes('break') || s.includes('orthodox') || s.includes('googly') || s.includes('slow');
  });

  // Pace Bowling Score
  const topPace = [...paceBowlers].sort((a, b) => (b.rating || 75) - (a.rating || 75)).slice(0, 3);
  const paceAvg = topPace.length > 0 ? topPace.reduce((s, p) => s + (p.rating || 75), 0) / topPace.length : 50;
  const paceCountBonus = paceBowlers.length >= 3 ? 10 : paceBowlers.length === 2 ? 5 : -15;
  const paceBowling = clamp(((paceAvg - 65) / 35) * 90 + paceCountBonus);

  // Spin Bowling Score
  const topSpin = [...spinBowlers].sort((a, b) => (b.rating || 75) - (a.rating || 75)).slice(0, 2);
  const spinAvg = topSpin.length > 0 ? topSpin.reduce((s, p) => s + (p.rating || 75), 0) / topSpin.length : 50;
  const spinCountBonus = spinBowlers.length >= 2 ? 10 : spinBowlers.length === 1 ? 5 : -15;
  const spinBowling = clamp(((spinAvg - 65) / 35) * 90 + spinCountBonus);

  // Death Overs Bowler Rating (High-rated specialist bowlers)
  const deathSpecialists = bowlersAndAR.filter(p => (p.rating || 75) >= 85);
  const deathAvg = deathSpecialists.length > 0 ? deathSpecialists.reduce((s, p) => s + (p.rating || 75), 0) / deathSpecialists.length : 60;
  const deathOvers = clamp(((deathAvg - 68) / 32) * 100);

  // Powerplay Bowling (Frontline new-ball operators)
  const ppBowlers = bowlersAndAR.sort((a, b) => (b.rating || 75) - (a.rating || 75)).slice(0, 3);
  const ppAvg = ppBowlers.length > 0 ? ppBowlers.reduce((s, p) => s + (p.rating || 75), 0) / ppBowlers.length : 55;
  const powerplay = clamp(((ppAvg - 65) / 35) * 100);

  // Bowling Depth (requires minimum 5 viable options in T20)
  const bowlingOptionsCount = bowlersAndAR.length;
  const bowlingDepth = clamp(
    bowlingOptionsCount >= 7 ? 95 :
    bowlingOptionsCount === 6 ? 85 :
    bowlingOptionsCount === 5 ? 70 :
    bowlingOptionsCount === 4 ? 50 : 25
  );

  // Overall Bowling Score
  const score = clamp(
    paceBowling * 0.28 +
    spinBowling * 0.22 +
    deathOvers * 0.25 +
    powerplay * 0.15 +
    bowlingDepth * 0.10
  );

  let summary = '';
  if (score >= 85) summary = 'World-class bowling attack featuring lethal death options and versatile spin strangulation.';
  else if (score >= 75) summary = 'Potent bowling unit equipped to defend par scores with sharp new-ball specialists.';
  else if (score >= 60) summary = 'Decent bowling lineup, but lacks a proven premier death-overs lockdown specialist.';
  else summary = 'Thin bowling battery; high risk of leaking heavy runs in powerplay and death overs.';

  return {
    score,
    paceBowling,
    spinBowling,
    deathOvers,
    powerplay,
    bowlingDepth,
    paceBowlersCount: paceBowlers.length,
    spinBowlersCount: spinBowlers.length,
    summary
  };
}

/**
 * 3. SQUAD BALANCE ANALYSIS
 */
export function analyzeSquadBalance(players: Player[]): SquadBalanceAnalysis {
  if (!players || players.length === 0) {
    return {
      score: 0,
      roleDistributionScore: 0,
      overseasBalanceScore: 0,
      squadDepthScore: 0,
      missingRoles: ['Batters', 'Bowlers', 'Wicketkeepers', 'All-Rounders'],
      insufficientRoles: ['Full squad missing'],
      summary: 'Empty squad — no players acquired.'
    };
  }

  const roleCounts = {
    batter: players.filter(p => p.role === 'Batter').length,
    bowler: players.filter(p => p.role === 'Bowler').length,
    allRounder: players.filter(p => p.role === 'All-Rounder').length,
    wicketkeeper: players.filter(p => p.role === 'Wicketkeeper').length
  };

  const overseasCount = players.filter(p => p.isOverseas).length;
  const missingRoles: string[] = [];
  const insufficientRoles: string[] = [];

  // Check roles
  if (roleCounts.wicketkeeper === 0) missingRoles.push('Specialist Wicketkeeper');
  else if (roleCounts.wicketkeeper < 2) insufficientRoles.push('Backup Wicketkeeper');

  if (roleCounts.bowler < 4) insufficientRoles.push('Frontline Bowlers (Minimum 4 needed)');
  if (roleCounts.batter < 3) insufficientRoles.push('Specialist Batters (Minimum 3 needed)');
  if (roleCounts.allRounder < 2) insufficientRoles.push('All-Rounders for Balance (Minimum 2 needed)');

  if (overseasCount < 4) insufficientRoles.push(`Overseas Core (${overseasCount}/4 filled for Playing XI)`);
  if (overseasCount > 8) missingRoles.push('Overseas Limit Exceeded (>8 in squad)');

  // Role distribution score
  let rolePoints = 100;
  if (roleCounts.wicketkeeper === 0) rolePoints -= 35;
  if (roleCounts.wicketkeeper === 1) rolePoints -= 5;
  if (roleCounts.bowler < 4) rolePoints -= (4 - roleCounts.bowler) * 10;
  if (roleCounts.batter < 3) rolePoints -= (3 - roleCounts.batter) * 10;
  if (roleCounts.allRounder === 0) rolePoints -= 20;
  const roleDistributionScore = clamp(rolePoints);

  // Overseas balance score (ideal 4 to 8)
  const overseasBalanceScore = clamp(
    overseasCount >= 4 && overseasCount <= 8 ? 95 :
    overseasCount === 3 ? 75 :
    overseasCount === 2 ? 55 :
    overseasCount === 1 ? 35 :
    overseasCount === 0 ? 20 : 40
  );

  // Squad depth score (ideal 18-25, minimum 11)
  const count = players.length;
  const squadDepthScore = clamp(
    count >= 18 && count <= 25 ? 95 :
    count >= 15 ? 80 :
    count >= 11 ? 65 :
    count >= 8 ? 40 : 20
  );

  const score = clamp(
    roleDistributionScore * 0.45 +
    overseasBalanceScore * 0.30 +
    squadDepthScore * 0.25
  );

  let summary = '';
  if (score >= 85) summary = 'Impeccable squad construction with seamless role coverage and excellent backups.';
  else if (score >= 70) summary = 'Well-rounded composition with minor depth gaps in secondary specialty roles.';
  else if (score >= 50) summary = 'Noticeable structural vulnerabilities in role balance or backup contingencies.';
  else summary = 'Severe tactical imbalances; missing key positional requirements like wicketkeeping or all-rounders.';

  return {
    score,
    roleDistributionScore,
    overseasBalanceScore,
    squadDepthScore,
    missingRoles,
    insufficientRoles,
    summary
  };
}

/**
 * 4. AUCTION EFFICIENCY ANALYSIS
 */
export function analyzeAuctionEfficiency(team: Team): AuctionEfficiencyAnalysis {
  const players = team.purchasedPlayers || [];
  const initialPurse = team.initialPurse || 1200000000;
  const totalSpent = initialPurse - team.currentPurse;
  const remainingPurse = team.currentPurse;
  const budgetUtilizationPct = clamp((totalSpent / initialPurse) * 100);

  if (players.length === 0) {
    return {
      score: 50,
      totalSpent: 0,
      remainingPurse: initialPurse,
      budgetUtilizationPct: 0,
      mostValuableBuy: null,
      mostExpensiveBuy: null,
      topBargains: [],
      summary: 'No auction transactions recorded.'
    };
  }

  // Identify most expensive purchase
  const sortedByPrice = [...players].sort((a, b) => (b.soldPrice || 0) - (a.soldPrice || 0));
  const mostExpensiveBuy = sortedByPrice[0] || null;

  // Value calculation: Player rating relative to price in Cr
  // Baseline: 80 rating expected at ~₹4-6 Cr, 90 rating expected at ~₹10-14 Cr, 95+ expected at ~₹18-24 Cr
  const bargains = players
    .filter(p => {
      const priceCr = (p.soldPrice || p.basePrice || 10000000) / 10000000;
      const rating = p.rating || 75;
      return (rating >= 88 && priceCr <= 8) || (rating >= 84 && priceCr <= 4) || (rating >= 92 && priceCr <= 14);
    })
    .sort((a, b) => {
      const valA = (a.rating || 75) / Math.max(1, (a.soldPrice || a.basePrice) / 10000000);
      const valB = (b.rating || 75) / Math.max(1, (b.soldPrice || b.basePrice) / 10000000);
      return valB - valA;
    });

  const mostValuableBuy = bargains[0] || sortedByPrice[sortedByPrice.length - 1] || null;
  const topBargains = bargains.slice(0, 3);

  // Spending pacing score: Optimal spending is between 85% and 98% of purse for 15+ players
  let budgetScore = 80;
  if (budgetUtilizationPct >= 85 && budgetUtilizationPct <= 98) budgetScore = 95;
  else if (budgetUtilizationPct > 98) budgetScore = 75; // Left no buffer
  else if (budgetUtilizationPct < 60) budgetScore = 50; // Underspent drastically

  // Squad size efficiency penalty if bought < 11 players
  if (players.length < 11) {
    budgetScore = Math.max(20, budgetScore - (11 - players.length) * 8);
  }

  // Value quotient: Average rating gained per Crore spent
  const totalRating = players.reduce((acc, p) => acc + (p.rating || 75), 0);
  const spentInCr = Math.max(1, totalSpent / 10000000);
  const ratingPerCr = totalRating / spentInCr;
  const valueRatioScore = clamp((ratingPerCr / 1.6) * 100);

  const score = clamp(valueRatioScore * 0.50 + budgetScore * 0.35 + (topBargains.length * 5));

  let summary = '';
  if (score >= 85) summary = `Masterful auction management; maximized player quality while maintaining smart purse reserves.`;
  else if (score >= 70) summary = `Sensible auction strategy with balanced spending, securing marquee targets without overpaying.`;
  else if (score >= 55) summary = `Aggressive bidding on premium assets resulted in slightly inflated prices for secondary roles.`;
  else summary = `Suboptimal capital allocation; either overpaid severely or failed to exhaust purse on top-tier talent.`;

  return {
    score,
    totalSpent,
    remainingPurse,
    budgetUtilizationPct,
    mostValuableBuy,
    mostExpensiveBuy,
    topBargains,
    summary
  };
}

/**
 * 5. BEST PLAYING XI RECOMMENDATION (Rule-compliant IPL XI)
 * Hard Rules: Max 4 Overseas, Min 1 Wicketkeeper, Min 5 Bowling options
 */
export function recommendPlayingXI(players: Player[]): {
  playingXI: PlayingXISlot[];
  captain: Player | null;
  viceCaptain: Player | null;
  suggestedBattingOrder: { position: number; playerName: string; role: string; rating: number; isOverseas: boolean }[];
  suggestedBowlingCombination: { phase: 'Powerplay' | 'Middle Overs' | 'Death Overs'; bowlers: string[] }[];
} {
  if (!players || players.length === 0) {
    return {
      playingXI: [],
      captain: null,
      viceCaptain: null,
      suggestedBattingOrder: [],
      suggestedBowlingCombination: []
    };
  }

  // Filter candidates
  const wicketkeepers = players.filter(p => p.role === 'Wicketkeeper');
  const batters = players.filter(p => p.role === 'Batter');
  const allRounders = players.filter(p => p.role === 'All-Rounder');
  const bowlers = players.filter(p => p.role === 'Bowler');

  const selectedPlayers: Player[] = [];
  let overseasCount = 0;

  const tryAdd = (p: Player): boolean => {
    if (selectedPlayers.some(sel => sel.id === p.id)) return false;
    if (selectedPlayers.length >= 11) return false;
    if (p.isOverseas && overseasCount >= 4) return false;

    selectedPlayers.push(p);
    if (p.isOverseas) overseasCount++;
    return true;
  };

  // Step 1: Ensure best Wicketkeeper is picked
  const sortedWKs = [...wicketkeepers].sort((a, b) => (b.rating || 75) - (a.rating || 75));
  if (sortedWKs.length > 0) {
    // Prefer Indian WK if overseas slots are tight
    const bestIndianWK = sortedWKs.find(w => !w.isOverseas);
    if (bestIndianWK && (bestIndianWK.rating || 75) >= 80) {
      tryAdd(bestIndianWK);
    } else {
      tryAdd(sortedWKs[0]);
    }
  }

  // Step 2: Pick top 3 frontline Bowlers
  const sortedBowlers = [...bowlers].sort((a, b) => (b.rating || 75) - (a.rating || 75));
  for (const b of sortedBowlers) {
    if (selectedPlayers.filter(p => p.role === 'Bowler').length >= 3) break;
    tryAdd(b);
  }

  // Step 3: Pick top 2 All-Rounders
  const sortedARs = [...allRounders].sort((a, b) => (b.rating || 75) - (a.rating || 75));
  for (const ar of sortedARs) {
    if (selectedPlayers.filter(p => p.role === 'All-Rounder').length >= 2) break;
    tryAdd(ar);
  }

  // Step 4: Pick top 3 Specialist Batters
  const sortedBatters = [...batters].sort((a, b) => (b.rating || 75) - (a.rating || 75));
  for (const bat of sortedBatters) {
    if (selectedPlayers.filter(p => p.role === 'Batter').length >= 3) break;
    tryAdd(bat);
  }

  // Step 5: Fill remaining spots up to 11 with highest rating available respecting overseas cap
  const remainingCandidates = [...players]
    .filter(p => !selectedPlayers.some(sel => sel.id === p.id))
    .sort((a, b) => (b.rating || 75) - (a.rating || 75));

  for (const cand of remainingCandidates) {
    if (selectedPlayers.length >= 11) break;
    tryAdd(cand);
  }

  // If still under 11, relax overseas constraint if squad is tiny
  if (selectedPlayers.length < 11 && selectedPlayers.length < players.length) {
    for (const cand of players) {
      if (selectedPlayers.length >= 11) break;
      if (!selectedPlayers.some(sel => sel.id === cand.id)) {
        selectedPlayers.push(cand);
      }
    }
  }

  // Identify Captain & Vice-Captain
  const sortedByLeadership = [...selectedPlayers].sort((a, b) => {
    // Prefer Indian marquee icons with high ratings
    const scoreA = (a.rating || 75) + (a.category === 'Marquee' ? 5 : 0) + (!a.isOverseas ? 3 : 0);
    const scoreB = (b.rating || 75) + (b.category === 'Marquee' ? 5 : 0) + (!b.isOverseas ? 3 : 0);
    return scoreB - scoreA;
  });

  const captain = sortedByLeadership[0] || null;
  const viceCaptain = sortedByLeadership.find(p => p.id !== captain?.id) || null;

  // Structure optimal batting order (1 to 11)
  // Pos 1-2: Openers / Top Batters
  // Pos 3: Number 3 Anchor
  // Pos 4-5: Middle order & WK
  // Pos 6-7: Finishing All-Rounders
  // Pos 8-11: Bowlers
  const xiBatters = selectedPlayers
    .filter(p => p.role === 'Batter' || p.role === 'Wicketkeeper')
    .sort((a, b) => (b.rating || 75) - (a.rating || 75));

  const xiAllRounders = selectedPlayers
    .filter(p => p.role === 'All-Rounder')
    .sort((a, b) => (b.rating || 75) - (a.rating || 75));

  const xiBowlers = selectedPlayers
    .filter(p => p.role === 'Bowler')
    .sort((a, b) => (b.rating || 75) - (a.rating || 75));

  // Synthesize Batting Lineup
  const orderedXI: Player[] = [];
  const addPlayerToOrder = (p?: Player) => {
    if (p && !orderedXI.some(x => x.id === p.id)) {
      orderedXI.push(p);
    }
  };

  // Top 3
  addPlayerToOrder(xiBatters[0]);
  addPlayerToOrder(xiBatters[1]);
  addPlayerToOrder(xiBatters[2]);

  // Middle 4-5
  addPlayerToOrder(xiBatters[3]);
  addPlayerToOrder(xiAllRounders[0]);
  addPlayerToOrder(xiBatters[4]);

  // Finishers 6-7
  addPlayerToOrder(xiAllRounders[1]);
  addPlayerToOrder(xiAllRounders[2]);

  // Bowlers 8-11
  for (const b of xiBowlers) {
    addPlayerToOrder(b);
  }

  // Any remaining slots filled
  for (const p of selectedPlayers) {
    addPlayerToOrder(p);
  }

  // Map to PlayingXISlot
  const playingXI: PlayingXISlot[] = orderedXI.slice(0, 11).map((p, idx) => {
    const pos = idx + 1;
    let roleInXI = 'Middle Order';
    if (pos <= 2) roleInXI = 'Opener';
    else if (pos === 3) roleInXI = 'Anchor (No. 3)';
    else if (p.role === 'Wicketkeeper') roleInXI = 'Wicketkeeper / Bat';
    else if (p.role === 'All-Rounder' && pos >= 6) roleInXI = 'Finisher / All-Rounder';
    else if (p.role === 'All-Rounder') roleInXI = 'Batting All-Rounder';
    else if (p.role === 'Bowler') {
      const style = (p.bowlingStyle || '').toLowerCase();
      if (style.includes('fast') || style.includes('medium')) roleInXI = 'Pace Bowler';
      else roleInXI = 'Spin Bowler';
    }

    return {
      position: pos,
      player: p,
      roleInXI,
      isCaptain: p.id === captain?.id,
      isViceCaptain: p.id === viceCaptain?.id
    };
  });

  const suggestedBattingOrder = playingXI.map(slot => ({
    position: slot.position,
    playerName: slot.player.name,
    role: slot.roleInXI,
    rating: slot.player.rating || 75,
    isOverseas: slot.player.isOverseas
  }));

  // Suggested Bowling Combinations
  const allBowlingOptions = playingXI.filter(s => s.player.role === 'Bowler' || s.player.role === 'All-Rounder');
  const pacers = allBowlingOptions.filter(s => {
    const sty = (s.player.bowlingStyle || '').toLowerCase();
    return sty.includes('fast') || sty.includes('medium') || sty.includes('pace');
  });
  const spinners = allBowlingOptions.filter(s => {
    const sty = (s.player.bowlingStyle || '').toLowerCase();
    return sty.includes('spin') || sty.includes('break') || sty.includes('orthodox');
  });

  const ppBowlersList = pacers.slice(0, 2).concat(spinners.slice(0, 1)).map(s => s.player.name);
  const midBowlersList = spinners.slice(0, 2).concat(pacers.slice(1, 3)).map(s => s.player.name);
  const deathBowlersList = pacers.slice(0, 2).map(s => s.player.name);

  const suggestedBowlingCombination: { phase: 'Powerplay' | 'Middle Overs' | 'Death Overs'; bowlers: string[] }[] = [
    { phase: 'Powerplay', bowlers: ppBowlersList.length > 0 ? ppBowlersList : ['Frontline Pacers'] },
    { phase: 'Middle Overs', bowlers: midBowlersList.length > 0 ? midBowlersList : ['Spinners & All-Rounders'] },
    { phase: 'Death Overs', bowlers: deathBowlersList.length > 0 ? deathBowlersList : ['Death Over Specialists'] }
  ];

  return {
    playingXI,
    captain,
    viceCaptain,
    suggestedBattingOrder,
    suggestedBowlingCombination
  };
}

/**
 * 6. GENERATE QUALITATIVE REPORT (Strengths, Weaknesses, Key Players)
 */
export function generateQualitativeReport(
  team: Team,
  batting: BattingAnalysis,
  bowling: BowlingAnalysis,
  balance: SquadBalanceAnalysis,
  efficiency: AuctionEfficiencyAnalysis,
  _playingXI: PlayingXISlot[]
): {
  strengths: string[];
  weaknesses: string[];
  improvementAreas: string[];
  keyPlayers: Player[];
} {
  const players = team.purchasedPlayers || [];
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const improvementAreas: string[] = [];

  // Identify Strengths
  if (batting.topOrderQuality >= 82) {
    strengths.push('Elite Top-Order: World-class opening pair capable of capitalizing on powerplay fielding restrictions.');
  }
  if (batting.finishingAbility >= 80) {
    strengths.push('High-Impact Finishers: Power-hitters in the lower-middle order to maximize death-over scoring rates.');
  }
  if (bowling.paceBowling >= 80) {
    strengths.push('Formidable Pace Attack: Express seam bowling depth with high wicket-taking probability.');
  }
  if (bowling.spinBowling >= 80) {
    strengths.push('Spin Chokehold: Quality spinners capable of controlling run-rates during the middle overs.');
  }
  if (bowling.deathOvers >= 82) {
    strengths.push('Death Lockdown: High-caliber death specialists with deadly yorkers and slower ball variations.');
  }
  if (efficiency.budgetUtilizationPct >= 80 && efficiency.score >= 80) {
    strengths.push('Astute Auction Economics: Efficient budget deployment securing maximum quality per Crore spent.');
  }
  if (strengths.length === 0) {
    strengths.push('Balanced foundation with room for tactical growth and role definition.');
  }

  // Identify Weaknesses
  if (batting.battingDepth < 65) {
    weaknesses.push('Long Tail: Batting depth drops off sharply after position 6, risking collapses.');
  }
  if (bowling.deathOvers < 70) {
    weaknesses.push('Death Bowling Uncertainty: Lacks an established, proven death-overs execution specialist.');
  }
  if (bowling.spinBowlersCount < 2) {
    weaknesses.push('Spin Scarcity: Insufficient slow-bowling variety for spin-friendly subcontinent pitches.');
  }
  if (balance.missingRoles.length > 0) {
    weaknesses.push(`Missing Critical Roles: ${balance.missingRoles.join(', ')}.`);
  }
  if (weaknesses.length === 0) {
    weaknesses.push('Slight dependency on overseas core remaining uninjured throughout the 14-game league stage.');
  }

  // Improvement Areas
  if (balance.insufficientRoles.length > 0) {
    improvementAreas.push(`Address bench backups: ${balance.insufficientRoles.join(', ')}.`);
  }
  if (bowling.bowlingDepth < 70) {
    improvementAreas.push('Develop 6th and 7th bowling options among top-order batters to give captain tactical flexibility.');
  }
  if (batting.finishingAbility < 75) {
    improvementAreas.push('Promote flexible all-rounders as pinch-hitters during high required run-rate phases.');
  }
  if (improvementAreas.length === 0) {
    improvementAreas.push('Maintain player workload management and rotate overseas pacers between away fixtures.');
  }

  // Key Players (Top 3 highest rated in squad)
  const keyPlayers = [...players].sort((a, b) => (b.rating || 75) - (a.rating || 75)).slice(0, 3);

  return {
    strengths: strengths.slice(0, 4),
    weaknesses: weaknesses.slice(0, 3),
    improvementAreas: improvementAreas.slice(0, 3),
    keyPlayers
  };
}

/**
 * 7. COMPLETE TEAM ANALYSIS GENERATOR
 */
export function analyzeTeam(team: Team): TeamAnalysisReport {
  const players = team.purchasedPlayers || [];
  const squadSize = players.length;

  const batting = analyzeBatting(players);
  const bowling = analyzeBowling(players);
  const squadBalance = analyzeSquadBalance(players);
  const efficiency = analyzeAuctionEfficiency(team);

  // Overall Score Calculation (Scale: 0 - 100)
  const overallScore = clamp(
    batting.score * 0.32 +
    bowling.score * 0.32 +
    squadBalance.score * 0.20 +
    efficiency.score * 0.16
  );

  const ratingTier = getRatingTier(overallScore);

  const {
    playingXI,
    captain,
    viceCaptain,
    suggestedBattingOrder,
    suggestedBowlingCombination
  } = recommendPlayingXI(players);

  const {
    strengths,
    weaknesses,
    improvementAreas,
    keyPlayers
  } = generateQualitativeReport(team, batting, bowling, squadBalance, efficiency, playingXI);

  return {
    teamId: team.id,
    teamName: team.name,
    teamShortName: team.shortName,
    teamLogo: team.logo,
    primaryColor: team.primaryColor,
    ownerName: team.ownerName,
    squadSize,
    overallScore,
    ratingTier,
    batting,
    bowling,
    squadBalance,
    efficiency,
    strengths,
    weaknesses,
    improvementAreas,
    keyPlayers,
    playingXI,
    captain,
    viceCaptain,
    suggestedBattingOrder,
    suggestedBowlingCombination
  };
}

/**
 * 8. TOURNAMENT-WIDE COMPARISON & RANKINGS
 */
export function analyzeTournament(teams: Team[]): TournamentComparison {
  const teamReports = teams.map(t => analyzeTeam(t));

  // Sort overall rankings descending
  const sortedReports = [...teamReports].sort((a, b) => b.overallScore - a.overallScore);
  const rankings = sortedReports.map((report, idx) => ({
    rank: idx + 1,
    teamId: report.teamId,
    teamShortName: report.teamShortName,
    teamName: report.teamName,
    overallScore: report.overallScore,
    tier: report.ratingTier,
    logo: report.teamLogo,
    primaryColor: report.primaryColor
  }));

  // Best in specific categories
  const strongestBattingReport = [...teamReports].sort((a, b) => b.batting.score - a.batting.score)[0] || teamReports[0];
  const strongestBowlingReport = [...teamReports].sort((a, b) => b.bowling.score - a.bowling.score)[0] || teamReports[0];
  const mostBalancedReport = [...teamReports].sort((a, b) => b.squadBalance.score - a.squadBalance.score)[0] || teamReports[0];
  const mostEfficientReport = [...teamReports].sort((a, b) => b.efficiency.score - a.efficiency.score)[0] || teamReports[0];

  return {
    teamReports,
    rankings,
    strongestBattingTeam: {
      teamId: strongestBattingReport?.teamId || 'MI',
      teamShortName: strongestBattingReport?.teamShortName || 'MI',
      teamName: strongestBattingReport?.teamName || 'Mumbai Indians',
      score: strongestBattingReport?.batting.score || 0
    },
    strongestBowlingTeam: {
      teamId: strongestBowlingReport?.teamId || 'CSK',
      teamShortName: strongestBowlingReport?.teamShortName || 'CSK',
      teamName: strongestBowlingReport?.teamName || 'Chennai Super Kings',
      score: strongestBowlingReport?.bowling.score || 0
    },
    mostBalancedTeam: {
      teamId: mostBalancedReport?.teamId || 'RCB',
      teamShortName: mostBalancedReport?.teamShortName || 'RCB',
      teamName: mostBalancedReport?.teamName || 'Royal Challengers Bengaluru',
      score: mostBalancedReport?.squadBalance.score || 0
    },
    mostEfficientTeam: {
      teamId: mostEfficientReport?.teamId || 'KKR',
      teamShortName: mostEfficientReport?.teamShortName || 'KKR',
      teamName: mostEfficientReport?.teamName || 'Kolkata Knight Riders',
      score: mostEfficientReport?.efficiency.score || 0
    }
  };
}
