import React from 'react';
import type { Team } from '../types';
import { formatCurrency } from '../utils/currencyUtils';
import { getTeamFallbackLogo } from '../utils/imageUtils';
import { User, Gavel, Plane } from 'lucide-react';

interface TeamsLeftPanelProps {
  teams: Team[];
  userTeamId: string;
  highestBidderTeamId: string | null;
  onSelectTeamToInspect: (team: Team) => void;
}

export const TeamsLeftPanel: React.FC<TeamsLeftPanelProps> = ({
  teams,
  userTeamId,
  highestBidderTeamId,
  onSelectTeamToInspect
}) => {
  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-col h-full shadow-lg">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
        <h3 className="text-xs font-black tracking-widest uppercase text-slate-300 flex items-center gap-2">
          <span>FRANCHISES</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">10</span>
        </h3>
        <span className="text-[10px] text-slate-400 font-medium">Single Player</span>
      </div>

      <div className="space-y-1.5 overflow-y-auto pr-1 flex-1 max-h-[640px]">
        {teams.map(team => {
          const isUser = team.id === userTeamId;
          const isHighestBidder = team.id === highestBidderTeamId;

          return (
            <div
              key={team.id}
              onClick={() => onSelectTeamToInspect(team)}
              style={{
                borderColor: isUser
                  ? isHighestBidder ? '#eab308' : team.primaryColor
                  : 'rgba(51, 65, 85, 0.4)'
              }}
              className={`group p-2 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                isUser
                  ? isHighestBidder
                    ? 'bg-amber-500/15 border-amber-400 shadow-lg animate-pulse-glow'
                    : 'bg-slate-950/90 hover:bg-slate-900 border-2 shadow-md'
                  : 'bg-slate-950/30 border-slate-900 text-slate-500 opacity-60 hover:opacity-85'
              }`}
            >
              {/* Left: Team badge & Name */}
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="w-7 h-7 rounded-md p-1 flex items-center justify-center bg-slate-900 border border-slate-800 flex-shrink-0"
                  style={{ borderLeftColor: team.primaryColor, borderLeftWidth: '3px' }}
                >
                  <img
                    src={team.logo}
                    alt={team.shortName}
                    onError={(e) => {
                      e.currentTarget.src = getTeamFallbackLogo(team.shortName, team.primaryColor, team.secondaryColor);
                    }}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`font-bold text-xs truncate transition-colors ${
                      isUser ? 'text-slate-100 group-hover:text-amber-300' : 'text-slate-400'
                    }`}>
                      {team.shortName}
                    </span>
                    {isUser ? (
                      <span className="px-1 py-0.2 rounded text-[9px] font-black uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/30 flex items-center gap-0.5">
                        <User className="w-2.5 h-2.5" /> YOU
                      </span>
                    ) : (
                      <span className="px-1 py-0.2 rounded text-[8px] uppercase tracking-wider bg-slate-900 text-slate-600 border border-slate-800">
                        INACTIVE
                      </span>
                    )}
                    {isHighestBidder && isUser && (
                      <span className="px-1 py-0.2 rounded text-[9px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-0.5">
                        <Gavel className="w-2.5 h-2.5" /> WINNING
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">
                    {team.name}
                  </div>
                </div>
              </div>

              {/* Right: Purse & Counts */}
              <div className="text-right flex-shrink-0">
                <div className={`font-mono text-xs font-bold ${
                  isUser ? 'text-amber-400' : 'text-slate-500'
                }`}>
                  {formatCurrency(team.currentPurse)}
                </div>
                <div className="text-[10px] text-slate-500 flex items-center justify-end gap-1.5">
                  <span title="Squad count">{team.squadCount}/25</span>
                  <span>•</span>
                  <span title="Overseas players" className="flex items-center gap-0.5 text-sky-500">
                    <Plane className="w-2.5 h-2.5" />
                    {team.overseasCount}/8
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
