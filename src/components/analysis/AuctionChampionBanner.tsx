import React from 'react';
import { Trophy, Award, ShieldCheck, ShoppingBag, Sparkles, ChevronRight } from 'lucide-react';
import type { TournamentComparison } from '../../types';
import { formatCurrency } from '../../utils/currencyUtils';
import { getTeamFallbackLogo } from '../../utils/imageUtils';

interface AuctionChampionBannerProps {
  comparison: TournamentComparison;
  onSelectTeamToInspect?: (teamId: string) => void;
}

export const AuctionChampionBanner: React.FC<AuctionChampionBannerProps> = ({
  comparison,
  onSelectTeamToInspect
}) => {
  const championReport =
    comparison.teamReports.find(r => r.teamId === comparison.championTeamId) ||
    comparison.teamReports[0];

  if (!championReport) return null;

  return (
    <div className="space-y-6">
      {/* BEST TEAM OF THE AUCTION HERO CARD */}
      <div
        className="bg-slate-900/95 border-2 rounded-2xl p-6 md:p-8 shadow-2xl relative overflow-hidden"
        style={{ borderColor: championReport.primaryColor }}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-5">
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-slate-950 p-2.5 border border-slate-800 flex items-center justify-center flex-shrink-0 shadow-inner">
              <img
                src={championReport.teamLogo}
                alt={championReport.teamName}
                onError={(e) => {
                  e.currentTarget.src = getTeamFallbackLogo(
                    championReport.teamShortName,
                    championReport.primaryColor,
                    '#1e293b'
                  );
                }}
                className="max-h-full max-w-full object-contain"
              />
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-300 text-xs font-black uppercase tracking-widest">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                <span>BEST TEAM OF THE AUCTION • RANK #1</span>
              </div>

              <div className="flex flex-wrap items-baseline gap-3">
                <h2 className="text-2xl md:text-4xl font-black text-slate-100">
                  {championReport.teamName}
                </h2>
                {championReport.ownerName && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-bold">
                    Manager: {championReport.ownerName}
                  </span>
                )}
              </div>

              <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
                {comparison.championReason || championReport.aiNarrative}
              </p>
            </div>
          </div>

          {/* Overall Rating Badge */}
          <div className="flex flex-col items-start lg:items-end justify-center bg-slate-950/90 border border-slate-800 rounded-2xl px-6 py-4 flex-shrink-0">
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">
              OVERALL AI RATING
            </span>
            <div className="text-4xl md:text-5xl font-black font-mono text-amber-400 mt-1">
              {championReport.overallScore}
              <span className="text-lg text-slate-500 font-sans">/100</span>
            </div>
            <span className="text-xs font-bold text-emerald-400 mt-1 uppercase tracking-wider">
              {championReport.ratingTier} Tier • {championReport.squadSize} Players
            </span>
          </div>
        </div>

        {/* Key Highlights Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-800/90">
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
            <div className="text-[10px] font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Strongest Area</span>
            </div>
            <div className="text-sm font-bold text-slate-100 mt-1">
              {championReport.strongestArea}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              XI Score: {championReport.playingXIScore}/100
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
            <div className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Best Retained Player</span>
            </div>
            <div className="text-sm font-bold text-slate-100 mt-1 truncate">
              {championReport.bestRetainedPlayer ? championReport.bestRetainedPlayer.name : 'None Retained'}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
              {championReport.bestRetainedPlayer
                ? `Rating ${championReport.bestRetainedPlayer.rating} • ${formatCurrency(championReport.bestRetainedPlayer.retentionCost || championReport.bestRetainedPlayer.soldPrice || 0)}`
                : 'Full purse auction'}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
            <div className="text-[10px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Best Auction Purchase</span>
            </div>
            <div className="text-sm font-bold text-slate-100 mt-1 truncate">
              {championReport.bestAuctionPurchase ? championReport.bestAuctionPurchase.name : 'N/A'}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
              {championReport.bestAuctionPurchase
                ? `Rating ${championReport.bestAuctionPurchase.rating} • ${formatCurrency(championReport.bestAuctionPurchase.soldPrice || championReport.bestAuctionPurchase.basePrice)}`
                : 'No auction buys'}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
            <div className="text-[10px] font-black uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5" />
              <span>Biggest Bargain</span>
            </div>
            <div className="text-sm font-bold text-slate-100 mt-1 truncate">
              {championReport.biggestBargain ? championReport.biggestBargain.name : 'N/A'}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
              {championReport.biggestBargain
                ? `Rating ${championReport.biggestBargain.rating} • ${formatCurrency(championReport.biggestBargain.soldPrice || championReport.biggestBargain.basePrice)}`
                : 'Balanced spend'}
            </div>
          </div>
        </div>
      </div>

      {/* COMPLETE TEAM RANKING LEADERBOARD TABLE */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-black uppercase tracking-wider text-slate-100">
              COMPLETE FRANCHISE RANKINGS
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Click any franchise row to inspect its complete squad, retained core, AI evaluation, and Playing XI.
            </p>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Evaluated across {comparison.rankings.length} Franchises
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-400 font-black">
                <th className="py-3 px-4">Rank</th>
                <th className="py-3 px-4">Franchise</th>
                <th className="py-3 px-3 text-right">Overall</th>
                <th className="py-3 px-3 text-right">Bat</th>
                <th className="py-3 px-3 text-right">Bowl</th>
                <th className="py-3 px-3 text-right">AR</th>
                <th className="py-3 px-3 text-right">Balance</th>
                <th className="py-3 px-3 text-right">XI</th>
                <th className="py-3 px-3 text-right">Eff.</th>
                <th className="py-3 px-4 text-right">Spent</th>
                <th className="py-3 px-4 text-right">Purse Left</th>
                <th className="py-3 px-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-xs">
              {comparison.rankings.map((entry) => (
                <tr
                  key={entry.teamId}
                  onClick={() => onSelectTeamToInspect && onSelectTeamToInspect(entry.teamId)}
                  className={`hover:bg-slate-800/50 transition cursor-pointer ${
                    entry.rank === 1 ? 'bg-amber-500/5' : ''
                  }`}
                >
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center justify-center w-7 h-7 rounded-lg font-mono font-black text-xs ${
                        entry.rank === 1
                          ? 'bg-amber-400 text-slate-950'
                          : entry.rank === 2
                          ? 'bg-slate-300 text-slate-950'
                          : entry.rank === 3
                          ? 'bg-amber-700 text-white'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      #{entry.rank}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={entry.logo}
                        alt={entry.teamShortName}
                        onError={(e) => {
                          e.currentTarget.src = getTeamFallbackLogo(entry.teamShortName, entry.primaryColor, '#1e293b');
                        }}
                        className="w-7 h-7 object-contain flex-shrink-0"
                      />
                      <div>
                        <div className="font-bold text-slate-100">{entry.teamName}</div>
                        <div className="text-[10px] text-slate-400">
                          {entry.squadSize} Players ({entry.retainedCount} Retained)
                          {entry.ownerName ? ` • ${entry.ownerName}` : ''}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-black text-amber-400 text-sm">
                    {entry.overallScore}/100
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-slate-200">{entry.battingScore}</td>
                  <td className="py-3 px-3 text-right font-mono text-slate-200">{entry.bowlingScore}</td>
                  <td className="py-3 px-3 text-right font-mono text-slate-200">{entry.allRounderScore}</td>
                  <td className="py-3 px-3 text-right font-mono text-slate-200">{entry.squadBalanceScore}</td>
                  <td className="py-3 px-3 text-right font-mono text-slate-200">{entry.playingXIScore}</td>
                  <td className="py-3 px-3 text-right font-mono text-slate-200">{entry.efficiencyScore}</td>
                  <td className="py-3 px-4 text-right font-mono text-slate-300">{formatCurrency(entry.totalSpent)}</td>
                  <td className="py-3 px-4 text-right font-mono text-emerald-400 font-bold">
                    {formatCurrency(entry.remainingPurse)}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <ChevronRight className="w-4 h-4 text-slate-500 inline" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
