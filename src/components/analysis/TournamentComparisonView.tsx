import React, { useState } from 'react';
import type { Team, TournamentComparison } from '../../types';
import { analyzeTournament } from '../../engine/teamAnalysisEngine';
import { getTeamFallbackLogo } from '../../utils/imageUtils';
import {
  Trophy,
  Zap,
  Target,
  Shield,
  DollarSign,
  ChevronRight
} from 'lucide-react';

interface TournamentComparisonViewProps {
  teams: Team[];
  onSelectTeamToInspect?: (teamId: string) => void;
}

export const TournamentComparisonView: React.FC<TournamentComparisonViewProps> = ({
  teams,
  onSelectTeamToInspect
}) => {
  const [sortCategory, setSortCategory] = useState<'overall' | 'batting' | 'bowling' | 'balance' | 'efficiency'>('overall');
  const comparison: TournamentComparison = analyzeTournament(teams);

  // Sorting
  const sortedReports = [...comparison.teamReports].sort((a, b) => {
    if (sortCategory === 'batting') return b.batting.score - a.batting.score;
    if (sortCategory === 'bowling') return b.bowling.score - a.bowling.score;
    if (sortCategory === 'balance') return b.squadBalance.score - a.squadBalance.score;
    if (sortCategory === 'efficiency') return b.efficiency.score - a.efficiency.score;
    return b.overallScore - a.overallScore;
  });

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case 'Elite':
        return 'bg-amber-400/20 text-amber-300 border-amber-400/30';
      case 'Excellent':
        return 'bg-emerald-400/20 text-emerald-300 border-emerald-400/30';
      case 'Strong':
        return 'bg-cyan-400/20 text-cyan-300 border-cyan-400/30';
      case 'Balanced':
        return 'bg-indigo-400/20 text-indigo-300 border-indigo-400/30';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Category Champions Card Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Strongest Batting Team */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl relative overflow-hidden">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Zap className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
              STRONGEST BATTING
            </span>
          </div>

          <div className="flex items-center justify-between mt-2">
            <div>
              <h4 className="text-sm font-black text-slate-100">{comparison.strongestBattingTeam.teamName}</h4>
              <span className="text-xs text-slate-400 font-mono">{comparison.strongestBattingTeam.teamShortName}</span>
            </div>
            <span className="text-xl font-black text-amber-400 font-mono">
              {comparison.strongestBattingTeam.score}%
            </span>
          </div>
        </div>

        {/* Strongest Bowling Team */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl relative overflow-hidden">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Target className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400">
              STRONGEST BOWLING
            </span>
          </div>

          <div className="flex items-center justify-between mt-2">
            <div>
              <h4 className="text-sm font-black text-slate-100">{comparison.strongestBowlingTeam.teamName}</h4>
              <span className="text-xs text-slate-400 font-mono">{comparison.strongestBowlingTeam.teamShortName}</span>
            </div>
            <span className="text-xl font-black text-cyan-400 font-mono">
              {comparison.strongestBowlingTeam.score}%
            </span>
          </div>
        </div>

        {/* Most Balanced Team */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl relative overflow-hidden">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Shield className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
              MOST BALANCED SQUAD
            </span>
          </div>

          <div className="flex items-center justify-between mt-2">
            <div>
              <h4 className="text-sm font-black text-slate-100">{comparison.mostBalancedTeam.teamName}</h4>
              <span className="text-xs text-slate-400 font-mono">{comparison.mostBalancedTeam.teamShortName}</span>
            </div>
            <span className="text-xl font-black text-emerald-400 font-mono">
              {comparison.mostBalancedTeam.score}%
            </span>
          </div>
        </div>

        {/* Most Efficient Team */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl relative overflow-hidden">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <DollarSign className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400">
              BEST AUCTION EFFICIENCY
            </span>
          </div>

          <div className="flex items-center justify-between mt-2">
            <div>
              <h4 className="text-sm font-black text-slate-100">{comparison.mostEfficientTeam.teamName}</h4>
              <span className="text-xs text-slate-400 font-mono">{comparison.mostEfficientTeam.teamShortName}</span>
            </div>
            <span className="text-xl font-black text-indigo-400 font-mono">
              {comparison.mostEfficientTeam.score}%
            </span>
          </div>
        </div>
      </div>

      {/* Main Comparison Leaderboard Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-black uppercase tracking-wider text-slate-100 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-400" />
              <span>FRANCHISE POWER RANKINGS (STAGE 4 EVALUATION)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Comparative rating matrix across all 10 franchises evaluated on player attributes and squad data.
            </p>
          </div>

          {/* Sort Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-slate-500 text-[11px] font-bold mr-1">SORT:</span>
            <button
              onClick={() => setSortCategory('overall')}
              className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                sortCategory === 'overall' ? 'bg-cyan-500 text-slate-950 font-black' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Overall
            </button>
            <button
              onClick={() => setSortCategory('batting')}
              className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                sortCategory === 'batting' ? 'bg-amber-500 text-slate-950 font-black' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Batting
            </button>
            <button
              onClick={() => setSortCategory('bowling')}
              className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                sortCategory === 'bowling' ? 'bg-cyan-500 text-slate-950 font-black' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Bowling
            </button>
            <button
              onClick={() => setSortCategory('balance')}
              className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                sortCategory === 'balance' ? 'bg-emerald-500 text-slate-950 font-black' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Balance
            </button>
            <button
              onClick={() => setSortCategory('efficiency')}
              className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                sortCategory === 'efficiency' ? 'bg-indigo-500 text-slate-950 font-black' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Efficiency
            </button>
          </div>
        </div>

        <div className="divide-y divide-slate-800 overflow-x-auto">
          {sortedReports.map((report, idx) => (
            <div
              key={report.teamId}
              onClick={() => onSelectTeamToInspect && onSelectTeamToInspect(report.teamId)}
              className="p-4 flex items-center justify-between gap-4 hover:bg-slate-800/40 transition cursor-pointer min-w-[650px]"
            >
              {/* Rank & Team Identity */}
              <div className="flex items-center gap-3.5 w-60">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-mono font-black text-xs ${
                  idx === 0
                    ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/30'
                    : idx === 1
                    ? 'bg-slate-300 text-slate-950'
                    : idx === 2
                    ? 'bg-amber-700 text-white'
                    : 'bg-slate-800 text-slate-400'
                }`}>
                  #{idx + 1}
                </div>

                <div className="w-10 h-10 rounded-xl bg-slate-950 p-1 border border-slate-800 flex items-center justify-center flex-shrink-0">
                  <img
                    src={report.teamLogo}
                    alt={report.teamShortName}
                    onError={(e) => {
                      e.currentTarget.src = getTeamFallbackLogo(report.teamShortName, report.primaryColor, '#111');
                    }}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-slate-100 truncate">{report.teamName}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] text-slate-400 font-mono font-semibold">{report.teamShortName}</span>
                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase border ${getTierBadge(report.ratingTier)}`}>
                      {report.ratingTier}
                    </span>
                  </div>
                </div>
              </div>

              {/* Department Breakdown Mini Bars */}
              <div className="grid grid-cols-4 gap-4 flex-1 text-xs">
                {/* Batting */}
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-400">Batting</span>
                    <span className="text-amber-400 font-mono font-bold">{report.batting.score}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full bg-amber-400 rounded-full" style={{ width: `${report.batting.score}%` }} />
                  </div>
                </div>

                {/* Bowling */}
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-400">Bowling</span>
                    <span className="text-cyan-400 font-mono font-bold">{report.bowling.score}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full bg-cyan-400 rounded-full" style={{ width: `${report.bowling.score}%` }} />
                  </div>
                </div>

                {/* Balance */}
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-400">Balance</span>
                    <span className="text-emerald-400 font-mono font-bold">{report.squadBalance.score}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${report.squadBalance.score}%` }} />
                  </div>
                </div>

                {/* Efficiency */}
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-400">Efficiency</span>
                    <span className="text-indigo-400 font-mono font-bold">{report.efficiency.score}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${report.efficiency.score}%` }} />
                  </div>
                </div>
              </div>

              {/* Overall Score & Action */}
              <div className="flex items-center gap-4 pl-4 border-l border-slate-800 flex-shrink-0">
                <div className="text-right">
                  <span className="text-lg font-black text-gold-gradient font-mono block leading-none">
                    {report.overallScore}%
                  </span>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                    Overall
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
