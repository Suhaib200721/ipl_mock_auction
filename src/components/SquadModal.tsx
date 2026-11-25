import React, { useState } from 'react';
import type { Team } from '../types';
import { formatCurrency } from '../utils/currencyUtils';
import { getPlayerFallbackSilhouette } from '../utils/imageUtils';
import { X, Users, Plane } from 'lucide-react';

interface SquadModalProps {
  teams: Team[];
  initialSelectedTeamId?: string;
  onClose: () => void;
}

export const SquadModal: React.FC<SquadModalProps> = ({
  teams,
  initialSelectedTeamId,
  onClose
}) => {
  const [selectedTeamId, setSelectedTeamId] = useState<string>(
    initialSelectedTeamId || teams[0]?.id || 'MI'
  );

  const team = teams.find(t => t.id === selectedTeamId) || teams[0];
  const spentPurse = team.initialPurse - team.currentPurse;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-bid-pop">
      <div className="relative max-w-4xl w-full rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-400/20 text-amber-300 flex items-center justify-center border border-amber-400/30">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-100">
                FRANCHISE SQUAD ROSTER
              </h2>
              <p className="text-xs text-slate-400">
                Review squad composition and expenditure across all 10 franchises.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Team Selector Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-3 border-b border-slate-800/80">
          {teams.map(t => {
            const isSelected = t.id === selectedTeamId;
            return (
              <button
                key={t.id}
                onClick={() => setSelectedTeamId(t.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                  isSelected
                    ? 'bg-amber-400 text-slate-950 font-black shadow-md'
                    : 'bg-slate-950 hover:bg-slate-800 text-slate-300'
                }`}
              >
                <div
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: t.primaryColor }}
                />
                <span>{t.shortName}</span>
                <span className="text-[10px] opacity-75">({t.squadCount})</span>
              </button>
            );
          })}
        </div>

        {/* Selected Team Summary Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-4">
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <div className="text-[10px] font-bold uppercase text-slate-400">Remaining Purse</div>
            <div className="text-base font-black font-mono text-amber-400 mt-0.5">
              {formatCurrency(team.currentPurse)}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <div className="text-[10px] font-bold uppercase text-slate-400">Total Spent</div>
            <div className="text-base font-black font-mono text-slate-200 mt-0.5">
              {formatCurrency(spentPurse)}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <div className="text-[10px] font-bold uppercase text-slate-400">Squad Count</div>
            <div className="text-base font-black text-slate-200 mt-0.5">
              {team.squadCount} / 25
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <div className="text-[10px] font-bold uppercase text-slate-400">Overseas Count</div>
            <div className="text-base font-black text-sky-400 mt-0.5 flex items-center gap-1">
              <Plane className="w-4 h-4" /> {team.overseasCount} / 8
            </div>
          </div>
        </div>

        {/* Role Breakdown Pills */}
        <div className="flex flex-wrap items-center gap-2 pb-3 text-xs">
          <span className="px-2.5 py-1 rounded-md bg-blue-500/20 text-blue-300 border border-blue-500/30">
            Batters: <strong>{team.roleCounts.batter}</strong>
          </span>
          <span className="px-2.5 py-1 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/30">
            Bowlers: <strong>{team.roleCounts.bowler}</strong>
          </span>
          <span className="px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            All-Rounders: <strong>{team.roleCounts.allRounder}</strong>
          </span>
          <span className="px-2.5 py-1 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
            Wicketkeepers: <strong>{team.roleCounts.wicketkeeper}</strong>
          </span>
        </div>

        {/* Player Roster Table */}
        <div className="flex-1 overflow-y-auto pr-1">
          {team.purchasedPlayers.length === 0 ? (
            <div className="py-16 text-center text-slate-500 text-xs italic">
              No players purchased yet by {team.name}.
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {team.purchasedPlayers.map((player, idx) => (
                <div key={player.id} className="py-2.5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-slate-500 w-5">#{idx + 1}</span>
                    <div className="w-8 h-9 rounded bg-slate-950 border border-slate-800 p-0.5 flex items-center justify-center">
                      <img
                        src={player.photoUrl}
                        alt={player.name}
                        onError={(e) => {
                          e.currentTarget.src = getPlayerFallbackSilhouette(player.name, player.role, player.nationality);
                        }}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                        <span>{player.name}</span>
                        {player.isOverseas && <Plane className="w-3 h-3 text-sky-400" />}
                        {player.isRetained && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[9px] font-black uppercase">
                            Retained
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {player.role} • {player.category}
                      </div>
                    </div>
                  </div>

                  <div className="font-mono text-xs font-bold text-amber-400">
                    {formatCurrency(player.soldPrice || player.basePrice)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
