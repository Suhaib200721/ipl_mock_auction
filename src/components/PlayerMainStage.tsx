import React, { useState, useEffect } from 'react';
import type { Player, Team } from '../types';
import { formatCurrency, getNextBidAmount } from '../utils/currencyUtils';
import { getPlayerFallbackSilhouette, getTeamFallbackLogo } from '../utils/imageUtils';
import { Gavel, Play, Pause, XCircle, SkipForward, FastForward, AlertCircle, Plane, Sparkles, CheckCircle2, ChevronUp } from 'lucide-react';

interface PlayerMainStageProps {
  player: Player | null;
  currentBid: number;
  highestBidder: Team | null;
  userTeam: Team;
  countdown: number;
  maxCountdown: number;
  isPaused: boolean;
  gameSpeed: number;
  canUserBid: boolean;
  userBidDisabledReason?: string;
  onPlaceUserBid: () => void;
  onPassPlayer: () => void;
  onSkipPlayer: () => void;
  onSkipSet: () => void;
  onTogglePause: () => void;
  onChangeSpeed: (speed: number) => void;
}

export const PlayerMainStage: React.FC<PlayerMainStageProps> = ({
  player,
  currentBid,
  highestBidder,
  userTeam,
  countdown,
  maxCountdown,
  isPaused,
  gameSpeed,
  canUserBid,
  userBidDisabledReason,
  onPlaceUserBid,
  onPassPlayer,
  onSkipPlayer,
  onSkipSet,
  onTogglePause,
  onChangeSpeed
}) => {
  const [imageLoaded, setImageLoaded] = useState(true);

  // Reset imageLoaded on every player or photo change
  useEffect(() => {
    setImageLoaded(true);
  }, [player?.id, player?.photoUrl]);

  if (!player) {
    return (
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-12 text-center flex flex-col items-center justify-center h-full">
        <Sparkles className="w-12 h-12 text-amber-400 mb-4 animate-spin" />
        <h2 className="text-xl font-bold text-slate-100">Preparing Next Lot...</h2>
        <p className="text-slate-400 text-sm mt-1">Auctioneer is bringing up the next player set.</p>
      </div>
    );
  }

  const isUserHighestBidder = highestBidder?.id === userTeam.id && currentBid > 0;
  const nextBid = currentBid === 0
    ? player.basePrice
    : getNextBidAmount(currentBid, player.basePrice);

  const isUrgent = countdown <= 3;
  const isMedium = countdown <= 6 && countdown > 3;

  // Percentage for progress bar (0% to 100%)
  const countdownPercentage = Math.max(0, Math.min(100, (countdown / maxCountdown) * 100));

  const roleBadgeColor =
    player.role === 'Batter'
      ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
      : player.role === 'Bowler'
      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
      : player.role === 'All-Rounder'
      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
      : 'bg-amber-500/20 text-amber-300 border-amber-500/40';

  const categoryBadgeColor =
    player.category === 'Marquee'
      ? 'bg-gradient-to-r from-amber-500/30 to-yellow-500/30 text-amber-300 border-amber-400/50 shadow-md shadow-amber-500/10'
      : 'bg-slate-800 text-slate-300 border-slate-700';

  return (
    <div className="bg-slate-900/95 border border-slate-800 rounded-xl p-4 md:p-6 flex flex-col justify-between shadow-2xl relative overflow-hidden h-full">
      {/* Stadium backdrop spotlight glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full blur-3xl opacity-10 pointer-events-none"
        style={{ backgroundColor: userTeam.primaryColor || '#eab308' }}
      />

      {/* Top Bar: Mode Badge & Controls */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-800 relative z-10">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${categoryBadgeColor}`}>
            ★ AUCTION SET: {player.category.toUpperCase()} LOT
          </span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            15S BIDDING CLOCK
          </span>
          <span className="text-xs text-slate-400 hidden sm:inline">
            Rating: <strong className="text-slate-200">{player.rating}/99</strong>
          </span>
        </div>

        {/* Speed Controls & Pause */}
        <div className="flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-lg border border-slate-800">
          <button
            onClick={onTogglePause}
            className={`p-1.5 rounded text-xs font-bold transition ${
              isPaused ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
            }`}
            title={isPaused ? 'Resume Auction' : 'Pause Auction'}
          >
            {isPaused ? <Play className="w-3.5 h-3.5 fill-current" /> : <Pause className="w-3.5 h-3.5 fill-current" />}
          </button>

          {[1, 2, 3].map(speed => (
            <button
              key={speed}
              onClick={() => onChangeSpeed(speed)}
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition ${
                gameSpeed === speed ? 'bg-slate-700 text-amber-300' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {speed}x
            </button>
          ))}
        </div>
      </div>

      {/* Center Spotlight: Player Info & Large Photo */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 my-4 items-center relative z-10">
        {/* Large Player Image Stage */}
        <div className="md:col-span-5 flex flex-col items-center">
          <div className="relative w-48 h-56 md:w-56 md:h-64 rounded-2xl bg-gradient-to-b from-slate-800 to-slate-950 border-2 border-slate-700/80 p-2 shadow-2xl flex items-center justify-center overflow-hidden group">
            {/* Country Pill */}
            <div className="absolute top-2 left-2 z-20 flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-950/80 backdrop-blur border border-slate-700 text-[10px] font-bold text-slate-200">
              {player.isOverseas ? <Plane className="w-3 h-3 text-sky-400" /> : <span>🇮🇳</span>}
              <span>{player.nationality}</span>
            </div>

            {/* Role Pill */}
            <div className={`absolute top-2 right-2 z-20 px-2 py-0.5 rounded-full text-[10px] font-bold border ${roleBadgeColor}`}>
              {player.role}
            </div>

            <img
              key={`${player.id}-${player.photoUrl}`}
              src={imageLoaded && player.photoUrl ? player.photoUrl : getPlayerFallbackSilhouette(player.name, player.role, player.nationality)}
              alt={player.name}
              onError={() => setImageLoaded(false)}
              className="max-h-full max-w-full object-contain filter drop-shadow-xl group-hover:scale-105 transition-transform duration-300"
            />

            {/* Previous Team Ribbon if available */}
            {player.previousTeam && (
              <div className="absolute bottom-2 left-2 right-2 z-20 py-1 px-2 rounded-lg bg-slate-950/90 border border-slate-800 text-[10px] text-center text-slate-300 flex items-center justify-between">
                <span>Prev: <strong>{player.previousTeam}</strong></span>
                {player.previousPrice && <span className="text-amber-400 font-mono">{player.previousPrice}</span>}
              </div>
            )}
          </div>
        </div>

        {/* Player Details & Real-Time Price Board */}
        <div className="md:col-span-7 flex flex-col justify-between space-y-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-1">
              Lot #{player.id} • Player Nomination
            </div>
            <h2 className="text-2xl md:text-4xl font-black text-slate-100 tracking-tight">
              {player.name}
            </h2>
            <div className="flex flex-wrap gap-2 text-xs text-slate-400 mt-2">
              <span className="px-2 py-1 rounded bg-slate-950 border border-slate-800">
                🏏 {player.battingStyle}
              </span>
              <span className="px-2 py-1 rounded bg-slate-950 border border-slate-800">
                🎯 {player.bowlingStyle}
              </span>
            </div>
          </div>

          {/* Pricing Board */}
          <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
            <div>
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Base Price
              </div>
              <div className="text-base font-bold font-mono text-slate-200 mt-0.5">
                {formatCurrency(player.basePrice)}
              </div>
            </div>

            <div className="text-right">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Your Current Bid
              </div>
              <div className="text-2xl font-black font-mono text-amber-400 animate-bid-pop mt-0.5">
                {currentBid > 0 ? formatCurrency(currentBid) : 'No Bid Placed'}
              </div>
            </div>
          </div>

          {/* Current Bid Status Card & 15s Timer Display */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-10 h-10 rounded-lg p-1.5 flex items-center justify-center bg-slate-900 border border-slate-700 flex-shrink-0"
                style={{ backgroundColor: isUserHighestBidder ? userTeam.primaryColor : '#1e293b' }}
              >
                {isUserHighestBidder ? (
                  <img
                    src={userTeam.logo}
                    alt={userTeam.shortName}
                    onError={(e) => {
                      e.currentTarget.src = getTeamFallbackLogo(userTeam.shortName, userTeam.primaryColor, userTeam.secondaryColor);
                    }}
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <Gavel className="w-5 h-5 text-slate-400" />
                )}
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Bidder Status
                </div>
                <div className="text-sm font-black text-slate-100 truncate">
                  {isUserHighestBidder ? (
                    <span className="flex items-center gap-1.5 text-emerald-400">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      Winning bid: {formatCurrency(currentBid)} • Hammer at 0s
                    </span>
                  ) : (
                    <span className="text-slate-400">
                      No bid placed • Marks Unsold at 0s
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Large 15s Real-Time Countdown Box */}
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
              <span className="text-[9px] uppercase font-bold text-slate-500 mt-1">Timer</span>
            </div>
          </div>

          {/* 15s Visual Linear Progress Bar */}
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

      {/* Bottom Action Controls: User BID / Raise / Pass */}
      <div className="pt-3 border-t border-slate-800 relative z-10">
        {/* User Bid Ineligibility Banner if any */}
        {!canUserBid && userBidDisabledReason && (
          <div className="mb-2.5 p-2 rounded-lg bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{userBidDisabledReason}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
          {/* Main Action Buttons */}
          <div className="lg:col-span-7 flex flex-col sm:flex-row gap-2">
            {currentBid === 0 ? (
              /* User has not bid yet -> Open Bid at Base Price (resets timer to 15s) */
              <button
                disabled={!canUserBid || isPaused}
                onClick={onPlaceUserBid}
                style={{
                  boxShadow: canUserBid ? '0 0 25px rgba(234, 179, 8, 0.35)' : 'none'
                }}
                className={`w-full py-4 px-6 rounded-xl font-black text-base md:text-lg uppercase tracking-wider flex items-center justify-center gap-3 transition-all duration-200 ${
                  canUserBid && !isPaused
                    ? 'bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 hover:from-amber-300 hover:to-yellow-200 text-slate-950 cursor-pointer scale-100 hover:scale-[1.02] active:scale-95'
                    : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-60'
                }`}
              >
                <Gavel className="w-6 h-6" />
                <span>BID BASE PRICE: {formatCurrency(player.basePrice)}</span>
              </button>
            ) : (
              /* User has placed a bid -> Can raise bid manually (resets timer to 15s) */
              <button
                disabled={!canUserBid || isPaused}
                onClick={onPlaceUserBid}
                className={`w-full py-4 px-6 rounded-xl font-black text-base md:text-lg uppercase tracking-wider flex items-center justify-center gap-2 transition-all duration-200 ${
                  canUserBid && !isPaused
                    ? 'bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 hover:from-amber-300 hover:to-yellow-200 text-slate-950 cursor-pointer scale-100 hover:scale-[1.02] active:scale-95 shadow-lg shadow-amber-500/20'
                    : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-60'
                }`}
              >
                <ChevronUp className="w-6 h-6" />
                <span>RAISE BID TO {formatCurrency(nextBid)} (RESETS 15S)</span>
              </button>
            )}
          </div>

          {/* Secondary Actions: Pass as Unsold, Skip Current Player, Skip Entire Set */}
          <div className="lg:col-span-5 grid grid-cols-3 gap-2">
            <button
              onClick={onPassPlayer}
              title="Pass player immediately — Mark as UNSOLD"
              className="py-3.5 px-2 rounded-xl bg-slate-800 hover:bg-rose-950/60 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-800 text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <XCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
              <span className="truncate">Pass</span>
            </button>

            <button
              onClick={onSkipPlayer}
              title="Skip current player and move to next player in set (marked UNSOLD)"
              className="py-3.5 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <SkipForward className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
              <span className="truncate">Skip Player</span>
            </button>

            <button
              onClick={onSkipSet}
              title="Skip remaining players in this set and jump directly to next auction set (marked UNSOLD)"
              className="py-3.5 px-2 rounded-xl bg-slate-800 hover:bg-amber-950/50 text-slate-300 hover:text-amber-300 border border-slate-700 hover:border-amber-600/60 text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <FastForward className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              <span className="truncate">Skip Set</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
