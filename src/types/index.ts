export type PlayerRole = 'Batter' | 'Bowler' | 'All-Rounder' | 'Wicketkeeper';

export type PlayerCategory = 'Marquee' | 'Batter' | 'All-Rounder' | 'Bowler' | 'Wicketkeeper';

export type AuctionStatus = 'upcoming' | 'bidding' | 'sold' | 'unsold' | 'retained';

export interface Player {
  id: string;
  name: string;
  photoUrl: string;
  nationality: string;
  isOverseas: boolean;
  role: PlayerRole;
  battingStyle: string;
  bowlingStyle: string;
  basePrice: number; // in Rupees (e.g. 20000000 for 2 Cr)
  category: PlayerCategory;
  previousTeam?: string;
  previousPrice?: string;
  rating: number; // 70 - 99
  status: AuctionStatus;
  soldPrice?: number;
  soldTo?: string; // Team ID
  isRetained?: boolean;
  retentionCost?: number;
  retainedBy?: string;
}

export interface Team {
  id: string;
  name: string;
  shortName: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logo: string;
  initialPurse: number;
  currentPurse: number;
  purchasedPlayers: Player[]; // Complete squad (retained + auction-purchased)
  retainedPlayers?: Player[];
  retentionSpent?: number;
  auctionSpent?: number;
  retentionConfirmed?: boolean;
  squadCount: number;
  indianCount: number;
  overseasCount: number;
  roleCounts: {
    batter: number;
    bowler: number;
    allRounder: number;
    wicketkeeper: number;
  };
  strategyBio: string;
  ownerName?: string; // Human player name in multiplayer
  isHumanControlled?: boolean;
}

export interface BidRecord {
  id: string;
  playerId: string;
  teamId: string;
  teamName: string;
  teamShortName: string;
  amount: number;
  timestamp: number;
  bidderType: 'user' | 'ai' | 'multiplayer';
  bidderName?: string;
}

export interface SquadRules {
  minSquadSize: number;
  maxSquadSize: number;
  maxOverseas: number;
  initialPurse: number;
  minBidIncrementBelow1Cr: number;
  minBidIncrement1To2Cr: number;
  minBidIncrement2To5Cr: number;
  minBidIncrementAbove5Cr: number;
}

export type AuctioneerCall = 'idle' | 'calling' | 'going_once' | 'going_twice' | 'fair_warning' | 'sold' | 'unsold';

export type AuctionScreen = 'selection' | 'retention' | 'confirmation' | 'auction' | 'results';

export type AppMode = 'singleplayer' | 'multiplayer' | null;

// ==========================================
// PLAYER RETENTION TYPES
// ==========================================

export interface RetentionRules {
  enabled: boolean;
  maxRetentions: number; // default 5
  maxOverseasRetentions: number; // default 2
  slotCosts: number[]; // Cost per retention slot in Rupees, e.g., [18Cr, 14Cr, 11Cr, 18Cr, 14Cr]
}

export interface TeamRetentionSubmission {
  teamId: string;
  playerIds: string[];
  totalCost: number;
  confirmed: boolean;
  confirmedAt?: number;
  submittedByPlayerId?: string;
}

// ==========================================
// STAGE 2: REAL-TIME MULTIPLAYER TYPES
// ==========================================

export type RoomStatus = 'waiting' | 'ready' | 'retention' | 'auction' | 'completed';

export interface MultiplayerPlayer {
  id: string;
  socketId: string;
  name: string;
  teamId: string | null;
  isHost: boolean;
  isReady: boolean;
  isConnected: boolean;
}

export interface MultiplayerRoomSettings {
  minPlayersToStart: number;
  timerSeconds: number; // default 15
  startingPurse: number; // default 120 Cr
  maxSquadSize: number; // 25
  maxOverseas: number; // 8
}

export interface MultiplayerResolvedLot {
  type: 'sold' | 'unsold';
  player: Player;
  winningTeam?: Team;
  winningPlayerName?: string;
  price?: number;
}

