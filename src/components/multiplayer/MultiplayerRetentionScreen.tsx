import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  Lock,
  CheckCircle2,
  AlertCircle,
  Play,
  Crown,
  Plane,
  Users,
  Settings,
  LogOut
} from 'lucide-react';
import type { MultiplayerRoomState } from '../../types';
import { formatCurrency } from '../../utils/currencyUtils';
import { getPlayerFallbackSilhouette, getTeamFallbackLogo } from '../../utils/imageUtils';
import {
  DEFAULT_RETENTION_RULES,
  getEligibleRetentionPlayers,
  calculateRetentionBreakdown,
  validateRetentionSelection
} from '../../engine/retentionEngine';
import {
  submitMultiplayerRetention,
  startMultiplayerAuction,
  updateRetentionRules,
  leaveMultiplayerRoom
} from '../../services/socketService';

interface MultiplayerRetentionScreenProps {
  room: MultiplayerRoomState;
  currentUserId: string;
  onLeaveRoom: () => void;
}

export const MultiplayerRetentionScreen: React.FC<MultiplayerRetentionScreenProps> = ({
  room,
  currentUserId,
  onLeaveRoom
}) => {
  const me = room.players.find(p => p.id === currentUserId);
  const isHost = me?.isHost || false;
  const myTeam = room.teams.find(t => t.id === me?.teamId);
  const rules = room.retentionRules || DEFAULT_RETENTION_RULES;

  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    if (myTeam && room.retentions?.[myTeam.id]?.confirmed) {
      return room.retentions[myTeam.id].playerIds;
    }
    return [];
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isStartingAuction, setIsStartingAuction] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const isConfirmed = Boolean(myTeam?.retentionConfirmed || (myTeam && room.retentions?.[myTeam.id]?.confirmed));

  const eligiblePlayers = useMemo(() => {
    if (!myTeam) return [];
    return getEligibleRetentionPlayers(myTeam.id, room.playerPool);
  }, [myTeam, room.playerPool]);

  const selectedPlayers = useMemo(() => {
    const idSet = new Set(selectedIds);
    return eligiblePlayers.filter(p => idSet.has(p.id));
  }, [eligiblePlayers, selectedIds]);

  const breakdown = useMemo(() => {
    return calculateRetentionBreakdown(selectedPlayers, rules);
  }, [selectedPlayers, rules]);

  const costByPlayerId = useMemo(() => {
    const map = new Map<string, { slotIndex: number; cost: number }>();
    for (const item of breakdown.items) {
      map.set(item.player.id, { slotIndex: item.slotIndex, cost: item.cost });
    }
    return map;
  }, [breakdown]);

  const validation = useMemo(() => {
    if (!myTeam) return { isValid: false, reason: 'No franchise assigned.', totalCost: 0, items: [] };
    if (isConfirmed) {
      return {
        isValid: true,
        totalCost: myTeam.retentionSpent || breakdown.totalCost,
        items: breakdown.items
      };
    }
    return validateRetentionSelection(myTeam, selectedIds, room.playerPool, rules);
  }, [myTeam, isConfirmed, selectedIds, room.playerPool, rules, breakdown]);

  const togglePlayer = (playerId: string) => {
    if (isConfirmed || isSubmitting) return;
    setErrorMsg(null);

    if (selectedIds.includes(playerId)) {
      setSelectedIds(prev => prev.filter(id => id !== playerId));
    } else {
      if (selectedIds.length >= rules.maxRetentions) {
        setErrorMsg(`Maximum ${rules.maxRetentions} retentions allowed.`);
        return;
      }
      const candidate = eligiblePlayers.find(p => p.id === playerId);
      if (candidate?.isOverseas) {
        const currentOverseas = selectedPlayers.filter(p => p.isOverseas).length;
        if (currentOverseas >= rules.maxOverseasRetentions) {
          setErrorMsg(`Maximum ${rules.maxOverseasRetentions} overseas retentions allowed.`);
          return;
        }
      }
      setSelectedIds(prev => [...prev, playerId]);
    }
  };

  const handleConfirmRetention = async () => {
    if (!myTeam || isConfirmed || isSubmitting) return;
    if (!validation.isValid) {
      setErrorMsg(validation.reason || 'Invalid retention selection.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const res = await submitMultiplayerRetention({
      roomCode: room.roomCode,
      playerId: currentUserId,
      teamId: myTeam.id,
      playerIds: selectedIds
    });

    setIsSubmitting(false);
    if (res.success) {
      setSuccessMsg(`Retentions locked! ${selectedIds.length} player(s) retained for ${formatCurrency(res.totalCost || 0)}.`);
    } else {
      setErrorMsg(res.error || 'Failed to confirm retentions.');
    }
  };

  const handleLaunchAuction = async () => {
    setIsStartingAuction(true);
    setErrorMsg(null);
    const res = await startMultiplayerAuction();
    if (!res.success) {
      setErrorMsg(res.error || 'Failed to launch auction.');
      setIsStartingAuction(false);
    }
  };

  const handleRuleChange = async (maxRetentions: number, maxOverseasRetentions: number) => {
    setErrorMsg(null);
    const res = await updateRetentionRules({ maxRetentions, maxOverseasRetentions });
    if (!res.success) {
      setErrorMsg(res.error || 'Could not update retention rules.');
    }
  };

  const handleExitRoom = async () => {
    await leaveMultiplayerRoom();
    onLeaveRoom();
  };

  const participatingTeams = room.players
    .map(p => ({
      player: p,
      team: room.teams.find(t => t.id === p.teamId)
    }))
    .filter((entry): entry is { player: typeof room.players[number]; team: NonNullable<typeof entry.team> } => Boolean(entry.team));

  const confirmedTeamsCount = participatingTeams.filter(e => e.team.retentionConfirmed).length;
  const displayPurse = myTeam
    ? (isConfirmed ? myTeam.currentPurse : Math.max(0, myTeam.initialPurse - breakdown.totalCost))
    : 0;
  const displaySpent = myTeam
    ? (isConfirmed ? (myTeam.retentionSpent || 0) : breakdown.totalCost)
    : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-6 shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2.5 mb-2">
              <span className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>PRE-AUCTION RETENTION STAGE</span>
              </span>
              <span className="text-xs font-mono text-slate-400">
                Room: <strong className="text-cyan-400">{room.roomCode}</strong>
              </span>
              <span className="text-xs text-slate-400">
                • Confirmed: <strong className="text-emerald-400">{confirmedTeamsCount}/{participatingTeams.length}</strong> Teams
              </span>
            </div>

            <h1 className="text-2xl md:text-3xl font-black text-slate-100">
              PLAYER <span className="text-gold-gradient">RETENTION</span> & PURSE ALLOCATION
            </h1>
            <p className="text-xs md:text-sm text-slate-400 mt-1">
              Select up to {rules.maxRetentions} players (max {rules.maxOverseasRetentions} overseas) from your franchise&apos;s pre-auction roster. Retention costs are deducted from your {formatCurrency(myTeam?.initialPurse || room.settings.startingPurse)} auction purse.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {isHost && (
              <button
                type="button"
                disabled={isStartingAuction}
                onClick={handleLaunchAuction}
                className="px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition cursor-pointer disabled:opacity-60"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>{isStartingAuction ? 'Starting Auction...' : 'Start Live Auction'}</span>
              </button>
            )}

            <button
              onClick={handleExitRoom}
              className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 border border-slate-700 transition cursor-pointer flex items-center gap-1.5 text-xs font-bold"
            >
              <LogOut className="w-4 h-4" />
              <span>Leave</span>
            </button>
          </div>
        </div>

        {/* Retention Slab Info & Host Config */}
        <div className="mt-5 pt-4 border-t border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-400 font-bold uppercase tracking-wider mr-1">Slab Costs:</span>
            {rules.slotCosts.slice(0, rules.maxRetentions).map((cost, idx) => (
              <span key={idx} className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 font-mono">
                Slot {idx + 1}: <strong className="text-amber-400">{formatCurrency(cost)}</strong>
              </span>
            ))}
          </div>

          {isHost && confirmedTeamsCount === 0 && (
            <div className="flex flex-wrap items-center gap-3 text-xs bg-slate-950/70 px-3 py-2 rounded-xl border border-slate-800">
              <span className="text-amber-400 font-bold flex items-center gap-1">
                <Settings className="w-3.5 h-3.5" /> Host Rules:
              </span>
              <label className="flex items-center gap-1.5 text-slate-300">
                <span>Max Retentions:</span>
                <select
                  value={rules.maxRetentions}
                  onChange={(e) => handleRuleChange(Number(e.target.value), rules.maxOverseasRetentions)}
                  className="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-slate-100 font-bold"
                >
                  {[2, 3, 4, 5, 6].map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-1.5 text-slate-300">
                <span>Max Overseas:</span>
                <select
                  value={rules.maxOverseasRetentions}
                  onChange={(e) => handleRuleChange(rules.maxRetentions, Number(e.target.value))}
                  className="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-slate-100 font-bold"
                >
                  {[1, 2, 3].map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
            </div>
          )}
        </div>

        {errorMsg && (
          <div className="mt-4 p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Eligible Players Pool (8 cols) */}
        <div className="lg:col-span-8 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              {myTeam && (
                <div className="w-9 h-9 rounded-lg bg-slate-950 border border-slate-800 p-1 flex items-center justify-center">
                  <img
                    src={myTeam.logo}
                    alt={myTeam.shortName}
                    onError={(e) => {
                      e.currentTarget.src = getTeamFallbackLogo(myTeam.shortName, myTeam.primaryColor, myTeam.secondaryColor);
                    }}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              )}
              <div>
                <h2 className="text-sm font-black uppercase tracking-wider text-slate-100">
                  {myTeam ? `${myTeam.name} Pre-Auction Roster (${eligiblePlayers.length})` : 'No Franchise Claimed'}
                </h2>
                <p className="text-xs text-slate-400">
                  {isConfirmed
                    ? 'Your retention selections are locked for this auction.'
                    : 'Click players to toggle retention selection.'}
                </p>
              </div>
            </div>

            {isConfirmed && (
              <span className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-black flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" /> CONFIRMED
              </span>
            )}
          </div>

          {eligiblePlayers.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              No eligible pre-auction players found for your franchise. You may confirm 0 retentions to keep your full purse.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[540px] overflow-y-auto pr-1">
              {eligiblePlayers.map(player => {
                const isSelected = selectedIds.includes(player.id);
                const costInfo = costByPlayerId.get(player.id);

                return (
                  <button
                    key={player.id}
                    type="button"
                    disabled={isConfirmed}
                    onClick={() => togglePlayer(player.id)}
                    className={`p-3 rounded-xl border text-left transition flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-amber-500/10 border-amber-400 shadow-md'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    } ${isConfirmed ? 'cursor-default opacity-90' : 'cursor-pointer'}`}
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
                          {player.isOverseas && (
                            <span title="Overseas"><Plane className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" /></span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                          <span>{player.role}</span>
                          <span>•</span>
                          <span>Rating: <strong className="text-slate-200">{player.rating}</strong></span>
                          {player.previousPrice && (
                            <>
                              <span>•</span>
                              <span>Prev: {player.previousPrice}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      {isSelected && costInfo ? (
                        <div>
                          <div className="text-[10px] font-black uppercase text-amber-400">
                            Slot #{costInfo.slotIndex}
                          </div>
                          <div className="text-xs font-mono font-bold text-slate-100">
                            {formatCurrency(costInfo.cost)}
                          </div>
                        </div>
                      ) : (
                        <span className="text-[10px] px-2 py-1 rounded bg-slate-900 text-slate-400 border border-slate-800 font-semibold">
                          {isConfirmed ? 'Release' : 'Select'}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Retention Summary & Host Monitor (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* My Franchise Retention Summary */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-300 border-b border-slate-800 pb-2.5">
              RETENTION SUMMARY
            </h3>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-bold">Retained Players</div>
                <div className="text-lg font-black text-slate-100 mt-0.5">
                  {selectedPlayers.length} <span className="text-xs text-slate-500">/ {rules.maxRetentions}</span>
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-bold">Retention Cost</div>
                <div className="text-lg font-black font-mono text-amber-400 mt-0.5">
                  {formatCurrency(displaySpent)}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 col-span-2">
                <div className="text-[10px] text-slate-400 uppercase font-bold">Remaining Auction Purse</div>
                <div className="text-xl font-black font-mono text-emerald-400 mt-0.5">
                  {formatCurrency(displayPurse)}
                </div>
              </div>
            </div>

            {breakdown.items.length > 0 && (
              <div className="space-y-1.5 pt-2">
                <div className="text-[11px] font-bold uppercase text-slate-400">Selected Core</div>
                {breakdown.items.map(item => (
                  <div
                    key={item.player.id}
                    className="p-2 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-slate-100 truncate">
                        {item.slotIndex}. {item.player.name}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {item.player.role} • {item.player.isOverseas ? 'Overseas' : 'Indian'}
                      </div>
                    </div>
                    <span className="font-mono font-bold text-amber-400 flex-shrink-0">
                      {formatCurrency(item.cost)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {!isConfirmed ? (
              <button
                type="button"
                disabled={isSubmitting || !validation.isValid}
                onClick={handleConfirmRetention}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 text-xs font-black uppercase tracking-wider shadow-lg shadow-amber-500/20 transition cursor-pointer disabled:opacity-50"
              >
                {isSubmitting
                  ? 'Confirming...'
                  : selectedIds.length === 0
                  ? 'Confirm 0 Retentions (Keep Full Purse)'
                  : `Confirm ${selectedIds.length} Retention${selectedIds.length > 1 ? 's' : ''}`}
              </button>
            ) : (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold text-center">
                Retentions locked. Waiting for host to start the auction.
              </div>
            )}
          </div>

          {/* Room Retention Monitor (Visible to all, critical for Host) */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-2 border-b border-slate-800 pb-2.5">
              <Users className="w-4 h-4 text-cyan-400" />
              <span>FRANCHISE RETENTION STATUS</span>
            </h3>

            <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
              {participatingTeams.map(({ player, team }) => {
                const confirmed = team.retentionConfirmed;
                const retCount = team.retainedPlayers?.length ?? 0;

                return (
                  <div
                    key={team.id}
                    className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-slate-100 flex items-center gap-1.5">
                        <span>{team.shortName}</span>
                        {player.isHost && <Crown className="w-3 h-3 text-amber-400" />}
                        <span className="text-[11px] font-normal text-slate-400 truncate">({player.name})</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        Purse: {formatCurrency(team.currentPurse)}
                      </div>
                    </div>

                    <div className="flex-shrink-0 text-right">
                      {confirmed ? (
                        <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-black">
                          LOCKED ({retCount})
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] font-semibold">
                          SELECTING
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
