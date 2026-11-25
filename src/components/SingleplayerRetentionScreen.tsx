import React, { useState, useMemo } from 'react';
import { ShieldCheck, Play, Plane, AlertCircle, ArrowLeft } from 'lucide-react';
import type { Player, RetentionRules, Team } from '../types';
import { formatCurrency } from '../utils/currencyUtils';
import { getPlayerFallbackSilhouette, getTeamFallbackLogo } from '../utils/imageUtils';
import {
  DEFAULT_RETENTION_RULES,
  getEligibleRetentionPlayers,
  calculateRetentionBreakdown,
  validateRetentionSelection
} from '../engine/retentionEngine';

interface SingleplayerRetentionScreenProps {
  team: Team;
  players: Player[];
  rules?: RetentionRules;
  onConfirmAndStartAuction: (selectedIds: string[]) => void;
  onSkipRetention: () => void;
  onBackToTeamSelection: () => void;
}

export const SingleplayerRetentionScreen: React.FC<SingleplayerRetentionScreenProps> = ({
  team,
  players,
  rules = DEFAULT_RETENTION_RULES,
  onConfirmAndStartAuction,
  onSkipRetention,
  onBackToTeamSelection
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const eligiblePlayers = useMemo(() => getEligibleRetentionPlayers(team.id, players), [team.id, players]);
  const selectedPlayers = useMemo(() => {
    const idSet = new Set(selectedIds);
    return eligiblePlayers.filter(p => idSet.has(p.id));
  }, [eligiblePlayers, selectedIds]);

  const breakdown = useMemo(() => calculateRetentionBreakdown(selectedPlayers, rules), [selectedPlayers, rules]);
  const costByPlayerId = useMemo(() => {
    const map = new Map<string, { slotIndex: number; cost: number }>();
    for (const item of breakdown.items) {
      map.set(item.player.id, { slotIndex: item.slotIndex, cost: item.cost });
    }
    return map;
  }, [breakdown]);

  const validation = useMemo(
    () => validateRetentionSelection(team, selectedIds, players, rules),
    [team, selectedIds, players, rules]
  );

  const togglePlayer = (playerId: string) => {
    setErrorMsg(null);
    if (selectedIds.includes(playerId)) {
      setSelectedIds(prev => prev.filter(id => id !== playerId));
    } else {
      if (selectedIds.length >= rules.maxRetentions) {
        setErrorMsg(`Maximum ${rules.maxRetentions} retentions allowed.`);
        return;
      }
      const cand = eligiblePlayers.find(p => p.id === playerId);
      if (cand?.isOverseas && selectedPlayers.filter(p => p.isOverseas).length >= rules.maxOverseasRetentions) {
        setErrorMsg(`Maximum ${rules.maxOverseasRetentions} overseas retentions allowed.`);
        return;
      }
      setSelectedIds(prev => [...prev, playerId]);
    }
  };

  const handleConfirm = () => {
    if (!validation.isValid) {
      setErrorMsg(validation.reason || 'Invalid retention selection.');
      return;
    }
    onConfirmAndStartAuction(selectedIds);
  };

  const remainingPurse = Math.max(0, team.initialPurse - breakdown.totalCost);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-6 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-black uppercase tracking-wider mb-2">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>PRE-AUCTION RETENTION STAGE</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-100">
              {team.name} — <span className="text-gold-gradient">PLAYER RETENTION</span>
            </h1>
            <p className="text-xs md:text-sm text-slate-400 mt-1">
              Retain up to {rules.maxRetentions} players (max {rules.maxOverseasRetentions} overseas) before the live auction begins.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onBackToTeamSelection}
              className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Change Team</span>
            </button>
            <button
              onClick={onSkipRetention}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-bold border border-emerald-500/30 transition cursor-pointer"
            >
              Skip Retention (Full Purse)
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="mt-4 p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center gap-3 pb-3 mb-4 border-b border-slate-800">
            <div className="w-9 h-9 rounded-lg bg-slate-950 border border-slate-800 p-1 flex items-center justify-center">
              <img
                src={team.logo}
                alt={team.shortName}
                onError={(e) => {
                  e.currentTarget.src = getTeamFallbackLogo(team.shortName, team.primaryColor, team.secondaryColor);
                }}
                className="max-h-full max-w-full object-contain"
              />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-100">
                Eligible Roster ({eligiblePlayers.length})
              </h2>
              <p className="text-xs text-slate-400">Select core players to retain before entering the auction.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[520px] overflow-y-auto pr-1">
            {eligiblePlayers.map(player => {
              const isSelected = selectedIds.includes(player.id);
              const costInfo = costByPlayerId.get(player.id);

              return (
                <button
                  key={player.id}
                  type="button"
                  onClick={() => togglePlayer(player.id)}
                  className={`p-3 rounded-xl border text-left transition flex items-center justify-between gap-3 cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500/10 border-amber-400 shadow-md'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={player.photoUrl}
                      alt={player.name}
                      onError={(e) => {
                        e.currentTarget.src = getPlayerFallbackSilhouette(player.name, player.role);
                      }}
                      className="w-11 h-11 rounded-lg object-cover bg-slate-900 border border-slate-800 flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-100 truncate flex items-center gap-1.5">
                        <span>{player.name}</span>
                        {player.isOverseas && <Plane className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {player.role} • Rating: <strong className="text-slate-200">{player.rating}</strong>
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {isSelected && costInfo ? (
                      <div>
                        <div className="text-[10px] font-black uppercase text-amber-400">Slot #{costInfo.slotIndex}</div>
                        <div className="text-xs font-mono font-bold text-slate-100">{formatCurrency(costInfo.cost)}</div>
                      </div>
                    ) : (
                      <span className="text-[10px] px-2 py-1 rounded bg-slate-900 text-slate-400 border border-slate-800 font-semibold">
                        Select
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-4 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4 h-fit">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-300 border-b border-slate-800 pb-2.5">
            RETENTION SUMMARY
          </h3>

          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase font-bold">Retained</div>
              <div className="text-lg font-black text-slate-100 mt-0.5">{selectedPlayers.length} / {rules.maxRetentions}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase font-bold">Total Cost</div>
              <div className="text-lg font-black font-mono text-amber-400 mt-0.5">{formatCurrency(breakdown.totalCost)}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 col-span-2">
              <div className="text-[10px] text-slate-400 uppercase font-bold">Remaining Purse</div>
              <div className="text-xl font-black font-mono text-emerald-400 mt-0.5">{formatCurrency(remainingPurse)}</div>
            </div>
          </div>

          {breakdown.items.length > 0 && (
            <div className="space-y-1.5">
              {breakdown.items.map(item => (
                <div key={item.player.id} className="p-2 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                  <div className="min-w-0">
                    <div className="font-bold text-slate-100 truncate">{item.slotIndex}. {item.player.name}</div>
                    <div className="text-[10px] text-slate-400">{item.player.role} • {item.player.isOverseas ? 'Overseas' : 'Indian'}</div>
                  </div>
                  <span className="font-mono font-bold text-amber-400">{formatCurrency(item.cost)}</span>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            disabled={!validation.isValid}
            onClick={handleConfirm}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition cursor-pointer disabled:opacity-50"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Confirm &amp; Start Auction</span>
          </button>
        </div>
      </div>
    </div>
  );
};
