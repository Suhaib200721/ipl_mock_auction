import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import type { Player, Team } from '../types';
import { formatCurrency } from '../utils/currencyUtils';
import { getPlayerFallbackSilhouette, getTeamFallbackLogo } from '../utils/imageUtils';
import { Trophy, ArrowRight } from 'lucide-react';

interface SoldOverlayProps {
  player: Player;
  winningTeam: Team;
  finalPrice: number;
  userTeamId: string;
  onNext: () => void;
}

export const SoldOverlay: React.FC<SoldOverlayProps> = ({
  player,
  winningTeam,
  finalPrice,
  userTeamId,
  onNext
}) => {
  const isUserWinner = winningTeam.id === userTeamId;

  useEffect(() => {
    // Fire festive confetti bursts
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
      setTimeout(() => {
        confetti({
          particleCount: 50,
          angle: 60,
          spread: 55,
          origin: { x: 0 }
        });
        confetti({
          particleCount: 50,
          angle: 120,
          spread: 55,
          origin: { x: 1 }
        });
      }, 250);
    } catch {
      // Ignore if canvas is unavailable
    }
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-bid-pop">
      <div
        className="relative max-w-lg w-full rounded-2xl bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 border-4 shadow-2xl p-6 md:p-8 text-center overflow-hidden"
        style={{
          borderColor: winningTeam.primaryColor || '#eab308',
          boxShadow: `0 0 50px ${winningTeam.primaryColor}88`
        }}
      >
        {/* Animated SOLD Gold Stamp */}
        <div className="inline-block transform -rotate-6 px-8 py-2 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-slate-950 font-black text-3xl md:text-5xl uppercase tracking-widest shadow-2xl border-4 border-yellow-200 mb-6 animate-stamp-sold">
          SOLD!
        </div>

        {/* User Victory Ribbon if user bought the player */}
        {isUserWinner && (
          <div className="mb-4 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-black uppercase tracking-wider">
            <Trophy className="w-4 h-4 text-emerald-400" />
            CONGRATULATIONS! PLAYER SECURED FOR YOUR SQUAD
          </div>
        )}

        {/* Player Spotlight Card */}
        <div className="flex items-center justify-center gap-6 my-4">
          <div className="w-28 h-32 rounded-xl bg-slate-950 border-2 border-slate-700 p-1 flex items-center justify-center overflow-hidden shadow-xl">
            <img
              src={player.photoUrl}
              alt={player.name}
              onError={(e) => {
                e.currentTarget.src = getPlayerFallbackSilhouette(player.name, player.role, player.nationality);
              }}
              className="max-h-full max-w-full object-contain"
            />
          </div>

          <div className="text-left">
            <div className="text-xs font-bold text-amber-400 uppercase tracking-wider">
              {player.role} • {player.nationality}
            </div>
            <h3 className="text-2xl font-black text-slate-100">
              {player.name}
            </h3>
            <div className="text-xs text-slate-400 mt-1">
              Base Price: {formatCurrency(player.basePrice)}
            </div>
          </div>
        </div>

        {/* Winning Franchise & Price Banner */}
        <div className="my-6 p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-xl p-1.5 flex items-center justify-center bg-slate-900 border border-slate-700 shadow-md"
              style={{ backgroundColor: winningTeam.primaryColor }}
            >
              <img
                src={winningTeam.logo}
                alt={winningTeam.shortName}
                onError={(e) => {
                  e.currentTarget.src = getTeamFallbackLogo(winningTeam.shortName, winningTeam.primaryColor, winningTeam.secondaryColor);
                }}
                className="max-h-full max-w-full object-contain"
              />
            </div>
            <div className="text-left">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Winning Franchise
              </div>
              <div className="text-base font-black text-slate-100">
                {winningTeam.name}
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Winning Price
            </div>
            <div className="text-2xl font-black font-mono text-amber-400">
              {formatCurrency(finalPrice)}
            </div>
          </div>
        </div>

        {/* Next Player button */}
        <button
          onClick={onNext}
          className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black uppercase tracking-wider text-sm shadow-xl shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer scale-100 hover:scale-105"
        >
          <span>Continue Auction</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
