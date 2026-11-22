import React, { useState, useEffect } from 'react';
import {
  Gavel,
  Play,
  Pause,
  SkipForward,
  FastForward,
  AlertCircle,
  Plane,
  Sparkles,
  CheckCircle2,
  Users,
  Crown
} from 'lucide-react';
import type { MultiplayerRoomState, PlayerCategory } from '../../types';
import { formatCurrency, getNextBidAmount } from '../../utils/currencyUtils';
import { getPlayerFallbackSilhouette, getTeamFallbackLogo } from '../../utils/imageUtils';
import {
  placeMultiplayerBid,
  advanceMultiplayerLot,
  skipMultiplayerSet,
  toggleMultiplayerPause
} from '../../services/socketService';
import { QueueBottomPanel } from '../QueueBottomPanel';
import { SoldOverlay } from '../SoldOverlay';
import { UnsoldOverlay } from '../UnsoldOverlay';
import { SquadModal } from '../SquadModal';
import { validateBid } from '../../engine/squadRules';
import { DEFAULT_RULES } from '../../utils/currencyUtils';

interface MultiplayerAuctionScreenProps {
  room: MultiplayerRoomState;
  currentUserId: string;
  onLeaveRoom: () => void;
  onOpenSquads: () => void;
}

export const MultiplayerAuctionScreen: React.FC<MultiplayerAuctionScreenProps> = ({
  room,
  currentUserId,
  onLeaveRoom: _onLeaveRoom,
  onOpenSquads: _onOpenSquads
}) => {
  const [imageLoaded, setImageLoaded] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<PlayerCategory | 'All'>('All');
  const [bidError, setBidError] = useState<string | null>(null);
  const [isBidding, setIsBidding] = useState(false);
  const [inspectSquadsOpen, setInspectSquadsOpen] = useState(false);

  // Robust player & team identity resolution (with session recovery fallback)
  const effectiveUserId = currentUserId || (typeof window !== 'undefined' ? sessionStorage.getItem('ipl_player_id') || '' : '');
  const me = room.players.find(p => p.id === effectiveUserId);
  const isHost = me?.isHost || false;
  const myTeam = room.teams.find(t => t.id === me?.teamId);

  const currentLot = room.playerPool[room.currentPlayerIndex] || null;
  const highestBidderTeam = room.teams.find(t => t.id === room.highestBidderTeamId) || null;
  const isMeHighestBidder = room.highestBidderId === effectiveUserId || (myTeam != null && room.highestBidderTeamId === myTeam.id);

  // Reset imageLoaded on every currentLot change
  useEffect(() => {
    setImageLoaded(true);
  }, [currentLot?.id, currentLot?.photoUrl]);

  // Synchronize bidding loading state whenever this user's franchise holds the highest bid
  useEffect(() => {
    if (myTeam && room.highestBidderTeamId === myTeam.id) {
      setIsBidding(false);
      setBidError(null);
    }
  }, [room.highestBidderTeamId, myTeam?.id]);

  const countdown = room.countdown;
  const maxCountdown = room.settings.timerSeconds || 15;
  const isUrgent = countdown <= 3;
  const isMedium = countdown <= 6 && countdown > 3;
  const countdownPercentage = Math.max(0, Math.min(100, (countdown / maxCountdown) * 100));

  const nextBid = currentLot
    ? (room.currentBid === 0 ? currentLot.basePrice : getNextBidAmount(room.currentBid, currentLot.basePrice))
    : 0;

  // Validation for user's bid
  let canBid = false;
  let validationReason = '';

  if (!myTeam) {
    validationReason = 'You are a spectator without a team.';
  } else if (!currentLot) {
    validationReason = 'No active player lot.';
  } else if (isMeHighestBidder) {
    validationReason = 'You already hold the highest bid!';
  } else if (room.isPaused) {
    validationReason = 'Auction is paused by host.';
  } else if (countdown <= 0) {
    validationReason = 'Timer has expired.';
  } else {
    const val = validateBid(myTeam, currentLot, nextBid, DEFAULT_RULES);
    canBid = val.isValid;
    validationReason = val.reason || '';
  }

  // Handle placing real-time multiplayer bid (with multi-client payload sync)
  const handlePlaceBid = async () => {
    if (isBidding) return;
    setIsBidding(true);
    setBidError(null);

    const timestamp = new Date().toISOString();
    console.log(`[BID UI ${timestamp}][CLICK] Bid button clicked:`, {
      effectiveUserId,
      playerId: me?.id,
      teamId: myTeam?.id,
      roomCode: room.roomCode,
      nextBid,
      currentBid: room.currentBid,
      highestBidderId: room.highestBidderId,
      highestBidderTeamId: room.highestBidderTeamId
    });

    try {
      const res = await placeMultiplayerBid({
        roomCode: room.roomCode,
        playerId: effectiveUserId || me?.id,
        teamId: myTeam?.id,
        amount: nextBid
      });

      console.log(`[BID UI ${new Date().toISOString()}][RESULT] placeMultiplayerBid resolved:`, res);

      if (!res.success) {
        console.warn(`[BID UI ${new Date().toISOString()}][REJECTED] Bid error:`, res.error);
        setBidError(res.error || 'Bid rejected by server.');
      }
    } catch (err: any) {
      console.error(`[BID UI ${new Date().toISOString()}][ERROR]`, err);
      setBidError(err?.message || 'Error executing bid.');
    } finally {
      setIsBidding(false);
    }
  };

  // Host advances lot (Skip Current Player)
  const handleNextLot = async () => {
    setBidError(null);
    const res = await advanceMultiplayerLot({
      roomCode: room.roomCode,
      playerId: effectiveUserId || me?.id
    });
    if (!res.success) {
      setBidError(res.error || 'Failed to advance lot.');
    }
  };

  // Host skips entire set
  const handleSkipSet = async () => {
    setBidError(null);
    const res = await skipMultiplayerSet({
      roomCode: room.roomCode,
      playerId: effectiveUserId || me?.id
    });
    if (!res.success) {
      setBidError(res.error || 'Failed to skip set.');
    }
  };

  // Host toggles pause
  const handleTogglePause = async () => {
    setBidError(null);
    const res = await toggleMultiplayerPause({
      roomCode: room.roomCode,
      playerId: effectiveUserId || me?.id
    });
    if (!res.success) {
      setBidError(res.error || 'Failed to toggle pause.');
    }
  };

  const upcomingPlayers = room.playerPool.filter((p, idx) => idx > room.currentPlayerIndex && p.status === 'upcoming');

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto p-3 md:p-4 flex flex-col gap-4">
      {/* Top Multiplayer Broadcast Status Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl px-4 py-2.5 flex items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
              LIVE MULTIPLAYER
            </span>
          </div>
          <span className="text-xs text-slate-500">•</span>
          <div className="text-xs text-slate-300 font-mono">
            Room: <strong className="text-cyan-400">{room.roomCode}</strong>
          </div>
          <span className="text-xs text-slate-500 hidden sm:inline">•</span>
          <div className="text-xs text-slate-400 hidden sm:inline">
            Managers: <strong className="text-slate-200">{room.players.length}/10</strong>
          </div>
        </div>

        {/* User Team & Purse */}
        {myTeam && (
          <div className="flex items-center gap-3">
            <div
              className="w-7 h-7 rounded flex items-center justify-center font-black text-[10px] text-white p-0.5"
              style={{ backgroundColor: myTeam.primaryColor }}
            >
              <img
                src={myTeam.logo}
                alt={myTeam.shortName}
                onError={(e) => {
                  e.currentTarget.src = getTeamFallbackLogo(myTeam.shortName, myTeam.primaryColor, myTeam.secondaryColor);
                }}
                className="max-h-full max-w-full object-contain"
              />
            </div>
            <div className="text-right text-xs">
              <div className="font-bold text-slate-200 flex items-center gap-1.5 justify-end">
                <span>{myTeam.shortName}</span>
                <span className="text-amber-400 font-mono font-bold">
                  {formatCurrency(myTeam.currentPurse)}
                </span>
              </div>
              <div className="text-[10px] text-slate-400">
                Squad: {myTeam.squadCount}/25 • Overseas: {myTeam.overseasCount}/8
              </div>
            </div>
          </div>
        )}

        {/* Host Controls */}
        {isHost && (
          <div className="flex items-center gap-2 border-l border-slate-800 pl-3">
            <span className="text-[10px] uppercase font-bold text-amber-400 flex items-center gap-1">
              <Crown className="w-3.5 h-3.5" /> Host
            </span>
            <button
              onClick={handleTogglePause}
              className={`p-1.5 rounded-lg border text-xs font-bold transition ${
                room.isPaused
                  ? 'bg-amber-500 text-slate-950 border-amber-400'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
              }`}
              title={room.isPaused ? 'Resume Auction' : 'Pause Auction'}
            >
              {room.isPaused ? <Play className="w-3.5 h-3.5 fill-current" /> : <Pause className="w-3.5 h-3.5 fill-current" />}
            </button>
            <button
              onClick={handleNextLot}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
              title="Skip Current Player"
            >
              <SkipForward className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden md:inline">Skip Player</span>
            </button>
            <button
              onClick={handleSkipSet}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-amber-950/40 text-slate-300 hover:text-amber-300 border border-slate-700 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
              title="Skip Entire Set"
            >
              <FastForward className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden md:inline">Skip Set</span>
            </button>
          </div>
        )}
      </div>

      {/* Main 3-Column Auction Board */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1">
        {/* Left Panel: 10 IPL Franchises with Owners */}
        <div className="lg:col-span-3 order-2 lg:order-1 bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-col h-full shadow-lg">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
            <h3 className="text-xs font-black tracking-widest uppercase text-slate-300 flex items-center gap-2">
              <span>FRANCHISES</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">10</span>
            </h3>
            <button
              onClick={() => setInspectSquadsOpen(true)}
              className="text-[10px] text-cyan-400 font-bold hover:underline"
            >
              View Squads
            </button>
          </div>

          <div className="space-y-1.5 overflow-y-auto pr-1 flex-1 max-h-[640px]">
            {room.teams.map(team => {
              const isMyTeam = team.id === myTeam?.id;
              const isHighestBidder = team.id === room.highestBidderTeamId;
              const ownerPlayer = room.players.find(p => p.teamId === team.id);

              return (
                <div
                  key={team.id}
                  style={{
                    borderColor: isHighestBidder
                      ? '#eab308'
                      : isMyTeam
                      ? team.primaryColor
                      : 'rgba(51, 65, 85, 0.4)'
                  }}
                  className={`p-2 rounded-lg border transition-all flex items-center justify-between gap-2 ${
                    isHighestBidder
                      ? 'bg-amber-500/15 border-amber-400 shadow-md animate-pulse-glow'
                      : isMyTeam
                      ? 'bg-slate-950/90 border-2 shadow-md'
                      : team.isHumanControlled
                      ? 'bg-slate-950/50 hover:bg-slate-900 border-slate-800'
                      : 'bg-slate-950/20 border-slate-900 opacity-50'
                  }`}
                >
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
                        <span className="font-bold text-xs text-slate-200 truncate">
                          {team.shortName}
                        </span>
                        {isMyTeam ? (
                          <span className="px-1 py-0.2 rounded text-[9px] font-black uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                            YOU
                          </span>
                        ) : ownerPlayer ? (
                          <span className="text-[9px] text-slate-400 font-medium truncate">
                            ({ownerPlayer.name})
                          </span>
                        ) : (
                          <span className="text-[8px] text-slate-600 uppercase">
                            INACTIVE
                          </span>
                        )}
                        {isHighestBidder && (
                          <span className="px-1 py-0.2 rounded text-[9px] font-black uppercase bg-amber-400/20 text-amber-300 border border-amber-400/30">
                            WINNING
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">
                        {team.name}
                      </div>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <div className={`font-mono text-xs font-bold ${
                      team.isHumanControlled ? 'text-amber-400' : 'text-slate-500'
                    }`}>
                      {formatCurrency(team.currentPurse)}
                    </div>
                    <div className="text-[10px] text-slate-500 flex items-center justify-end gap-1.5">
                      <span>{team.squadCount}/25</span>
                      <span>•</span>
                      <span className="text-sky-400">{team.overseasCount}/8 ✈</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Center Panel: Spotlight Player & Live 15s Countdown */}
        <div className="lg:col-span-6 order-1 lg:order-2 bg-slate-900/95 border border-slate-800 rounded-xl p-4 md:p-6 flex flex-col justify-between shadow-2xl relative overflow-hidden">
          {currentLot ? (
            <>
              {/* Top Meta Bar */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-800 border border-slate-700 text-amber-400">
                  ★ AUCTION SET: {currentLot.category.toUpperCase()} LOT • MULTIPLAYER
                </span>
                <span className="text-xs text-slate-400">
                  Rating: <strong className="text-slate-200">{currentLot.rating}/99</strong>
                </span>
              </div>

              {/* Player Image and Details */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 my-4 items-center">
                <div className="md:col-span-5 flex flex-col items-center">
                  <div className="relative w-48 h-56 md:w-52 md:h-60 rounded-2xl bg-gradient-to-b from-slate-800 to-slate-950 border-2 border-slate-700/80 p-2 shadow-2xl flex items-center justify-center overflow-hidden">
                    <div className="absolute top-2 left-2 z-20 flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-950/80 backdrop-blur border border-slate-700 text-[10px] font-bold text-slate-200">
                      {currentLot.isOverseas ? <Plane className="w-3 h-3 text-sky-400" /> : <span>🇮🇳</span>}
                      <span>{currentLot.nationality}</span>
                    </div>

                    <div className="absolute top-2 right-2 z-20 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-200 border border-slate-700">
                      {currentLot.role}
                    </div>

                    <img
                      key={`${currentLot.id}-${currentLot.photoUrl}`}
                      src={imageLoaded && currentLot.photoUrl ? currentLot.photoUrl : getPlayerFallbackSilhouette(currentLot.name, currentLot.role, currentLot.nationality)}
                      alt={currentLot.name}
                      onError={() => setImageLoaded(false)}
                      className="max-h-full max-w-full object-contain filter drop-shadow-xl"
                    />

                    {currentLot.previousTeam && (
                      <div className="absolute bottom-2 left-2 right-2 z-20 py-1 px-2 rounded-lg bg-slate-950/90 border border-slate-800 text-[10px] text-center text-slate-300 flex items-center justify-between">
                        <span>Prev: <strong>{currentLot.previousTeam}</strong></span>
                        {currentLot.previousPrice && <span className="text-amber-400 font-mono">{currentLot.previousPrice}</span>}
                      </div>
                    )}
                  </div>
                </div>

                <div className="md:col-span-7 flex flex-col justify-between space-y-3.5">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-1">
                      Lot #{currentLot.id} • Live Auction
                    </div>
                    <h2 className="text-2xl md:text-3xl font-black text-slate-100 tracking-tight">
                      {currentLot.name}
                    </h2>
                    <div className="flex flex-wrap gap-2 text-xs text-slate-400 mt-1.5">
                      <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800">
                        🏏 {currentLot.battingStyle}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800">
                        🎯 {currentLot.bowlingStyle}
                      </span>
                    </div>
                  </div>

                  {/* Pricing Board */}
                  <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                    <div>
                      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                        Base Price
                      </div>
                      <div className="text-base font-bold font-mono text-slate-200 mt-0.5">
                        {formatCurrency(currentLot.basePrice)}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                        Current Bid
                      </div>
                      <div className="text-2xl font-black font-mono text-amber-400 animate-bid-pop mt-0.5">
                        {room.currentBid > 0 ? formatCurrency(room.currentBid) : 'No Bids Yet'}
                      </div>
                    </div>
                  </div>

                  {/* Highest Bidder & 15s Timer Box */}
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-10 h-10 rounded-lg p-1.5 flex items-center justify-center bg-slate-900 border border-slate-700 flex-shrink-0"
                        style={{ backgroundColor: highestBidderTeam?.primaryColor || '#1e293b' }}
                      >
                        {highestBidderTeam ? (
                          <img
                            src={highestBidderTeam.logo}
                            alt={highestBidderTeam.shortName}
                            onError={(e) => {
                              e.currentTarget.src = getTeamFallbackLogo(highestBidderTeam.shortName, highestBidderTeam.primaryColor, highestBidderTeam.secondaryColor);
                            }}
                            className="max-h-full max-w-full object-contain"
                          />
                        ) : (
                          <Gavel className="w-5 h-5 text-slate-400" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Highest Bidder
                        </div>
                        <div className="text-xs font-black text-slate-100 truncate">
                          {highestBidderTeam ? (
                            <span className="flex items-center gap-1.5 text-amber-300">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                              {highestBidderTeam.shortName} ({room.highestBidderName}) {isMeHighestBidder && '★ YOU'}
                            </span>
                          ) : (
                            <span className="text-slate-500">Waiting for first bid...</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 15s Countdown Box */}
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div className={`flex flex-col items-center justify-center w-14 h-14 rounded-xl font-mono font-black text-2xl border-2 transition-all shadow-lg ${
                        isUrgent
                          ? 'bg-rose-500/20 text-rose-400 border-rose-500 animate-pulse shadow-rose-500/20'
                          : isMedium
                          ? 'bg-amber-500/20 text-amber-400 border-amber-500 shadow-amber-500/20'
                          : 'bg-slate-900 text-slate-200 border-slate-700'
                      }`}>
                        <span>{countdown}s</span>
                      </div>
                    </div>
                  </div>

                  {/* 15s Progress Bar */}
                  <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className={`h-full transition-all duration-300 rounded-full ${
                        isUrgent ? 'bg-rose-500' : isMedium ? 'bg-amber-400' : 'bg-emerald-400'
                      }`}
                      style={{ width: `${countdownPercentage}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Bidding Controls */}
              <div className="pt-3 border-t border-slate-800">
                {bidError && (
                  <div className="mb-2 p-2 rounded-lg bg-rose-950/50 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{bidError}</span>
                  </div>
                )}
                {!canBid && validationReason && (
                  <div className="mb-2 p-1.5 rounded-lg bg-slate-950 text-slate-400 text-[11px] text-center border border-slate-800">
                    {validationReason}
                  </div>
                )}

                <button
                  disabled={!canBid || isBidding}
                  onClick={handlePlaceBid}
                  style={{
                    boxShadow: canBid && !isBidding ? '0 0 25px rgba(234, 179, 8, 0.35)' : 'none'
                  }}
                  className={`w-full py-4 px-6 rounded-xl font-black text-base md:text-lg uppercase tracking-wider flex items-center justify-center gap-3 transition-all duration-200 ${
                    canBid && !isBidding
                      ? 'bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 hover:from-amber-300 hover:to-yellow-200 text-slate-950 cursor-pointer scale-100 hover:scale-[1.02] active:scale-95'
                      : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-60'
                  }`}
                >
                  {isBidding ? (
                    <>
                      <Sparkles className="w-6 h-6 animate-spin text-amber-400" />
                      <span>SUBMITTING BID...</span>
                    </>
                  ) : (
                    <>
                      <Gavel className="w-6 h-6" />
                      <span>
                        {isMeHighestBidder
                          ? 'YOU HOLD HIGHEST BID'
                          : room.currentBid === 0
                          ? `BID BASE PRICE: ${formatCurrency(currentLot.basePrice)}`
                          : `BID ${formatCurrency(nextBid)} (RESETS 15S)`}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            <div className="py-20 text-center flex flex-col items-center justify-center">
              <Sparkles className="w-12 h-12 text-amber-400 mb-3 animate-spin" />
              <h3 className="text-xl font-bold text-slate-200">Auction Completed or Inactive</h3>
            </div>
          )}
        </div>

        {/* Right Panel: Live Synchronized Bid Ticker Feed */}
        <div className="lg:col-span-3 order-3 bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-col h-full shadow-lg">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
            <h3 className="text-xs font-black tracking-widest uppercase text-slate-300 flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-cyan-400" />
              <span>LIVE BID TICKER</span>
            </h3>
            <span className="text-[10px] text-slate-400 font-medium">Real-Time Sync</span>
          </div>

          <div className="mb-3 p-2.5 rounded-lg bg-slate-950/80 border border-amber-500/30 flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping flex-shrink-0" />
            <div className="text-xs font-bold text-amber-300 leading-snug">
              {room.auctioneerCall}
            </div>
          </div>

          <div className="space-y-2 overflow-y-auto pr-1 flex-1 max-h-[580px]">
            {room.bidHistory.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                No bids placed yet for this lot.
                <div className="text-[11px] text-slate-600 mt-1">
                  Connected managers can raise paddle to open bidding.
                </div>
              </div>
            ) : (
              room.bidHistory.map((bid, index) => {
                const isLatest = index === 0;
                const isMe = bid.bidderName === me?.name;

                return (
                  <div
                    key={bid.id}
                    className={`p-2.5 rounded-lg border transition-all ${
                      isLatest
                        ? 'bg-amber-500/10 border-amber-400/80 shadow-md animate-bid-pop'
                        : 'bg-slate-950/50 border-slate-800/80 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5 truncate">
                          <span>{bid.teamShortName}</span>
                          <span className="text-slate-400 font-normal">({bid.bidderName})</span>
                          {isMe && (
                            <span className="text-[8px] px-1 py-0.2 rounded bg-cyan-400/20 text-cyan-300 font-black">
                              YOU
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {new Date(bid.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                      </div>

                      <div className="font-mono text-xs font-black text-amber-400 flex-shrink-0">
                        {formatCurrency(bid.amount)}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Bottom Panel: Upcoming Queue */}
      <div className="w-full">
        <QueueBottomPanel
          upcomingPlayers={upcomingPlayers}
          selectedCategory={selectedCategory}
          onSelectCategory={cat => setSelectedCategory(cat)}
          onJumpToPlayer={() => {}}
          currentIndex={room.currentPlayerIndex}
          totalPlayers={room.playerPool.length}
        />
      </div>

      {/* Synchronized SOLD Overlay */}
      {room.lastResolvedLot?.type === 'sold' && room.lastResolvedLot.winningTeam && (
        <SoldOverlay
          player={room.lastResolvedLot.player}
          winningTeam={room.lastResolvedLot.winningTeam}
          finalPrice={room.lastResolvedLot.price || 0}
          userTeamId={myTeam?.id || ''}
          onNext={() => {
            if (isHost) handleNextLot();
          }}
        />
      )}

      {/* Synchronized UNSOLD Overlay */}
      {room.lastResolvedLot?.type === 'unsold' && (
        <UnsoldOverlay
          player={room.lastResolvedLot.player}
          onNext={() => {
            if (isHost) handleNextLot();
          }}
        />
      )}

      {/* Squad Inspection Modal */}
      {inspectSquadsOpen && (
        <SquadModal
          teams={room.teams}
          initialSelectedTeamId={myTeam?.id || 'MI'}
          onClose={() => setInspectSquadsOpen(false)}
        />
      )}
    </div>
  );
};
