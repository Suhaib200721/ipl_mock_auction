import React, { useState } from 'react';
import type { Team, TeamAnalysisReport } from '../../types';
import { formatCurrency } from '../../utils/currencyUtils';
import { getPlayerFallbackSilhouette, getTeamFallbackLogo } from '../../utils/imageUtils';
import {
  Trophy,
  Shield,
  Zap,
  Target,
  DollarSign,
  Crown,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Users,
  Plane,
  Sparkles,
  Award
} from 'lucide-react';
import { analyzeTeam } from '../../engine/teamAnalysisEngine';

interface TeamAnalysisDashboardProps {
  teams: Team[];
  initialTeamId?: string;
}

export const TeamAnalysisDashboard: React.FC<TeamAnalysisDashboardProps> = ({
  teams,
  initialTeamId
}) => {
  const [selectedTeamId, setSelectedTeamId] = useState<string>(initialTeamId || teams[0]?.id || 'MI');
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'playingXI' | 'breakdowns' | 'report'>('overview');

  const selectedTeam = teams.find(t => t.id === selectedTeamId) || teams[0];
  const report: TeamAnalysisReport = analyzeTeam(selectedTeam);

  // Helper for tier color badges
  const getTierBadgeClass = (tier: string) => {
    switch (tier) {
      case 'Elite':
        return 'bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 font-black shadow-lg shadow-amber-500/25 border-amber-300';
      case 'Excellent':
        return 'bg-gradient-to-r from-emerald-400 to-teal-500 text-slate-950 font-black shadow-lg shadow-emerald-500/25 border-emerald-300';
      case 'Strong':
        return 'bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 font-black shadow-lg shadow-cyan-500/25 border-cyan-300';
      case 'Balanced':
        return 'bg-gradient-to-r from-indigo-400 to-purple-500 text-slate-950 font-black shadow-lg shadow-indigo-500/25 border-indigo-300';
      case 'Average':
        return 'bg-gradient-to-r from-amber-600 to-orange-600 text-slate-100 font-bold border-amber-500';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  // Helper for score bar colors
  const getScoreBarColor = (score: number) => {
    if (score >= 85) return 'from-emerald-500 to-teal-400';
    if (score >= 70) return 'from-cyan-500 to-blue-400';
    if (score >= 55) return 'from-amber-500 to-yellow-400';
    return 'from-rose-500 to-red-400';
  };

  return (
    <div className="space-y-6">
      {/* Franchise Selector Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span>Select Franchise for Deep AI Analysis</span>
          </span>
          <span className="text-slate-500 font-mono text-[11px]">IPL 2027 Evaluation Engine</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 md:grid-cols-10 gap-2">
          {teams.map(t => {
            const isSelected = t.id === selectedTeam.id;
            return (
              <button
                key={t.id}
                onClick={() => setSelectedTeamId(t.id)}
                className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-slate-800 border-cyan-400 shadow-md shadow-cyan-500/20 scale-[1.03]'
                    : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-900 hover:border-slate-700 opacity-80'
                }`}
                style={{
                  borderTopColor: isSelected ? t.primaryColor : undefined,
                  borderTopWidth: isSelected ? '3px' : undefined
                }}
              >
                <div className="w-8 h-8 rounded-lg bg-slate-900 p-0.5 flex items-center justify-center">
                  <img
                    src={t.logo}
                    alt={t.shortName}
                    onError={(e) => {
                      e.currentTarget.src = getTeamFallbackLogo(t.shortName, t.primaryColor, t.secondaryColor);
                    }}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <span className={`text-[11px] font-black tracking-wider ${isSelected ? 'text-slate-100' : 'text-slate-400'}`}>
                  {t.shortName}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Team Hero Banner */}
      <div
        className="bg-slate-900/95 border-2 rounded-2xl p-6 md:p-8 shadow-2xl relative overflow-hidden transition-all"
        style={{ borderColor: selectedTeam.primaryColor }}
      >
        {/* Ambient Glow */}
        <div
          className="absolute -top-12 -right-12 w-64 h-64 rounded-full blur-3xl opacity-20 pointer-events-none"
          style={{ backgroundColor: selectedTeam.primaryColor }}
        />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-slate-950 p-2 border border-slate-800 flex items-center justify-center flex-shrink-0 shadow-inner">
              <img
                src={selectedTeam.logo}
                alt={selectedTeam.name}
                onError={(e) => {
                  e.currentTarget.src = getTeamFallbackLogo(selectedTeam.shortName, selectedTeam.primaryColor, selectedTeam.secondaryColor);
                }}
                className="max-h-full max-w-full object-contain"
              />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="text-xs font-black uppercase tracking-widest text-slate-400">
                  {selectedTeam.shortName} FRANCHISE REPORT
                </span>
                {selectedTeam.ownerName && (
                  <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-bold border border-cyan-500/30">
                    Manager: {selectedTeam.ownerName}
                  </span>
                )}
              </div>

              <h2 className="text-2xl md:text-4xl font-black text-slate-100 tracking-tight">
                {selectedTeam.name}
              </h2>

              <p className="text-slate-400 text-xs md:text-sm mt-1 max-w-xl">
                {selectedTeam.strategyBio}
              </p>

              <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-slate-300">
                <span>Squad: <strong className="text-white">{report.squadSize}</strong> players</span>
                <span>•</span>
                <span>Spent: <strong className="text-white">{formatCurrency(report.efficiency.totalSpent)}</strong></span>
                <span>•</span>
                <span>Remaining: <strong className="text-emerald-400">{formatCurrency(report.efficiency.remainingPurse)}</strong></span>
              </div>
            </div>
          </div>

          {/* Overall Performance Score Badge */}
          <div className="flex flex-col items-center justify-center bg-slate-950/80 border border-slate-800 rounded-2xl p-5 md:px-8 shadow-xl flex-shrink-0 text-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
              OVERALL PERFORMANCE
            </span>

            <div className="flex items-baseline gap-1 my-1">
              <span className="text-4xl md:text-5xl font-black tracking-tight text-gold-gradient">
                {report.overallScore}%
              </span>
            </div>

            <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border mt-1.5 ${getTierBadgeClass(report.ratingTier)}`}>
              {report.ratingTier} Squad
            </span>
          </div>
        </div>

        {/* 4 Core Pillars Score Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 pt-6 border-t border-slate-800/80">
          {/* Batting Strength */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
            <div className="flex items-center justify-between text-xs font-bold mb-1.5">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>Batting Strength</span>
              </span>
              <span className="text-amber-400 font-mono text-sm">{report.batting.score}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r ${getScoreBarColor(report.batting.score)} rounded-full`}
                style={{ width: `${report.batting.score}%` }}
              />
            </div>
          </div>

          {/* Bowling Strength */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
            <div className="flex items-center justify-between text-xs font-bold mb-1.5">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-cyan-400" />
                <span>Bowling Strength</span>
              </span>
              <span className="text-cyan-400 font-mono text-sm">{report.bowling.score}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r ${getScoreBarColor(report.bowling.score)} rounded-full`}
                style={{ width: `${report.bowling.score}%` }}
              />
            </div>
          </div>

          {/* Squad Balance */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
            <div className="flex items-center justify-between text-xs font-bold mb-1.5">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                <span>Squad Balance</span>
              </span>
              <span className="text-emerald-400 font-mono text-sm">{report.squadBalance.score}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r ${getScoreBarColor(report.squadBalance.score)} rounded-full`}
                style={{ width: `${report.squadBalance.score}%` }}
              />
            </div>
          </div>

          {/* Auction Efficiency */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
            <div className="flex items-center justify-between text-xs font-bold mb-1.5">
              <span className="text-slate-400 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-indigo-400" />
                <span>Auction Efficiency</span>
              </span>
              <span className="text-indigo-400 font-mono text-sm">{report.efficiency.score}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r ${getScoreBarColor(report.efficiency.score)} rounded-full`}
                style={{ width: `${report.efficiency.score}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveSubTab('overview')}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'overview'
              ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Trophy className="w-3.5 h-3.5" />
          <span>Analysis Overview</span>
        </button>

        <button
          onClick={() => setActiveSubTab('playingXI')}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'playingXI'
              ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Recommended Playing XI</span>
        </button>

        <button
          onClick={() => setActiveSubTab('breakdowns')}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'breakdowns'
              ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Department Breakdowns</span>
        </button>

        <button
          onClick={() => setActiveSubTab('report')}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'report'
              ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Award className="w-3.5 h-3.5" />
          <span>AI Qualitative Report</span>
        </button>
      </div>

      {/* SUB-TAB 1: ANALYSIS OVERVIEW */}
      {activeSubTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Strengths & Weaknesses (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Key Strengths */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <h3 className="text-sm font-black uppercase tracking-wider text-emerald-400 flex items-center gap-2 mb-3">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span>Primary Squad Strengths</span>
              </h3>
              <div className="space-y-2.5">
                {report.strengths.map((str, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-900/40 text-xs text-slate-200 flex items-start gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />
                    <span>{str}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Critical Weaknesses & Gaps */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <h3 className="text-sm font-black uppercase tracking-wider text-rose-400 flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>Vulnerabilities & Tactical Risks</span>
              </h3>
              <div className="space-y-2.5">
                {report.weaknesses.map((wk, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-rose-950/20 border border-rose-900/40 text-xs text-slate-200 flex items-start gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5 flex-shrink-0" />
                    <span>{wk}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Improvement Recommendations */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <h3 className="text-sm font-black uppercase tracking-wider text-amber-400 flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-amber-400" />
                <span>Recommended Tournament Adjustments</span>
              </h3>
              <div className="space-y-2.5">
                {report.improvementAreas.map((imp, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-amber-950/20 border border-amber-900/40 text-xs text-slate-200 flex items-start gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                    <span>{imp}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Key Pillars & Key Players (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Key Players Card */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-100 flex items-center gap-2 mb-4">
                <Award className="w-4 h-4 text-cyan-400" />
                <span>Marquee Impact Pillars</span>
              </h3>

              <div className="space-y-3">
                {report.keyPlayers.map(p => (
                  <div key={p.id} className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-slate-900 overflow-hidden border border-slate-800 flex items-center justify-center flex-shrink-0">
                      <img
                        src={p.photoUrl}
                        alt={p.name}
                        onError={(e) => {
                          e.currentTarget.src = getPlayerFallbackSilhouette(p.name, p.role, p.nationality);
                        }}
                        className="w-full h-full object-cover object-top"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-100 truncate">{p.name}</span>
                        {p.isOverseas && <Plane className="w-3 h-3 text-cyan-400 flex-shrink-0" />}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {p.role} • {p.nationality}
                      </div>
                      <div className="text-[11px] text-emerald-400 font-mono mt-0.5">
                        Acquired: {formatCurrency(p.soldPrice || p.basePrice)}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="px-2 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 font-mono font-black text-xs border border-cyan-500/30">
                        {p.rating}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Leadership Recommendations */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-100 flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-400" />
                <span>Leadership Duo</span>
              </h3>

              {report.captain ? (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">RECOMMENDED CAPTAIN</span>
                    <div className="text-sm font-black text-slate-100">{report.captain.name}</div>
                    <div className="text-[11px] text-slate-400">{report.captain.role} • Rating {report.captain.rating}</div>
                  </div>
                  <Crown className="w-6 h-6 text-amber-400" />
                </div>
              ) : null}

              {report.viceCaptain ? (
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">VICE-CAPTAIN</span>
                    <div className="text-sm font-bold text-slate-200">{report.viceCaptain.name}</div>
                    <div className="text-[11px] text-slate-400">{report.viceCaptain.role} • Rating {report.viceCaptain.rating}</div>
                  </div>
                  <Shield className="w-5 h-5 text-slate-400" />
                </div>
              ) : null}
            </div>

            {/* Auction Finance Summary */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-100 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <span>Auction Ledger Highlights</span>
              </h3>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Top Investment</span>
                  <span className="font-bold text-slate-200 truncate block mt-0.5">{report.efficiency.mostExpensiveBuy?.name || 'N/A'}</span>
                  <span className="text-amber-400 font-mono text-[11px]">{formatCurrency(report.efficiency.mostExpensiveBuy?.soldPrice || 0)}</span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Best Value Steal</span>
                  <span className="font-bold text-slate-200 truncate block mt-0.5">{report.efficiency.mostValuableBuy?.name || 'N/A'}</span>
                  <span className="text-emerald-400 font-mono text-[11px]">{formatCurrency(report.efficiency.mostValuableBuy?.soldPrice || 0)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: RECOMMENDED PLAYING XI */}
      {activeSubTab === 'playingXI' && (
        <div className="space-y-6">
          {/* Header Note */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-300">
            <div>
              <strong className="text-slate-100">IPL Rule-Compliant Playing XI:</strong> Formulated using maximum 4 overseas players, at least 1 wicketkeeper, and minimum 5 bowling options.
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-cyan-400 font-semibold">
                <Plane className="w-3.5 h-3.5" />
                <span>{report.playingXI.filter(s => s.player.isOverseas).length}/4 Overseas</span>
              </span>
              <span className="text-slate-500">•</span>
              <span className="text-amber-400 font-semibold">
                Avg Rating: {Math.round(report.playingXI.reduce((s, p) => s + (p.player.rating || 75), 0) / Math.max(1, report.playingXI.length))}
              </span>
            </div>
          </div>

          {/* Playing XI Roster Table */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
            <div className="divide-y divide-slate-800">
              {report.playingXI.map(slot => (
                <div
                  key={slot.player.id}
                  className="p-3.5 md:p-4 flex items-center justify-between gap-4 hover:bg-slate-800/40 transition"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    {/* Batting Position Badge */}
                    <div className="w-8 h-8 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center font-mono font-black text-xs text-cyan-400 flex-shrink-0">
                      #{slot.position}
                    </div>

                    {/* Photo */}
                    <div className="w-10 h-10 rounded-xl bg-slate-950 overflow-hidden border border-slate-800 flex items-center justify-center flex-shrink-0">
                      <img
                        src={slot.player.photoUrl}
                        alt={slot.player.name}
                        onError={(e) => {
                          e.currentTarget.src = getPlayerFallbackSilhouette(slot.player.name, slot.player.role, slot.player.nationality);
                        }}
                        className="w-full h-full object-cover object-top"
                      />
                    </div>

                    {/* Name & Role */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-100 truncate">{slot.player.name}</span>
                        {slot.isCaptain && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 text-[10px] font-black border border-amber-400/30">
                            (C)
                          </span>
                        )}
                        {slot.isViceCaptain && (
                          <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 text-[10px] font-bold border border-slate-700">
                            (VC)
                          </span>
                        )}
                        {slot.player.isOverseas && (
                          <span className="px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 text-[10px] font-bold flex items-center gap-1 border border-cyan-500/30">
                            <Plane className="w-2.5 h-2.5" /> OS
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                        <span className="text-cyan-400 font-medium">{slot.roleInXI}</span>
                        <span>•</span>
                        <span>{slot.player.battingStyle}</span>
                        {slot.player.bowlingStyle && (
                          <>
                            <span>•</span>
                            <span>{slot.player.bowlingStyle}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="text-right hidden sm:block">
                      <span className="text-xs font-mono text-emerald-400 block font-bold">
                        {formatCurrency(slot.player.soldPrice || slot.player.basePrice)}
                      </span>
                      <span className="text-[10px] text-slate-500 uppercase">{slot.player.category}</span>
                    </div>

                    <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center font-mono font-black text-sm text-cyan-300">
                      {slot.player.rating}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bowling Combinations by Phase */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {report.suggestedBowlingCombination.map((combo, idx) => (
              <div key={idx} className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl">
                <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400 block mb-1">
                  {combo.phase}
                </span>
                <h4 className="text-xs font-bold text-slate-300 mb-2">Key Bowling Options</h4>
                <div className="space-y-1.5">
                  {combo.bowlers.map((b, bIdx) => (
                    <div key={bIdx} className="text-xs font-semibold text-slate-200 flex items-center gap-2 bg-slate-950/60 px-3 py-1.5 rounded-lg border border-slate-800/80">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                      <span>{b}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: DEPARTMENT BREAKDOWNS */}
      {activeSubTab === 'breakdowns' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Batting Department */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-black uppercase tracking-wider text-slate-100 flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-400" />
                <span>Batting Diagnostics</span>
              </h3>
              <span className="text-base font-black text-amber-400 font-mono">{report.batting.score}%</span>
            </div>

            <p className="text-xs text-slate-300 italic">{report.batting.summary}</p>

            <div className="space-y-3.5">
              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-slate-400">Top-Order Quality (Pos 1–3)</span>
                  <span className="text-slate-200">{report.batting.topOrderQuality}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full" style={{ width: `${report.batting.topOrderQuality}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-slate-400">Middle-Order Stability (Pos 4–6)</span>
                  <span className="text-slate-200">{report.batting.middleOrderStability}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full" style={{ width: `${report.batting.middleOrderStability}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-slate-400">Death Finishing Ability</span>
                  <span className="text-slate-200">{report.batting.finishingAbility}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full" style={{ width: `${report.batting.finishingAbility}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-slate-400">Batting Depth (To Pos 8)</span>
                  <span className="text-slate-200">{report.batting.battingDepth}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full" style={{ width: `${report.batting.battingDepth}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Bowling Department */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-black uppercase tracking-wider text-slate-100 flex items-center gap-2">
                <Target className="w-5 h-5 text-cyan-400" />
                <span>Bowling Diagnostics</span>
              </h3>
              <span className="text-base font-black text-cyan-400 font-mono">{report.bowling.score}%</span>
            </div>

            <p className="text-xs text-slate-300 italic">{report.bowling.summary}</p>

            <div className="space-y-3.5">
              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-slate-400">Pace Battery ({report.bowling.paceBowlersCount} Pacers)</span>
                  <span className="text-slate-200">{report.bowling.paceBowling}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full bg-cyan-400 rounded-full" style={{ width: `${report.bowling.paceBowling}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-slate-400">Spin Chokehold ({report.bowling.spinBowlersCount} Spinners)</span>
                  <span className="text-slate-200">{report.bowling.spinBowling}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full bg-cyan-400 rounded-full" style={{ width: `${report.bowling.spinBowling}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-slate-400">Death Overs Lockdown</span>
                  <span className="text-slate-200">{report.bowling.deathOvers}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full bg-cyan-400 rounded-full" style={{ width: `${report.bowling.deathOvers}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-slate-400">Powerplay Penetration</span>
                  <span className="text-slate-200">{report.bowling.powerplay}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full bg-cyan-400 rounded-full" style={{ width: `${report.bowling.powerplay}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: AI QUALITATIVE REPORT */}
      {activeSubTab === 'report' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-xl space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-100 uppercase tracking-tight">
                AI SQUAD VALUATION & SEASON PROJECTION
              </h3>
              <p className="text-xs text-slate-400">
                Computational evaluation based on historical IPL attributes, roles, and tactical metrics.
              </p>
            </div>
          </div>

          <div className="prose prose-invert max-w-none text-xs md:text-sm text-slate-300 leading-relaxed space-y-4">
            <p>
              <strong>Franchise Assessment:</strong> {selectedTeam.name} finishes the auction cycle rated as an{' '}
              <strong className="text-cyan-300">{report.ratingTier} Contender</strong> with an overall score of{' '}
              <strong className="text-amber-400">{report.overallScore}%</strong>. The squad comprises {report.squadSize}{' '}
              players constructed on a total expenditure of {formatCurrency(report.efficiency.totalSpent)}, leaving{' '}
              {formatCurrency(report.efficiency.remainingPurse)} in reserve.
            </p>

            <p>
              <strong>Tactical Matrix:</strong> In the batting department, the team registers a {report.batting.score}% index. {report.batting.summary}{' '}
              The bowling division scores {report.bowling.score}%, featuring {report.bowling.paceBowlersCount} pace options and{' '}
              {report.bowling.spinBowlersCount} spin operators.
            </p>

            <p>
              <strong>Leadership & Playing XI:</strong> {report.captain ? report.captain.name : 'The senior marquee asset'} is the recommended captaincy candidate, supported by {report.viceCaptain?.name || 'the primary all-rounder'}. The recommended starting eleven utilizes {report.playingXI.filter(s => s.player.isOverseas).length} overseas players, maximizing batting depth while securing the required 5 frontline bowling spells.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
