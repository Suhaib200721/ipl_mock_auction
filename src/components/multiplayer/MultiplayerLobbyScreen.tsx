import React, { useState } from 'react';
import { Copy, Check, Crown, Users, AlertCircle, CheckCircle2, LogOut, Shield, Lock, Undo2, Sparkles, Play, ShieldCheck } from 'lucide-react';
import type { MultiplayerRoomState } from '../../types';
import { formatCurrency } from '../../utils/currencyUtils';
import { getTeamFallbackLogo } from '../../utils/imageUtils';
import {
  claimMultiplayerTeam,
  releaseMultiplayerTeam,
  toggleMultiplayerReady,
  leaveMultiplayerRoom,
  startMultiplayerAuction,
  startRetentionStage
} from '../../services/socketService';

interface MultiplayerLobbyScreenProps {
  room: MultiplayerRoomState;
  currentUserId: string;
  onLeaveRoom: () => void;
}

export const MultiplayerLobbyScreen: React.FC<MultiplayerLobbyScreenProps> = ({
  room,
  currentUserId,
  onLeaveRoom
}) => {
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [claimingTeamId, setClaimingTeamId] = useState<string | null>(null);
  const [isReleasing, setIsReleasing] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const me = room.players.find(p => p.id === currentUserId);
  const isHost = me?.isHost || false;
  const myAssignedTeam = room.teams.find(t => t.id === me?.teamId);

  const unassignedPlayers = room.players.filter(p => !p.teamId);
  const hostPlayer = room.players.find(p => p.isHost);
  const hasHostClaimedTeam = Boolean(hostPlayer?.teamId);
  const canStart = isHost && hasHostClaimedTeam && unassignedPlayers.length === 0 && room.players.length >= 1;

  const handleStartAuction = async () => {
    setIsStarting(true);
    setErrorMessage(null);
    const res = await startMultiplayerAuction();
    if (!res.success) {
      setErrorMessage(res.error || 'Failed to start auction.');
      setIsStarting(false);
    }
  };

  const handleStartRetention = async () => {
    setIsStarting(true);
    setErrorMessage(null);
    const res = await startRetentionStage();
    if (!res.success) {
      setErrorMessage(res.error || 'Failed to enter retention stage.');
      setIsStarting(false);
    }
  };

  // Copy Room Code to clipboard
  const handleCopyCode = () => {
    navigator.clipboard.writeText(room.roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Claim a franchise (Stage 3)
  const handleClaimTeam = async (teamId: string) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    // If already holding a different team, prompt release first
    if (me?.teamId && me.teamId !== teamId) {
      setErrorMessage(`You already hold ${myAssignedTeam?.name || me.teamId}. Please release it before claiming another franchise.`);
      return;
    }

    setClaimingTeamId(teamId);
    try {
      const res = await claimMultiplayerTeam(teamId);
      if (res.success) {
        setSuccessMessage(`Successfully claimed ${res.teamName || teamId}!`);
        setTimeout(() => setSuccessMessage(null), 4000);
      } else {
        setErrorMessage(res.error || 'Failed to claim franchise.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error claiming franchise.');
    } finally {
      setClaimingTeamId(null);
    }
  };

  // Release currently held franchise (Stage 3)
  const handleReleaseTeam = async () => {
    if (!me?.teamId) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsReleasing(true);

    try {
      const teamName = myAssignedTeam?.name || 'Franchise';
      const res = await releaseMultiplayerTeam();
      if (res.success) {
        setSuccessMessage(`Released ${teamName}. You can now select another franchise.`);
        setTimeout(() => setSuccessMessage(null), 4000);
      } else {
        setErrorMessage(res.error || 'Failed to release franchise.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error releasing franchise.');
    } finally {
      setIsReleasing(false);
    }
  };

  // Toggle ready status
  const handleToggleReady = async () => {
    setErrorMessage(null);
    const res = await toggleMultiplayerReady();
    if (!res.success) {
      setErrorMessage(res.error || 'Failed to update ready status.');
    }
  };

  // Safe room exit
  const handleExitRoom = async () => {
    await leaveMultiplayerRoom();
    onLeaveRoom();
  };

  // Claim metrics
  const claimedCount = room.teams.filter(t => room.players.some(p => p.teamId === t.id)).length;
  const availableCount = room.teams.length - claimedCount;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Top Room Banner */}
      <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-2xl mb-8 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <span className="px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>STAGE 3 • TEAM CLAIM LOBBY</span>
              </span>
              <span className="text-xs text-slate-400 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <span>{room.players.length}/10 Connected Managers</span>
              </span>
              <span className="text-xs font-bold text-amber-400 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20">
                {claimedCount}/10 Franchises Claimed
              </span>
            </div>

            <h1 className="text-2xl md:text-4xl font-black text-slate-100 flex items-center gap-4">
              <span>ROOM CODE:</span>
              <span className="font-mono text-cyan-400 tracking-widest bg-slate-950 px-4 py-1 rounded-xl border border-slate-800">
                {room.roomCode}
              </span>
            </h1>

            <p className="text-slate-400 text-xs md:text-sm mt-2">
              Real-time franchise lock enabled. Claimed franchises immediately lock for all other managers.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleCopyCode}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-2 border border-slate-700 transition cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Code Copied!' : 'Copy Code'}</span>
            </button>

            <button
              onClick={handleExitRoom}
              className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 border border-slate-700 transition cursor-pointer flex items-center gap-1.5 text-xs font-bold"
              title="Leave Room"
            >
              <LogOut className="w-4 h-4" />
              <span>Leave</span>
            </button>
          </div>
        </div>

        {/* Feedback Alerts */}
        {errorMessage && (
          <div className="mt-4 p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2.5 animate-bid-pop">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2.5 animate-bid-pop">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
        )}
      </div>

      {/* Main Grid: Left (Player Roster) & Right (10 Franchises Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Joined Managers Roster */}
        <div className="lg:col-span-4 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Users className="w-4 h-4 text-cyan-400" />
                <span>CONNECTED MANAGERS ({room.players.length}/10)</span>
              </h3>
            </div>

            <div className="space-y-2.5">
              {room.players.map(player => {
                const assignedTeam = room.teams.find(t => t.id === player.teamId);
                const isMe = player.id === currentUserId;

                return (
                  <div
                    key={player.id}
                    className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition ${isMe
                        ? 'bg-cyan-500/10 border-cyan-500/50 shadow-md'
                        : 'bg-slate-950/60 border-slate-800'
                      }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center font-bold text-xs text-white flex-shrink-0">
                        {assignedTeam ? (
                          <img
                            src={assignedTeam.logo}
                            alt={assignedTeam.shortName}
                            onError={(e) => {
                              e.currentTarget.src = getTeamFallbackLogo(assignedTeam.shortName, assignedTeam.primaryColor, assignedTeam.secondaryColor);
                            }}
                            className="max-h-full max-w-full object-contain p-0.5"
                          />
                        ) : (
                          '?'
                        )}
                      </div>

                      <div className="truncate">
                        <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5 truncate">
                          <span>{player.name}</span>
                          {player.isHost && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 text-[10px] font-black border border-amber-400/30" title="Room Host">
                              <Crown className="w-3 h-3 text-amber-400" />
                              <span>HOST</span>
                            </span>
                          )}
                          {isMe && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-400/20 text-cyan-300 font-black">
                              YOU
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {assignedTeam ? `${assignedTeam.name} (${assignedTeam.shortName})` : 'Selecting franchise...'}
                        </div>
                      </div>
                    </div>

                    <div className="flex-shrink-0 text-right">
                      {player.isReady ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> READY
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-400">
                          PENDING
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* User Controls & Stage 3 Status */}
          <div className="pt-6 border-t border-slate-800 mt-6 space-y-3">
            {/* Host Start Retention / Start Auction Buttons or Waiting Message */}
            {isHost ? (
              <div className="space-y-2.5">
                <button
                  type="button"
                  disabled={!canStart || isStarting}
                  onClick={handleStartRetention}
                  className={`w-full py-3.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl transition-all cursor-pointer ${
                    canStart && !isStarting
                      ? 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 shadow-amber-500/25'
                      : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-60'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>
                    {!hasHostClaimedTeam
                      ? 'Claim a Team to Start'
                      : unassignedPlayers.length > 0
                      ? `Waiting for ${unassignedPlayers[0].name} to pick team`
                      : isStarting
                      ? 'Loading...'
                      : 'Enter Retention Stage'}
                  </span>
                </button>

                <button
                  type="button"
                  disabled={!canStart || isStarting}
                  onClick={handleStartAuction}
                  className={`w-full py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                    canStart && !isStarting
                      ? 'bg-slate-950 hover:bg-slate-800 text-emerald-400 border-emerald-500/30'
                      : 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed opacity-60'
                  }`}
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Skip Retention &amp; Start Auction</span>
                </button>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-center text-xs text-slate-400">
                Waiting for host <strong className="text-slate-200">{room.players.find(p => p.isHost)?.name}</strong> to launch the auction.
              </div>
            )}

            {/* Ready Toggle Button */}
            {me && (
              <button
                onClick={handleToggleReady}
                disabled={!me.teamId}
                className={`w-full py-3 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer ${me.isReady
                    ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                    : me.teamId
                      ? 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700'
                      : 'bg-slate-950 text-slate-600 border border-slate-800 cursor-not-allowed opacity-60'
                  }`}
              >
                {me.isReady ? '✓ You Are Ready' : me.teamId ? 'Click To Ready Up' : 'Claim Franchise To Ready Up'}
              </button>
            )}

            {/* Stage 3 Status Card */}
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-center text-xs space-y-1.5">
              <div className="font-bold text-slate-300 flex items-center justify-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-cyan-400" />
                <span>Stage 3 Team Claim Mode</span>
              </div>
              {isHost && (
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-300 text-[10px] font-bold">
                  <Crown className="w-3 h-3 text-amber-400" />
                  <span>You are Room Host</span>
                </div>
              )}
              <div className="text-[11px] text-slate-400">
                {claimedCount === 10
                  ? 'All 10 IPL franchises have been claimed!'
                  : `${availableCount} franchise${availableCount === 1 ? '' : 's'} currently open for claim.`}
              </div>
              {me?.teamId && (
                <div className="text-[11px] text-cyan-300 font-semibold">
                  You hold {myAssignedTeam?.name} ({myAssignedTeam?.shortName})
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: 10 IPL Franchises Claiming Grid */}
        <div className="lg:col-span-8">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
            <div>
              <h3 className="text-base font-black uppercase tracking-wider text-slate-100 flex items-center gap-2">
                <span>CLAIM YOUR IPL FRANCHISE</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-normal">
                  {claimedCount}/10 Claimed
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Each franchise can be claimed by exactly one human manager. Real-time server sync.
              </p>
            </div>
            <span className="text-xs text-amber-400 font-bold hidden sm:inline-block">
              Purse: {formatCurrency(room.settings.startingPurse)}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {room.teams.map(team => {
              const claimingPlayer = room.players.find(p => p.teamId === team.id);
              const isClaimedByMe = claimingPlayer?.id === currentUserId;
              const isClaimedByOther = claimingPlayer && !isClaimedByMe;
              const isClaimingThis = claimingTeamId === team.id;

              return (
                <div
                  key={team.id}
                  style={{
                    borderColor: isClaimedByMe
                      ? '#06b6d4'
                      : isClaimedByOther
                        ? 'rgba(71, 85, 105, 0.4)'
                        : 'rgba(51, 65, 85, 0.6)'
                  }}
                  className={`p-4 rounded-xl border-2 transition-all relative overflow-hidden flex items-center justify-between gap-4 ${isClaimedByMe
                      ? 'bg-cyan-500/10 shadow-lg shadow-cyan-500/10 ring-1 ring-cyan-500/40'
                      : isClaimedByOther
                        ? 'bg-slate-950/40 opacity-70'
                        : 'bg-slate-900/80 hover:bg-slate-800/80 hover:border-slate-500 shadow-sm'
                    }`}
                >
                  {/* Left Team Color Bar */}
                  <div
                    className="absolute top-0 bottom-0 left-0 w-1.5"
                    style={{ backgroundColor: team.primaryColor }}
                  />

                  <div className="flex items-center gap-3.5 min-w-0 pl-1">
                    <div className="w-12 h-12 rounded-xl bg-slate-950 p-1 border border-slate-800 flex items-center justify-center flex-shrink-0">
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
                        <span className="text-xs font-black text-slate-400">{team.shortName}</span>
                        {isClaimedByMe ? (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                            YOUR FRANCHISE
                          </span>
                        ) : isClaimedByOther ? (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-slate-800 text-rose-300 border border-slate-700">
                            CLAIMED
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            AVAILABLE
                          </span>
                        )}
                      </div>

                      <h4 className="text-sm font-bold text-slate-100 truncate mt-0.5">
                        {team.name}
                      </h4>

                      <div className="text-[11px] truncate mt-0.5">
                        {isClaimedByMe ? (
                          <span className="text-cyan-400 font-semibold">
                            Owned by You ({me?.name})
                          </span>
                        ) : isClaimedByOther ? (
                          <span className="text-slate-400 flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5 text-slate-500" />
                            <span>Claimed by <strong className="text-slate-300">{claimingPlayer.name}</strong></span>
                          </span>
                        ) : (
                          <span className="text-emerald-400/80 font-medium">
                            Available for selection
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Team Action Button */}
                  <div className="flex-shrink-0">
                    {isClaimedByMe ? (
                      <button
                        type="button"
                        onClick={handleReleaseTeam}
                        disabled={isReleasing}
                        className="px-3 py-1.5 rounded-lg bg-rose-950/70 hover:bg-rose-900 border border-rose-800 text-rose-300 hover:text-rose-200 text-xs font-bold uppercase transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        title="Release this franchise to choose another"
                      >
                        <Undo2 className="w-3.5 h-3.5" />
                        <span>{isReleasing ? 'Releasing...' : 'Release'}</span>
                      </button>
                    ) : isClaimedByOther ? (
                      <button
                        type="button"
                        disabled
                        className="px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/50 text-slate-500 text-xs font-semibold uppercase cursor-not-allowed flex items-center gap-1.5"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>Locked</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleClaimTeam(team.id)}
                        disabled={isClaimingThis}
                        className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 text-xs font-black uppercase tracking-wider transition shadow-md shadow-cyan-500/20 cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {isClaimingThis ? (
                          <>
                            <div className="w-3 h-3 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                            <span>Claiming...</span>
                          </>
                        ) : (
                          <>
                            <Shield className="w-3.5 h-3.5" />
                            <span>Claim Team</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