export interface MultiplayerRoomState {
  roomId: string;
  roomCode: string;
  hostId: string;
  status: RoomStatus;
  players: MultiplayerPlayer[];
  settings: MultiplayerRoomSettings;
  teams: Team[];
  playerPool: Player[];
  currentPlayerIndex: number;
  currentBid: number;
  highestBidderId: string | null; // Player ID
  highestBidderTeamId: string | null; // Team ID
  highestBidderName: string | null;
  bidHistory: BidRecord[];
  countdown: number;
  isPaused: boolean;
  auctioneerCall: string;
  lastResolvedLot?: MultiplayerResolvedLot | null;
  retentionRules?: RetentionRules;
  retentions?: Record<string, TeamRetentionSubmission>;
  finalizedAt?: number;
  finalResults?: TournamentComparison;
}

// ==========================================
// STAGE 4: AI TEAM ANALYSIS & EVALUATION TYPES
// ==========================================

export type TeamTier = 'Elite' | 'Excellent' | 'Strong' | 'Balanced' | 'Average' | 'Weak';

export interface PlayingXISlot {
  position: number;
  player: Player;
  roleInXI: string;
  isCaptain?: boolean;
  isViceCaptain?: boolean;
}

export interface BattingAnalysis {
  score: number;
  topOrderQuality: number;
  middleOrderStability: number;
  finishingAbility: number;
  battingDepth: number;
  summary: string;
}

export interface BowlingAnalysis {
  score: number;
  paceBowling: number;
  spinBowling: number;
  deathOvers: number;
  powerplay: number;
  bowlingDepth: number;
  paceBowlersCount: number;
  spinBowlersCount: number;
  summary: string;
}

export interface SquadBalanceAnalysis {
  score: number;
  roleDistributionScore: number;
  overseasBalanceScore: number;
  squadDepthScore: number;
  missingRoles: string[];
  insufficientRoles: string[];
  summary: string;
}

export interface AuctionEfficiencyAnalysis {
  score: number;
  totalSpent: number;
  remainingPurse: number;
  budgetUtilizationPct: number;
  mostValuableBuy: Player | null;
  mostExpensiveBuy: Player | null;
  topBargains: Player[];
  summary: string;
}

export interface TeamAnalysisReport {
  teamId: string;
  teamName: string;
  teamShortName: string;
  teamLogo: string;
  primaryColor: string;
  ownerName?: string;
  squadSize: number;
  retainedCount: number;
  auctionPurchasedCount: number;
  indianCount: number;
  overseasCount: number;
  overallScore: number;
  ratingTier: TeamTier;
  batting: BattingAnalysis;
  bowling: BowlingAnalysis;
  allRounderScore: number;
  wicketkeepingScore: number;
  squadBalance: SquadBalanceAnalysis;
  benchStrengthScore: number;
  playingXIScore: number;
  efficiency: AuctionEfficiencyAnalysis;
  retentionSpent: number;
  auctionSpent: number;
  bestRetainedPlayer: Player | null;
  bestAuctionPurchase: Player | null;
  biggestBargain: Player | null;
  strongestArea: string;
  weakestArea: string;
  aiNarrative: string;
  strengths: string[];
  weaknesses: string[];
  improvementAreas: string[];
  keyPlayers: Player[];
  playingXI: PlayingXISlot[];
  impactPlayer: Player | null;
  captain: Player | null;
  viceCaptain: Player | null;
  suggestedBattingOrder: { position: number; playerName: string; role: string; rating: number; isOverseas: boolean }[];
  suggestedBowlingCombination: { phase: 'Powerplay' | 'Middle Overs' | 'Death Overs'; bowlers: string[] }[];
}

export interface TournamentRankingEntry {
  rank: number;
  teamId: string;
  teamShortName: string;
  teamName: string;
  ownerName?: string;
  overallScore: number;
  battingScore: number;
  bowlingScore: number;
  allRounderScore: number;
  squadBalanceScore: number;
  playingXIScore: number;
  efficiencyScore: number;
  totalSpent: number;
  remainingPurse: number;
  squadSize: number;
  retainedCount: number;
  tier: TeamTier;
  logo: string;
  primaryColor: string;
}

export interface TournamentComparison {
  teamReports: TeamAnalysisReport[];
  rankings: TournamentRankingEntry[];
  championTeamId: string;
  championReason: string;
  strongestBattingTeam: { teamId: string; teamShortName: string; teamName: string; score: number };
  strongestBowlingTeam: { teamId: string; teamShortName: string; teamName: string; score: number };
  mostBalancedTeam: { teamId: string; teamShortName: string; teamName: string; score: number };
  mostEfficientTeam: { teamId: string; teamShortName: string; teamName: string; score: number };
}
